jest.mock('ioredis', () => require('../../_mocks/ioredis'));
const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const orderModel = require('../../src/models/order.model');
const tenantModel = require('../../src/models/tenant.model');
const transactionModel = require('../../src/models/transaction.model');
const userModel = require('../../src/models/user.model');

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'testsecret';
  process.env.REDIS_URL = 'redis://localhost';
  await mongoose.connect(process.env.MONGODB_URI);
  app = require('../../src/app');
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
});

afterEach(async () => {
  if (mongoose.connection && mongoose.connection.db) {
    const collections = await mongoose.connection.db.collections();
    for (const c of collections) {
      await c.deleteMany({});
    }
  }
  if (global.__redis_subscribers) global.__redis_subscribers.length = 0;
});

test('full flow: register, create tenant, secure order, transaction, payment publish', async () => {
  const hashed = await bcrypt.hash('secret123', 10);
  await userModel.create({ email: 'admin@example.com', password: hashed, role: 'SUPER_ADMIN' });

  const loginRes = await request(app)
    .post('/auth/login')
    .send({ email: 'admin@example.com', password: 'secret123' })
    .expect(200);

  expect(loginRes.body.data.user.email).toBe('admin@example.com');

  const tenantToken = loginRes.body.data.token;

  const tenantRes = await request(app)
    .post('/tenants')
    .set('Authorization', `Bearer ${tenantToken}`)
    .send({ name: 'Test Tenant', menu: [{ name: 'Tea', price: 5000, stock: 20 }, { name: 'Coffee', price: 15000, stock: 20 }] })
    .expect(201);

  const tenant = tenantRes.body.data;
  expect(tenant.name).toBe('Test Tenant');

  const menu = (await request(app).get(`/tenants/${tenant._id}/menu`).expect(200)).body.data;
  const tea = menu.find((m) => m.name === 'Tea');

  const orderRes = await request(app)
    .post('/orders')
    .send({ tenantId: tenant._id, items: [{ menuItemId: tea._id, name: 'Tea', price: 1, quantity: 2 }] })
    .expect(201);

  const order = orderRes.body.data;
  expect(order.total).toBe(tea.price * 2);

  const txRes = await request(app)
    .post('/transactions')
    .send({ customerName: 'John', customerPhone: '08123', items: [{ tenantId: tenant._id, menuItemId: tea._id, name: 'Tea', quantity: 3 }] })
    .expect(201);

  const tx = txRes.body.data;
  expect(tx.grandTotal).toBe(tea.price * 3);

  const Redis = require('ioredis');
  const sub = new Redis();
  let received = null;
  sub.on('message', (_ch, msg) => {
    received = msg;
  });

  const payRes = await request(app)
    .post('/payments')
    .set('Authorization', `Bearer ${tenantToken}`)
    .send({ transactionId: tx._id, method: 'manual' })
    .expect(200);

  expect(payRes.body.data.payment.status).toBe('success');
  expect(payRes.body.data.transaction.paymentStatus).toBe('paid');
  expect(payRes.body.data.transaction.paymentMethod).toBe('manual');

  await new Promise((r) => setTimeout(r, 50));
  expect(received).not.toBeNull();
  const payload = JSON.parse(received);
  expect(payload.event).toBe('ORDER_PAID');
  expect(payload.order.status).toBe('paid');
});

test('payment rollback keeps transaction and orders pending when a later order update fails', async () => {
  const hashed = await bcrypt.hash('secret123', 10);
  await userModel.create({ email: 'rollback-admin@example.com', password: hashed, role: 'SUPER_ADMIN' });

  const loginRes = await request(app)
    .post('/auth/login')
    .send({ email: 'rollback-admin@example.com', password: 'secret123' })
    .expect(200);

  const token = loginRes.body.data.token;

  const tenantARes = await request(app)
    .post('/tenants')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Rollback Tenant A',
      menu: [{ name: 'Tea', price: 5000, stock: 10 }],
    })
    .expect(201);

  const tenantBRes = await request(app)
    .post('/tenants')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Rollback Tenant B',
      menu: [{ name: 'Coffee', price: 7000, stock: 10 }],
    })
    .expect(201);

  const tenantA = tenantARes.body.data;
  const tenantB = tenantBRes.body.data;
  const menuA = (await request(app).get(`/tenants/${tenantA._id}/menu`).expect(200)).body.data;
  const menuB = (await request(app).get(`/tenants/${tenantB._id}/menu`).expect(200)).body.data;
  const tea = menuA.find((item) => item.name === 'Tea');
  const coffee = menuB.find((item) => item.name === 'Coffee');

  const txRes = await request(app)
    .post('/transactions')
    .send({
      customerName: 'Rollback User',
      customerPhone: '08123',
      items: [
        { tenantId: tenantA._id, menuItemId: tea._id, name: 'Tea', quantity: 1 },
        { tenantId: tenantB._id, menuItemId: coffee._id, name: 'Coffee', quantity: 1 },
      ],
    })
    .expect(201);

  const tx = txRes.body.data;
  const originalOrderTransitionStatus = orderModel.transitionStatus;
  let callCount = 0;
  const transitionSpy = jest.spyOn(orderModel, 'transitionStatus').mockImplementation(async (...args) => {
    callCount += 1;
    if (callCount === 1) {
      return originalOrderTransitionStatus(...args);
    }

    throw new Error('forced order update failure');
  });

  const payRes = await request(app)
    .post('/payments')
    .set('Authorization', `Bearer ${token}`)
    .send({ transactionId: tx._id, method: 'manual' })
    .expect(500);

  expect(payRes.body.success).toBe(false);
  expect(payRes.body.message).toBe('forced order update failure');

  const persistedTransaction = await transactionModel.findById(tx._id);
  expect(persistedTransaction.paymentStatus).toBe('pending');
  expect(persistedTransaction.paymentMethod).toBe('');

  const persistedOrders = await Promise.all(
    persistedTransaction.orders.map((order) => orderModel.findById(order._id))
  );
  expect(persistedOrders).toHaveLength(2);
  expect(persistedOrders.every((order) => order.status === 'pending')).toBe(true);

  const persistedTenantA = await tenantModel.findById(tenantA._id);
  const persistedTenantB = await tenantModel.findById(tenantB._id);
  const persistedTea = persistedTenantA.menu.id(tea._id);
  const persistedCoffee = persistedTenantB.menu.id(coffee._id);

  expect(persistedTea.stock).toBe(9);
  expect(persistedTea.reserved).toBe(1);
  expect(persistedTea.sold).toBe(0);
  expect(persistedCoffee.stock).toBe(9);
  expect(persistedCoffee.reserved).toBe(1);
  expect(persistedCoffee.sold).toBe(0);

  transitionSpy.mockRestore();
});

test('duplicate payment request is idempotent and does not republish events', async () => {
  const hashed = await bcrypt.hash('secret123', 10);
  await userModel.create({ email: 'idempotent-admin@example.com', password: hashed, role: 'SUPER_ADMIN' });

  const loginRes = await request(app)
    .post('/auth/login')
    .send({ email: 'idempotent-admin@example.com', password: 'secret123' })
    .expect(200);

  const token = loginRes.body.data.token;

  const tenantRes = await request(app)
    .post('/tenants')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Idempotent Tenant', menu: [{ name: 'Latte', price: 12000, stock: 10 }] })
    .expect(201);

  const tenant = tenantRes.body.data;
  const menu = (await request(app).get(`/tenants/${tenant._id}/menu`).expect(200)).body.data;
  const latte = menu.find((item) => item.name === 'Latte');

  const txRes = await request(app)
    .post('/transactions')
    .send({ customerName: 'Retry User', customerPhone: '08123', items: [{ tenantId: tenant._id, menuItemId: latte._id, name: 'Latte', quantity: 1 }] })
    .expect(201);

  const tx = txRes.body.data;
  const Redis = require('ioredis');
  const sub = new Redis();
  const messages = [];
  sub.on('message', (_ch, msg) => {
    messages.push(msg);
  });

  const firstPayRes = await request(app)
    .post('/payments')
    .set('Authorization', `Bearer ${token}`)
    .send({ transactionId: tx._id, method: 'manual', paymentReference: 'idempotent-ref' })
    .expect(200);

  await new Promise((r) => setTimeout(r, 50));

  const secondPayRes = await request(app)
    .post('/payments')
    .set('Authorization', `Bearer ${token}`)
    .send({ transactionId: tx._id, method: 'manual', paymentReference: 'different-ref' })
    .expect(200);

  await new Promise((r) => setTimeout(r, 50));

  expect(messages).toHaveLength(1);
  expect(firstPayRes.body.data.transaction.paymentStatus).toBe('paid');
  expect(firstPayRes.body.data.payment.reference).toBe('idempotent-ref');
  expect(secondPayRes.body.data.transaction.paymentStatus).toBe('paid');
  expect(secondPayRes.body.data.payment.reference).toBe('idempotent-ref');

  const persistedTransaction = await transactionModel.findById(tx._id);
  expect(persistedTransaction.paymentStatus).toBe('paid');
  expect(persistedTransaction.paymentReference).toBe('idempotent-ref');
  expect(persistedTransaction.paymentMethod).toBe('manual');

  const persistedTenant = await tenantModel.findById(tenant._id);
  const persistedMenuItem = persistedTenant.menu.id(latte._id);
  expect(persistedMenuItem.stock).toBe(9);
  expect(persistedMenuItem.reserved).toBe(0);
  expect(persistedMenuItem.sold).toBe(1);
});

test('concurrent duplicate payment requests settle inventory once and publish once', async () => {
  const hashed = await bcrypt.hash('secret123', 10);
  await userModel.create({ email: 'concurrent-admin@example.com', password: hashed, role: 'SUPER_ADMIN' });

  const loginRes = await request(app)
    .post('/auth/login')
    .send({ email: 'concurrent-admin@example.com', password: 'secret123' })
    .expect(200);

  const token = loginRes.body.data.token;

  const tenantRes = await request(app)
    .post('/tenants')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Concurrent Tenant', menu: [{ name: 'Matcha', price: 18000, stock: 5 }] })
    .expect(201);

  const tenant = tenantRes.body.data;
  const menu = (await request(app).get(`/tenants/${tenant._id}/menu`).expect(200)).body.data;
  const matcha = menu.find((item) => item.name === 'Matcha');

  const txRes = await request(app)
    .post('/transactions')
    .send({ customerName: 'Concurrent User', customerPhone: '08123', items: [{ tenantId: tenant._id, menuItemId: matcha._id, name: 'Matcha', quantity: 2 }] })
    .expect(201);

  const tx = txRes.body.data;
  const Redis = require('ioredis');
  const sub = new Redis();
  const messages = [];
  sub.on('message', (_ch, msg) => {
    messages.push(msg);
  });

  const [firstResult, secondResult] = await Promise.all([
    request(app)
      .post('/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ transactionId: tx._id, method: 'manual', paymentReference: 'concurrent-ref-a' }),
    request(app)
      .post('/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ transactionId: tx._id, method: 'manual', paymentReference: 'concurrent-ref-b' }),
  ]);

  await new Promise((r) => setTimeout(r, 50));

  expect([200, 409]).toContain(firstResult.status);
  expect([200, 409]).toContain(secondResult.status);
  expect([firstResult.status, secondResult.status]).toContain(200);
  expect(messages).toHaveLength(1);

  const persistedTransaction = await transactionModel.findById(tx._id);
  expect(persistedTransaction.paymentStatus).toBe('paid');

  const persistedTenant = await tenantModel.findById(tenant._id);
  const persistedMenuItem = persistedTenant.menu.id(matcha._id);
  expect(persistedMenuItem.stock).toBe(3);
  expect(persistedMenuItem.reserved).toBe(0);
  expect(persistedMenuItem.sold).toBe(2);
});

test('transaction creation rejects insufficient stock without mutating inventory', async () => {
  const hashed = await bcrypt.hash('secret123', 10);
  await userModel.create({ email: 'stock-admin@example.com', password: hashed, role: 'SUPER_ADMIN' });

  const loginRes = await request(app)
    .post('/auth/login')
    .send({ email: 'stock-admin@example.com', password: 'secret123' })
    .expect(200);

  const token = loginRes.body.data.token;

  const tenantRes = await request(app)
    .post('/tenants')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Stock Tenant', menu: [{ name: 'Tea', price: 5000, stock: 1 }] })
    .expect(201);

  const tenant = tenantRes.body.data;
  const menu = (await request(app).get(`/tenants/${tenant._id}/menu`).expect(200)).body.data;
  const tea = menu.find((item) => item.name === 'Tea');

  const txRes = await request(app)
    .post('/transactions')
    .send({ customerName: 'John', customerPhone: '08123', items: [{ tenantId: tenant._id, menuItemId: tea._id, name: 'Tea', quantity: 2 }] })
    .expect(400);

  expect(txRes.body.success).toBe(false);
  expect(txRes.body.message).toContain('Insufficient stock');

  const persistedTenant = await tenantModel.findById(tenant._id);
  const persistedMenuItem = persistedTenant.menu.id(tea._id);
  expect(persistedMenuItem.stock).toBe(1);
  expect(persistedMenuItem.reserved).toBe(0);
  expect(persistedMenuItem.sold).toBe(0);
});

test('order status route enforces valid lifecycle transitions and tenant access', async () => {
  const hashed = await bcrypt.hash('secret123', 10);
  await userModel.create({ email: 'cp8-admin@example.com', password: hashed, role: 'SUPER_ADMIN' });
  await userModel.create({ email: 'cp8-tenant@example.com', password: hashed, role: 'TENANT_ADMIN', tenantId: new mongoose.Types.ObjectId() });

  const adminLoginRes = await request(app)
    .post('/auth/login')
    .send({ email: 'cp8-admin@example.com', password: 'secret123' })
    .expect(200);

  const adminToken = adminLoginRes.body.data.token;

  const tenantRes = await request(app)
    .post('/tenants')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Lifecycle Tenant', menu: [{ name: 'Tea', price: 5000, stock: 10 }] })
    .expect(201);

  const tenant = tenantRes.body.data;

  const tenantUser = await userModel.findByEmail('cp8-tenant@example.com');
  tenantUser.tenantId = tenant._id;
  await tenantUser.save();

  const tenantLoginRes = await request(app)
    .post('/auth/login')
    .send({ email: 'cp8-tenant@example.com', password: 'secret123' })
    .expect(200);

  const tenantToken = tenantLoginRes.body.data.token;

  const menu = (await request(app).get(`/tenants/${tenant._id}/menu`).expect(200)).body.data;
  const tea = menu.find((item) => item.name === 'Tea');

  const txRes = await request(app)
    .post('/transactions')
    .send({ customerName: 'Lifecycle User', customerPhone: '08123', items: [{ tenantId: tenant._id, menuItemId: tea._id, name: 'Tea', quantity: 1 }] })
    .expect(201);

  const tx = txRes.body.data;

  await request(app)
    .post('/payments')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ transactionId: tx._id, method: 'manual' })
    .expect(200);

  const paidTransaction = await transactionModel.findById(tx._id);
  const order = paidTransaction.orders[0];

  await request(app)
    .patch(`/orders/${order._id}/status`)
    .set('Authorization', `Bearer ${tenantToken}`)
    .send({ status: 'preparing' })
    .expect(200)
    .expect((res) => {
      expect(res.body.data.status).toBe('preparing');
    });

  await request(app)
    .patch(`/orders/${order._id}/status`)
    .set('Authorization', `Bearer ${tenantToken}`)
    .send({ status: 'ready' })
    .expect(200)
    .expect((res) => {
      expect(res.body.data.status).toBe('ready');
    });

  await request(app)
    .patch(`/orders/${order._id}/status`)
    .set('Authorization', `Bearer ${tenantToken}`)
    .send({ status: 'completed' })
    .expect(200)
    .expect((res) => {
      expect(res.body.data.status).toBe('completed');
    });

  const invalidOrderRes = await request(app)
    .post('/transactions')
    .send({ customerName: 'Invalid Lifecycle User', customerPhone: '08124', items: [{ tenantId: tenant._id, menuItemId: tea._id, name: 'Tea', quantity: 1 }] })
    .expect(201);

  const invalidTx = invalidOrderRes.body.data;

  const invalidPaymentRes = await request(app)
    .post('/payments')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ transactionId: invalidTx._id, method: 'manual' })
    .expect(200);

  const invalidOrderId = invalidPaymentRes.body.data.order._id;

  await request(app)
    .patch(`/orders/${invalidOrderId}/status`)
    .set('Authorization', `Bearer ${tenantToken}`)
    .send({ status: 'completed' })
    .expect(400);

  await request(app)
    .patch(`/orders/${invalidOrderId}/status`)
    .send({ status: 'preparing' })
    .expect(401);

  const outsiderHashed = await bcrypt.hash('secret123', 10);
  await userModel.create({ email: 'cp8-outsider@example.com', password: outsiderHashed, role: 'TENANT_ADMIN', tenantId: new mongoose.Types.ObjectId() });
  const outsiderLoginRes = await request(app)
    .post('/auth/login')
    .send({ email: 'cp8-outsider@example.com', password: 'secret123' })
    .expect(200);

  await request(app)
    .patch(`/orders/${invalidOrderId}/status`)
    .set('Authorization', `Bearer ${outsiderLoginRes.body.data.token}`)
    .send({ status: 'preparing' })
    .expect(403);
});

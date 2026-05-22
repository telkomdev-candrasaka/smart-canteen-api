jest.mock('ioredis', () => require('../_mocks/ioredis'));
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'testsecret';
  process.env.REDIS_URL = 'redis://localhost';
  // connect mongoose used by app when requiring
  await mongoose.connect(process.env.MONGODB_URI);
  // require app after env set
  app = require('../src/app');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  const collections = await mongoose.connection.db.collections();
  for (const c of collections) {
    await c.deleteMany({});
  }
  // clear redis mock subscribers
  if (global.__redis_subscribers) global.__redis_subscribers.length = 0;
});

test('full flow: register, create tenant, secure order, transaction, payment publish', async () => {
  // register
  const reg = await request(app)
    .post('/auth/register')
    .send({ email: 'admin@example.com', password: 'secret123', role: 'SUPER_ADMIN' })
    .expect(201);

  expect(reg.body.data.user.email).toBe('admin@example.com');

  // create tenant with menu
  const tenantRes = await request(app)
    .post('/tenants')
    .send({ name: 'Test Tenant', menu: [{ name: 'Tea', price: 5000 }, { name: 'Coffee', price: 15000 }] })
    .expect(201);

  const tenant = tenantRes.body.data;
  expect(tenant.name).toBe('Test Tenant');

  // get menu and create order using wrong price from client
  const menu = (await request(app).get(`/tenants/${tenant._id}/menu`).expect(200)).body.data;
  const tea = menu.find((m) => m.name === 'Tea');

  const orderRes = await request(app)
    .post('/orders')
    .send({ tenantId: tenant._id, items: [{ menuItemId: tea._id, name: 'Tea', price: 1, quantity: 2 }] })
    .expect(201);

  const order = orderRes.body.data;
  expect(order.total).toBe(tea.price * 2);

  // create transaction across tenants (single)
  const txRes = await request(app)
    .post('/transactions')
    .send({ customerName: 'John', customerPhone: '08123', items: [{ tenantId: tenant._id, menuItemId: tea._id, name: 'Tea', quantity: 3 }] })
    .expect(201);

  const tx = txRes.body.data;
  expect(tx.grandTotal).toBe(tea.price * 3);

  // process payment and expect Redis publish to have been invoked (mock will call subscriber handlers)
  // create a subscriber instance to capture published message
  const Redis = require('ioredis');
  const sub = new Redis();
  let received = null;
  sub.on('message', (_ch, msg) => {
    received = msg;
  });

  const payRes = await request(app)
    .post('/payments')
    .send({ orderId: order._id, method: 'manual' })
    .expect(200);

  expect(payRes.body.data.payment.status).toBe('success');

  // allow event loop to process publish
  await new Promise((r) => setTimeout(r, 50));
  expect(received).not.toBeNull();
  const payload = JSON.parse(received);
  expect(payload.event).toBe('ORDER_PAID');
  expect(payload.order._id).toBe(order._id);
});

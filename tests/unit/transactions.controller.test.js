const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const transactionsController = require('../../src/controllers/transactions.controller');
const tenantModel = require('../../src/models/tenant.model');
const transactionModel = require('../../src/models/transaction.model');
const orderModel = require('../../src/models/order.model');

let mongod;
beforeAll(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
});

afterEach(async () => {
  if (mongoose.connection && mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
  }
});

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

test('createTransaction returns 400 when customerName or customerPhone is missing', async () => {
  const req = { body: { customerPhone: '081234', items: [] } };
  const res = mockRes();
  const next = jest.fn();

  await transactionsController.createTransaction(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('createTransaction returns 400 when items array is empty', async () => {
  const req = { body: { customerName: 'Test', customerPhone: '081234', items: [] } };
  const res = mockRes();
  const next = jest.fn();

  await transactionsController.createTransaction(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('createTransaction returns 400 when an item has no tenantId', async () => {
  const req = { body: { customerName: 'Test', customerPhone: '081234', items: [{ menuItemId: new mongoose.Types.ObjectId().toString(), quantity: 1 }] } };
  const res = mockRes();
  const next = jest.fn();

  await transactionsController.createTransaction(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('createTransaction returns 400 when tenantId is invalid', async () => {
  const req = { body: { customerName: 'Test', customerPhone: '081234', items: [{ tenantId: new mongoose.Types.ObjectId().toString(), name: 'Water', quantity: 1 }] } };
  const res = mockRes();
  const next = jest.fn();

  await transactionsController.createTransaction(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('createTransaction returns 201 and stores transaction with orders', async () => {
  const tenant = await tenantModel.create({ name: 'Multi Shop', menu: [{ name: 'Soda', price: 3000, stock: 10, reserved: 0, sold: 0 }] });
  const req = {
    body: {
      customerName: ' Alice ',
      customerPhone: '0812345678',
      tableNumber: ' 2 ',
      items: [{ tenantId: tenant._id.toString(), name: 'Soda', quantity: 2 }],
    },
  };
  const res = mockRes();
  const next = jest.fn();

  await transactionsController.createTransaction(req, res, next);

  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.objectContaining({ grandTotal: 6000, orders: expect.any(Array) }) }));
  const responseBody = res.json.mock.calls[0][0];
  expect(responseBody.data.paymentStatus).toBe('pending');
  expect(responseBody.data.paymentMethod).toBe('');
  const persistedTenant = await tenantModel.findById(tenant._id);
  expect(persistedTenant.menu[0].stock).toBe(8);
  expect(persistedTenant.menu[0].reserved).toBe(2);
});

test('createTransaction handles repeated tenant grouping, default quantity, and zero price items', async () => {
  const tenant = await tenantModel.create({ name: 'Combo Shop', menu: [{ name: 'Free Water', price: 0, stock: 10, reserved: 0, sold: 0 }] });
  const req = {
    body: {
      customerName: ' Alice ',
      customerPhone: '0812345678',
      items: [
        { tenantId: tenant._id.toString(), name: 'Free Water' },
        { tenantId: tenant._id.toString(), name: 'Free Water', quantity: 2 },
      ],
    },
  };
  const res = mockRes();
  const next = jest.fn();

  await transactionsController.createTransaction(req, res, next);

  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.objectContaining({ grandTotal: 0 }) }));
  const persistedTenant = await tenantModel.findById(tenant._id);
  expect(persistedTenant.menu[0].stock).toBe(7);
  expect(persistedTenant.menu[0].reserved).toBe(3);
});

test('createTransaction returns 400 when menu item is missing without name fallback', async () => {
  const tenant = await tenantModel.create({ name: 'Missing Menu Shop', menu: [{ name: 'Tea', price: 5000, stock: 5, reserved: 0, sold: 0 }] });
  const req = {
    body: {
      customerName: 'Alice',
      customerPhone: '08123',
      items: [{ tenantId: tenant._id.toString(), menuItemId: new mongoose.Types.ObjectId().toString(), quantity: 1 }],
    },
  };
  const res = mockRes();
  const next = jest.fn();

  await transactionsController.createTransaction(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('getTransactionById returns 404 when not found', async () => {
  const req = { params: { id: new mongoose.Types.ObjectId().toString() } };
  const res = mockRes();
  const next = jest.fn();

  await transactionsController.getTransactionById(req, res, next);

  expect(res.status).toHaveBeenCalledWith(404);
});

test('getTransactionById returns 200 when transaction exists', async () => {
  const tenant = await tenantModel.create({ name: 'Tenant Tx Shop', menu: [{ name: 'Tea', price: 3000 }] });
  const order = await orderModel.create({ tenantId: tenant._id, items: [{ name: 'Tea', price: 3000, quantity: 1 }], total: 3000, status: 'pending' });
  const transaction = await transactionModel.create({ customerName: 'Joe', customerPhone: '0812', tableNumber: '5', orders: [order._id], grandTotal: 3000, paymentStatus: 'pending' });
  const req = { params: { id: transaction._id.toString() }, user: { role: 'TENANT_ADMIN', tenantId: tenant._id.toString() } };
  const res = mockRes();
  const next = jest.fn();

  await transactionsController.getTransactionById(req, res, next);

  expect(res.status).toHaveBeenCalledWith(200);
  const responseBody = res.json.mock.calls[0][0];
  expect(responseBody.success).toBe(true);
  expect(String(responseBody.data._id)).toBe(transaction._id.toString());
});

test('getTransactionById returns 200 for SUPER_ADMIN across tenants', async () => {
  const tenant = await tenantModel.create({ name: 'Super Tx Shop', menu: [{ name: 'Tea', price: 3000 }] });
  const order = await orderModel.create({ tenantId: tenant._id, items: [{ name: 'Tea', price: 3000, quantity: 1 }], total: 3000, status: 'pending' });
  const transaction = await transactionModel.create({ customerName: 'Admin', customerPhone: '0812', tableNumber: '9', orders: [order._id], grandTotal: 3000, paymentStatus: 'pending' });
  const req = { params: { id: transaction._id.toString() }, user: { role: 'SUPER_ADMIN' } };
  const res = mockRes();
  const next = jest.fn();

  await transactionsController.getTransactionById(req, res, next);

  expect(res.status).toHaveBeenCalledWith(200);
});

test('getTransactionById returns 403 for cross-tenant transaction access', async () => {
  const tenant = await tenantModel.create({ name: 'Cross Tx Shop', menu: [{ name: 'Tea', price: 3000 }] });
  const order = await orderModel.create({ tenantId: tenant._id, items: [{ name: 'Tea', price: 3000, quantity: 1 }], total: 3000, status: 'pending' });
  const transaction = await transactionModel.create({ customerName: 'Joe', customerPhone: '0812', tableNumber: '5', orders: [order._id], grandTotal: 3000, paymentStatus: 'pending' });
  const req = { params: { id: transaction._id.toString() }, user: { role: 'TENANT_ADMIN', tenantId: new mongoose.Types.ObjectId().toString() } };
  const res = mockRes();
  const next = jest.fn();

  await transactionsController.getTransactionById(req, res, next);

  expect(res.status).toHaveBeenCalledWith(403);
});

test('getTransactionById returns 403 for MEMBER on tenant-scoped transactions', async () => {
  const tenant = await tenantModel.create({ name: 'Member Tx Shop', menu: [{ name: 'Tea', price: 3000 }] });
  const order = await orderModel.create({ tenantId: tenant._id, items: [{ name: 'Tea', price: 3000, quantity: 1 }], total: 3000, status: 'pending' });
  const transaction = await transactionModel.create({ customerName: 'Joe', customerPhone: '0812', tableNumber: '5', orders: [order._id], grandTotal: 3000, paymentStatus: 'pending' });
  const req = { params: { id: transaction._id.toString() }, user: { role: 'MEMBER', tenantId: tenant._id.toString() } };
  const res = mockRes();
  const next = jest.fn();

  await transactionsController.getTransactionById(req, res, next);

  expect(res.status).toHaveBeenCalledWith(403);
});

test('getTransactionById returns 403 for tenant roles when transaction has no orders', async () => {
  const transaction = await transactionModel.create({ customerName: 'Joe', customerPhone: '0812', tableNumber: '5', orders: [], grandTotal: 0, paymentStatus: 'pending' });
  const req = { params: { id: transaction._id.toString() }, user: { role: 'TENANT_ADMIN', tenantId: new mongoose.Types.ObjectId().toString() } };
  const res = mockRes();
  const next = jest.fn();

  await transactionsController.getTransactionById(req, res, next);

  expect(res.status).toHaveBeenCalledWith(403);
});

test('createTransaction forwards unexpected errors to next', async () => {
  const tenant = await tenantModel.create({ name: 'Error Shop', menu: [{ name: 'Juice', price: 7000, stock: 5, reserved: 0, sold: 0 }] });
  const orderModel = require('../../src/models/order.model');
  const createSpy = jest.spyOn(orderModel, 'create').mockRejectedValueOnce(new Error('transaction order create failed'));
  const req = {
    body: {
      customerName: 'Bob',
      customerPhone: '081111',
      items: [{ tenantId: tenant._id.toString(), name: 'Juice', quantity: 1 }],
    },
  };
  const res = mockRes();
  const next = jest.fn();

  await transactionsController.createTransaction(req, res, next);

  expect(next).toHaveBeenCalledWith(expect.any(Error));
  createSpy.mockRestore();
});

test('createTransaction rolls back created orders when parent transaction create fails', async () => {
  const tenantA = await tenantModel.create({ name: 'Rollback Shop A', menu: [{ name: 'Tea', price: 3000, stock: 4, reserved: 0, sold: 0 }] });
  const tenantB = await tenantModel.create({ name: 'Rollback Shop B', menu: [{ name: 'Coffee', price: 4000, stock: 4, reserved: 0, sold: 0 }] });
  const createSpy = jest.spyOn(transactionModel, 'create').mockRejectedValueOnce(new Error('transaction create failed'));
  const req = {
    body: {
      customerName: 'Bob',
      customerPhone: '081111',
      items: [
        { tenantId: tenantA._id.toString(), name: 'Tea', quantity: 1 },
        { tenantId: tenantB._id.toString(), name: 'Coffee', quantity: 1 },
      ],
    },
  };
  const res = mockRes();
  const next = jest.fn();

  await transactionsController.createTransaction(req, res, next);

  expect(next).toHaveBeenCalledWith(expect.any(Error));
  expect(await transactionModel.findById(new mongoose.Types.ObjectId())).toBeNull();
  const orders = await mongoose.connection.collection('orders').find({}).toArray();
  expect(orders).toHaveLength(0);
  const transactions = await mongoose.connection.collection('transactions').find({}).toArray();
  expect(transactions).toHaveLength(0);
  const persistedTenantA = await tenantModel.findById(tenantA._id);
  const persistedTenantB = await tenantModel.findById(tenantB._id);
  expect(persistedTenantA.menu[0].stock).toBe(4);
  expect(persistedTenantA.menu[0].reserved).toBe(0);
  expect(persistedTenantB.menu[0].stock).toBe(4);
  expect(persistedTenantB.menu[0].reserved).toBe(0);
  createSpy.mockRestore();
});

test('createTransaction returns 400 when stock is insufficient', async () => {
  const tenant = await tenantModel.create({ name: 'Stock Shop', menu: [{ name: 'Tea', price: 5000, stock: 1, reserved: 0, sold: 0 }] });
  const req = {
    body: {
      customerName: 'Alice',
      customerPhone: '08123',
      items: [{ tenantId: tenant._id.toString(), name: 'Tea', quantity: 2 }],
    },
  };
  const res = mockRes();
  const next = jest.fn();

  await transactionsController.createTransaction(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
  const persistedTenant = await tenantModel.findById(tenant._id);
  expect(persistedTenant.menu[0].stock).toBe(1);
  expect(persistedTenant.menu[0].reserved).toBe(0);
});

test('getTransactionById forwards unexpected errors to next', async () => {
  const findSpy = jest.spyOn(transactionModel, 'findById').mockRejectedValueOnce(new Error('transaction lookup failed'));
  const req = { params: { id: new mongoose.Types.ObjectId().toString() } };
  const res = mockRes();
  const next = jest.fn();

  await transactionsController.getTransactionById(req, res, next);

  expect(next).toHaveBeenCalledWith(expect.any(Error));
  findSpy.mockRestore();
});

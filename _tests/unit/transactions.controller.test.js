const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const transactionsController = require('../../src/controllers/transactions.controller');
const tenantModel = require('../../src/models/tenant.model');
const transactionModel = require('../../src/models/transaction.model');

let mongod;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await mongoose.connection.db.dropDatabase();
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
  const tenant = await tenantModel.create({ name: 'Multi Shop', menu: [{ name: 'Soda', price: 3000 }] });
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
});

test('createTransaction handles repeated tenant grouping, default quantity, and zero price items', async () => {
  const tenant = await tenantModel.create({ name: 'Combo Shop', menu: [{ name: 'Free Water', price: 0 }] });
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
});

test('createTransaction returns 400 when menu item is missing without name fallback', async () => {
  const tenant = await tenantModel.create({ name: 'Missing Menu Shop', menu: [{ name: 'Tea', price: 5000 }] });
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
  const transaction = await transactionModel.create({ customerName: 'Joe', customerPhone: '0812', tableNumber: '5', orders: [], grandTotal: 0, paymentStatus: 'pending' });
  const req = { params: { id: transaction._id.toString() } };
  const res = mockRes();
  const next = jest.fn();

  await transactionsController.getTransactionById(req, res, next);

  expect(res.status).toHaveBeenCalledWith(200);
  const responseBody = res.json.mock.calls[0][0];
  expect(responseBody.success).toBe(true);
  expect(String(responseBody.data._id)).toBe(transaction._id.toString());
});

test('createTransaction forwards unexpected errors to next', async () => {
  const tenant = await tenantModel.create({ name: 'Error Shop', menu: [{ name: 'Juice', price: 7000 }] });
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

test('getTransactionById forwards unexpected errors to next', async () => {
  const findSpy = jest.spyOn(transactionModel, 'findById').mockRejectedValueOnce(new Error('transaction lookup failed'));
  const req = { params: { id: new mongoose.Types.ObjectId().toString() } };
  const res = mockRes();
  const next = jest.fn();

  await transactionsController.getTransactionById(req, res, next);

  expect(next).toHaveBeenCalledWith(expect.any(Error));
  findSpy.mockRestore();
});

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ordersController = require('../../src/controllers/orders.controller');
const tenantModel = require('../../src/models/tenant.model');

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

test('createOrder returns 400 when tenantId is invalid', async () => {
  const req = { body: { tenantId: new mongoose.Types.ObjectId().toString(), items: [{ name: 'Tea', quantity: 1 }] } };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.createOrder(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('createOrder returns 400 when items array is empty', async () => {
  const tenant = await tenantModel.create({ name: 'Test Shop', menu: [{ name: 'Tea', price: 5000 }] });

  const req = { body: { tenantId: tenant._id.toString(), items: [] } };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.createOrder(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('createOrder accepts fallback name-based menu item lookup', async () => {
  const tenant = await tenantModel.create({ name: 'Fallback Shop', menu: [{ name: 'Coffee', price: 6500 }] });

  const req = { body: { tenantId: tenant._id.toString(), items: [{ name: 'Coffee', quantity: 2 }] } };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.createOrder(req, res, next);

  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.objectContaining({ total: 13000 }) }));
});

test('getOrderById returns 200 when order exists', async () => {
  const tenant = await tenantModel.create({ name: 'Query Shop', menu: [{ name: 'Water', price: 2000 }] });
  const order = await require('../../src/models/order.model').create({ tenantId: tenant._id, items: [{ name: 'Water', price: 2000, quantity: 1 }], total: 2000, status: 'pending' });

  const req = { params: { id: order._id.toString() } };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.getOrderById(req, res, next);

  expect(res.status).toHaveBeenCalledWith(200);
  const responseBody = res.json.mock.calls[0][0];
  expect(responseBody.success).toBe(true);
  expect(String(responseBody.data._id)).toBe(order._id.toString());
});

test('createOrder returns 400 when menu item is not found by name or id', async () => {
  const tenant = await tenantModel.create({ name: 'Lookup Shop', menu: [{ name: 'Tea', price: 5000 }] });
  const req = { body: { tenantId: tenant._id.toString(), items: [{ name: 'Missing Item', quantity: 1 }] } };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.createOrder(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('createOrder defaults missing quantity to one and supports zero price items', async () => {
  const tenant = await tenantModel.create({ name: 'Promo Shop', menu: [{ name: 'Free Tea', price: 0 }] });
  const req = { body: { tenantId: tenant._id.toString(), items: [{ name: 'Free Tea' }] } };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.createOrder(req, res, next);

  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.objectContaining({ total: 0 }) }));
});

test('createOrder forwards model errors to next', async () => {
  const tenant = await tenantModel.create({ name: 'Crash Shop', menu: [{ name: 'Tea', price: 5000 }] });
  const createSpy = jest.spyOn(require('../../src/models/order.model'), 'create').mockRejectedValueOnce(new Error('create failed'));
  const req = { body: { tenantId: tenant._id.toString(), items: [{ name: 'Tea', quantity: 1 }] } };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.createOrder(req, res, next);

  expect(next).toHaveBeenCalledWith(expect.any(Error));
  createSpy.mockRestore();
});

test('createOrder returns 400 when menu item lookup by id fails without name fallback', async () => {
  const tenant = await tenantModel.create({ name: 'Id Lookup Shop', menu: [{ name: 'Tea', price: 5000 }] });
  const req = { body: { tenantId: tenant._id.toString(), items: [{ menuItemId: new mongoose.Types.ObjectId().toString(), quantity: 1 }] } };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.createOrder(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('getOrderById forwards lookup errors to next', async () => {
  const orderModel = require('../../src/models/order.model');
  const findSpy = jest.spyOn(orderModel, 'findById').mockRejectedValueOnce(new Error('find failed'));
  const req = { params: { id: new mongoose.Types.ObjectId().toString() } };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.getOrderById(req, res, next);

  expect(next).toHaveBeenCalledWith(expect.any(Error));
  findSpy.mockRestore();
});

test('getOrderById returns 404 when order does not exist', async () => {
  const req = { params: { id: new mongoose.Types.ObjectId().toString() } };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.getOrderById(req, res, next);

  expect(res.status).toHaveBeenCalledWith(404);
});

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const ordersController = require('../../src/controllers/orders.controller');
const tenantModel = require('../../src/models/tenant.model');

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
  const tenant = await tenantModel.create({ name: 'Fallback Shop', menu: [{ name: 'Coffee', price: 6500, stock: 5, reserved: 0, sold: 0 }] });

  const req = { body: { tenantId: tenant._id.toString(), items: [{ name: 'Coffee', quantity: 2 }] } };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.createOrder(req, res, next);

  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.objectContaining({ total: 13000 }) }));
  const persistedTenant = await tenantModel.findById(tenant._id);
  expect(persistedTenant.menu[0].stock).toBe(3);
  expect(persistedTenant.menu[0].reserved).toBe(2);
});

test('getOrderById returns 200 when order exists', async () => {
  const tenant = await tenantModel.create({ name: 'Query Shop', menu: [{ name: 'Water', price: 2000 }] });
  const order = await require('../../src/models/order.model').create({ tenantId: tenant._id, items: [{ name: 'Water', price: 2000, quantity: 1 }], total: 2000, status: 'pending' });

  const req = { params: { id: order._id.toString() }, user: { role: 'TENANT_ADMIN', tenantId: tenant._id.toString() } };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.getOrderById(req, res, next);

  expect(res.status).toHaveBeenCalledWith(200);
  const responseBody = res.json.mock.calls[0][0];
  expect(responseBody.success).toBe(true);
  expect(String(responseBody.data._id)).toBe(order._id.toString());
});

test('getOrderById returns 200 for SUPER_ADMIN across tenants', async () => {
  const tenant = await tenantModel.create({ name: 'Super Query Shop', menu: [{ name: 'Tea', price: 4000 }] });
  const order = await require('../../src/models/order.model').create({ tenantId: tenant._id, items: [{ name: 'Tea', price: 4000, quantity: 1 }], total: 4000, status: 'pending' });

  const req = { params: { id: order._id.toString() }, user: { role: 'SUPER_ADMIN' } };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.getOrderById(req, res, next);

  expect(res.status).toHaveBeenCalledWith(200);
});

test('getOrderById returns 403 for cross-tenant access', async () => {
  const tenant = await tenantModel.create({ name: 'Tenant Scoped Shop', menu: [{ name: 'Tea', price: 5000 }] });
  const order = await require('../../src/models/order.model').create({ tenantId: tenant._id, items: [{ name: 'Tea', price: 5000, quantity: 1 }], total: 5000, status: 'pending' });

  const req = { params: { id: order._id.toString() }, user: { role: 'TENANT_ADMIN', tenantId: new mongoose.Types.ObjectId().toString() } };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.getOrderById(req, res, next);

  expect(res.status).toHaveBeenCalledWith(403);
});

test('getOrderById returns 403 for MEMBER on tenant-scoped resources', async () => {
  const tenant = await tenantModel.create({ name: 'Member Scoped Shop', menu: [{ name: 'Tea', price: 5000 }] });
  const order = await require('../../src/models/order.model').create({ tenantId: tenant._id, items: [{ name: 'Tea', price: 5000, quantity: 1 }], total: 5000, status: 'pending' });

  const req = { params: { id: order._id.toString() }, user: { role: 'MEMBER', tenantId: tenant._id.toString() } };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.getOrderById(req, res, next);

  expect(res.status).toHaveBeenCalledWith(403);
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
  const tenant = await tenantModel.create({ name: 'Promo Shop', menu: [{ name: 'Free Tea', price: 0, stock: 1, reserved: 0, sold: 0 }] });
  const req = { body: { tenantId: tenant._id.toString(), items: [{ name: 'Free Tea' }] } };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.createOrder(req, res, next);

  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.objectContaining({ total: 0 }) }));
});

test('createOrder forwards model errors to next', async () => {
  const tenant = await tenantModel.create({ name: 'Crash Shop', menu: [{ name: 'Tea', price: 5000, stock: 4, reserved: 0, sold: 0 }] });
  const createSpy = jest.spyOn(require('../../src/models/order.model'), 'create').mockRejectedValueOnce(new Error('create failed'));
  const req = { body: { tenantId: tenant._id.toString(), items: [{ name: 'Tea', quantity: 1 }] } };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.createOrder(req, res, next);

  expect(next).toHaveBeenCalledWith(expect.any(Error));
  createSpy.mockRestore();
});

test('createOrder returns 400 when menu item lookup by id fails without name fallback', async () => {
  const tenant = await tenantModel.create({ name: 'Id Lookup Shop', menu: [{ name: 'Tea', price: 5000, stock: 3, reserved: 0, sold: 0 }] });
  const req = { body: { tenantId: tenant._id.toString(), items: [{ menuItemId: new mongoose.Types.ObjectId().toString(), quantity: 1 }] } };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.createOrder(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('createOrder returns 400 when stock is insufficient', async () => {
  const tenant = await tenantModel.create({ name: 'Low Stock Shop', menu: [{ name: 'Tea', price: 5000, stock: 1, reserved: 0, sold: 0 }] });
  const req = { body: { tenantId: tenant._id.toString(), items: [{ name: 'Tea', quantity: 2 }] } };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.createOrder(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
  const persistedTenant = await tenantModel.findById(tenant._id);
  expect(persistedTenant.menu[0].stock).toBe(1);
  expect(persistedTenant.menu[0].reserved).toBe(0);
});

test('createOrder rejects unavailable menu item even when stock exists', async () => {
  const tenant = await tenantModel.create({ name: 'Hidden Shop', menu: [{ name: 'Tea', price: 5000, available: false, stock: 5, reserved: 0, sold: 0 }] });
  const req = { body: { tenantId: tenant._id.toString(), items: [{ name: 'Tea', quantity: 1 }] } };
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

test('updateOrderStatus transitions paid order to preparing for same-tenant admin', async () => {
  const orderModel = require('../../src/models/order.model');
  const tenant = await tenantModel.create({ name: 'Kitchen Shop', menu: [{ name: 'Tea', price: 5000 }] });
  const order = await orderModel.create({ tenantId: tenant._id, items: [{ name: 'Tea', price: 5000, quantity: 1 }], total: 5000, status: 'paid' });

  const req = {
    params: { id: order._id.toString() },
    body: { status: 'preparing' },
    user: { role: 'TENANT_ADMIN', tenantId: tenant._id.toString() },
  };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.updateOrderStatus(req, res, next);

  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.objectContaining({ status: 'preparing' }) }));
});

test('updateOrderStatus returns 400 for invalid transition', async () => {
  const orderModel = require('../../src/models/order.model');
  const tenant = await tenantModel.create({ name: 'Transition Shop', menu: [{ name: 'Tea', price: 5000 }] });
  const order = await orderModel.create({ tenantId: tenant._id, items: [{ name: 'Tea', price: 5000, quantity: 1 }], total: 5000, status: 'pending' });

  const req = {
    params: { id: order._id.toString() },
    body: { status: 'ready' },
    user: { role: 'TENANT_ADMIN', tenantId: tenant._id.toString() },
  };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.updateOrderStatus(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid order status transition: pending -> ready' });
});

test('updateOrderStatus returns 403 for cross-tenant access', async () => {
  const orderModel = require('../../src/models/order.model');
  const tenant = await tenantModel.create({ name: 'Cross Tenant Shop', menu: [{ name: 'Tea', price: 5000 }] });
  const order = await orderModel.create({ tenantId: tenant._id, items: [{ name: 'Tea', price: 5000, quantity: 1 }], total: 5000, status: 'paid' });

  const req = {
    params: { id: order._id.toString() },
    body: { status: 'preparing' },
    user: { role: 'TENANT_ADMIN', tenantId: new mongoose.Types.ObjectId().toString() },
  };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.updateOrderStatus(req, res, next);

  expect(res.status).toHaveBeenCalledWith(403);
});

test('updateOrderStatus returns 404 when order does not exist', async () => {
  const req = {
    params: { id: new mongoose.Types.ObjectId().toString() },
    body: { status: 'preparing' },
    user: { role: 'SUPER_ADMIN' },
  };
  const res = mockRes();
  const next = jest.fn();

  await ordersController.updateOrderStatus(req, res, next);

  expect(res.status).toHaveBeenCalledWith(404);
});

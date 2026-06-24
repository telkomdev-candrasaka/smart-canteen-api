jest.mock('../../src/config/redis', () => ({
  createRedisClient: jest.fn(),
  closeRedisClient: jest.fn().mockResolvedValue(undefined),
}));

const EventEmitter = require('events');
const { createRedisClient, closeRedisClient } = require('../../src/config/redis');
const tenantController = require('../../src/controllers/tenants.controller');
const tenantModel = require('../../src/models/tenant.model');
const tenantsRouter = require('../../src/routes/tenants.routes');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

function createSubscriberMock() {
  const subscriber = {
    handler: null,
    on: jest.fn((eventName, cb) => {
      if (eventName === 'message') {
        subscriber.handler = cb;
      }
    }),
    subscribe: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    removeListener: jest.fn(),
    emitMessage(message) {
      if (this.handler) {
        this.handler('channel', message);
      }
    },
  };

  return subscriber;
}

let mongod;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
});

test('getTenantById returns 404 when not found', async () => {
  const req = { params: { id: new mongoose.Types.ObjectId().toString() } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();

  await tenantController.getTenantById(req, res, next);
  expect(res.status).toHaveBeenCalledWith(404);
});

test('getMenu returns 404 when tenant not found', async () => {
  const req = { params: { id: new mongoose.Types.ObjectId().toString() } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();

  await tenantController.getMenu(req, res, next);
  expect(res.status).toHaveBeenCalledWith(404);
});

test('streamTenantOrders sets SSE headers and writes messages', async () => {
  const created = await tenantModel.create({ name: 'SSETenant', menu: [] });
  const subscriber = createSubscriberMock();
  createRedisClient.mockReturnValue(subscriber);

  const req = new EventEmitter();
  req.params = { id: created._id.toString() };
  req.user = { role: 'TENANT_ADMIN', tenantId: created._id.toString() };

  const writes = [];
  const res = {
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: (d) => writes.push(d),
  };

  const next = jest.fn();

  await tenantController.streamTenantOrders(req, res, next);

  subscriber.handler(`tenant:${created._id}:orders`, JSON.stringify({ hello: 'world' }));

  await new Promise((r) => setTimeout(r, 10));

  expect(res.setHeader).toHaveBeenCalled();
  expect(subscriber.subscribe).toHaveBeenCalledWith(`tenant:${created._id}:orders`);
  expect(writes.length).toBeGreaterThan(0);

  req.emit('close');
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(closeRedisClient).toHaveBeenCalledWith(subscriber);
});

test('streamTenantOrders ignores write errors and unsubscribe failures on close', async () => {
  const subscriber = createSubscriberMock();
  subscriber.unsubscribe.mockRejectedValue(new Error('unsubscribe failed'));
  createRedisClient.mockReturnValue(subscriber);

  const created = await tenantModel.create({ name: 'BrokenSSE', menu: [] });
  const req = new EventEmitter();
  req.params = { id: created._id.toString() };
  req.user = { role: 'TENANT_ADMIN', tenantId: created._id.toString() };

  const res = {
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(() => {
      throw new Error('socket closed');
    }),
  };
  const next = jest.fn();

  await tenantController.streamTenantOrders(req, res, next);

  subscriber.handler(`tenant:${created._id}:orders`, JSON.stringify({ ok: true }));

  req.emit('close');
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(res.write).toHaveBeenCalled();
  expect(subscriber.unsubscribe).toHaveBeenCalledWith(`tenant:${created._id}:orders`);
  expect(closeRedisClient).toHaveBeenCalledWith(subscriber);
});

test('streamTenantOrders returns 403 for cross-tenant access', async () => {
  const created = await tenantModel.create({ name: 'DeniedSSE', menu: [] });
  const subscriber = createSubscriberMock();
  createRedisClient.mockReturnValue(subscriber);

  const req = new EventEmitter();
  req.params = { id: created._id.toString() };
  req.user = { role: 'TENANT_ADMIN', tenantId: new mongoose.Types.ObjectId().toString() };

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(),
  };
  const next = jest.fn();

  await tenantController.streamTenantOrders(req, res, next);

  expect(res.status).toHaveBeenCalledWith(403);
  expect(createRedisClient).not.toHaveBeenCalled();
  expect(res.setHeader).not.toHaveBeenCalled();
});

test('streamTenantOrders returns 403 for MEMBER even when tenant matches', async () => {
  const created = await tenantModel.create({ name: 'MemberSSE', menu: [] });
  const subscriber = createSubscriberMock();
  createRedisClient.mockReturnValue(subscriber);

  const req = new EventEmitter();
  req.params = { id: created._id.toString() };
  req.user = { role: 'MEMBER', tenantId: created._id.toString() };

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(),
  };
  const next = jest.fn();

  await tenantController.streamTenantOrders(req, res, next);

  expect(res.status).toHaveBeenCalledWith(403);
  expect(createRedisClient).not.toHaveBeenCalled();
});

test('streamTenantOrders allows SUPER_ADMIN across tenants', async () => {
  const created = await tenantModel.create({ name: 'AdminSSE', menu: [] });
  const subscriber = createSubscriberMock();
  createRedisClient.mockReturnValue(subscriber);

  const req = new EventEmitter();
  req.params = { id: created._id.toString() };
  req.user = { role: 'SUPER_ADMIN' };

  const writes = [];
  const res = {
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: (d) => writes.push(d),
  };
  const next = jest.fn();

  await tenantController.streamTenantOrders(req, res, next);

  expect(res.setHeader).toHaveBeenCalled();
  expect(subscriber.subscribe).toHaveBeenCalledWith(`tenant:${created._id}:orders`);
  expect(writes).toEqual([]);
});

test('tenants stream route requires SUPER_ADMIN or TENANT_ADMIN before controller', () => {
  const streamLayer = tenantsRouter.stack.find((layer) => layer.route && layer.route.path === '/:id/orders/stream');

  expect(streamLayer).toBeDefined();
  expect(streamLayer.route.methods.get).toBe(true);

  expect(streamLayer.route.stack).toHaveLength(4);
  expect(streamLayer.route.stack[0].handle.name).toBe('verifyToken');
  expect(streamLayer.route.stack[1].handle.length).toBe(3);
  expect(streamLayer.route.stack[2].handle.name).toBe('validateTenantId');
  expect(streamLayer.route.stack[3].handle.name).toBe('streamTenantOrders');
});

test('createTenant forwards model errors to next', async () => {
  const createSpy = jest.spyOn(tenantModel, 'create').mockRejectedValueOnce(new Error('create failed'));
  const req = { body: { name: 'Bad Tenant' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();

  await tenantController.createTenant(req, res, next);

  expect(next).toHaveBeenCalledWith(expect.any(Error));
  createSpy.mockRestore();
});

test('getAllTenants forwards model errors to next', async () => {
  const findAllSpy = jest.spyOn(tenantModel, 'findAll').mockRejectedValueOnce(new Error('findAll failed'));
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();

  await tenantController.getAllTenants({}, res, next);

  expect(next).toHaveBeenCalledWith(expect.any(Error));
  findAllSpy.mockRestore();
});

test('getTenantById forwards model errors to next', async () => {
  const findByIdSpy = jest.spyOn(tenantModel, 'findById').mockRejectedValueOnce(new Error('lookup failed'));
  const req = { params: { id: new mongoose.Types.ObjectId().toString() } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();

  await tenantController.getTenantById(req, res, next);

  expect(next).toHaveBeenCalledWith(expect.any(Error));
  findByIdSpy.mockRestore();
});

test('getMenu forwards model errors to next', async () => {
  const findByIdSpy = jest.spyOn(tenantModel, 'findById').mockRejectedValueOnce(new Error('menu lookup failed'));
  const req = { params: { id: new mongoose.Types.ObjectId().toString() } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();

  await tenantController.getMenu(req, res, next);

  expect(next).toHaveBeenCalledWith(expect.any(Error));
  findByIdSpy.mockRestore();
});

test('createTenant returns 201 and stores a tenant', async () => {
  const req = { body: { name: 'New Tenant', description: 'A fresh tenant', menu: [{ name: 'Tea', price: 3000 }] } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();

  await tenantController.createTenant(req, res, next);

  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.objectContaining({ name: 'New Tenant' }) }));
});

test('getAllTenants returns the list of tenants', async () => {
  await tenantModel.create({ name: 'Tenant A', menu: [] });
  await tenantModel.create({ name: 'Tenant B', menu: [] });

  const req = {};
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();

  await tenantController.getAllTenants(req, res, next);

  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.any(Array) }));
});

test('getTenantById returns 200 when tenant exists', async () => {
  const tenant = await tenantModel.create({ name: 'Found Tenant', menu: [] });
  const req = { params: { id: tenant._id.toString() } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();

  await tenantController.getTenantById(req, res, next);

  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.objectContaining({ name: 'Found Tenant' }) }));
});

test('getMenu returns 200 with menu items when tenant exists', async () => {
  const tenant = await tenantModel.create({ name: 'Menu Tenant', menu: [{ name: 'Pizza', price: 12000 }] });
  const req = { params: { id: tenant._id.toString() } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();

  await tenantController.getMenu(req, res, next);

  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.any(Array) }));
});

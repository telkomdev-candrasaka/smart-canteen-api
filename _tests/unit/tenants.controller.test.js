jest.mock('ioredis', () => require('../../_mocks/ioredis'));

const EventEmitter = require('events');
const tenantController = require('../../src/controllers/tenants.controller');
const tenantModel = require('../../src/models/tenant.model');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

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

  const req = new EventEmitter();
  req.params = { id: created._id.toString() };

  const writes = [];
  const res = {
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: (d) => writes.push(d),
  };

  const next = jest.fn();

  await tenantController.streamTenantOrders(req, res, next);

  // simulate publish from mock Redis
  if (global.__redis_subscribers && global.__redis_subscribers[0]) {
    const sub = global.__redis_subscribers[0];
    if (sub._onMessage) sub._onMessage(`tenant:${created._id}:orders`, JSON.stringify({ hello: 'world' }));
  }

  // give a tick
  await new Promise((r) => setTimeout(r, 10));

  expect(res.setHeader).toHaveBeenCalled();
  expect(writes.length).toBeGreaterThan(0);

  // close connection
  req.emit('close');
});

test('streamTenantOrders ignores write errors and unsubscribe failures on close', async () => {
  const Redis = require('ioredis');
  Redis.prototype.unsubscribe = jest.fn().mockRejectedValue(new Error('unsubscribe failed'));

  const created = await tenantModel.create({ name: 'BrokenSSE', menu: [] });
  const req = new EventEmitter();
  req.params = { id: created._id.toString() };

  const res = {
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(() => {
      throw new Error('socket closed');
    }),
  };
  const next = jest.fn();

  await tenantController.streamTenantOrders(req, res, next);

  const sub = global.__redis_subscribers[0];
  sub._onMessage(`tenant:${created._id}:orders`, JSON.stringify({ ok: true }));

  req.emit('close');
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(res.write).toHaveBeenCalled();
  expect(Redis.prototype.unsubscribe).toHaveBeenCalledWith(`tenant:${created._id}:orders`);
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

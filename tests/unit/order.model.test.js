const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const orderModel = require('../../src/models/order.model');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
});

afterEach(async () => {
  if (mongoose.connection && mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
});

test('order model supports create, findById, and update without session', async () => {
  const created = await orderModel.create({
    tenantId: new mongoose.Types.ObjectId(),
    items: [{ name: 'Nasi Goreng', price: 25000, quantity: 1 }],
    total: 25000,
  });

  const found = await orderModel.findById(created._id);
  expect(found).toBeTruthy();
  expect(found.status).toBe('pending');

  const updated = await orderModel.update(created._id, { total: 26000 });
  expect(updated.total).toBe(26000);

  const persisted = await orderModel.findById(created._id);
  expect(persisted.total).toBe(26000);
  expect(persisted.status).toBe('pending');
});

test('order model rejects unknown status values', async () => {
  await expect(orderModel.create({
    tenantId: new mongoose.Types.ObjectId(),
    items: [{ name: 'Nasi Goreng', price: 25000, quantity: 1 }],
    total: 25000,
    status: 'unknown',
  })).rejects.toThrow();
});

test('transitionStatus enforces legal order state transitions', async () => {
  const created = await orderModel.create({
    tenantId: new mongoose.Types.ObjectId(),
    items: [{ name: 'Sate', price: 30000, quantity: 1 }],
    total: 30000,
  });

  const paid = await orderModel.transitionStatus(created._id, 'paid');
  expect(paid.status).toBe('paid');

  await expect(orderModel.transitionStatus(created._id, 'completed')).rejects.toThrow('Invalid order status transition: paid -> completed');
});

test('transitionStatus returns null when order does not exist', async () => {
  const missing = await orderModel.transitionStatus(new mongoose.Types.ObjectId(), 'paid');
  expect(missing).toBeNull();
});

test('order model blocks direct status updates outside transitionStatus', async () => {
  const created = await orderModel.create({
    tenantId: new mongoose.Types.ObjectId(),
    items: [{ name: 'Soto', price: 20000, quantity: 1 }],
    total: 20000,
  });

  expect(() => orderModel.update(created._id, { status: 'completed' })).toThrow('Order status updates must use transitionStatus()');
});

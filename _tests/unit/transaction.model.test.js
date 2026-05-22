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

const orderModel = require('../../src/models/order.model');
const transactionModel = require('../../src/models/transaction.model');

test('create and find transaction with populated orders', async () => {
  const order = await orderModel.create({ tenantId: new mongoose.Types.ObjectId(), items: [{ name: 'X', price: 100, quantity: 1 }], total: 100 });
  const tx = await transactionModel.create({ customerName: 'A', customerPhone: '081', tableNumber: '1', orders: [order._id], grandTotal: 100 });

  const found = await transactionModel.findById(tx._id);
  expect(found).toBeDefined();
  expect(Array.isArray(found.orders)).toBe(true);
  expect(String(found.orders[0]._id)).toBe(String(order._id));
});

test('update transaction', async () => {
  const tx = await transactionModel.create({ customerName: 'B', customerPhone: '082', tableNumber: '', orders: [], grandTotal: 0 });
  const updated = await transactionModel.update(tx._id, { paymentStatus: 'paid' });
  expect(updated.paymentStatus).toBe('paid');
});

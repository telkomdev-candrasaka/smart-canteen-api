const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
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

const orderModel = require('../../src/models/order.model');
const tenantModel = require('../../src/models/tenant.model');
const transactionModel = require('../../src/models/transaction.model');

afterEach(async () => {
  if (mongoose.connection && mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
  }
});

test('create and find transaction with populated orders', async () => {
  const order = await orderModel.create({ tenantId: new mongoose.Types.ObjectId(), items: [{ name: 'X', price: 100, quantity: 1 }], total: 100 });
  const tx = await transactionModel.create({ customerName: 'A', customerPhone: '081', tableNumber: '1', orders: [order._id], grandTotal: 100 });

  const found = await transactionModel.findById(tx._id);
  const foundByOrder = await transactionModel.findByOrderId(order._id);
  expect(found).toBeDefined();
  expect(foundByOrder).toBeDefined();
  expect(Array.isArray(found.orders)).toBe(true);
  expect(String(found.orders[0]._id)).toBe(String(order._id));
  expect(String(foundByOrder._id)).toBe(String(tx._id));
});

test('update transaction', async () => {
  const tx = await transactionModel.create({ customerName: 'B', customerPhone: '082', tableNumber: '', orders: [], grandTotal: 0 });
  const updated = await transactionModel.update(tx._id, { paymentStatus: 'paid' });
  expect(updated.paymentStatus).toBe('paid');
});

test('transaction payment statuses support processing, failed, and refunded', async () => {
  const tx = await transactionModel.create({
    customerName: 'C',
    customerPhone: '083',
    tableNumber: '',
    orders: [],
    grandTotal: 0,
    paymentStatus: 'processing',
    paymentMethod: 'manual',
    paymentReference: 'ref-1',
    paymentMetadata: { source: 'test' },
  });

  expect(tx.paymentStatus).toBe('processing');
  expect(tx.paymentMethod).toBe('manual');
  expect(tx.paymentReference).toBe('ref-1');

  const failed = await transactionModel.update(tx._id, { paymentStatus: 'failed', failedAt: new Date() });
  expect(failed.paymentStatus).toBe('failed');

  const refunded = await transactionModel.update(tx._id, { paymentStatus: 'refunded', refundedAt: new Date() });
  expect(refunded.paymentStatus).toBe('refunded');
});

test('session-aware model helpers support create, find, and update inside transactions', async () => {
  const tenant = await tenantModel.create({ name: 'Session Tenant', menu: [{ name: 'Soup', price: 1000 }] });
  const session = await mongoose.startSession();
  let orderId;
  let txId;

  try {
    await session.withTransaction(async () => {
      const order = await orderModel.create({
        tenantId: tenant._id,
        items: [{ name: 'Soup', price: 1000, quantity: 1 }],
        total: 1000,
      }, { session });
      orderId = order._id;

      const tx = await transactionModel.create({
        customerName: 'Txn Session',
        customerPhone: '081',
        tableNumber: '1',
        orders: [order._id],
        grandTotal: 1000,
      }, { session });
      txId = tx._id;

      const foundOrder = await orderModel.findById(order._id, { session });
      const foundTransaction = await transactionModel.findById(tx._id, { session });
      const foundByOrder = await transactionModel.findByOrderId(order._id, { session });

      expect(foundOrder).toBeTruthy();
      expect(foundTransaction).toBeTruthy();
      expect(foundByOrder).toBeTruthy();
      expect(String(foundByOrder._id)).toBe(String(tx._id));

      const updatedOrder = await orderModel.transitionStatus(order._id, 'paid', { session });
      const updatedTransaction = await transactionModel.update(tx._id, { paymentStatus: 'processing' }, { session });

      expect(updatedOrder.status).toBe('paid');
      expect(updatedTransaction.paymentStatus).toBe('processing');
    });
  } finally {
    await session.endSession();
  }

  const persistedOrder = await orderModel.findById(orderId);
  const persistedTransaction = await transactionModel.findById(txId);

  expect(persistedOrder.status).toBe('paid');
  expect(persistedTransaction.paymentStatus).toBe('processing');
});

test('claimPendingPayment only transitions transactions that are still pending', async () => {
  const pendingTx = await transactionModel.create({
    customerName: 'Pending User',
    customerPhone: '081',
    tableNumber: '1',
    orders: [],
    grandTotal: 0,
    paymentStatus: 'pending',
  });

  const paidTx = await transactionModel.create({
    customerName: 'Paid User',
    customerPhone: '082',
    tableNumber: '2',
    orders: [],
    grandTotal: 0,
    paymentStatus: 'paid',
  });

  const claimedPending = await transactionModel.claimPendingPayment(pendingTx._id, {
    paymentStatus: 'processing',
    paymentMethod: 'manual',
    paymentReference: 'claim-ref',
  });
  const claimedPaid = await transactionModel.claimPendingPayment(paidTx._id, {
    paymentStatus: 'processing',
    paymentMethod: 'manual',
  });

  expect(claimedPending).toBeTruthy();
  expect(claimedPending.paymentStatus).toBe('processing');
  expect(claimedPending.paymentReference).toBe('claim-ref');
  expect(claimedPaid).toBeNull();

  const persistedPending = await transactionModel.findById(pendingTx._id);
  const persistedPaid = await transactionModel.findById(paidTx._id);
  expect(persistedPending.paymentStatus).toBe('processing');
  expect(persistedPaid.paymentStatus).toBe('paid');
});

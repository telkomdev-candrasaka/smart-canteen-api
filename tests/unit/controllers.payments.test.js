jest.mock('../../src/models/order.model');
jest.mock('ioredis', () => require('../../_mocks/ioredis'));

jest.mock('../../src/models/order.model');
jest.mock('../../src/models/tenant.model');
jest.mock('../../src/models/transaction.model');
jest.mock('../../src/config/redis', () => ({
	createRedisClient: jest.fn(),
	closeRedisClient: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/utils/logger', () => ({
	warn: jest.fn(),
}));

const mongoose = require('mongoose');
const orderModel = require('../../src/models/order.model');
const tenantModel = require('../../src/models/tenant.model');
const transactionModel = require('../../src/models/transaction.model');
const { createRedisClient, closeRedisClient } = require('../../src/config/redis');
const logger = require('../../src/utils/logger');
const { processPayment } = require('../../src/controllers/payments.controller');

let session;

beforeEach(() => {
	jest.clearAllMocks();
	session = {
		withTransaction: jest.fn(async (callback) => callback()),
		endSession: jest.fn().mockResolvedValue(undefined),
	};
	jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
});

afterEach(() => {
	mongoose.startSession.mockRestore();
});

function mockReq(body) {
	return { body, user: { role: 'TENANT_ADMIN', tenantId: 'tid' } };
}

function mockRes() {
	const res = {};
	res.status = jest.fn().mockReturnValue(res);
	res.json = jest.fn().mockReturnValue(res);
	return res;
}

test('processPayment updates order, settles inventory, and publishes event', async () => {
	const order = { _id: 'oid', tenantId: 'tid', status: 'pending', items: [{ menuItemId: 'mid', quantity: 2 }] };
	const transaction = { _id: 'txid', orders: [order], paymentStatus: 'pending' };
	transactionModel.findByOrderId.mockResolvedValue(transaction);
	transactionModel.claimPendingPayment
		.mockResolvedValueOnce({ _id: 'txid', orders: [order], paymentStatus: 'processing' });
	transactionModel.update
		.mockResolvedValueOnce({ _id: 'txid', orders: [{ _id: 'oid', tenantId: 'tid', status: 'paid', items: [{ menuItemId: 'mid', quantity: 2 }] }], paymentStatus: 'paid' });
	orderModel.transitionStatus.mockResolvedValue({ _id: 'oid', tenantId: 'tid', status: 'paid' });
	tenantModel.settleMenuItemStock.mockResolvedValue(true);

	const publisher = { publish: jest.fn().mockResolvedValue(1) };
	createRedisClient.mockReturnValue(publisher);

	const req = mockReq({ orderId: 'oid', method: 'manual' });
	const res = mockRes();
	const next = jest.fn();

	await processPayment(req, res, next);

	expect(transactionModel.findByOrderId).toHaveBeenCalledWith('oid');
	expect(mongoose.startSession).toHaveBeenCalled();
	expect(session.withTransaction).toHaveBeenCalled();
	expect(transactionModel.claimPendingPayment).toHaveBeenCalledWith('txid', expect.objectContaining({ paymentStatus: 'processing', paymentMethod: 'manual' }), { session });
	expect(tenantModel.settleMenuItemStock).toHaveBeenCalledWith('tid', 'mid', 2, { session });
	expect(orderModel.transitionStatus).toHaveBeenCalledWith('oid', 'paid', { session });
	expect(transactionModel.update).toHaveBeenCalledWith('txid', expect.objectContaining({ paymentStatus: 'paid' }), { session });
	expect(session.endSession).toHaveBeenCalled();
	expect(createRedisClient).toHaveBeenCalledWith('payment-publisher');
	expect(publisher.publish).toHaveBeenCalled();
	expect(closeRedisClient).toHaveBeenCalledWith(publisher);
	expect(res.status).toHaveBeenCalledWith(200);
});

test('processPayment returns 404 when transaction is not found for orderId', async () => {
	transactionModel.findByOrderId.mockResolvedValue(null);

	const req = mockReq({ orderId: 'missing', method: 'manual' });
	const res = mockRes();
	const next = jest.fn();

	await processPayment(req, res, next);

	expect(transactionModel.findByOrderId).toHaveBeenCalledWith('missing');
	expect(res.status).toHaveBeenCalledWith(404);
});

test('processPayment supports transactionId as payment target', async () => {
	const order = { _id: 'oid', tenantId: 'tid', status: 'pending', items: [{ menuItemId: 'mid', quantity: 1 }] };
	const transaction = { _id: 'txid', orders: [order], paymentStatus: 'pending' };
	transactionModel.findById.mockResolvedValue(transaction);
	transactionModel.claimPendingPayment
		.mockResolvedValueOnce({ _id: 'txid', orders: [order], paymentStatus: 'processing' });
	transactionModel.update
		.mockResolvedValueOnce({ _id: 'txid', orders: [{ _id: 'oid', tenantId: 'tid', status: 'paid', items: [{ menuItemId: 'mid', quantity: 1 }] }], paymentStatus: 'paid' });
	orderModel.transitionStatus.mockResolvedValue({ _id: 'oid', tenantId: 'tid', status: 'paid' });
	tenantModel.settleMenuItemStock.mockResolvedValue(true);

	const publisher = { publish: jest.fn().mockResolvedValue(1) };
	createRedisClient.mockReturnValue(publisher);

	const req = mockReq({ transactionId: 'txid', method: 'manual' });
	const res = mockRes();
	const next = jest.fn();

	await processPayment(req, res, next);

	expect(transactionModel.findById).toHaveBeenCalledWith('txid');
	expect(res.status).toHaveBeenCalledWith(200);
});

test('processPayment returns 403 for cross-tenant access', async () => {
	const order = { _id: 'oid', tenantId: 'other-tenant' };
	transactionModel.findByOrderId.mockResolvedValue({ _id: 'txid', orders: [order], paymentStatus: 'pending' });

	const req = mockReq({ orderId: 'oid', method: 'manual' });
	const res = mockRes();
	const next = jest.fn();

	await processPayment(req, res, next);

	expect(res.status).toHaveBeenCalledWith(403);
	expect(orderModel.update).not.toHaveBeenCalled();
	expect(createRedisClient).not.toHaveBeenCalled();
});

test('processPayment allows SUPER_ADMIN across tenants', async () => {
	const order = { _id: 'oid', tenantId: 'tenant-a', status: 'pending' };
	transactionModel.findByOrderId.mockResolvedValue({ _id: 'txid', orders: [order], paymentStatus: 'pending' });
	transactionModel.claimPendingPayment
		.mockResolvedValueOnce({ _id: 'txid', orders: [order], paymentStatus: 'processing' });
	transactionModel.update
		.mockResolvedValueOnce({ _id: 'txid', orders: [{ _id: 'oid', tenantId: 'tenant-a', status: 'paid' }], paymentStatus: 'paid' });
	orderModel.transitionStatus.mockResolvedValue({ _id: 'oid', tenantId: 'tenant-a', status: 'paid' });

	const publisher = { publish: jest.fn().mockResolvedValue(1) };
	createRedisClient.mockReturnValue(publisher);

	const req = { body: { orderId: 'oid', method: 'manual' }, user: { role: 'SUPER_ADMIN' } };
	const res = mockRes();
	const next = jest.fn();

	await processPayment(req, res, next);

	expect(res.status).toHaveBeenCalledWith(200);
});

test('processPayment returns 403 for MEMBER even when tenant matches', async () => {
	const order = { _id: 'oid', tenantId: 'tid' };
	transactionModel.findByOrderId.mockResolvedValue({ _id: 'txid', orders: [order], paymentStatus: 'pending' });

	const req = { body: { orderId: 'oid', method: 'manual' }, user: { role: 'MEMBER', tenantId: 'tid' } };
	const res = mockRes();
	const next = jest.fn();

	await processPayment(req, res, next);

	expect(res.status).toHaveBeenCalledWith(403);
	expect(orderModel.update).not.toHaveBeenCalled();
});

test('processPayment still succeeds when Redis publish fails', async () => {
	const order = { _id: 'oid', tenantId: 'tid', status: 'pending', items: [{ menuItemId: 'mid', quantity: 1 }] };
	transactionModel.findByOrderId.mockResolvedValue({ _id: 'txid', orders: [order], paymentStatus: 'pending' });
	transactionModel.claimPendingPayment
		.mockResolvedValueOnce({ _id: 'txid', orders: [order], paymentStatus: 'processing' });
	transactionModel.update
		.mockResolvedValueOnce({ _id: 'txid', orders: [{ _id: 'oid', tenantId: 'tid', status: 'paid', items: [{ menuItemId: 'mid', quantity: 1 }] }], paymentStatus: 'paid' });
	orderModel.transitionStatus.mockResolvedValue({ _id: 'oid', tenantId: 'tid', status: 'paid' });
	tenantModel.settleMenuItemStock.mockResolvedValue(true);

	const publisher = { publish: jest.fn().mockRejectedValue(new Error('publish failed')) };
	createRedisClient.mockReturnValue(publisher);

	const req = mockReq({ orderId: 'oid', method: 'manual' });
	const res = mockRes();
	const next = jest.fn();

	await processPayment(req, res, next);

	expect(transactionModel.findByOrderId).toHaveBeenCalledWith('oid');
	expect(orderModel.transitionStatus).toHaveBeenCalledWith('oid', 'paid', { session });
	expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error), orderId: 'oid', transactionId: 'txid' }), 'Failed to publish Redis event');
	expect(res.status).toHaveBeenCalledWith(200);
});

test('processPayment forwards unexpected errors to next', async () => {
	transactionModel.findByOrderId.mockRejectedValueOnce(new Error('payment lookup failed'));

	const req = mockReq({ orderId: 'oid', method: 'manual' });
	const res = mockRes();
	const next = jest.fn();

	await processPayment(req, res, next);

	expect(next).toHaveBeenCalledWith(expect.any(Error));
});

test('processPayment logs publish failures without message property', async () => {
	const order = { _id: 'oid', tenantId: 'tid', status: 'pending', items: [{ menuItemId: 'mid', quantity: 1 }] };
	transactionModel.findByOrderId.mockResolvedValue({ _id: 'txid', orders: [order], paymentStatus: 'pending' });
	transactionModel.claimPendingPayment
		.mockResolvedValueOnce({ _id: 'txid', orders: [order], paymentStatus: 'processing' });
	transactionModel.update
		.mockResolvedValueOnce({ _id: 'txid', orders: [{ _id: 'oid', tenantId: 'tid', status: 'paid', items: [{ menuItemId: 'mid', quantity: 1 }] }], paymentStatus: 'paid' });
	orderModel.transitionStatus.mockResolvedValue({ _id: 'oid', tenantId: 'tid', status: 'paid' });
	tenantModel.settleMenuItemStock.mockResolvedValue(true);

	const publisher = { publish: jest.fn().mockRejectedValue({ code: 'NO_MESSAGE' }) };
	createRedisClient.mockReturnValue(publisher);

	const req = mockReq({ orderId: 'oid', method: 'manual' });
	const res = mockRes();
	const next = jest.fn();

	await processPayment(req, res, next);

	expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ err: expect.objectContaining({ code: 'NO_MESSAGE' }) }), 'Failed to publish Redis event');
	expect(res.status).toHaveBeenCalledWith(200);
});

test('processPayment stops before Redis publish when payment transaction fails', async () => {
	const order = { _id: 'oid', tenantId: 'tid', status: 'pending', items: [{ menuItemId: 'mid', quantity: 1 }] };
	transactionModel.findByOrderId.mockResolvedValue({ _id: 'txid', orders: [order], paymentStatus: 'pending' });
	transactionModel.claimPendingPayment
		.mockResolvedValueOnce({ _id: 'txid', orders: [order], paymentStatus: 'processing' });
	tenantModel.settleMenuItemStock.mockResolvedValue(true);
	orderModel.transitionStatus.mockRejectedValueOnce(new Error('order update failed'));

	const req = mockReq({ orderId: 'oid', method: 'manual' });
	const res = mockRes();
	const next = jest.fn();

	await processPayment(req, res, next);

	expect(next).toHaveBeenCalledWith(expect.any(Error));
	expect(createRedisClient).not.toHaveBeenCalled();
	expect(session.endSession).toHaveBeenCalled();
});

test('processPayment returns existing payment result when transaction is already paid', async () => {
	const paidOrder = { _id: 'oid', tenantId: 'tid', status: 'paid' };
	transactionModel.findByOrderId.mockResolvedValue({
		_id: 'txid',
		orders: [paidOrder],
		paymentStatus: 'paid',
		paymentMethod: 'manual',
		paymentReference: 'existing-ref',
	});

	const req = mockReq({ orderId: 'oid', method: 'manual', paymentReference: 'new-ref' });
	const res = mockRes();
	const next = jest.fn();

	await processPayment(req, res, next);

	expect(transactionModel.update).not.toHaveBeenCalled();
	expect(orderModel.transitionStatus).not.toHaveBeenCalled();
	expect(mongoose.startSession).not.toHaveBeenCalled();
	expect(createRedisClient).not.toHaveBeenCalled();
	expect(res.status).toHaveBeenCalledWith(200);
	expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
		success: true,
		data: expect.objectContaining({
			order: paidOrder,
			transaction: expect.objectContaining({ paymentStatus: 'paid' }),
			payment: expect.objectContaining({ method: 'manual', reference: 'existing-ref', status: 'success' }),
		}),
	}));
});

test('processPayment returns first paid order and fallback payment fields on paid retry without matching order', async () => {
	const firstOrder = { _id: 'first-order', tenantId: 'tid', status: 'paid' };
	const secondOrder = { _id: 'second-order', tenantId: 'tid', status: 'paid' };
	transactionModel.findByOrderId.mockResolvedValue({
		_id: 'txid',
		orders: [firstOrder, secondOrder],
		paymentStatus: 'paid',
		paymentMethod: '',
		paymentReference: '',
	});

	const req = mockReq({ orderId: 'missing-order', method: 'bank-transfer' });
	const res = mockRes();
	const next = jest.fn();

	await processPayment(req, res, next);

	expect(transactionModel.update).not.toHaveBeenCalled();
	expect(orderModel.transitionStatus).not.toHaveBeenCalled();
	expect(createRedisClient).not.toHaveBeenCalled();
	expect(res.status).toHaveBeenCalledWith(200);
	expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
		success: true,
		data: expect.objectContaining({
			order: firstOrder,
			payment: expect.objectContaining({ method: 'bank-transfer', reference: null, status: 'success' }),
		}),
	}));
});

test('processPayment returns first updated order when payment target was transactionId', async () => {
	const firstPendingOrder = { _id: 'oid-1', tenantId: 'tid', status: 'pending', items: [{ menuItemId: 'mid-1', quantity: 1 }] };
	const secondPendingOrder = { _id: 'oid-2', tenantId: 'tid', status: 'pending', items: [{ menuItemId: 'mid-2', quantity: 2 }] };
	transactionModel.findById.mockResolvedValue({ _id: 'txid', orders: [firstPendingOrder, secondPendingOrder], paymentStatus: 'pending' });
	transactionModel.claimPendingPayment
		.mockResolvedValueOnce({ _id: 'txid', orders: [firstPendingOrder, secondPendingOrder], paymentStatus: 'processing' });
	transactionModel.update
		.mockResolvedValueOnce({
			_id: 'txid',
			orders: [
				{ _id: 'oid-1', tenantId: 'tid', status: 'paid' },
				{ _id: 'oid-2', tenantId: 'tid', status: 'paid' },
			],
			paymentStatus: 'paid',
		});
	orderModel.transitionStatus
		.mockResolvedValueOnce({ _id: 'oid-1', tenantId: 'tid', status: 'paid' })
		.mockResolvedValueOnce({ _id: 'oid-2', tenantId: 'tid', status: 'paid' });
	tenantModel.settleMenuItemStock.mockResolvedValue(true);

	const req = mockReq({ transactionId: 'txid', method: 'manual' });
	const res = mockRes();
	const next = jest.fn();

	await processPayment(req, res, next);

	expect(res.status).toHaveBeenCalledWith(200);
	expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
		success: true,
		data: expect.objectContaining({
			order: expect.objectContaining({ _id: 'oid-1', status: 'paid' }),
			payment: expect.objectContaining({ method: 'manual', status: 'success' }),
		}),
	}));
});

test('processPayment forwards settlement errors to next before Redis publish', async () => {
	const order = { _id: 'oid', tenantId: 'tid', status: 'pending', items: [{ menuItemId: 'mid', quantity: 1 }] };
	transactionModel.findByOrderId.mockResolvedValue({ _id: 'txid', orders: [order], paymentStatus: 'pending' });
	transactionModel.claimPendingPayment.mockResolvedValueOnce({ _id: 'txid', orders: [order], paymentStatus: 'processing' });
	tenantModel.settleMenuItemStock.mockResolvedValue(false);

	const req = mockReq({ orderId: 'oid', method: 'manual' });
	const res = mockRes();
	const next = jest.fn();

	await processPayment(req, res, next);

	expect(next).toHaveBeenCalledWith(expect.any(Error));
	expect(orderModel.transitionStatus).not.toHaveBeenCalled();
	expect(createRedisClient).not.toHaveBeenCalled();
});

test('processPayment returns existing paid result when another request already claimed and finished payment', async () => {
	const pendingOrder = { _id: 'oid', tenantId: 'tid', status: 'pending', items: [{ menuItemId: 'mid', quantity: 1 }] };
	const paidOrder = { _id: 'oid', tenantId: 'tid', status: 'paid', items: [{ menuItemId: 'mid', quantity: 1 }] };
	transactionModel.findByOrderId.mockResolvedValue({ _id: 'txid', orders: [pendingOrder], paymentStatus: 'pending' });
	transactionModel.claimPendingPayment.mockResolvedValueOnce(null);
	transactionModel.findById.mockResolvedValueOnce({
		_id: 'txid',
		orders: [paidOrder],
		paymentStatus: 'paid',
		paymentMethod: 'manual',
		paymentReference: 'existing-ref',
	});

	const req = mockReq({ orderId: 'oid', method: 'manual', paymentReference: 'new-ref' });
	const res = mockRes();
	const next = jest.fn();

	await processPayment(req, res, next);

	expect(transactionModel.claimPendingPayment).toHaveBeenCalled();
	expect(transactionModel.findById).toHaveBeenCalledWith('txid', { session });
	expect(tenantModel.settleMenuItemStock).not.toHaveBeenCalled();
	expect(orderModel.transitionStatus).not.toHaveBeenCalled();
	expect(createRedisClient).not.toHaveBeenCalled();
	expect(res.status).toHaveBeenCalledWith(200);
	expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
		success: true,
		data: expect.objectContaining({
			order: paidOrder,
			payment: expect.objectContaining({ reference: 'existing-ref', status: 'success' }),
		}),
	}));
});

test('processPayment returns 409 when another request is already processing the same payment', async () => {
	const pendingOrder = { _id: 'oid', tenantId: 'tid', status: 'pending', items: [{ menuItemId: 'mid', quantity: 1 }] };
	transactionModel.findByOrderId.mockResolvedValue({ _id: 'txid', orders: [pendingOrder], paymentStatus: 'pending' });
	transactionModel.claimPendingPayment.mockResolvedValueOnce(null);
	transactionModel.findById.mockResolvedValueOnce({
		_id: 'txid',
		orders: [pendingOrder],
		paymentStatus: 'processing',
	});

	const req = mockReq({ orderId: 'oid', method: 'manual' });
	const res = mockRes();
	const next = jest.fn();

	await processPayment(req, res, next);

	expect(tenantModel.settleMenuItemStock).not.toHaveBeenCalled();
	expect(orderModel.transitionStatus).not.toHaveBeenCalled();
	expect(createRedisClient).not.toHaveBeenCalled();
	expect(res.status).toHaveBeenCalledWith(409);
	expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Payment is already being processed' });
});

test('processPayment returns 404 when claim is lost and transaction no longer exists', async () => {
	const pendingOrder = { _id: 'oid', tenantId: 'tid', status: 'pending', items: [{ menuItemId: 'mid', quantity: 1 }] };
	transactionModel.findByOrderId.mockResolvedValue({ _id: 'txid', orders: [pendingOrder], paymentStatus: 'pending' });
	transactionModel.claimPendingPayment.mockResolvedValueOnce(null);
	transactionModel.findById.mockResolvedValueOnce(null);

	const req = mockReq({ orderId: 'oid', method: 'manual' });
	const res = mockRes();
	const next = jest.fn();

	await processPayment(req, res, next);

	expect(tenantModel.settleMenuItemStock).not.toHaveBeenCalled();
	expect(orderModel.update).not.toHaveBeenCalled();
	expect(res.status).toHaveBeenCalledWith(404);
	expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Transaction not found for payment target' });
});

test('processPayment returns generic 409 when claim is lost and transaction is neither paid nor processing', async () => {
	const pendingOrder = { _id: 'oid', tenantId: 'tid', status: 'pending', items: [{ menuItemId: 'mid', quantity: 1 }] };
	transactionModel.findByOrderId.mockResolvedValue({ _id: 'txid', orders: [pendingOrder], paymentStatus: 'pending' });
	transactionModel.claimPendingPayment.mockResolvedValueOnce(null);
	transactionModel.findById.mockResolvedValueOnce({ _id: 'txid', orders: [pendingOrder], paymentStatus: 'failed' });

	const req = mockReq({ orderId: 'oid', method: 'manual' });
	const res = mockRes();
	const next = jest.fn();

	await processPayment(req, res, next);

	expect(tenantModel.settleMenuItemStock).not.toHaveBeenCalled();
	expect(orderModel.update).not.toHaveBeenCalled();
	expect(res.status).toHaveBeenCalledWith(409);
	expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Unable to claim payment for processing' });
});

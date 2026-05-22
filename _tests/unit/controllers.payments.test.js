jest.mock('../../src/models/order.model');
jest.mock('ioredis', () => require('../../_mocks/ioredis'));

const orderModel = require('../../src/models/order.model');
const Redis = require('ioredis');
const { processPayment } = require('../../src/controllers/payments.controller');

function mockReq(body) {
  return { body };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

test('processPayment updates order and publishes event', async () => {
  const order = { _id: 'oid', tenantId: 'tid' };
  orderModel.findById.mockResolvedValue(order);
  orderModel.update.mockResolvedValue({ _id: 'oid', tenantId: 'tid', status: 'paid' });

  const RedisMock = require('ioredis');
  RedisMock.prototype.publish = jest.fn().mockResolvedValue(1);

  const req = mockReq({ orderId: 'oid', method: 'manual' });
  const res = mockRes();
  const next = jest.fn();

  await processPayment(req, res, next);

  expect(orderModel.findById).toHaveBeenCalledWith('oid');
  expect(orderModel.update).toHaveBeenCalledWith('oid', { status: 'paid' });
  expect(RedisMock.prototype.publish).toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(200);
});

test('processPayment returns 404 when order is not found', async () => {
  orderModel.findById.mockResolvedValue(null);

  const req = mockReq({ orderId: 'missing', method: 'manual' });
  const res = mockRes();
  const next = jest.fn();

  await processPayment(req, res, next);

  expect(orderModel.findById).toHaveBeenCalledWith('missing');
  expect(res.status).toHaveBeenCalledWith(404);
});

test('processPayment still succeeds when Redis publish fails', async () => {
  const order = { _id: 'oid', tenantId: 'tid' };
  orderModel.findById.mockResolvedValue(order);
  orderModel.update.mockResolvedValue({ _id: 'oid', tenantId: 'tid', status: 'paid' });

  const RedisMock = require('ioredis');
  RedisMock.prototype.publish = jest.fn().mockRejectedValue(new Error('publish failed'));

  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const req = mockReq({ orderId: 'oid', method: 'manual' });
  const res = mockRes();
  const next = jest.fn();

  await processPayment(req, res, next);

  expect(orderModel.findById).toHaveBeenCalledWith('oid');
  expect(orderModel.update).toHaveBeenCalledWith('oid', { status: 'paid' });
  expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to publish Redis event'), expect.any(String));
  expect(res.status).toHaveBeenCalledWith(200);
  errorSpy.mockRestore();
});

test('processPayment forwards unexpected errors to next', async () => {
  orderModel.findById.mockRejectedValueOnce(new Error('payment lookup failed'));

  const req = mockReq({ orderId: 'oid', method: 'manual' });
  const res = mockRes();
  const next = jest.fn();

  await processPayment(req, res, next);

  expect(next).toHaveBeenCalledWith(expect.any(Error));
});

test('processPayment logs publish failures without message property', async () => {
  const order = { _id: 'oid', tenantId: 'tid' };
  orderModel.findById.mockResolvedValue(order);
  orderModel.update.mockResolvedValue({ _id: 'oid', tenantId: 'tid', status: 'paid' });

  const RedisMock = require('ioredis');
  RedisMock.prototype.publish = jest.fn().mockRejectedValue({ code: 'NO_MESSAGE' });

  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const req = mockReq({ orderId: 'oid', method: 'manual' });
  const res = mockRes();
  const next = jest.fn();

  await processPayment(req, res, next);

  expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to publish Redis event'), expect.objectContaining({ code: 'NO_MESSAGE' }));
  expect(res.status).toHaveBeenCalledWith(200);
  errorSpy.mockRestore();
});

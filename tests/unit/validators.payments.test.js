const { validateProcessPayment } = require('../../src/validators/payments.validator');
const mongoose = require('mongoose');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

test('validateProcessPayment accepts valid body', () => {
  const req = { body: { orderId: new mongoose.Types.ObjectId().toString(), method: 'manual' } };
  const res = mockRes();
  const next = jest.fn();

  validateProcessPayment(req, res, next);
  expect(next).toHaveBeenCalled();
});

test('validateProcessPayment accepts valid transactionId body', () => {
  const req = { body: { transactionId: new mongoose.Types.ObjectId().toString(), method: 'manual' } };
  const res = mockRes();
  const next = jest.fn();

  validateProcessPayment(req, res, next);
  expect(next).toHaveBeenCalled();
});

test('validateProcessPayment rejects missing payment target', () => {
  const req = { body: { method: 'card' } };
  const res = mockRes();
  const next = jest.fn();

  validateProcessPayment(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateProcessPayment rejects missing method', () => {
  const req = { body: { orderId: new mongoose.Types.ObjectId().toString(), method: '' } };
  const res = mockRes();
  const next = jest.fn();

  validateProcessPayment(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});
test('validateProcessPayment rejects invalid orderId', () => {
  const req = { body: { orderId: 'bad', method: 'manual' } };
  const res = mockRes();
  const next = jest.fn();

  validateProcessPayment(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateProcessPayment rejects invalid transactionId', () => {
  const req = { body: { transactionId: 'bad', method: 'manual' } };
  const res = mockRes();
  const next = jest.fn();

  validateProcessPayment(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

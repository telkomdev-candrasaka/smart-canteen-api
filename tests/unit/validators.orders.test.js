const { validateCreateOrder, validateOrderId, validateUpdateOrderStatus } = require('../../src/validators/orders.validator');
const mongoose = require('mongoose');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

test('validateCreateOrder accepts valid order', () => {
  const req = { body: { tenantId: new mongoose.Types.ObjectId().toString(), items: [{ name: 'Tea', price: 5000, quantity: 2 }] } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateOrder(req, res, next);
  expect(next).toHaveBeenCalled();
  expect(Array.isArray(req.body.items)).toBe(true);
  expect(req.body.items[0].price).toBe(5000);
});

test('validateCreateOrder rejects invalid tenantId', () => {
  const req = { body: { tenantId: 'bad', items: [{ name: 'Tea', price: 5000 }] } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateOrder(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateOrderId rejects missing id', () => {
  const req = { params: { id: '   ' } };
  const res = mockRes();
  const next = jest.fn();

  validateOrderId(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateOrderId rejects malformed id', () => {
  const req = { params: { id: 'not-an-id' } };
  const res = mockRes();
  const next = jest.fn();

  validateOrderId(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateCreateOrder rejects missing tenantId', () => {
  const req = { body: { items: [{ name: 'Tea', price: 5000, quantity: 1 }] } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateOrder(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateCreateOrder rejects empty items array', () => {
  const req = { body: { tenantId: new mongoose.Types.ObjectId().toString(), items: [] } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateOrder(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateCreateOrder rejects blank item name', () => {
  const req = { body: { tenantId: new mongoose.Types.ObjectId().toString(), items: [{ name: '   ', price: 5000, quantity: 1 }] } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateOrder(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateCreateOrder rejects invalid item objects', () => {
  const req = { body: { tenantId: new mongoose.Types.ObjectId().toString(), items: [null] } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateOrder(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateCreateOrder rejects invalid item price', () => {
  const req = { body: { tenantId: new mongoose.Types.ObjectId().toString(), items: [{ name: 'Tea', price: 'abc', quantity: 1 }] } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateOrder(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateCreateOrder rejects invalid item quantity', () => {
  const req = { body: { tenantId: new mongoose.Types.ObjectId().toString(), items: [{ name: 'Tea', price: 10000, quantity: 0 }] } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateOrder(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateCreateOrder defaults quantity to one when omitted', () => {
  const req = { body: { tenantId: new mongoose.Types.ObjectId().toString(), items: [{ name: 'Tea', price: 10000 }] } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateOrder(req, res, next);

  expect(next).toHaveBeenCalled();
  expect(req.body.items[0].quantity).toBe(1);
});

test('validateOrderId accepts valid id', () => {
  const id = new mongoose.Types.ObjectId().toString();
  const req = { params: { id } };
  const res = mockRes();
  const next = jest.fn();

  validateOrderId(req, res, next);
  expect(next).toHaveBeenCalled();
});

test('validateUpdateOrderStatus accepts valid order state and trims input', () => {
  const req = { body: { status: ' preparing ' } };
  const res = mockRes();
  const next = jest.fn();

  validateUpdateOrderStatus(req, res, next);

  expect(next).toHaveBeenCalled();
  expect(req.body).toEqual({ status: 'preparing' });
});

test('validateUpdateOrderStatus rejects missing status', () => {
  const req = { body: {} };
  const res = mockRes();
  const next = jest.fn();

  validateUpdateOrderStatus(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateUpdateOrderStatus rejects unsupported state', () => {
  const req = { body: { status: 'shipped' } };
  const res = mockRes();
  const next = jest.fn();

  validateUpdateOrderStatus(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

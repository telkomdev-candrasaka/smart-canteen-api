const { validateCreateTenant, validateTenantId } = require('../../src/validators/tenants.validator');
const mongoose = require('mongoose');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

test('validateCreateTenant accepts valid tenant and menu', () => {
  const req = { body: { name: ' T ', menu: [{ name: 'Tea', price: 5000 }] } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateTenant(req, res, next);
  expect(next).toHaveBeenCalled();
  expect(req.body.menu[0].price).toBe(5000);
});

test('validateCreateTenant rejects invalid menu price', () => {
  const req = { body: { name: 'T', menu: [{ name: 'Tea', price: -1 }] } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateTenant(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateTenantId accepts valid id', () => {
  const id = new mongoose.Types.ObjectId().toString();
  const req = { params: { id } };
  const res = mockRes();
  const next = jest.fn();

  validateTenantId(req, res, next);
  expect(next).toHaveBeenCalled();
});

test('validateTenantId rejects missing id', () => {
  const req = { params: { id: '   ' } };
  const res = mockRes();
  const next = jest.fn();

  validateTenantId(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateTenantId rejects malformed id', () => {
  const req = { params: { id: 'not-an-id' } };
  const res = mockRes();
  const next = jest.fn();

  validateTenantId(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateCreateTenant rejects missing name', () => {
  const req = { body: { name: '   ' } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateTenant(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateCreateTenant rejects invalid description type', () => {
  const req = { body: { name: 'Shop', description: 123 } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateTenant(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateCreateTenant rejects non-array menu', () => {
  const req = { body: { name: 'Shop', menu: 'not-an-array' } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateTenant(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateCreateTenant rejects invalid menu item object', () => {
  const req = { body: { name: 'Shop', menu: [null] } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateTenant(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateCreateTenant rejects missing menu item name', () => {
  const req = { body: { name: 'Shop', menu: [{ name: '   ', price: 4000 }] } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateTenant(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateCreateTenant rejects invalid menu item price type', () => {
  const req = { body: { name: 'Shop', menu: [{ name: 'Tea', price: {} }] } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateTenant(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateCreateTenant rejects invalid menu item quantity', () => {
  const req = { body: { name: 'Shop', menu: [{ name: 'Tea', price: 4000, quantity: 0 }] } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateTenant(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateCreateTenant rejects non-integer menu item quantity', () => {
  const req = { body: { name: 'Shop', menu: [{ name: 'Tea', price: 4000, quantity: 1.5 }] } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateTenant(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateCreateTenant sanitizes valid data', () => {
  const req = { body: { name: ' Shop ', description: ' Desc ', menu: [{ name: 'Tea', price: '5000', description: ' Hot ', available: 0 }] } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateTenant(req, res, next);
  expect(next).toHaveBeenCalled();
  expect(req.body.name).toBe('Shop');
  expect(req.body.menu[0].price).toBe(5000);
  expect(req.body.menu[0].available).toBe(false);
});

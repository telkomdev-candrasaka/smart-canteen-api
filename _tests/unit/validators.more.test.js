const { validateCreateTenant } = require('../../src/validators/tenants.validator');
const { validateCreateOrder } = require('../../src/validators/orders.validator');
const { validateRegister } = require('../../src/validators/auth.validator');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

test('validateCreateTenant rejects menu not array', () => {
  const req = { body: { name: 'T', menu: 'notarray' } };
  const res = mockRes();
  const next = jest.fn();
  validateCreateTenant(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateCreateTenant rejects menu item not object', () => {
  const req = { body: { name: 'T', menu: [null] } };
  const res = mockRes();
  const next = jest.fn();
  validateCreateTenant(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateCreateOrder rejects non-integer quantity', () => {
  const req = { body: { tenantId: '507f1f77bcf86cd799439011', items: [{ name: 'x', price: 100, quantity: 1.5 }] } };
  const res = mockRes();
  const next = jest.fn();
  validateCreateOrder(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateRegister rejects invalid role and missing tenantId for TENANT_ADMIN', () => {
  const req1 = { body: { email: 'a@b.com', password: 'secret123', role: 'INVALID' } };
  const res1 = mockRes();
  const next1 = jest.fn();
  validateRegister(req1, res1, next1);
  expect(res1.status).toHaveBeenCalledWith(400);

  const req2 = { body: { email: 'a@b.com', password: 'secret123', role: 'TENANT_ADMIN' } };
  const res2 = mockRes();
  const next2 = jest.fn();
  validateRegister(req2, res2, next2);
  expect(res2.status).toHaveBeenCalledWith(400);
});

const { validateRegister, validateLogin } = require('../../src/validators/auth.validator');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

test('validateRegister requires email and password', () => {
  const req = { body: { email: '', password: '123' } };
  const res = mockRes();
  const next = jest.fn();

  validateRegister(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateRegister rejects short password with valid email', () => {
  const req = { body: { email: 'valid@example.com', password: '12345' } };
  const res = mockRes();
  const next = jest.fn();

  validateRegister(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateLogin accepts valid input', () => {
  const req = { body: { email: 'a@b.com', password: 'secret' } };
  const res = mockRes();
  const next = jest.fn();

  validateLogin(req, res, next);
  expect(next).toHaveBeenCalled();
});

test('validateLogin rejects missing email', () => {
  const req = { body: { email: '   ', password: 'secret' } };
  const res = mockRes();
  const next = jest.fn();

  validateLogin(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateLogin rejects non-string password', () => {
  const req = { body: { email: 'a@b.com', password: 123456 } };
  const res = mockRes();
  const next = jest.fn();

  validateLogin(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateRegister rejects unsupported role values', () => {
  const req = { body: { email: 'a@b.com', password: 'secret12', role: 'INVALID' } };
  const res = mockRes();
  const next = jest.fn();

  validateRegister(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateRegister requires tenantId for TENANT_ADMIN role', () => {
  const req = { body: { email: 'a@b.com', password: 'secret12', role: 'TENANT_ADMIN' } };
  const res = mockRes();
  const next = jest.fn();

  validateRegister(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateRegister accepts valid input when role is omitted', () => {
  const req = { body: { email: '  A@B.COM  ', password: 'secret12' } };
  const res = mockRes();
  const next = jest.fn();

  validateRegister(req, res, next);

  expect(next).toHaveBeenCalled();
  expect(req.body.email).toBe('a@b.com');
});

test('validateLogin rejects missing password', () => {
  const req = { body: { email: 'a@b.com', password: '' } };
  const res = mockRes();
  const next = jest.fn();

  validateLogin(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

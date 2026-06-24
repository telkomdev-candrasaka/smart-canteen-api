jest.mock('jsonwebtoken');
jest.mock('../../src/config/env', () => ({
  validateEnv: jest.fn(() => ({ jwtSecret: 'testsecret' })),
}));

const jwt = require('jsonwebtoken');
const { verifyToken, requireRole } = require('../../src/middlewares/auth.middleware');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

test('verifyToken returns 401 when missing', () => {
  const req = { headers: {} };
  const res = mockRes();
  const next = jest.fn();

  verifyToken(req, res, next);
  expect(res.status).toHaveBeenCalledWith(401);
});

test('verifyToken sets req.user when token valid', () => {
  jwt.verify.mockReturnValue({ id: '1', role: 'SUPER_ADMIN' });
  const req = { headers: { authorization: 'Bearer tok' } };
  const res = mockRes();
  const next = jest.fn();

  verifyToken(req, res, next);
  expect(req.user.role).toBe('SUPER_ADMIN');
  expect(next).toHaveBeenCalled();
});

test('requireRole allows matching role', () => {
  const mw = requireRole(['SUPER_ADMIN']);
  const req = { user: { role: 'SUPER_ADMIN' } };
  const res = mockRes();
  const next = jest.fn();

  mw(req, res, next);
  expect(next).toHaveBeenCalled();
});

test('requireRole forbids non-matching role', () => {
  const mw = requireRole(['TENANT_ADMIN']);
  const req = { user: { role: 'MEMBER' } };
  const res = mockRes();
  const next = jest.fn();

  mw(req, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
});

test('verifyToken forwards error when token is invalid', () => {
  jwt.verify.mockImplementation(() => { throw new Error('invalid token'); });
  const req = { headers: { authorization: 'Bearer bad' } };
  const res = mockRes();
  const next = jest.fn();

  verifyToken(req, res, next);
  expect(next).toHaveBeenCalledWith(expect.any(Error));
});

test('requireRole allows when no roles are provided', () => {
  const mw = requireRole();
  const req = { user: { role: 'MEMBER' } };
  const res = mockRes();
  const next = jest.fn();

  mw(req, res, next);
  expect(next).toHaveBeenCalled();
});

test('requireRole returns 401 when req.user is missing', () => {
  const mw = requireRole(['SUPER_ADMIN']);
  const res = mockRes();
  const next = jest.fn();

  mw({}, res, next);

  expect(res.status).toHaveBeenCalledWith(401);
});

test('requireRole forwards unexpected errors to next', () => {
  const mw = requireRole(['SUPER_ADMIN']);
  const req = {};
  Object.defineProperty(req, 'user', {
    get() {
      throw new Error('broken req');
    },
  });
  const res = mockRes();
  const next = jest.fn();

  mw(req, res, next);

  expect(next).toHaveBeenCalledWith(expect.any(Error));
});

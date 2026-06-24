const { validateCreateItem, validateItemId, validateUpdateItem } = require('../../src/validators/items.validator');
const mongoose = require('mongoose');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

test('validateCreateItem accepts valid input and sanitizes', () => {
  const req = { body: { name: '  Tea  ', description: ' nice ' } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateItem(req, res, next);

  expect(next).toHaveBeenCalled();
  expect(req.body.name).toBe('Tea');
  expect(req.body.description).toBe('nice');
});

test('validateCreateItem rejects empty name', () => {
  const req = { body: { name: '   ' } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateItem(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(next).not.toHaveBeenCalled();
});

test('validateItemId rejects invalid id', () => {
  const req = { params: { id: 'invalid' } };
  const res = mockRes();
  const next = jest.fn();

  validateItemId(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateItemId allows valid ObjectId', () => {
  const id = new mongoose.Types.ObjectId().toString();
  const req = { params: { id } };
  const res = mockRes();
  const next = jest.fn();

  validateItemId(req, res, next);
  expect(next).toHaveBeenCalled();
});

test('validateItemId rejects missing id', () => {
  const req = { params: { id: '   ' } };
  const res = mockRes();
  const next = jest.fn();

  validateItemId(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateUpdateItem enforces allowed fields', () => {
  const req = { body: { bad: 'x' } };
  const res = mockRes();
  const next = jest.fn();

  validateUpdateItem(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateCreateItem rejects invalid description', () => {
  const req = { body: { name: 'Test', description: '' } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateItem(req, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateCreateItem defaults description to empty string when omitted', () => {
  const req = { body: { name: 'Tea' } };
  const res = mockRes();
  const next = jest.fn();

  validateCreateItem(req, res, next);

  expect(next).toHaveBeenCalled();
  expect(req.body.description).toBe('');
});

test('validateUpdateItem accepts valid update and trims input', () => {
  const req = { body: { name: ' Updated ' } };
  const res = mockRes();
  const next = jest.fn();

  validateUpdateItem(req, res, next);
  expect(next).toHaveBeenCalled();
  expect(req.body.name).toBe('Updated');
});

test('validateUpdateItem rejects empty body', () => {
  const req = { body: {} };
  const res = mockRes();
  const next = jest.fn();

  validateUpdateItem(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateUpdateItem rejects invalid name when provided', () => {
  const req = { body: { name: '   ' } };
  const res = mockRes();
  const next = jest.fn();

  validateUpdateItem(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateUpdateItem rejects invalid description when provided', () => {
  const req = { body: { description: '' } };
  const res = mockRes();
  const next = jest.fn();

  validateUpdateItem(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
});

test('validateUpdateItem trims description when valid', () => {
  const req = { body: { description: ' Fresh ' } };
  const res = mockRes();
  const next = jest.fn();

  validateUpdateItem(req, res, next);

  expect(next).toHaveBeenCalled();
  expect(req.body.description).toBe('Fresh');
});

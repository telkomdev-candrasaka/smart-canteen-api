const { errorHandler } = require('../../src/middlewares/error-handler');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

test('errorHandler uses status and message from error', () => {
  const err = { status: 400, message: 'Bad' };
  const res = mockRes();
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

  errorHandler(err, {}, res, () => {});
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Bad' });
  spy.mockRestore();
});

test('errorHandler defaults to 500', () => {
  const err = {};
  const res = mockRes();
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

  errorHandler(err, {}, res, () => {});
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Internal server error' });
  spy.mockRestore();
});

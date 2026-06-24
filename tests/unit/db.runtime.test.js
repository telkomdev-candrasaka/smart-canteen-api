jest.mock('mongoose');

const mongoose = require('mongoose');
const { disconnectFromDatabase, getDatabaseHealth } = require('../../src/config/db');

test('disconnectFromDatabase skips disconnect when mongoose is not connected', async () => {
  mongoose.connection = { readyState: 0 };
  mongoose.disconnect = jest.fn().mockResolvedValue(undefined);

  await disconnectFromDatabase();

  expect(mongoose.disconnect).not.toHaveBeenCalled();
});

test('disconnectFromDatabase disconnects when mongoose is connected', async () => {
  mongoose.connection = { readyState: 1 };
  mongoose.disconnect = jest.fn().mockResolvedValue(undefined);

  await disconnectFromDatabase();

  expect(mongoose.disconnect).toHaveBeenCalled();
});

test('getDatabaseHealth reports up and down based on readyState', () => {
  mongoose.connection = { readyState: 1 };
  expect(getDatabaseHealth()).toBe('up');

  mongoose.connection = { readyState: 0 };
  expect(getDatabaseHealth()).toBe('down');
});

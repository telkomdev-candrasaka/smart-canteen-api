jest.mock('mongoose');
const mongoose = require('mongoose');

const { connectToDatabase } = require('../../src/config/db');

test('connectToDatabase throws when MONGODB_URI missing', async () => {
  const real = process.env.MONGODB_URI;
  delete process.env.MONGODB_URI;
  await expect(connectToDatabase()).rejects.toThrow('MONGODB_URI is not configured');
  process.env.MONGODB_URI = real;
});

test('connectToDatabase calls mongoose.connect when MONGODB_URI present', async () => {
  process.env.MONGODB_URI = 'mongodb://ok';
  mongoose.connect = jest.fn().mockResolvedValue(true);
  await connectToDatabase();
  expect(mongoose.connect).toHaveBeenCalledWith('mongodb://ok');
});

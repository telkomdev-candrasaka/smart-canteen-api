const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
});

const userModel = require('../../src/models/user.model');

test('create and find user by email and id', async () => {
  const user = await userModel.create({ email: 'x@y.com', password: 'hash', role: 'MEMBER' });
  const byEmail = await userModel.findByEmail('x@y.com');
  expect(byEmail._id.toString()).toBe(user._id.toString());

  const byId = await userModel.findById(user._id);
  expect(byId.email).toBe('x@y.com');
});

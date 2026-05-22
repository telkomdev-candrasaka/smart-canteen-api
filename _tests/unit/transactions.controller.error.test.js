const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
  app = require('../../src/app');
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test('createTransaction requires customerName and phone', async () => {
  await request(app).post('/transactions').send({}).expect(400);
});

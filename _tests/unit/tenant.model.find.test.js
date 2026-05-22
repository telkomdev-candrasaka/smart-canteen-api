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
  await mongod.stop();
});

const tenantModel = require('../../src/models/tenant.model');

test('findAll and findById work', async () => {
  const a = await tenantModel.create({ name: 'FindAll1' });
  const b = await tenantModel.create({ name: 'FindAll2' });

  const all = await tenantModel.findAll();
  expect(all.length).toBeGreaterThanOrEqual(2);

  const found = await tenantModel.findById(a._id);
  expect(found.name).toBe('FindAll1');
});

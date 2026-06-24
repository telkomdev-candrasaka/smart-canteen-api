const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
});
afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
});

const tenantModel = require('../../src/models/tenant.model');

test('findAll and findById work', async () => {
  const a = await tenantModel.create({ name: 'FindAll1' });
  const b = await tenantModel.create({ name: 'FindAll2' });

  const all = await tenantModel.findAll();
  expect(all.length).toBeGreaterThanOrEqual(2);

  const found = await tenantModel.findById(a._id);
  expect(found.name).toBe('FindAll1');

  const foundB = await tenantModel.findById(b._id);
  expect(foundB.name).toBe('FindAll2');
});

test('findById supports session-aware reads', async () => {
  const tenant = await tenantModel.create({ name: 'Session Find Tenant' });
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const found = await tenantModel.findById(tenant._id, { session });
      expect(found.name).toBe('Session Find Tenant');
    });
  } finally {
    await session.endSession();
  }
});

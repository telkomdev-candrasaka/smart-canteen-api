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

test('addMenuItem returns null when tenant not found', async () => {
  const res = await tenantModel.addMenuItem(new mongoose.Types.ObjectId(), { name: 'X', price: 1 });
  expect(res).toBeNull();
});

test('addMenuItem adds item to tenant menu', async () => {
  const t = await tenantModel.create({ name: 'A', menu: [] });
  const updated = await tenantModel.addMenuItem(t._id, { name: 'New', price: 1000 });
  expect(updated.menu.length).toBe(1);
  expect(updated.menu[0].name).toBe('New');
});

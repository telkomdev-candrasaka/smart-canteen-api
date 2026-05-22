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

test('createOrder returns 400 when menu item not found', async () => {
  const tenantRes = await require('supertest')(app)
    .post('/tenants')
    .send({ name: 'NoMenu' })
    .expect(201);

  const tenant = tenantRes.body.data;

  await require('supertest')(app)
    .post('/orders')
    .send({ tenantId: tenant._id, items: [{ menuItemId: new mongoose.Types.ObjectId(), name: 'X', quantity: 1 }] })
    .expect(400);
});

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const userModel = require('../../src/models/user.model');
let mongod;
let app;
let adminToken;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'testsecret';
  process.env.REDIS_URL = 'redis://localhost';
  await mongoose.connect(process.env.MONGODB_URI);
  app = require('../../src/app');

  const hashed = await bcrypt.hash('secret123', 10);
  await userModel.create({ email: 'phase1-admin@example.com', password: hashed, role: 'SUPER_ADMIN' });

  const registerRes = await request(app)
    .post('/auth/login')
    .send({ email: 'phase1-admin@example.com', password: 'secret123' })
    .expect(200);

  adminToken = registerRes.body.data.token;
});
afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
});

test('createOrder returns 400 when menu item not found', async () => {
  const tenantRes = await request(app)
    .post('/tenants')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'NoMenu' })
    .expect(201);

  const tenant = tenantRes.body.data;

  await request(app)
    .post('/orders')
    .send({ tenantId: tenant._id, items: [{ menuItemId: new mongoose.Types.ObjectId(), name: 'X', quantity: 1 }] })
    .expect(400);
});

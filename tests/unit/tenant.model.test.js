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

afterEach(async () => {
  if (mongoose.connection && mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
  }
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

test('reserveMenuItemStock decrements stock and increments reserved when inventory is available', async () => {
  const tenant = await tenantModel.create({
    name: 'Reserve Tenant',
    menu: [{ name: 'Tea', price: 5000, stock: 5, reserved: 0, sold: 0, available: true }],
  });

  const menuItem = tenant.menu[0];
  const reserved = await tenantModel.reserveMenuItemStock(tenant._id, menuItem._id, 3);

  expect(reserved).toBe(true);

  const persistedTenant = await tenantModel.findById(tenant._id);
  const persistedMenuItem = persistedTenant.menu.id(menuItem._id);
  expect(persistedMenuItem.stock).toBe(2);
  expect(persistedMenuItem.reserved).toBe(3);
  expect(persistedMenuItem.sold).toBe(0);
});

test('reserveMenuItemStock returns false when stock is insufficient or item is unavailable', async () => {
  const tenant = await tenantModel.create({
    name: 'Unavailable Tenant',
    menu: [
      { name: 'Tea', price: 5000, stock: 1, reserved: 0, sold: 0, available: true },
      { name: 'Coffee', price: 7000, stock: 5, reserved: 0, sold: 0, available: false },
    ],
  });

  const tea = tenant.menu.find((item) => item.name === 'Tea');
  const coffee = tenant.menu.find((item) => item.name === 'Coffee');

  await expect(tenantModel.reserveMenuItemStock(tenant._id, tea._id, 2)).resolves.toBe(false);
  await expect(tenantModel.reserveMenuItemStock(tenant._id, coffee._id, 1)).resolves.toBe(false);

  const persistedTenant = await tenantModel.findById(tenant._id);
  const persistedTea = persistedTenant.menu.id(tea._id);
  const persistedCoffee = persistedTenant.menu.id(coffee._id);

  expect(persistedTea.stock).toBe(1);
  expect(persistedTea.reserved).toBe(0);
  expect(persistedCoffee.stock).toBe(5);
  expect(persistedCoffee.reserved).toBe(0);
});

test('settleMenuItemStock decrements reserved and increments sold when stock is reserved', async () => {
  const tenant = await tenantModel.create({
    name: 'Settle Tenant',
    menu: [{ name: 'Latte', price: 12000, stock: 2, reserved: 3, sold: 1, available: true }],
  });

  const menuItem = tenant.menu[0];
  const settled = await tenantModel.settleMenuItemStock(tenant._id, menuItem._id, 2);

  expect(settled).toBe(true);

  const persistedTenant = await tenantModel.findById(tenant._id);
  const persistedMenuItem = persistedTenant.menu.id(menuItem._id);
  expect(persistedMenuItem.stock).toBe(2);
  expect(persistedMenuItem.reserved).toBe(1);
  expect(persistedMenuItem.sold).toBe(3);
});

test('settleMenuItemStock returns false when reserved quantity is insufficient', async () => {
  const tenant = await tenantModel.create({
    name: 'Settle Failure Tenant',
    menu: [{ name: 'Mocha', price: 15000, stock: 4, reserved: 1, sold: 0, available: true }],
  });

  const menuItem = tenant.menu[0];
  const settled = await tenantModel.settleMenuItemStock(tenant._id, menuItem._id, 2);

  expect(settled).toBe(false);

  const persistedTenant = await tenantModel.findById(tenant._id);
  const persistedMenuItem = persistedTenant.menu.id(menuItem._id);
  expect(persistedMenuItem.stock).toBe(4);
  expect(persistedMenuItem.reserved).toBe(1);
  expect(persistedMenuItem.sold).toBe(0);
});

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const authController = require('../../src/controllers/auth.controller');
const userModel = require('../../src/models/user.model');

let mongod;
beforeAll(async () => {
	mongod = await MongoMemoryServer.create();
	process.env.MONGODB_URI = mongod.getUri();
	process.env.JWT_SECRET = 'test-secret';
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

function mockRes() {
	const res = {};
	res.status = jest.fn().mockReturnValue(res);
	res.json = jest.fn().mockReturnValue(res);
	return res;
}

test('register returns 409 when email already exists', async () => {
	const hashed = await bcrypt.hash('secret123', 10);
	await userModel.create({ email: 'someone@test.com', password: hashed });

	const req = { body: { email: 'someone@test.com', password: 'secret123' } };
	const res = mockRes();
	const next = jest.fn();

	await authController.register(req, res, next);

	expect(res.status).toHaveBeenCalledWith(409);
	expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
});

test('register always creates public users with MEMBER role', async () => {
	const req = { body: { email: 'member-only@test.com', password: 'secret123', role: 'SUPER_ADMIN' } };
	const res = mockRes();
	const next = jest.fn();

	await authController.register(req, res, next);

	expect(res.status).toHaveBeenCalledWith(201);
	const responseBody = res.json.mock.calls[0][0];
	expect(responseBody.data.user.role).toBe('MEMBER');

	const createdUser = await userModel.findByEmail('member-only@test.com');
	expect(createdUser.role).toBe('MEMBER');
});

test('login returns 401 when user not found', async () => {
	const req = { body: { email: 'missing@test.com', password: 'secret123' } };
	const res = mockRes();
	const next = jest.fn();

	await authController.login(req, res, next);

	expect(res.status).toHaveBeenCalledWith(401);
	expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
});

test('login returns 401 when password is invalid', async () => {
	const hashed = await bcrypt.hash('mysecret', 10);
	await userModel.create({ email: 'user@test.com', password: hashed });

	const req = { body: { email: 'user@test.com', password: 'wrongpass' } };
	const res = mockRes();
	const next = jest.fn();

	await authController.login(req, res, next);

	expect(res.status).toHaveBeenCalledWith(401);
	expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
});

test('login returns 200 and a token when credentials are valid', async () => {
	const hashed = await bcrypt.hash('secret123', 10);
	await userModel.create({ email: 'auth@test.com', password: hashed, role: 'MEMBER' });

	const req = { body: { email: 'auth@test.com', password: 'secret123' } };
	const res = mockRes();
	const next = jest.fn();

	await authController.login(req, res, next);

	expect(res.status).toHaveBeenCalledWith(200);
	expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.objectContaining({ token: expect.any(String) }) }));
});

test('register forwards unexpected errors to next', async () => {
	const spy = jest.spyOn(userModel, 'findByEmail').mockRejectedValueOnce(new Error('db failure'));
	const req = { body: { email: 'oops@test.com', password: 'secret123' } };
	const res = mockRes();
	const next = jest.fn();

	await authController.register(req, res, next);

	expect(next).toHaveBeenCalledWith(expect.any(Error));
	spy.mockRestore();
});

test('login forwards unexpected errors to next', async () => {
	const spy = jest.spyOn(userModel, 'findByEmail').mockRejectedValueOnce(new Error('lookup failure'));
	const req = { body: { email: 'oops@test.com', password: 'secret123' } };
	const res = mockRes();
	const next = jest.fn();

	await authController.login(req, res, next);

	expect(next).toHaveBeenCalledWith(expect.any(Error));
	spy.mockRestore();
});

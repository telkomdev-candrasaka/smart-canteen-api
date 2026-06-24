jest.mock('../../src/config/db', () => ({
	getDatabaseHealth: jest.fn(),
}));
jest.mock('../../src/config/redis', () => ({
	getRedisHealth: jest.fn(),
}));

const request = require('supertest');
const { getDatabaseHealth } = require('../../src/config/db');
const { getRedisHealth } = require('../../src/config/redis');
const app = require('../../src/app');

test('GET /health returns API status', async () => {
	getDatabaseHealth.mockReturnValue('up');
	getRedisHealth.mockResolvedValue('up');

	await request(app)
		.get('/health')
		.expect(200)
		.expect((res) => {
			expect(res.body).toEqual({ status: 'ok', services: { mongodb: 'up', redis: 'up' } });
		});
});

test('GET /health returns 503 when a dependency is down', async () => {
	getDatabaseHealth.mockReturnValue('up');
	getRedisHealth.mockResolvedValue('down');

	await request(app)
		.get('/health')
		.expect(503)
		.expect((res) => {
			expect(res.body).toEqual({ status: 'error', services: { mongodb: 'up', redis: 'down' } });
		});
});

test('unknown route returns 404 with route message', async () => {
	await request(app)
		.get('/unknown-path')
		.expect(404)
		.expect((res) => {
			expect(res.body).toEqual({ success: false, message: 'Route GET /unknown-path not found' });
		});
});

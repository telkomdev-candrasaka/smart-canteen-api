describe('env config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('getConfig returns defaults for missing optional values', () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;

    const { getConfig } = require('../../src/config/env');
    const config = getConfig();

    expect(config.port).toBe('3000');
    expect(config.nodeEnv).toBe('development');
  });

  test('getConfig normalizes and preserves provided values', () => {
    process.env.PORT = ' 4000 ';
    process.env.NODE_ENV = 'production';
    process.env.MONGODB_URI = ' mongodb://db ';
    process.env.JWT_SECRET = ' secret ';
    process.env.REDIS_URL = ' redis://cache ';

    const { getConfig } = require('../../src/config/env');
    const config = getConfig();

    expect(config).toEqual({
      port: '4000',
      nodeEnv: 'production',
      mongodbUri: 'mongodb://db',
      jwtSecret: 'secret',
      redisUrl: 'redis://cache',
    });
  });

  test('getConfig falls back to development for invalid NODE_ENV', () => {
    process.env.NODE_ENV = 'staging';

    const { getConfig } = require('../../src/config/env');
    expect(getConfig().nodeEnv).toBe('development');
  });

  test('validateEnv throws with all requested missing variables', () => {
    delete process.env.MONGODB_URI;
    delete process.env.JWT_SECRET;
    delete process.env.REDIS_URL;

    const { validateEnv } = require('../../src/config/env');

    expect(() => validateEnv({ requireMongo: true, requireJwt: true, requireRedis: true })).toThrow(
      'Missing required environment variables: MONGODB_URI, JWT_SECRET, REDIS_URL'
    );
  });
});

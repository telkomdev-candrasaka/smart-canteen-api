jest.mock('../../src/config/env', () => ({
  validateEnv: jest.fn(() => ({ redisUrl: 'redis://cache' })),
}));
jest.mock('../../src/utils/logger', () => ({
  warn: jest.fn(),
}));

describe('redis config helpers', () => {
  let RedisMock;
  let logger;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    logger = require('../../src/utils/logger');
    RedisMock = jest.fn(() => {
      const listeners = {};

      return {
        on: jest.fn((eventName, cb) => {
          listeners[eventName] = cb;
        }),
        ping: jest.fn().mockResolvedValue('PONG'),
        quit: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn(),
        __listeners: listeners,
      };
    });

    jest.doMock('ioredis', () => RedisMock);
  });

  test('createRedisClient tracks and untracks client lifecycle', () => {
    const { createRedisClient } = require('../../src/config/redis');
    const client = createRedisClient('worker');

    expect(RedisMock).toHaveBeenCalledWith('redis://cache');
    expect(client.on).toHaveBeenCalledTimes(2);

    client.__listeners.error(new Error('boom'));
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ client: 'worker', err: expect.any(Error) }), 'Redis client error');

    client.__listeners.end();
    expect(client.__listeners.end).toBeDefined();
  });

  test('closeRedisClient safely handles missing client', async () => {
    const { closeRedisClient } = require('../../src/config/redis');
    await expect(closeRedisClient()).resolves.toBeUndefined();
  });

  test('closeRedisClient falls back to disconnect when quit fails', async () => {
    const { closeRedisClient } = require('../../src/config/redis');
    const client = {
      quit: jest.fn().mockRejectedValue(new Error('quit failed')),
      disconnect: jest.fn(),
    };

    await closeRedisClient(client);

    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), 'Redis quit failed, disconnecting client');
    expect(client.disconnect).toHaveBeenCalled();
  });

  test('getRedisHealth returns down when ping is not PONG', async () => {
    RedisMock = jest.fn(() => {
      const listeners = {};

      return {
        on: jest.fn((eventName, cb) => {
          listeners[eventName] = cb;
        }),
        ping: jest.fn().mockResolvedValue('NOPE'),
        quit: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn(),
        __listeners: listeners,
      };
    });

    jest.doMock('ioredis', () => RedisMock);
    const { getRedisHealth } = require('../../src/config/redis');

    await expect(getRedisHealth()).resolves.toBe('down');
  });

  test('getRedisHealth returns down when client creation or ping fails', async () => {
    RedisMock.mockImplementation(() => {
      throw new Error('redis init failed');
    });

    const { getRedisHealth } = require('../../src/config/redis');
    await expect(getRedisHealth()).resolves.toBe('down');
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), 'Redis health check failed');
  });

  test('shutdownRedisClients closes tracked and health clients', async () => {
    const { createRedisClient, getRedisHealth, shutdownRedisClients } = require('../../src/config/redis');
    const worker = createRedisClient('worker');
    await getRedisHealth();

    const workerQuit = worker.quit;
    await shutdownRedisClients();

    expect(workerQuit).toHaveBeenCalled();
  });
});

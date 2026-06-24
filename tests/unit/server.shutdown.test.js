describe('server shutdown handling', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      MONGODB_URI: 'mongodb://localhost/test',
      JWT_SECRET: 'secret',
      REDIS_URL: 'redis://localhost:6379',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('graceful shutdown closes resources on SIGINT', async () => {
    const listeners = {};
    const processOnSpy = jest.spyOn(process, 'on').mockImplementation((eventName, handler) => {
      listeners[eventName] = handler;
      return process;
    });
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined);

    jest.doMock('../../src/app', () => ({
      listen: jest.fn((port, cb) => {
        cb();
        return {
          close: jest.fn((done) => done()),
        };
      }),
    }));
    jest.doMock('../../src/config/db', () => ({
      connectToDatabase: jest.fn().mockResolvedValue(undefined),
      disconnectFromDatabase: jest.fn().mockResolvedValue(undefined),
    }));
    jest.doMock('../../src/config/redis', () => ({
      shutdownRedisClients: jest.fn().mockResolvedValue(undefined),
    }));
    jest.doMock('../../src/utils/logger', () => ({
      info: jest.fn(),
      error: jest.fn(),
    }));

    const { disconnectFromDatabase } = require('../../src/config/db');
    const { shutdownRedisClients } = require('../../src/config/redis');
    const { startServer } = require('../../src/server');

    await startServer();
    listeners.SIGINT();
    await new Promise((resolve) => setImmediate(resolve));

    expect(disconnectFromDatabase).toHaveBeenCalled();
    expect(shutdownRedisClients).toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(0);

    processOnSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  test('graceful shutdown exits with error when server close fails', async () => {
    const listeners = {};
    const processOnSpy = jest.spyOn(process, 'on').mockImplementation((eventName, handler) => {
      listeners[eventName] = handler;
      return process;
    });
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined);

    jest.doMock('../../src/app', () => ({
      listen: jest.fn((port, cb) => {
        cb();
        return {
          close: jest.fn((done) => done(new Error('close failed'))),
        };
      }),
    }));
    jest.doMock('../../src/config/db', () => ({
      connectToDatabase: jest.fn().mockResolvedValue(undefined),
      disconnectFromDatabase: jest.fn().mockResolvedValue(undefined),
    }));
    jest.doMock('../../src/config/redis', () => ({
      shutdownRedisClients: jest.fn().mockResolvedValue(undefined),
    }));
    const logger = { info: jest.fn(), error: jest.fn() };
    jest.doMock('../../src/utils/logger', () => logger);

    const { startServer } = require('../../src/server');

    await startServer();
    listeners.SIGTERM();
    await new Promise((resolve) => setImmediate(resolve));

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error), signal: 'SIGTERM' }), 'Graceful shutdown failed');
    expect(processExitSpy).toHaveBeenCalledWith(1);

    processOnSpy.mockRestore();
    processExitSpy.mockRestore();
  });
});

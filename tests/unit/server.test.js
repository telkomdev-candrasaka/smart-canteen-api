jest.mock('../..//src/config/db');
jest.mock('../../src/app');
jest.mock('../../src/config/env', () => ({
  validateEnv: jest.fn(() => ({ port: '3000', mongodbUri: 'mongodb://ok', jwtSecret: 'secret', redisUrl: 'redis://ok' })),
}));
jest.mock('../../src/config/redis', () => ({
  shutdownRedisClients: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

const { connectToDatabase } = require('../../src/config/db');
const app = require('../../src/app');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { validateEnv } = require('../../src/config/env');

const { startServer } = require('../../src/server');

test('startServer calls connectToDatabase and app.listen', async () => {
  connectToDatabase.mockResolvedValue(true);
  const listen = jest.fn((port, cb) => { cb(); });
  app.listen = listen;

  await startServer();
  expect(connectToDatabase).toHaveBeenCalled();
  expect(listen).toHaveBeenCalled();
  expect(validateEnv).toHaveBeenCalledWith({ requireMongo: true, requireJwt: true, requireRedis: true });
});

test('startServer uses PORT from environment when provided', async () => {
  jest.resetModules();

  jest.doMock('../../src/config/db', () => ({ connectToDatabase: jest.fn().mockResolvedValue(true) }));
  jest.doMock('../../src/config/env', () => ({
    validateEnv: jest.fn(() => ({ port: '4321', mongodbUri: 'mongodb://ok', jwtSecret: 'secret', redisUrl: 'redis://ok' })),
  }));
  jest.doMock('../../src/config/redis', () => ({ shutdownRedisClients: jest.fn().mockResolvedValue(undefined) }));
  jest.doMock('../../src/utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));
  jest.doMock('../../src/app', () => ({ listen: jest.fn((port, cb) => { cb(); return { port }; }) }));

  let startServerWithEnv;
  let mockedApp;
  jest.isolateModules(() => {
    startServerWithEnv = require('../../src/server').startServer;
    mockedApp = require('../../src/app');
  });

  await startServerWithEnv();

  expect(mockedApp.listen).toHaveBeenCalledWith('4321', expect.any(Function));

  jest.resetModules();
});

test('server main path logs and exits when startup fails', async () => {
  const filePath = path.resolve(__dirname, '../../src/server.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const consoleError = jest.fn();
  const processExit = jest.fn();
  const mockedModule = { exports: {} };

  const localRequire = (request) => {
    if (request === './app') return { listen: jest.fn() };
    if (request === './config/db') return { connectToDatabase: jest.fn().mockRejectedValue(new Error('db down')) };
    if (request === './config/env') return { validateEnv: jest.fn(() => ({ port: '3000', mongodbUri: 'mongodb://ok', jwtSecret: 'secret', redisUrl: 'redis://ok' })) };
    if (request === './config/redis') return { shutdownRedisClients: jest.fn().mockResolvedValue(undefined) };
    if (request === './utils/logger') return { info: jest.fn(), error: consoleError };
    throw new Error(`Unexpected require: ${request}`);
  };
  localRequire.main = mockedModule;

  const context = vm.createContext({
    require: localRequire,
    module: mockedModule,
    exports: mockedModule.exports,
    process: { env: {}, exit: processExit, on: jest.fn() },
    console: { log: jest.fn(), error: consoleError },
    setTimeout,
    clearTimeout,
  });

  new vm.Script(source, { filename: filePath }).runInContext(context);
  await new Promise((resolve) => setImmediate(resolve));

  expect(consoleError).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), 'Failed to start server');
  expect(processExit).toHaveBeenCalledWith(1);
});

jest.mock('../..//src/config/db');
jest.mock('../../src/app');
const { connectToDatabase } = require('../../src/config/db');
const app = require('../../src/app');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { startServer } = require('../../src/server');

test('startServer calls connectToDatabase and app.listen', async () => {
  connectToDatabase.mockResolvedValue(true);
  const listen = jest.fn((port, cb) => { cb(); });
  app.listen = listen;

  const server = await startServer();
  expect(connectToDatabase).toHaveBeenCalled();
  expect(listen).toHaveBeenCalled();
  // server is whatever app.listen returns (undefined here), so just ensure function returned
});

test('startServer uses PORT from environment when provided', async () => {
  jest.resetModules();
  process.env.PORT = '4321';

  jest.doMock('../../src/config/db', () => ({ connectToDatabase: jest.fn().mockResolvedValue(true) }));
  jest.doMock('../../src/app', () => ({ listen: jest.fn((port, cb) => { cb(); return { port }; }) }));

  let startServerWithEnv;
  let mockedApp;
  jest.isolateModules(() => {
    startServerWithEnv = require('../../src/server').startServer;
    mockedApp = require('../../src/app');
  });

  await startServerWithEnv();

  expect(mockedApp.listen).toHaveBeenCalledWith('4321', expect.any(Function));

  delete process.env.PORT;
  jest.resetModules();
});

test('server main path logs and exits when startup fails', async () => {
  const filePath = path.resolve(__dirname, '../../src/server.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const consoleError = jest.fn();
  const processExit = jest.fn();
  const mockedModule = { exports: {} };

  const localRequire = (request) => {
    if (request === 'dotenv') return { config: jest.fn() };
    if (request === './app') return { listen: jest.fn() };
    if (request === './config/db') return { connectToDatabase: jest.fn().mockRejectedValue(new Error('db down')) };
    throw new Error(`Unexpected require: ${request}`);
  };
  localRequire.main = mockedModule;

  const context = vm.createContext({
    require: localRequire,
    module: mockedModule,
    exports: mockedModule.exports,
    process: { env: {}, exit: processExit },
    console: { log: jest.fn(), error: consoleError },
    setTimeout,
    clearTimeout,
  });

  new vm.Script(source, { filename: filePath }).runInContext(context);
  await new Promise((resolve) => setImmediate(resolve));

  expect(consoleError).toHaveBeenCalledWith('Failed to start server:', 'db down');
  expect(processExit).toHaveBeenCalledWith(1);
});

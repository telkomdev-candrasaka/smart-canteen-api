const { spawnSync } = require('child_process');
const path = require('path');

test('running server as main logs failure when MONGODB_URI missing', () => {
  // run node on server.js with no MONGODB_URI to trigger error branch
  const serverPath = path.resolve(__dirname, '../../src/server.js');
  const result = spawnSync(process.execPath, [serverPath], { encoding: 'utf8', env: { ...process.env, MONGODB_URI: '' } });

  // process should exit non-zero and output contains Failed to start server
  expect(result.status).not.toBe(0);
  expect(result.stderr + result.stdout).toMatch(/Failed to start server|MONGODB_URI is not configured/);
});

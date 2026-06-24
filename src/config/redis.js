const Redis = require('ioredis');
const { validateEnv } = require('./env');
const logger = require('../utils/logger');

const trackedClients = new Set();
let healthClient = null;

function createRedisClient(label = 'redis-client') {
    const { redisUrl } = validateEnv({ requireRedis: true });
    const client = new Redis(redisUrl);

    trackedClients.add(client);

    client.on('error', (error) => {
        logger.warn({ err: error, client: label }, 'Redis client error');
    });

    client.on('end', () => {
        trackedClients.delete(client);
    });

    return client;
}

async function closeRedisClient(client) {
    if (!client) {
        return;
    }

    trackedClients.delete(client);

    try {
        if (typeof client.quit === 'function') {
            await client.quit();
            return;
        }
    } catch (error) {
        logger.warn({ err: error }, 'Redis quit failed, disconnecting client');
    }

    if (typeof client.disconnect === 'function') {
        client.disconnect();
    }
}

async function getHealthRedisClient() {
    if (!healthClient) {
        healthClient = createRedisClient('redis-health');
    }

    return healthClient;
}

async function getRedisHealth() {
    try {
        const client = await getHealthRedisClient();
        const response = await client.ping();
        return response === 'PONG' ? 'up' : 'down';
    } catch (error) {
        logger.warn({ err: error }, 'Redis health check failed');
        return 'down';
    }
}

async function shutdownRedisClients() {
    const clients = Array.from(trackedClients);
    trackedClients.clear();

    await Promise.all(clients.map((client) => closeRedisClient(client)));

    if (healthClient) {
        const currentHealthClient = healthClient;
        healthClient = null;
        await closeRedisClient(currentHealthClient);
    }
}

module.exports = {
    createRedisClient,
    closeRedisClient,
    getRedisHealth,
    shutdownRedisClients,
};

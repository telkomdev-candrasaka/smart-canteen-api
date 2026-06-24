require('dotenv').config();

const VALID_NODE_ENVS = new Set(['development', 'test', 'production']);

function normalizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function getConfig() {
    const portValue = normalizeString(process.env.PORT);
    const nodeEnvValue = normalizeString(process.env.NODE_ENV) || 'development';

    return Object.freeze({
        port: portValue || '3000',
        nodeEnv: VALID_NODE_ENVS.has(nodeEnvValue) ? nodeEnvValue : 'development',
        mongodbUri: normalizeString(process.env.MONGODB_URI),
        jwtSecret: normalizeString(process.env.JWT_SECRET),
        redisUrl: normalizeString(process.env.REDIS_URL),
    });
}

function validateEnv(options = {}) {
    const config = getConfig();
    const missing = [];

    if (options.requireMongo && !config.mongodbUri) {
        missing.push('MONGODB_URI');
    }

    if (options.requireJwt && !config.jwtSecret) {
        missing.push('JWT_SECRET');
    }

    if (options.requireRedis && !config.redisUrl) {
        missing.push('REDIS_URL');
    }

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    return config;
}

module.exports = {
    getConfig,
    validateEnv,
};

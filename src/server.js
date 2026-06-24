const app = require('./app');
const { connectToDatabase, disconnectFromDatabase } = require('./config/db');
const { validateEnv } = require('./config/env');
const { shutdownRedisClients } = require('./config/redis');
const logger = require('./utils/logger');

let registeredShutdownHandlers = false;
let shuttingDown = false;

function registerShutdownHandlers(server) {
    if (registeredShutdownHandlers) {
        return;
    }

    const shutdown = async (signal) => {
        if (shuttingDown) {
            return;
        }

        shuttingDown = true;
        logger.info({ signal }, 'Shutdown signal received');

        try {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve();
                });
            });

            await disconnectFromDatabase();
            await shutdownRedisClients();
            logger.info({ signal }, 'Graceful shutdown completed');
            process.exit(0);
        } catch (error) {
            logger.error({ err: error, signal }, 'Graceful shutdown failed');
            process.exit(1);
        }
    };

    process.on('SIGINT', () => {
        shutdown('SIGINT');
    });

    process.on('SIGTERM', () => {
        shutdown('SIGTERM');
    });

    registeredShutdownHandlers = true;
}

async function startServer() {
    const { port } = validateEnv({ requireMongo: true, requireJwt: true, requireRedis: true });
    await connectToDatabase();

    const server = app.listen(port, () => {
        logger.info({ port }, 'Server running');
    });

    registerShutdownHandlers(server);

    return server;
}

if (require.main === module) {
    startServer().catch((error) => {
        logger.error({ err: error }, 'Failed to start server');
        process.exit(1);
    });
}

module.exports = { startServer };

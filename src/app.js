const express = require('express');
const tenantsRouter = require('./routes/tenants.routes');
const ordersRouter = require('./routes/orders.routes');
const paymentsRouter = require('./routes/payments.routes');
const authRouter = require('./routes/auth.routes');
const transactionsRouter = require('./routes/transactions.routes');
const { getDatabaseHealth } = require('./config/db');
const { getRedisHealth } = require('./config/redis');
const { errorHandler } = require('./middlewares/error-handler');
const logger = require('./utils/logger');

const app = express();

app.use(express.json());

app.use((req, res, next) => {
    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    req.log = logger.child({
        requestId,
        method: req.method,
        path: req.originalUrl,
    });

    res.on('finish', () => {
        req.log.info({ statusCode: res.statusCode }, 'Request completed');
    });

    next();
});

app.get('/health', async (_req, res) => {
    const services = {
        mongodb: getDatabaseHealth(),
        redis: await getRedisHealth(),
    };

    const isHealthy = Object.values(services).every((status) => status === 'up');

    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'ok' : 'error',
        services,
    });
});

app.use('/tenants', tenantsRouter);
app.use('/orders', ordersRouter);
app.use('/payments', paymentsRouter);
app.use('/auth', authRouter);
app.use('/transactions', transactionsRouter);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`,
    });
});

app.use(errorHandler);

module.exports = app;

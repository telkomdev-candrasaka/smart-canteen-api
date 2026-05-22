const express = require('express');
const tenantsRouter = require('./routes/tenants.routes');
const ordersRouter = require('./routes/orders.routes');
const paymentsRouter = require('./routes/payments.routes');
const authRouter = require('./routes/auth.routes');
const transactionsRouter = require('./routes/transactions.routes');
const { errorHandler } = require('./middlewares/error-handler');

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
    res.status(200).json({
        success: true,
        message: 'API is running',
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

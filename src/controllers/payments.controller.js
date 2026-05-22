const orderModel = require('../models/order.model');
const Redis = require('ioredis');

// This is a mock payment flow. In production integrate with payment gateway.
exports.processPayment = async function processPayment(req, res, next) {
    try {
        const { orderId, method } = req.body;
        const order = await orderModel.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        // Simulate success
        const updated = await orderModel.update(orderId, { status: 'paid' });

        // publish to redis channel for tenant listeners
        try {
            const publisher = new Redis(process.env.REDIS_URL);
            const channel = `tenant:${updated.tenantId}:orders`;
            const payload = JSON.stringify({ event: 'ORDER_PAID', order: updated });
            await publisher.publish(channel, payload);
            publisher.quit();
        } catch (pubErr) {
            // do not fail the request if publish fails; just log
            console.error('Failed to publish Redis event', pubErr.message || pubErr);
        }

        return res.status(200).json({ success: true, data: { order: updated, payment: { method, status: 'success' } } });
    } catch (error) {
        return next(error);
    }
};

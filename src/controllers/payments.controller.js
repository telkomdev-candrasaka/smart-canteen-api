const mongoose = require('mongoose');
const orderModel = require('../models/order.model');
const tenantModel = require('../models/tenant.model');
const transactionModel = require('../models/transaction.model');
const { createRedisClient, closeRedisClient } = require('../config/redis');
const logger = require('../utils/logger');
const { canAccessTransaction, sendForbidden } = require('../policies/tenant.policy');

function buildPaidPaymentResponse(transaction, orderId, method) {
    const paidOrder = orderId
        ? transaction.orders.find((order) => String(order._id) === String(orderId)) || transaction.orders[0] || null
        : transaction.orders[0] || null;

    return {
        order: paidOrder,
        transaction,
        payment: {
            method: transaction.paymentMethod || method,
            reference: transaction.paymentReference || null,
            status: 'success',
        },
    };
}

// This is a mock payment flow. In production integrate with payment gateway.
exports.processPayment = async function processPayment(req, res, next) {
    try {
        const { orderId, transactionId, method } = req.body;
        const transaction = transactionId
            ? await transactionModel.findById(transactionId)
            : await transactionModel.findByOrderId(orderId);

        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found for payment target' });
        }

        if (!canAccessTransaction(req.user, transaction)) return sendForbidden(res);

        if (transaction.paymentStatus === 'paid') {
            return res.status(200).json({ success: true, data: buildPaidPaymentResponse(transaction, orderId, method) });
        }

        const paymentReference = req.body.paymentReference || `mock-${Date.now()}`;

        const session = await mongoose.startSession();
        let updatedTransaction;
        let updatedOrders;
        let latestTransaction;
        let wasClaimed = false;

        try {
            await session.withTransaction(async () => {
                updatedTransaction = await transactionModel.claimPendingPayment(transaction._id, {
                    paymentStatus: 'processing',
                    paymentMethod: method,
                    paymentReference,
                    paymentMetadata: { provider: 'mock', orderId: orderId || null },
                    failedAt: null,
                    refundedAt: null,
                }, { session });

                if (!updatedTransaction) {
                    latestTransaction = await transactionModel.findById(transaction._id, { session });
                    return;
                }

                wasClaimed = true;

                for (const order of updatedTransaction.orders) {
                    if (!Array.isArray(order.items)) {
                        continue;
                    }

                    for (const item of order.items) {
                        if (!item.menuItemId) {
                            continue;
                        }

                        const settled = await tenantModel.settleMenuItemStock(order.tenantId, item.menuItemId, item.quantity, { session });
                        if (!settled) {
                            throw new Error(`Unable to settle reserved stock for order ${order._id}`);
                        }
                    }
                }

                updatedOrders = await Promise.all(
                    updatedTransaction.orders.map((order) => orderModel.transitionStatus(order._id, 'paid', { session }))
                );

                updatedTransaction = await transactionModel.update(updatedTransaction._id, {
                    paymentStatus: 'paid',
                    paidAt: new Date(),
                }, { session });
            });
        } finally {
            await session.endSession();
        }

        if (!wasClaimed) {
            if (!latestTransaction) {
                return res.status(404).json({ success: false, message: 'Transaction not found for payment target' });
            }

            if (latestTransaction.paymentStatus === 'paid') {
                return res.status(200).json({ success: true, data: buildPaidPaymentResponse(latestTransaction, orderId, method) });
            }

            if (latestTransaction.paymentStatus === 'processing') {
                return res.status(409).json({ success: false, message: 'Payment is already being processed' });
            }

            return res.status(409).json({ success: false, message: 'Unable to claim payment for processing' });
        }

        updatedTransaction.orders = updatedOrders;

        const paidOrder = orderId
            ? updatedOrders.find((order) => String(order._id) === String(orderId)) || updatedOrders[0]
            : updatedOrders[0] || null;

        // publish to redis channel for tenant listeners
        let publisher;
        try {
            publisher = createRedisClient('payment-publisher');
            await Promise.all(updatedOrders.map((order) => {
                const channel = `tenant:${order.tenantId}:orders`;
                const payload = JSON.stringify({ event: 'ORDER_PAID', order });
                return publisher.publish(channel, payload);
            }));
        } catch (pubErr) {
            // do not fail the request if publish fails; just log
            logger.warn({ err: pubErr, orderId, transactionId: updatedTransaction._id }, 'Failed to publish Redis event');
        } finally {
            await closeRedisClient(publisher);
        }

        return res.status(200).json({
            success: true,
            data: {
                order: paidOrder,
                transaction: updatedTransaction,
                payment: { method, reference: paymentReference, status: 'success' },
            },
        });
    } catch (error) {
        return next(error);
    }
};

const mongoose = require('mongoose');

function sendValidationError(res, message) {
    return res.status(400).json({ success: false, message });
}

exports.validateProcessPayment = function validateProcessPayment(req, res, next) {
    const { orderId, transactionId, method } = req.body;

    const hasOrderId = typeof orderId === 'string' && orderId.trim() !== '';
    const hasTransactionId = typeof transactionId === 'string' && transactionId.trim() !== '';

    if (!hasOrderId && !hasTransactionId) {
        return sendValidationError(res, 'orderId or transactionId is required');
    }

    if (hasOrderId && !mongoose.Types.ObjectId.isValid(orderId)) {
        return sendValidationError(res, 'orderId must be a valid MongoDB ObjectId');
    }

    if (hasTransactionId && !mongoose.Types.ObjectId.isValid(transactionId)) {
        return sendValidationError(res, 'transactionId must be a valid MongoDB ObjectId');
    }

    if (!method || typeof method !== 'string' || method.trim() === '') {
        return sendValidationError(res, 'method is required');
    }

    if (hasOrderId) req.body.orderId = orderId.trim();
    if (hasTransactionId) req.body.transactionId = transactionId.trim();
    req.body.method = method.trim();

    return next();
};

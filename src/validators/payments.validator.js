const mongoose = require('mongoose');

function sendValidationError(res, message) {
    return res.status(400).json({ success: false, message });
}

exports.validateProcessPayment = function validateProcessPayment(req, res, next) {
    const { orderId, method } = req.body;

    if (!orderId || typeof orderId !== 'string' || orderId.trim() === '') {
        return sendValidationError(res, 'orderId is required');
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return sendValidationError(res, 'orderId must be a valid MongoDB ObjectId');
    }

    if (!method || typeof method !== 'string' || method.trim() === '') {
        return sendValidationError(res, 'method is required');
    }

    req.body.orderId = orderId.trim();
    req.body.method = method.trim();

    return next();
};

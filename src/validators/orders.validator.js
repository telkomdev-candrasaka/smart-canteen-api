const mongoose = require('mongoose');

function sendValidationError(res, message) {
    return res.status(400).json({ success: false, message });
}

exports.validateOrderId = function validateOrderId(req, res, next) {
    const { id } = req.params;

    if (!id || typeof id !== 'string' || id.trim() === '') {
        return sendValidationError(res, 'Order id is required');
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendValidationError(res, 'Order id must be a valid MongoDB ObjectId');
    }

    return next();
};

exports.validateCreateOrder = function validateCreateOrder(req, res, next) {
    const { tenantId, items } = req.body;

    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
        return sendValidationError(res, 'tenantId is required');
    }

    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
        return sendValidationError(res, 'tenantId must be a valid MongoDB ObjectId');
    }

    if (!Array.isArray(items) || items.length === 0) {
        return sendValidationError(res, 'items must be a non-empty array');
    }

    const normalized = [];
    for (const it of items) {
        if (!it || typeof it !== 'object') {
            return sendValidationError(res, 'Each item must be an object');
        }

        if (typeof it.name !== 'string' || it.name.trim() === '') {
            return sendValidationError(res, 'Item name is required and must be a string');
        }

        if (typeof it.price !== 'number' && typeof it.price !== 'string') {
            return sendValidationError(res, 'Item price is required and must be a number');
        }

        const price = Number(it.price);
        if (Number.isNaN(price) || price < 0) {
            return sendValidationError(res, 'Item price must be a non-negative number');
        }

        const qty = it.quantity === undefined ? 1 : Number(it.quantity);
        if (!Number.isInteger(qty) || qty < 1) {
            return sendValidationError(res, 'Item quantity must be an integer >= 1');
        }

        normalized.push({ menuItemId: it.menuItemId, name: it.name.trim(), price, quantity: qty });
    }

    req.body = { tenantId: tenantId.trim(), items: normalized };

    return next();
};

const mongoose = require('mongoose');

function sendValidationError(res, message) {
    return res.status(400).json({
        success: false,
        message,
    });
}

exports.validateItemId = function validateItemId(req, res, next) {
    const { id } = req.params;

    if (!id || typeof id !== 'string' || id.trim() === '') {
        return sendValidationError(res, 'Item id is required');
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendValidationError(res, 'Item id must be a valid MongoDB ObjectId');
    }

    return next();
};

exports.validateCreateItem = function validateCreateItem(req, res, next) {
    const { name, description } = req.body;

    if (typeof name !== 'string' || name.trim() === '') {
        return sendValidationError(res, 'Name is required and must be a non-empty string');
    }

    if (description !== undefined && (typeof description !== 'string' || description.trim() === '')) {
        return sendValidationError(res, 'Description must be a non-empty string when provided');
    }

    req.body = {
        name: name.trim(),
        description: typeof description === 'string' ? description.trim() : '',
    };

    return next();
};

exports.validateUpdateItem = function validateUpdateItem(req, res, next) {
    const allowedFields = ['name', 'description'];
    const requestFields = Object.keys(req.body);

    if (requestFields.length === 0) {
        return sendValidationError(res, 'At least one field is required for update');
    }

    const hasInvalidField = requestFields.some((field) => !allowedFields.includes(field));

    if (hasInvalidField) {
        return sendValidationError(res, 'Only name and description fields can be updated');
    }

    if (req.body.name !== undefined) {
        if (typeof req.body.name !== 'string' || req.body.name.trim() === '') {
            return sendValidationError(res, 'Name must be a non-empty string when provided');
        }

        req.body.name = req.body.name.trim();
    }

    if (req.body.description !== undefined) {
        if (typeof req.body.description !== 'string' || req.body.description.trim() === '') {
            return sendValidationError(res, 'Description must be a non-empty string when provided');
        }

        req.body.description = req.body.description.trim();
    }

    return next();
};

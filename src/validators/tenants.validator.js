const mongoose = require('mongoose');

function sendValidationError(res, message) {
    return res.status(400).json({ success: false, message });
}

exports.validateTenantId = function validateTenantId(req, res, next) {
    const { id } = req.params;

    if (!id || typeof id !== 'string' || id.trim() === '') {
        return sendValidationError(res, 'Tenant id is required');
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendValidationError(res, 'Tenant id must be a valid MongoDB ObjectId');
    }

    return next();
};

exports.validateCreateTenant = function validateCreateTenant(req, res, next) {
    const { name, description, menu } = req.body;

    if (typeof name !== 'string' || name.trim() === '') {
        return sendValidationError(res, 'Name is required and must be a non-empty string');
    }

    if (description !== undefined && (typeof description !== 'string')) {
        return sendValidationError(res, 'Description must be a string when provided');
    }

    if (menu !== undefined) {
        if (!Array.isArray(menu)) {
            return sendValidationError(res, 'Menu must be an array when provided');
        }

        for (const mi of menu) {
            if (!mi || typeof mi !== 'object') {
                return sendValidationError(res, 'Each menu item must be an object');
            }

            if (typeof mi.name !== 'string' || mi.name.trim() === '') {
                return sendValidationError(res, 'Menu item name is required and must be a string');
            }

            if (typeof mi.price !== 'number' && typeof mi.price !== 'string') {
                return sendValidationError(res, 'Menu item price is required and must be a number');
            }

            const priceNum = Number(mi.price);
            if (Number.isNaN(priceNum) || priceNum < 0) {
                return sendValidationError(res, 'Menu item price must be a non-negative number');
            }

            if (mi.quantity !== undefined) {
                const q = Number(mi.quantity);
                if (!Number.isInteger(q) || q < 1) {
                    return sendValidationError(res, 'Menu item quantity must be an integer >= 1 when provided');
                }
            }
        }
    }

    // sanitize
    req.body = {
        name: name.trim(),
        description: typeof description === 'string' ? description.trim() : '',
        menu: Array.isArray(menu)
            ? menu.map((mi) => ({
                  name: mi.name.trim(),
                  description: typeof mi.description === 'string' ? mi.description.trim() : '',
                  price: Number(mi.price),
                  available: mi.available === undefined ? true : Boolean(mi.available),
              }))
            : [],
    };

    return next();
};

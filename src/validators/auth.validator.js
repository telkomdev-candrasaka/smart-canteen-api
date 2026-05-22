function sendValidationError(res, message) {
    return res.status(400).json({ success: false, message });
}

exports.validateRegister = function validateRegister(req, res, next) {
    const { email, password, role, tenantId } = req.body;

    if (!email || typeof email !== 'string' || email.trim() === '') {
        return sendValidationError(res, 'Email is required');
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
        return sendValidationError(res, 'Password is required and must be at least 6 characters');
    }

    if (role !== undefined) {
        const allowed = ['SUPER_ADMIN', 'TENANT_ADMIN', 'MEMBER'];
        if (!allowed.includes(role)) return sendValidationError(res, `Role must be one of ${allowed.join(', ')}`);
        if (role === 'TENANT_ADMIN' && !tenantId) return sendValidationError(res, 'tenantId is required for TENANT_ADMIN');
    }

    req.body.email = req.body.email.trim().toLowerCase();

    return next();
};

exports.validateLogin = function validateLogin(req, res, next) {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string' || email.trim() === '') {
        return sendValidationError(res, 'Email is required');
    }

    if (!password || typeof password !== 'string') {
        return sendValidationError(res, 'Password is required');
    }

    req.body.email = req.body.email.trim().toLowerCase();

    return next();
};

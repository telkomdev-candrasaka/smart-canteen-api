function sendValidationError(res, message) {
    return res.status(400).json({ success: false, message });
}

function sendForbiddenRoleError(res) {
    return res.status(403).json({ success: false, message: 'Privileged roles cannot be assigned through public registration' });
}

exports.validateRegister = function validateRegister(req, res, next) {
    const { email, password, role } = req.body;

    if (!email || typeof email !== 'string' || email.trim() === '') {
        return sendValidationError(res, 'Email is required');
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
        return sendValidationError(res, 'Password is required and must be at least 6 characters');
    }

    if (role !== undefined) {
        const knownRoles = ['SUPER_ADMIN', 'TENANT_ADMIN', 'MEMBER', 'ADMIN', 'OWNER'];
        if (knownRoles.includes(role) && role !== 'MEMBER') {
            return sendForbiddenRoleError(res);
        }

        if (role !== 'MEMBER') {
            return sendValidationError(res, 'Role must be MEMBER when provided');
        }
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

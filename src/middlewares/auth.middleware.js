const jwt = require('jsonwebtoken');
const { validateEnv } = require('../config/env');

exports.verifyToken = function verifyToken(req, res, next) {
    try {
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Authorization token required' });
        }

        const token = auth.split(' ')[1];
        const { jwtSecret } = validateEnv({ requireJwt: true });
        const payload = jwt.verify(token, jwtSecret);
        req.user = payload;
        return next();
    } catch (error) {
        return next(error);
    }
};

exports.requireRole = function requireRole(roles = []) {
    return function (req, res, next) {
        try {
            if (!req.user || !req.user.role) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }

            if (!Array.isArray(roles) || roles.length === 0) return next();

            if (!roles.includes(req.user.role)) {
                return res.status(403).json({ success: false, message: 'Forbidden' });
            }

            return next();
        } catch (error) {
            return next(error);
        }
    };
};

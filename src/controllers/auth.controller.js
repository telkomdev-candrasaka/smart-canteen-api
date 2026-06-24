const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/user.model');
const { validateEnv } = require('../config/env');

const PUBLIC_ROLE = 'MEMBER';

function signToken(user) {
    const payload = { id: user._id, email: user.email, role: user.role, tenantId: user.tenantId };
    const { jwtSecret } = validateEnv({ requireJwt: true });

    return jwt.sign(payload, jwtSecret, { expiresIn: '7d' });
}

exports.register = async function register(req, res, next) {
    try {
        const { email, password, tenantId } = req.body;

        const existing = await userModel.findByEmail(email);
        if (existing) {
            return res.status(409).json({ success: false, message: 'Email already registered' });
        }

        const hashed = await bcrypt.hash(password, 10);
        const user = await userModel.create({ email, password: hashed, role: PUBLIC_ROLE, tenantId });

        const token = signToken(user);

        const safeUser = { id: user._id, email: user.email, role: user.role, tenantId: user.tenantId };

        return res.status(201).json({ success: true, data: { user: safeUser, token } });
    } catch (error) {
        return next(error);
    }
};

exports.login = async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        const user = await userModel.findByEmail(email);
        if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });

        const token = signToken(user);
        const safeUser = { id: user._id, email: user.email, role: user.role, tenantId: user.tenantId };

        return res.status(200).json({ success: true, data: { user: safeUser, token } });
    } catch (error) {
        return next(error);
    }
};

const tenantModel = require('../models/tenant.model');
const Redis = require('ioredis');

exports.createTenant = async function createTenant(req, res, next) {
    try {
        const tenant = await tenantModel.create(req.body);

        return res.status(201).json({ success: true, data: tenant });
    } catch (error) {
        return next(error);
    }
};

exports.getAllTenants = async function getAllTenants(_req, res, next) {
    try {
        const tenants = await tenantModel.findAll();
        return res.status(200).json({ success: true, data: tenants });
    } catch (error) {
        return next(error);
    }
};

exports.getTenantById = async function getTenantById(req, res, next) {
    try {
        const tenant = await tenantModel.findById(req.params.id);

        if (!tenant) {
            return res.status(404).json({ success: false, message: 'Tenant not found' });
        }

        return res.status(200).json({ success: true, data: tenant });
    } catch (error) {
        return next(error);
    }
};

exports.getMenu = async function getMenu(req, res, next) {
    try {
        const tenant = await tenantModel.findById(req.params.id);
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

        return res.status(200).json({ success: true, data: tenant.menu });
    } catch (error) {
        return next(error);
    }
};

exports.streamTenantOrders = async function streamTenantOrders(req, res, next) {
    try {
        const { id } = req.params;

        // setup SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders && res.flushHeaders();

        const subscriber = new Redis(process.env.REDIS_URL);
        const channel = `tenant:${id}:orders`;

        const onMessage = (channelName, message) => {
            try {
                res.write(`data: ${message}\n\n`);
            } catch (err) {
                // ignore write errors
            }
        };

        subscriber.on('message', onMessage);
        await subscriber.subscribe(channel);

        req.on('close', async () => {
            subscriber.removeListener('message', onMessage);
            try {
                await subscriber.unsubscribe(channel);
            } catch (err) {
                // ignore
            }
            subscriber.quit();
        });
    } catch (error) {
        return next(error);
    }
};

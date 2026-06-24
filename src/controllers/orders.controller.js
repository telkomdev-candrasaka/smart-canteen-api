const mongoose = require('mongoose');
const orderModel = require('../models/order.model');
const tenantModel = require('../models/tenant.model');
const { canAccessOrder, sendForbidden } = require('../policies/tenant.policy');

function createBadRequestError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

// Create single order for a single tenant, prices MUST come from DB
exports.createOrder = async function createOrder(req, res, next) {
    try {
        const { tenantId, items } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'items must be a non-empty array' });
        }

        const session = await mongoose.startSession();
        let order;

        try {
            await session.withTransaction(async () => {
                const tenant = await tenantModel.findById(tenantId, { session });
                if (!tenant) throw createBadRequestError('Invalid tenantId');

                let total = 0;
                const normalizedItems = [];
                const reservationRequests = new Map();

                for (const it of items) {
                    const qty = Number(it.quantity) || 1;

                    let menuItem = null;
                    if (it.menuItemId) {
                        menuItem = tenant.menu.id(it.menuItemId);
                    }

                    if (!menuItem && it.name) {
                        menuItem = tenant.menu.find((m) => m.name === it.name);
                    }

                    if (!menuItem) {
                        throw createBadRequestError(`Menu item not found: ${it.name || it.menuItemId}`);
                    }

                    if (menuItem.available === false) {
                        throw createBadRequestError(`Menu item is unavailable: ${menuItem.name}`);
                    }

                    const price = Number(menuItem.price || 0);
                    total += price * qty;

                    normalizedItems.push({ menuItemId: menuItem._id, name: menuItem.name, price, quantity: qty });

                    const reservationKey = String(menuItem._id);
                    const currentQty = reservationRequests.get(reservationKey) || 0;
                    reservationRequests.set(reservationKey, currentQty + qty);
                }

                for (const [menuItemId, quantity] of reservationRequests.entries()) {
                    const reserved = await tenantModel.reserveMenuItemStock(tenantId, menuItemId, quantity, { session });
                    if (!reserved) {
                        const menuItem = tenant.menu.id(menuItemId);
                        throw createBadRequestError(`Insufficient stock for menu item: ${menuItem ? menuItem.name : menuItemId}`);
                    }
                }

                order = await orderModel.create({ tenantId, items: normalizedItems, total, status: 'pending' }, { session });
            });
        } finally {
            await session.endSession();
        }

        return res.status(201).json({ success: true, data: order });
    } catch (error) {
        if (error.statusCode === 400) {
            return res.status(400).json({ success: false, message: error.message });
        }

        return next(error);
    }
};

exports.getOrderById = async function getOrderById(req, res, next) {
    try {
        const order = await orderModel.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        if (!canAccessOrder(req.user, order)) return sendForbidden(res);

        return res.status(200).json({ success: true, data: order });
    } catch (error) {
        return next(error);
    }
};

exports.updateOrderStatus = async function updateOrderStatus(req, res, next) {
    try {
        const order = await orderModel.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        if (!canAccessOrder(req.user, order)) return sendForbidden(res);

        const updatedOrder = await orderModel.transitionStatus(order._id, req.body.status);

        return res.status(200).json({ success: true, data: updatedOrder });
    } catch (error) {
        if (error.message && error.message.includes('order status')) {
            return res.status(400).json({ success: false, message: error.message });
        }

        return next(error);
    }
};


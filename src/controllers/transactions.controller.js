const mongoose = require('mongoose');
const tenantModel = require('../models/tenant.model');
const orderModel = require('../models/order.model');
const transactionModel = require('../models/transaction.model');
const { canAccessTransaction, sendForbidden } = require('../policies/tenant.policy');

function createBadRequestError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

// Create a single checkout that can include orders across multiple tenants
exports.createTransaction = async function createTransaction(req, res, next) {
    try {
        const { customerName, customerPhone, tableNumber, items } = req.body;

        if (!customerName || !customerPhone) {
            return res.status(400).json({ success: false, message: 'customerName and customerPhone are required' });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'items must be a non-empty array' });
        }

        // Group items by tenantId
        const byTenant = new Map();
        for (const it of items) {
            if (!it.tenantId) return res.status(400).json({ success: false, message: 'Each item must have tenantId' });
            const key = String(it.tenantId);
            if (!byTenant.has(key)) byTenant.set(key, []);
            byTenant.get(key).push(it);
        }

        const session = await mongoose.startSession();
        let transaction;

        try {
            await session.withTransaction(async () => {
                const createdOrderIds = [];
                let grandTotal = 0;

                for (const [tenantId, tenantItems] of byTenant.entries()) {
                    const tenant = await tenantModel.findById(tenantId, { session });
                    if (!tenant) throw createBadRequestError(`Invalid tenantId ${tenantId}`);

                    let total = 0;
                    const normalizedItems = [];
                    const reservationRequests = new Map();

                    for (const it of tenantItems) {
                        const qty = Number(it.quantity) || 1;

                        let menuItem = null;
                        if (it.menuItemId) menuItem = tenant.menu.id(it.menuItemId);
                        if (!menuItem && it.name) menuItem = tenant.menu.find((m) => m.name === it.name);

                        if (!menuItem) throw createBadRequestError(`Menu item not found for tenant ${tenantId}`);
                        if (menuItem.available === false) throw createBadRequestError(`Menu item is unavailable for tenant ${tenantId}: ${menuItem.name}`);

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
                            throw createBadRequestError(`Insufficient stock for tenant ${tenantId}: ${menuItem ? menuItem.name : menuItemId}`);
                        }
                    }

                    const order = await orderModel.create({ tenantId, items: normalizedItems, total, status: 'pending' }, { session });
                    createdOrderIds.push(order._id);
                    grandTotal += total;
                }

                transaction = await transactionModel.create({
                    customerName: customerName.trim(),
                    customerPhone: customerPhone.trim(),
                    tableNumber: tableNumber ? String(tableNumber).trim() : '',
                    orders: createdOrderIds,
                    grandTotal,
                    paymentStatus: 'pending',
                }, { session });
            });
        } finally {
            await session.endSession();
        }

        return res.status(201).json({ success: true, data: transaction });
    } catch (error) {
        if (error.statusCode === 400) {
            return res.status(400).json({ success: false, message: error.message });
        }

        return next(error);
    }
};

exports.getTransactionById = async function getTransactionById(req, res, next) {
    try {
        const transaction = await transactionModel.findById(req.params.id);
        if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });
        if (!canAccessTransaction(req.user, transaction)) return sendForbidden(res);

        return res.status(200).json({ success: true, data: transaction });
    } catch (error) {
        return next(error);
    }
};

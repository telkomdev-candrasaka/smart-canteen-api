const tenantModel = require('../models/tenant.model');
const orderModel = require('../models/order.model');
const transactionModel = require('../models/transaction.model');

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

        const createdOrderIds = [];
        let grandTotal = 0;

        for (const [tenantId, tenantItems] of byTenant.entries()) {
            const tenant = await tenantModel.findById(tenantId);
            if (!tenant) return res.status(400).json({ success: false, message: `Invalid tenantId ${tenantId}` });

            let total = 0;
            const normalizedItems = [];

            for (const it of tenantItems) {
                const qty = Number(it.quantity) || 1;

                let menuItem = null;
                if (it.menuItemId) menuItem = tenant.menu.id(it.menuItemId);
                if (!menuItem && it.name) menuItem = tenant.menu.find((m) => m.name === it.name);

                if (!menuItem) return res.status(400).json({ success: false, message: `Menu item not found for tenant ${tenantId}` });

                const price = Number(menuItem.price || 0);
                total += price * qty;
                normalizedItems.push({ menuItemId: menuItem._id, name: menuItem.name, price, quantity: qty });
            }

            const order = await orderModel.create({ tenantId, items: normalizedItems, total, status: 'pending' });
            createdOrderIds.push(order._id);
            grandTotal += total;
        }

        const transaction = await transactionModel.create({
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            tableNumber: tableNumber ? String(tableNumber).trim() : '',
            orders: createdOrderIds,
            grandTotal,
            paymentStatus: 'pending',
        });

        return res.status(201).json({ success: true, data: transaction });
    } catch (error) {
        return next(error);
    }
};

exports.getTransactionById = async function getTransactionById(req, res, next) {
    try {
        const transaction = await transactionModel.findById(req.params.id);
        if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });

        return res.status(200).json({ success: true, data: transaction });
    } catch (error) {
        return next(error);
    }
};

const orderModel = require('../models/order.model');
const tenantModel = require('../models/tenant.model');

// Create single order for a single tenant, prices MUST come from DB
exports.createOrder = async function createOrder(req, res, next) {
    try {
        const { tenantId, items } = req.body;

        const tenant = await tenantModel.findById(tenantId);
        if (!tenant) return res.status(400).json({ success: false, message: 'Invalid tenantId' });

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'items must be a non-empty array' });
        }

        let total = 0;
        const normalizedItems = [];

        for (const it of items) {
            const qty = Number(it.quantity) || 1;

            // Prefer menuItemId lookup for security
            let menuItem = null;
            if (it.menuItemId) {
                menuItem = tenant.menu.id(it.menuItemId);
            }

            // fallback: try match by name
            if (!menuItem && it.name) {
                menuItem = tenant.menu.find((m) => m.name === it.name);
            }

            if (!menuItem) {
                return res.status(400).json({ success: false, message: `Menu item not found: ${it.name || it.menuItemId}` });
            }

            const price = Number(menuItem.price || 0);
            total += price * qty;

            normalizedItems.push({ menuItemId: menuItem._id, name: menuItem.name, price, quantity: qty });
        }

        const order = await orderModel.create({ tenantId, items: normalizedItems, total, status: 'pending' });

        return res.status(201).json({ success: true, data: order });
    } catch (error) {
        return next(error);
    }
};

exports.getOrderById = async function getOrderById(req, res, next) {
    try {
        const order = await orderModel.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        return res.status(200).json({ success: true, data: order });
    } catch (error) {
        return next(error);
    }
};


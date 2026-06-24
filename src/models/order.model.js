const mongoose = require('mongoose');
const { ORDER_STATES, assertValidOrderTransition } = require('../domain/order-state-machine');

const orderItemSchema = new mongoose.Schema(
    {
        menuItemId: { type: mongoose.Schema.Types.ObjectId, required: false },
        name: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
        quantity: { type: Number, required: true, min: 1 },
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true },
        items: { type: [orderItemSchema], required: true, default: [] },
        total: { type: Number, required: true, min: 0 },
        status: { type: String, enum: Object.values(ORDER_STATES), default: ORDER_STATES.PENDING },
    },
    { timestamps: true, versionKey: false }
);

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

exports.create = async function create(orderData, options = {}) {
    if (options.session) {
        const docs = await Order.create([orderData], { session: options.session });
        return docs[0];
    }

    return Order.create(orderData);
};

exports.findById = function findById(id, options = {}) {
    const query = Order.findById(id);

    if (options.session) {
        query.session(options.session);
    }

    return query;
};

exports.update = function update(id, data, options = {}) {
    if (Object.prototype.hasOwnProperty.call(data, 'status')) {
        throw new Error('Order status updates must use transitionStatus()');
    }

    return Order.findByIdAndUpdate(id, data, {
        new: true,
        runValidators: true,
        session: options.session,
    });
};

exports.transitionStatus = async function transitionStatus(id, nextStatus, options = {}) {
    const order = await exports.findById(id, options);

    if (!order) {
        return null;
    }

    assertValidOrderTransition(order.status, nextStatus);

    return Order.findByIdAndUpdate(id, { status: nextStatus }, {
        new: true,
        runValidators: true,
        session: options.session,
    });
};

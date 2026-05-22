const mongoose = require('mongoose');

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
        status: { type: String, default: 'pending' },
    },
    { timestamps: true, versionKey: false }
);

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

exports.create = function create(orderData) {
    return Order.create(orderData);
};

exports.findById = function findById(id) {
    return Order.findById(id);
};

exports.update = function update(id, data) {
    return Order.findByIdAndUpdate(id, data, { new: true, runValidators: true });
};

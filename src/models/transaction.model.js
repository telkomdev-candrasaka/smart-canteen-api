const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
    {
        customerName: { type: String, required: true, trim: true },
        customerPhone: { type: String, required: true, trim: true },
        tableNumber: { type: String, default: '', trim: true },
        orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true }],
        grandTotal: { type: Number, required: true, min: 0 },
        paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    },
    { timestamps: true, versionKey: false }
);

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

exports.create = function create(data) {
    return Transaction.create(data);
};

exports.findById = function findById(id) {
    return Transaction.findById(id).populate('orders');
};

exports.update = function update(id, data) {
    return Transaction.findByIdAndUpdate(id, data, { new: true, runValidators: true });
};

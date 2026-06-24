const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
    {
        customerName: { type: String, required: true, trim: true },
        customerPhone: { type: String, required: true, trim: true },
        tableNumber: { type: String, default: '', trim: true },
        orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true }],
        grandTotal: { type: Number, required: true, min: 0 },
        paymentStatus: { type: String, enum: ['pending', 'processing', 'paid', 'failed', 'refunded'], default: 'pending' },
        paymentMethod: { type: String, default: '', trim: true },
        paymentReference: { type: String, default: '', trim: true },
        paymentMetadata: { type: mongoose.Schema.Types.Mixed, default: null },
        paidAt: { type: Date, default: null },
        failedAt: { type: Date, default: null },
        refundedAt: { type: Date, default: null },
    },
    { timestamps: true, versionKey: false }
);

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

exports.create = async function create(data, options = {}) {
    if (options.session) {
        const docs = await Transaction.create([data], { session: options.session });
        return docs[0];
    }

    return Transaction.create(data);
};

exports.findById = function findById(id, options = {}) {
    const query = Transaction.findById(id).populate('orders');

    if (options.session) {
        query.session(options.session);
    }

    return query;
};

exports.findByOrderId = function findByOrderId(orderId, options = {}) {
    const query = Transaction.findOne({ orders: orderId }).populate('orders');

    if (options.session) {
        query.session(options.session);
    }

    return query;
};

exports.claimPendingPayment = function claimPendingPayment(id, data, options = {}) {
    return Transaction.findOneAndUpdate(
        { _id: id, paymentStatus: 'pending' },
        data,
        {
            new: true,
            runValidators: true,
            session: options.session,
        }
    ).populate('orders');
};

exports.update = function update(id, data, options = {}) {
    return Transaction.findByIdAndUpdate(id, data, {
        new: true,
        runValidators: true,
        session: options.session,
    });
};

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true, trim: true, lowercase: true },
        password: { type: String, required: true },
        role: { type: String, enum: ['SUPER_ADMIN', 'TENANT_ADMIN', 'MEMBER'], default: 'MEMBER' },
        tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: false },
    },
    { timestamps: true, versionKey: false }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

exports.create = function create(data) {
    return User.create(data);
};

exports.findByEmail = function findByEmail(email) {
    return User.findOne({ email });
};

exports.findById = function findById(id) {
    return User.findById(id);
};

const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, default: '', trim: true },
        price: { type: Number, required: true, min: 0 },
        available: { type: Boolean, default: true },
    },
    { _id: true }
);

const tenantSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, default: '', trim: true },
        menu: { type: [menuItemSchema], default: [] },
    },
    { timestamps: true, versionKey: false }
);

const Tenant = mongoose.models.Tenant || mongoose.model('Tenant', tenantSchema);

exports.create = function create(data) {
    return Tenant.create(data);
};

exports.findAll = function findAll() {
    return Tenant.find().sort({ createdAt: -1 });
};

exports.findById = function findById(id) {
    return Tenant.findById(id);
};

exports.addMenuItem = async function addMenuItem(tenantId, menuItem) {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return null;
    tenant.menu.push(menuItem);
    await tenant.save();
    return tenant;
};

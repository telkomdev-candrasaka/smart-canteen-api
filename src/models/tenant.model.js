const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, default: '', trim: true },
        price: { type: Number, required: true, min: 0 },
        available: { type: Boolean, default: true },
        stock: { type: Number, required: true, min: 0, default: 0 },
        reserved: { type: Number, required: true, min: 0, default: 0 },
        sold: { type: Number, required: true, min: 0, default: 0 },
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

exports.findById = function findById(id, options = {}) {
    const query = Tenant.findById(id);

    if (options.session) {
        query.session(options.session);
    }

    return query;
};

exports.addMenuItem = async function addMenuItem(tenantId, menuItem) {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return null;
    tenant.menu.push(menuItem);
    await tenant.save();
    return tenant;
};

exports.reserveMenuItemStock = async function reserveMenuItemStock(tenantId, menuItemId, quantity, options = {}) {
    const result = await Tenant.updateOne(
        {
            _id: tenantId,
            menu: {
                $elemMatch: {
                    _id: menuItemId,
                    available: { $ne: false },
                    stock: { $gte: quantity },
                },
            },
        },
        {
            $inc: {
                'menu.$.stock': -quantity,
                'menu.$.reserved': quantity,
            },
        },
        { session: options.session }
    );

    return result.modifiedCount === 1;
};

exports.settleMenuItemStock = async function settleMenuItemStock(tenantId, menuItemId, quantity, options = {}) {
    const result = await Tenant.updateOne(
        {
            _id: tenantId,
            menu: {
                $elemMatch: {
                    _id: menuItemId,
                    reserved: { $gte: quantity },
                },
            },
        },
        {
            $inc: {
                'menu.$.reserved': -quantity,
                'menu.$.sold': quantity,
            },
        },
        { session: options.session }
    );

    return result.modifiedCount === 1;
};

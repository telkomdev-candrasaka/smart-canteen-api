function normalizeId(value) {
    if (value === undefined || value === null) return null;
    return String(value);
}

function isSuperAdmin(user) {
    return Boolean(user && user.role === 'SUPER_ADMIN');
}

function hasTenantAdminAccess(user) {
    return Boolean(user && user.role === 'TENANT_ADMIN' && normalizeId(user.tenantId));
}

function canAccessTenant(user, tenantId) {
    if (isSuperAdmin(user)) return true;
    if (!hasTenantAdminAccess(user)) return false;

    return normalizeId(user.tenantId) === normalizeId(tenantId);
}

function canAccessOrder(user, order) {
    if (!order) return false;
    return canAccessTenant(user, order.tenantId);
}

function canAccessTransaction(user, transaction) {
    if (isSuperAdmin(user)) return true;
    if (!hasTenantAdminAccess(user)) return false;
    if (!transaction || !Array.isArray(transaction.orders) || transaction.orders.length === 0) return false;

    return transaction.orders.every((order) => canAccessOrder(user, order));
}

function sendForbidden(res) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
}

module.exports = {
    canAccessTenant,
    canAccessOrder,
    canAccessTransaction,
    sendForbidden,
};

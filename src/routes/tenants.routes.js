const express = require('express');
const tenantsController = require('../controllers/tenants.controller');
const { validateCreateTenant, validateTenantId } = require('../validators/tenants.validator');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');


const router = express.Router();

// Public route: tenant browsing remains open for menu discovery and existing client compatibility.
router.post('/', verifyToken, requireRole(['SUPER_ADMIN']), validateCreateTenant, tenantsController.createTenant);
// Public route: tenant browsing remains open for menu discovery and existing client compatibility.
router.get('/', tenantsController.getAllTenants);
// Public route: tenant detail remains open for menu discovery and existing client compatibility.
router.get('/:id', validateTenantId, tenantsController.getTenantById);
// Public route: menu browsing remains open for customer ordering flows.
router.get('/:id/menu', validateTenantId, tenantsController.getMenu);
router.get('/:id/orders/stream', verifyToken, requireRole(['SUPER_ADMIN', 'TENANT_ADMIN']), validateTenantId, tenantsController.streamTenantOrders);

module.exports = router;

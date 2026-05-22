const express = require('express');
const tenantsController = require('../controllers/tenants.controller');
const { validateCreateTenant, validateTenantId } = require('../validators/tenants.validator');


const router = express.Router();

router.post('/', validateCreateTenant, tenantsController.createTenant);
router.get('/', tenantsController.getAllTenants);
router.get('/:id', validateTenantId, tenantsController.getTenantById);
router.get('/:id/menu', validateTenantId, tenantsController.getMenu);
router.get('/:id/orders/stream', validateTenantId, tenantsController.streamTenantOrders);

module.exports = router;

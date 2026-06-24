const { canAccessTenant, canAccessOrder, canAccessTransaction } = require('../../src/policies/tenant.policy');

test('canAccessTenant allows SUPER_ADMIN for any tenant', () => {
  expect(canAccessTenant({ role: 'SUPER_ADMIN' }, 'tenant-1')).toBe(true);
});

test('canAccessTenant allows TENANT_ADMIN for matching tenant only', () => {
  expect(canAccessTenant({ role: 'TENANT_ADMIN', tenantId: 'tenant-1' }, 'tenant-1')).toBe(true);
  expect(canAccessTenant({ role: 'TENANT_ADMIN', tenantId: 'tenant-1' }, 'tenant-2')).toBe(false);
});

test('canAccessTenant denies MEMBER and users without tenant scope', () => {
  expect(canAccessTenant({ role: 'MEMBER', tenantId: 'tenant-1' }, 'tenant-1')).toBe(false);
  expect(canAccessTenant({ role: 'TENANT_ADMIN' }, 'tenant-1')).toBe(false);
  expect(canAccessTenant(null, 'tenant-1')).toBe(false);
});

test('canAccessOrder delegates to tenant access', () => {
  expect(canAccessOrder({ role: 'TENANT_ADMIN', tenantId: 'tenant-1' }, { tenantId: 'tenant-1' })).toBe(true);
  expect(canAccessOrder({ role: 'MEMBER', tenantId: 'tenant-1' }, { tenantId: 'tenant-1' })).toBe(false);
});

test('canAccessTransaction requires all populated orders to match tenant access', () => {
  const transaction = { orders: [{ tenantId: 'tenant-1' }, { tenantId: 'tenant-1' }] };
  expect(canAccessTransaction({ role: 'TENANT_ADMIN', tenantId: 'tenant-1' }, transaction)).toBe(true);
  expect(canAccessTransaction({ role: 'TENANT_ADMIN', tenantId: 'tenant-2' }, transaction)).toBe(false);
});

test('canAccessTransaction denies empty transactions for tenant roles and allows SUPER_ADMIN', () => {
  expect(canAccessTransaction({ role: 'TENANT_ADMIN', tenantId: 'tenant-1' }, { orders: [] })).toBe(false);
  expect(canAccessTransaction({ role: 'SUPER_ADMIN' }, { orders: [] })).toBe(true);
});

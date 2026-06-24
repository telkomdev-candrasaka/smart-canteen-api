const {
  ORDER_STATES,
  canTransitionOrder,
  assertValidOrderTransition,
  isValidOrderState,
} = require('../../src/domain/order-state-machine');

test('order state machine exposes all required states', () => {
  expect(ORDER_STATES).toEqual(expect.objectContaining({
    PENDING: 'pending',
    PAID: 'paid',
    PREPARING: 'preparing',
    READY: 'ready',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded',
  }));
});

test('order state machine accepts required valid transitions', () => {
  expect(canTransitionOrder('pending', 'paid')).toBe(true);
  expect(canTransitionOrder('paid', 'preparing')).toBe(true);
  expect(canTransitionOrder('preparing', 'ready')).toBe(true);
  expect(canTransitionOrder('ready', 'completed')).toBe(true);
  expect(canTransitionOrder('paid', 'refunded')).toBe(true);
  expect(() => assertValidOrderTransition('pending', 'paid')).not.toThrow();
});

test('order state machine rejects invalid transitions and unknown states', () => {
  expect(canTransitionOrder('pending', 'ready')).toBe(false);
  expect(canTransitionOrder('paid', 'completed')).toBe(false);
  expect(canTransitionOrder('completed', 'paid')).toBe(false);
  expect(isValidOrderState('unknown')).toBe(false);
  expect(() => assertValidOrderTransition('pending', 'ready')).toThrow('Invalid order status transition: pending -> ready');
  expect(() => assertValidOrderTransition('unknown', 'paid')).toThrow('Unknown order status: unknown');
  expect(() => assertValidOrderTransition('paid', 'unknown')).toThrow('Unknown order status: unknown');
});

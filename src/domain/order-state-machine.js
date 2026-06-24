const ORDER_STATES = Object.freeze({
    PENDING: 'pending',
    PAID: 'paid',
    PREPARING: 'preparing',
    READY: 'ready',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded',
});

const ALLOWED_ORDER_TRANSITIONS = Object.freeze({
    [ORDER_STATES.PENDING]: [ORDER_STATES.PAID],
    [ORDER_STATES.PAID]: [ORDER_STATES.PREPARING, ORDER_STATES.REFUNDED],
    [ORDER_STATES.PREPARING]: [ORDER_STATES.READY],
    [ORDER_STATES.READY]: [ORDER_STATES.COMPLETED],
    [ORDER_STATES.COMPLETED]: [],
    [ORDER_STATES.CANCELLED]: [],
    [ORDER_STATES.REFUNDED]: [],
});

function isValidOrderState(status) {
    return Object.values(ORDER_STATES).includes(status);
}

function canTransitionOrder(from, to) {
    if (!isValidOrderState(from) || !isValidOrderState(to)) {
        return false;
    }

    return ALLOWED_ORDER_TRANSITIONS[from].includes(to);
}

function assertValidOrderTransition(from, to) {
    if (!isValidOrderState(from)) {
        throw new Error(`Unknown order status: ${from}`);
    }

    if (!isValidOrderState(to)) {
        throw new Error(`Unknown order status: ${to}`);
    }

    if (!canTransitionOrder(from, to)) {
        throw new Error(`Invalid order status transition: ${from} -> ${to}`);
    }
}

module.exports = {
    ORDER_STATES,
    ALLOWED_ORDER_TRANSITIONS,
    isValidOrderState,
    canTransitionOrder,
    assertValidOrderTransition,
};

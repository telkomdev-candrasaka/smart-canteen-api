class RedisMock {
    constructor() {
        this._onMessage = null;
        if (!global.__redis_subscribers) global.__redis_subscribers = [];
        global.__redis_subscribers.push(this);
    }

    async publish(channel, message) {
        if (global.__redis_subscribers) {
            for (const sub of global.__redis_subscribers) {
                if (sub._onMessage) {
                    try {
                        sub._onMessage(channel, message);
                    } catch (_error) {
                        // ignore subscriber callback failures in tests
                    }
                }
            }
        }

        return 1;
    }

    on(eventName, cb) {
        if (eventName === 'message') {
            this._onMessage = (channel, message) => cb(channel, message);
        }
    }

    removeListener(eventName) {
        if (eventName === 'message') {
            this._onMessage = null;
        }
    }

    async subscribe(_channel) {
        return undefined;
    }

    async unsubscribe(_channel) {
        return undefined;
    }

    quit() {
        if (global.__redis_subscribers) {
            const idx = global.__redis_subscribers.indexOf(this);
            if (idx !== -1) global.__redis_subscribers.splice(idx, 1);
        }
    }
}

module.exports = RedisMock;

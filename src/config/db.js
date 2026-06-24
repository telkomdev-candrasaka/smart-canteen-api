const mongoose = require('mongoose');
const { validateEnv } = require('./env');

exports.connectToDatabase = async function connectToDatabase() {
    const { mongodbUri } = validateEnv({ requireMongo: true });

    await mongoose.connect(mongodbUri);
};

exports.disconnectFromDatabase = async function disconnectFromDatabase() {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
};

exports.getDatabaseHealth = function getDatabaseHealth() {
    return mongoose.connection.readyState === 1 ? 'up' : 'down';
};

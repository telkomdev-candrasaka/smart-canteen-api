const mongoose = require('mongoose');

exports.connectToDatabase = async function connectToDatabase() {
    const { MONGODB_URI } = process.env;

    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI is not configured');
    }

    await mongoose.connect(MONGODB_URI);
};

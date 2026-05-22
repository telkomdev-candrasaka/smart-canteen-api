require('dotenv').config();

const app = require('./app');
const { connectToDatabase } = require('./config/db');

const PORT = process.env.PORT || 3000;

async function startServer() {
    await connectToDatabase();

    const server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });

    return server;
}

if (require.main === module) {
    startServer().catch((error) => {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    });
}

module.exports = { startServer };

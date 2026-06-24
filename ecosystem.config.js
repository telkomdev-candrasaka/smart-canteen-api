module.exports = {
    apps: [
        {
            name: 'smart-canteen-api',
            script: 'src/server.js',
            instances: 1,
            exec_mode: 'fork',
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
            },
        },
    ],
};

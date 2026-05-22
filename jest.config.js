module.exports = {
    collectCoverage: true,
    coveragePathIgnorePatterns: ['/node_modules/', '/_mocks/', '/_tests/', '/src/seed.js'],
    collectCoverageFrom: ['src/**/*.js'],
    coverageDirectory: 'coverage',
    coverageReporters: ['lcov', 'text'],
    coverageThreshold: {
        global: {
            branches: 95,
            functions: 95,
            lines: 95,
            statements: 95,
        },
    },
    testEnvironment: 'node',
    verbose: true,
    testTimeout: 30000,
};

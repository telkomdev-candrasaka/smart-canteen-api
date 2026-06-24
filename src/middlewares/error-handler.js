const logger = require('../utils/logger');

exports.errorHandler = function errorHandler(err, _req, res, _next) {
    const statusCode = err.status || 500;
    const message = err.message || 'Internal server error';

    const requestLogger = _req && _req.log ? _req.log : logger;

    requestLogger.error({ err }, 'Unhandled request error');

    return res.status(statusCode).json({
        success: false,
        message,
    });
};

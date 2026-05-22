exports.errorHandler = function errorHandler(err, _req, res, _next) {
    const statusCode = err.status || 500;
    const message = err.message || 'Internal server error';

    console.error(err);

    return res.status(statusCode).json({
        success: false,
        message,
    });
};

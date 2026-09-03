export const errorHandler = (err, req, res, next) => {
  console.error('[API Error]:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Terjadi kesalahan internal pada server database';

  res.status(statusCode).json({
    success: false,
    message: message,
    error_code: err.code || 'INTERNAL_SERVER_ERROR'
  });
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route endpoint '${req.originalUrl}' tidak ditemukan`
  });
};

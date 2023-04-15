class AppError extends Error {
  constructor(message, statusCode) {
    super(message);

    //console.log(this.message);
    //this.errMessage = message;
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;

import AppError from '../utils/AppError.js';

// source = 'body' (default) or 'query'. Cleaned query data is in req.validated.
const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return next(new AppError(400, 'Validation failed', details));
  }
  if (source === 'body') req.body = result.data;
  else req.validated = result.data;
  next();
};

export default validate;

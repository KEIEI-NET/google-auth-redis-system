import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AppError, ErrorCode } from '../types';

/**
 * Express Validatorのエラーをチェックするミドルウェア
 */
export function validateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : undefined,
      message: error.msg,
    }));

    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      '入力データにエラーがあります',
      400,
      errorMessages
    );
  }
  
  next();
}
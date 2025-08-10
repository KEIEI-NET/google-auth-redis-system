import { Request, Response, NextFunction } from 'express';
import { body, param, query, ValidationChain, validationResult } from 'express-validator';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';
import { AppError, ErrorCode } from '../types';

// Custom sanitization function for general text input
export const sanitizeInput = (input: string): string => {
  // Remove any HTML tags and scripts
  let sanitized = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Escape special characters for SQL injection prevention
  sanitized = sanitized.replace(/['";\\]/g, '\\$&');
  
  return sanitized;
};

// Enhanced validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg,
      value: (error as any).value,
    }));
    
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'リクエストデータが無効です',
      400,
      { errors: errorMessages }
    );
  }
  
  next();
};

// Common validation chains
export const validationRules = {
  // Email validation with sanitization
  email: (): ValidationChain =>
    body('email')
      .trim()
      .normalizeEmail()
      .isEmail()
      .withMessage('有効なメールアドレスを入力してください')
      .isLength({ max: 255 })
      .withMessage('メールアドレスは255文字以内で入力してください')
      .customSanitizer(value => validator.escape(value)),

  // Employee ID validation
  employeeId: (): ValidationChain =>
    body('employeeId')
      .trim()
      .matches(/^[A-Z0-9-]+$/i)
      .withMessage('従業員IDは英数字とハイフンのみ使用できます')
      .isLength({ min: 3, max: 50 })
      .withMessage('従業員IDは3〜50文字で入力してください')
      .customSanitizer(value => value.toUpperCase()),

  // Name validation with sanitization
  name: (fieldName: string): ValidationChain =>
    body(fieldName)
      .trim()
      .notEmpty()
      .withMessage(`${fieldName}は必須です`)
      .isLength({ min: 1, max: 100 })
      .withMessage(`${fieldName}は1〜100文字で入力してください`)
      .matches(/^[a-zA-Zぁ-んァ-ヶー一-龯\s]+$/)
      .withMessage(`${fieldName}に使用できない文字が含まれています`)
      .customSanitizer(value => sanitizeInput(value)),

  // Department validation
  department: (): ValidationChain =>
    body('department')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('部署名は100文字以内で入力してください')
      .customSanitizer(value => sanitizeInput(value)),

  // Position validation
  position: (): ValidationChain =>
    body('position')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('役職名は100文字以内で入力してください')
      .customSanitizer(value => sanitizeInput(value)),

  // Role code validation
  roleCode: (): ValidationChain =>
    body('roleCode')
      .trim()
      .matches(/^[A-Z_]+$/)
      .withMessage('ロールコードは大文字英字とアンダースコアのみ使用できます')
      .isIn(['ADMIN', 'MANAGER', 'SUPERVISOR', 'EMPLOYEE', 'VIEWER'])
      .withMessage('無効なロールコードです'),

  // UUID validation
  uuid: (fieldName: string): ValidationChain =>
    param(fieldName)
      .isUUID(4)
      .withMessage('無効なUUID形式です'),

  // Integer ID validation
  intId: (fieldName: string): ValidationChain =>
    param(fieldName)
      .isInt({ min: 1 })
      .withMessage('無効なID形式です')
      .toInt(),

  // Date validation
  date: (fieldName: string): ValidationChain =>
    body(fieldName)
      .optional()
      .isISO8601()
      .withMessage('有効な日付形式(ISO8601)で入力してください')
      .toDate(),

  // Pagination validation
  pagination: (): ValidationChain[] => [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('ページ番号は1以上の整数で指定してください')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('取得件数は1〜100の間で指定してください')
      .toInt(),
    query('sort')
      .optional()
      .matches(/^[a-zA-Z_]+:(asc|desc)$/)
      .withMessage('ソート指定は "フィールド名:asc" または "フィールド名:desc" の形式で指定してください'),
  ],

  // Search query validation
  searchQuery: (): ValidationChain =>
    query('q')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('検索文字列は1〜100文字で入力してください')
      .customSanitizer(value => sanitizeInput(value)),

  // OAuth state validation
  oauthState: (): ValidationChain =>
    body('state')
      .trim()
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('無効なstateパラメータです')
      .isLength({ min: 32, max: 128 })
      .withMessage('stateパラメータの長さが無効です'),

  // OAuth code validation
  oauthCode: (): ValidationChain =>
    body('code')
      .trim()
      .notEmpty()
      .withMessage('認証コードは必須です')
      .isLength({ max: 512 })
      .withMessage('認証コードが長すぎます'),

  // Token validation
  token: (fieldName: string): ValidationChain =>
    body(fieldName)
      .trim()
      .notEmpty()
      .withMessage(`${fieldName}は必須です`)
      .matches(/^[a-zA-Z0-9._-]+$/)
      .withMessage(`無効な${fieldName}形式です`),
};

// Validation middleware factory for common employee operations
export const employeeValidation = {
  create: [
    validationRules.email(),
    validationRules.employeeId(),
    validationRules.name('firstName'),
    validationRules.name('lastName'),
    validationRules.department(),
    validationRules.position(),
    validationRules.date('hireDate'),
    handleValidationErrors,
  ],

  update: [
    validationRules.intId('id'),
    validationRules.name('firstName').optional(),
    validationRules.name('lastName').optional(),
    validationRules.department(),
    validationRules.position(),
    validationRules.date('hireDate'),
    handleValidationErrors,
  ],

  assignRole: [
    validationRules.intId('id'),
    validationRules.roleCode(),
    handleValidationErrors,
  ],

  list: [
    ...validationRules.pagination(),
    validationRules.searchQuery(),
    handleValidationErrors,
  ],
};

// OAuth validation middleware
export const oauthValidation = {
  callback: [
    validationRules.oauthCode(),
    validationRules.oauthState(),
    handleValidationErrors,
  ],

  refresh: [
    validationRules.token('refreshToken'),
    handleValidationErrors,
  ],
};

// Custom validation middleware for request body size
export const validateRequestSize = (maxSizeInBytes: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    let size = 0;
    
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxSizeInBytes) {
        res.status(413).json({
          success: false,
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: `リクエストサイズが制限(${maxSizeInBytes}バイト)を超えています`,
          },
        });
        req.connection.destroy();
      }
    });
    
    next();
  };
};

// XSS prevention middleware
export const xssPrevention = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize common input fields
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = DOMPurify.sanitize(req.body[key], {
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: [],
        });
      }
    });
  }
  
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = DOMPurify.sanitize(req.query[key] as string, {
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: [],
        });
      }
    });
  }
  
  next();
};
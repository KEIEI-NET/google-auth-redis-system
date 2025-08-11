import { Request, Response, NextFunction } from 'express';
import validator from 'validator';
import { AppError, ErrorCode } from '../types';

interface SanitizationRule {
  field: string;
  type: 'string' | 'email' | 'url' | 'alphanumeric' | 'number';
  maxLength?: number;
  required?: boolean;
  sanitize?: boolean;
}

export class InputSanitization {
  /**
   * Sanitize string input
   */
  private static sanitizeString(value: string, maxLength: number = 255): string {
    // Remove null bytes
    let sanitized = value.replace(/\0/g, '');
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    // Limit length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    
    // Escape HTML entities for display fields
    sanitized = validator.escape(sanitized);
    
    return sanitized;
  }

  /**
   * Validate and sanitize email
   */
  private static sanitizeEmail(value: string): string {
    const normalized = validator.normalizeEmail(value) || '';
    
    if (!validator.isEmail(normalized)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid email format',
        400
      );
    }
    
    return normalized;
  }

  /**
   * Validate and sanitize URL
   */
  private static sanitizeUrl(value: string): string {
    if (!validator.isURL(value, {
      protocols: ['http', 'https'],
      require_protocol: true,
    })) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid URL format',
        400
      );
    }
    
    return value;
  }

  /**
   * Validate alphanumeric
   */
  private static sanitizeAlphanumeric(value: string): string {
    if (!validator.isAlphanumeric(value, 'en-US', { ignore: '-_' })) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Value must be alphanumeric',
        400
      );
    }
    
    return value;
  }

  /**
   * Validate number
   */
  private static sanitizeNumber(value: any): number {
    const num = Number(value);
    
    if (isNaN(num)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Value must be a number',
        400
      );
    }
    
    return num;
  }

  /**
   * Apply sanitization rules
   */
  static applySanitization(data: any, rules: SanitizationRule[]): any {
    const sanitized: any = {};
    
    for (const rule of rules) {
      const value = data[rule.field];
      
      // Check required fields
      if (rule.required && (value === undefined || value === null || value === '')) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `Field ${rule.field} is required`,
          400
        );
      }
      
      // Skip optional empty fields
      if (!value && !rule.required) {
        continue;
      }
      
      // Apply sanitization based on type
      try {
        switch (rule.type) {
          case 'email':
            sanitized[rule.field] = this.sanitizeEmail(value);
            break;
          case 'url':
            sanitized[rule.field] = this.sanitizeUrl(value);
            break;
          case 'alphanumeric':
            sanitized[rule.field] = this.sanitizeAlphanumeric(value);
            break;
          case 'number':
            sanitized[rule.field] = this.sanitizeNumber(value);
            break;
          case 'string':
          default:
            sanitized[rule.field] = rule.sanitize !== false 
              ? this.sanitizeString(value, rule.maxLength)
              : value;
            break;
        }
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `Invalid value for field ${rule.field}`,
          400
        );
      }
    }
    
    return sanitized;
  }

  /**
   * Middleware for common auth endpoints
   */
  static authInputValidation() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        if (req.path === '/api/auth/google/callback') {
          req.body = this.applySanitization(req.body, [
            { field: 'code', type: 'string', maxLength: 500, required: true, sanitize: false },
            { field: 'state', type: 'alphanumeric', maxLength: 100, required: true },
          ]);
        }
        
        if (req.path === '/api/auth/refresh') {
          req.body = this.applySanitization(req.body, [
            { field: 'refreshToken', type: 'string', maxLength: 500, required: true, sanitize: false },
          ]);
        }
        
        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Prevent SQL injection in query parameters
   */
  static preventSqlInjection() {
    return (req: Request, res: Response, next: NextFunction) => {
      const dangerousPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE)\b)/gi,
        /(--|#|\/\*|\*\/)/g,
        /(\bOR\b\s*\d+\s*=\s*\d+)/gi,
        /(\bAND\b\s*\d+\s*=\s*\d+)/gi,
      ];
      
      // Check query parameters
      for (const [key, value] of Object.entries(req.query)) {
        const strValue = String(value);
        for (const pattern of dangerousPatterns) {
          if (pattern.test(strValue)) {
            throw new AppError(
              ErrorCode.VALIDATION_ERROR,
              'Invalid characters in query parameters',
              400
            );
          }
        }
      }
      
      // Check body if it's JSON
      if (req.body && typeof req.body === 'object') {
        const bodyStr = JSON.stringify(req.body);
        for (const pattern of dangerousPatterns) {
          if (pattern.test(bodyStr)) {
            throw new AppError(
              ErrorCode.VALIDATION_ERROR,
              'Invalid characters in request body',
              400
            );
          }
        }
      }
      
      next();
    };
  }
}
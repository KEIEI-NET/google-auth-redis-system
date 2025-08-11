import { Response, CookieOptions } from 'express';
import { config } from '../config/env';

/**
 * Secure cookie configuration
 */
const getSecureCookieOptions = (): CookieOptions => ({
  httpOnly: true,        // Prevent XSS attacks
  secure: config.isProduction, // HTTPS only in production
  sameSite: 'strict',    // CSRF protection
  path: '/',
  maxAge: 15 * 60 * 1000, // 15 minutes for access token
});

const getRefreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'strict',
  path: '/api/auth/refresh', // Restricted path for refresh token
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

/**
 * Set authentication cookies securely
 */
export const setSecureAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
  csrfToken?: string
): void => {
  // Set access token in httpOnly cookie
  res.cookie('access_token', accessToken, getSecureCookieOptions());
  
  // Set refresh token with restricted path
  res.cookie('refresh_token', refreshToken, getRefreshCookieOptions());
  
  // Set CSRF token in non-httpOnly cookie (needs to be readable by JS)
  if (csrfToken) {
    res.cookie('csrf_token', csrfToken, {
      secure: config.isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 1000, // 1 hour
    });
  }
};

/**
 * Clear authentication cookies
 */
export const clearSecureAuthCookies = (res: Response): void => {
  const clearOptions: CookieOptions = {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
  };

  res.clearCookie('access_token', clearOptions);
  res.clearCookie('refresh_token', { ...clearOptions, path: '/api/auth/refresh' });
  res.clearCookie('csrf_token', { ...clearOptions, httpOnly: false });
  res.clearCookie('session_id', clearOptions);
};

/**
 * Set session cookie
 */
export const setSessionCookie = (res: Response, sessionId: string): void => {
  res.cookie('session_id', sessionId, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
};

/**
 * Security headers for cookie protection
 */
export const setCookieSecurityHeaders = (res: Response): void => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Feature policy
  res.setHeader('Feature-Policy', "geolocation 'none'; microphone 'none'; camera 'none'");
};
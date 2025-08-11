import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
};

/**
 * Sanitize user input for display
 */
export const sanitizeUserInput = (input: string): string => {
  if (!input) return '';
  
  // Remove any HTML tags
  const cleaned = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  
  // Additional validation
  return cleaned.trim();
};

/**
 * Sanitize user data object
 */
export interface UserData {
  id?: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  position?: string;
  avatarUrl?: string;
}

export const sanitizeUserData = (user: UserData): UserData => {
  return {
    ...user,
    email: user.email ? sanitizeUserInput(user.email) : '',
    firstName: user.firstName ? sanitizeUserInput(user.firstName) : '',
    lastName: user.lastName ? sanitizeUserInput(user.lastName) : '',
    department: user.department ? sanitizeUserInput(user.department) : undefined,
    position: user.position ? sanitizeUserInput(user.position) : undefined,
  };
};

/**
 * CSRF token management
 */
export class CsrfTokenManager {
  private static token: string | null = null;

  static setToken(token: string): void {
    this.token = token;
  }

  static getToken(): string | null {
    return this.token;
  }

  static clearToken(): void {
    this.token = null;
  }

  /**
   * Add CSRF token to request headers
   */
  static addToHeaders(headers: HeadersInit = {}): HeadersInit {
    if (this.token) {
      return {
        ...headers,
        'X-CSRF-Token': this.token,
      };
    }
    return headers;
  }
}

/**
 * Validate URL to prevent open redirect attacks
 */
export const isValidRedirectUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url, window.location.origin);
    
    // Only allow same-origin redirects
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
};

/**
 * Content Security Policy helper
 */
export const getCspMeta = (): string => {
  return `
    default-src 'self';
    script-src 'self' 'unsafe-inline' https://apis.google.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: https:;
    connect-src 'self' http://localhost:5000 http://localhost:5001;
  `.replace(/\s+/g, ' ').trim();
};
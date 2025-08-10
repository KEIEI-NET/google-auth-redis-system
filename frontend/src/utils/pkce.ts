/**
 * PKCE (Proof Key for Code Exchange) implementation for OAuth 2.0
 * Provides additional security for public clients
 */

// Generate a cryptographically random string
function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues)
    .map(v => charset[v % charset.length])
    .join('');
}

// Generate code verifier (43-128 characters)
export function generateCodeVerifier(): string {
  return generateRandomString(128);
}

// Generate code challenge from verifier using SHA-256
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  
  // Convert to base64url
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Store PKCE values in sessionStorage
export function storePKCEValues(codeVerifier: string, state: string): void {
  sessionStorage.setItem('pkce_code_verifier', codeVerifier);
  sessionStorage.setItem('oauth_state', state);
}

// Retrieve PKCE values from sessionStorage
export function getPKCEValues(): { codeVerifier: string | null; state: string | null } {
  return {
    codeVerifier: sessionStorage.getItem('pkce_code_verifier'),
    state: sessionStorage.getItem('oauth_state'),
  };
}

// Clear PKCE values from sessionStorage
export function clearPKCEValues(): void {
  sessionStorage.removeItem('pkce_code_verifier');
  sessionStorage.removeItem('oauth_state');
}

// Validate state parameter to prevent CSRF attacks
export function validateState(receivedState: string): boolean {
  const storedState = sessionStorage.getItem('oauth_state');
  return storedState !== null && storedState === receivedState;
}
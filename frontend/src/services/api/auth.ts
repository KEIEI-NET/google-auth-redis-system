import axios from '../../config/axios';
import { ApiResponse, GoogleAuthResponse, LoginResponse } from '../../types';

export const authApi = {
  // Get Google OAuth URL
  getGoogleAuthUrl: async (): Promise<GoogleAuthResponse> => {
    const { data } = await axios.get<ApiResponse<GoogleAuthResponse>>('/auth/google');
    if (!data.success || !data.data) {
      throw new Error(data.error?.message || 'Failed to get auth URL');
    }
    return data.data;
  },

  // Handle Google OAuth callback
  googleCallback: async (code: string, state: string): Promise<LoginResponse> => {
    const { data } = await axios.post<ApiResponse<LoginResponse>>('/auth/google/callback', {
      code,
      state,
    });
    if (!data.success || !data.data) {
      throw new Error(data.error?.message || 'Authentication failed');
    }
    return data.data;
  },

  // Refresh access token
  refreshToken: async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
    const { data } = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
      '/auth/refresh',
      { refreshToken }
    );
    if (!data.success || !data.data) {
      throw new Error(data.error?.message || 'Token refresh failed');
    }
    return data.data;
  },

  // Logout
  logout: async (refreshToken?: string): Promise<void> => {
    await axios.post('/auth/logout', { refreshToken });
  },

  // Get current user
  getCurrentUser: async (): Promise<any> => {
    const { data } = await axios.get<ApiResponse>('/auth/me');
    if (!data.success || !data.data) {
      throw new Error(data.error?.message || 'Failed to get user info');
    }
    return data.data;
  },
};
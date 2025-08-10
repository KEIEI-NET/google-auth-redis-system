import axios, { AxiosError } from 'axios';

// Create axios instance
const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000',
  timeout: parseInt(process.env.REACT_APP_API_TIMEOUT || '30000'),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Always send httpOnly cookies
});

// Request interceptor - no longer needed for token management
// Tokens are handled automatically via httpOnly cookies
axiosInstance.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any & { _retry?: boolean };

    // Handle 401 errors - attempt token refresh via backend
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token via backend endpoint
        await axiosInstance.post('/api/auth/refresh');
        
        // Retry original request - tokens are now refreshed in httpOnly cookies
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Handle other error responses
    if (error.response?.data) {
      const apiError = error.response.data as any;
      if (apiError.error) {
        // Create a more user-friendly error
        const customError = new Error(apiError.error.message || 'An error occurred');
        (customError as any).code = apiError.error.code;
        (customError as any).details = apiError.error.details;
        return Promise.reject(customError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
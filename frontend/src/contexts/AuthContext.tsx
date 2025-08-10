import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../config/axios';
import { Employee, AuthContextType } from '../types';

// Re-export for backward compatibility
export type User = Employee;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const login = useCallback((userData: Employee) => {
    setUser(userData);
    
    // Note: Tokens are now handled as httpOnly cookies on the backend
    // No need to store tokens in localStorage anymore
  }, []);

  const logout = useCallback(async () => {
    try {
      // Backend will handle token revocation via httpOnly cookies
      await axios.post('/api/auth/logout', {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear user state
      setUser(null);
      navigate('/login');
    }
  }, [navigate]);

  const refreshAccessToken = useCallback(async () => {
    try {
      // Backend will handle token refresh via httpOnly cookies
      await axios.post('/api/auth/refresh', {}, { withCredentials: true });
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      await logout();
      throw error;
    }
  }, [logout]);

  // Check authentication status on mount (run once)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Use httpOnly cookies for authentication
        const response = await axios.get('/api/auth/me', { withCredentials: true });
        setUser(response.data.data);
      } catch (error: any) {
        if (error.response?.status === 401) {
          try {
            // Attempt token refresh
            await axios.post('/api/auth/refresh', {}, { withCredentials: true });
            const response = await axios.get('/api/auth/me', { withCredentials: true });
            setUser(response.data.data);
          } catch (refreshError) {
            console.error('Authentication check failed:', refreshError);
            // Authentication failed completely - user needs to login
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []); // Empty dependency array - run only once on mount

  // Setup axios interceptor for token refresh
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            await refreshAccessToken();
            // Retry original request with credentials
            originalRequest.withCredentials = true;
            return axios(originalRequest);
          } catch (refreshError) {
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [refreshAccessToken]);

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
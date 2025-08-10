import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import axios from '../../config/axios';
import { useAuth } from '../../contexts/AuthContext';

const AuthCallback: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get authorization code and state from URL parameters
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        // Handle OAuth errors
        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }

        if (!code || !state) {
          throw new Error('Missing authorization code or state parameter');
        }

        // Verify state matches what we stored
        const storedState = sessionStorage.getItem('oauth_state');
        if (!storedState || storedState !== state) {
          throw new Error('Invalid state parameter - possible CSRF attack');
        }

        // Clean up stored state
        sessionStorage.removeItem('oauth_state');

        // Exchange code for tokens via backend (uses httpOnly cookies)
        const response = await axios.post('/api/auth/google/callback', {
          code,
          state,
        }, { withCredentials: true });

        const { employee } = response.data.data;

        // Update auth context (tokens now handled via httpOnly cookies)
        login(employee);

        // Navigate to dashboard
        navigate('/dashboard', { replace: true });
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        setError(
          err.response?.data?.error?.message || 
          err.message || 
          '認証処理中にエラーが発生しました'
        );
        
        // Clean up stored state on error
        sessionStorage.removeItem('oauth_state');
        
        // Redirect to login page after a delay
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, login]);

  if (error) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        bgcolor="#f5f5f5"
        gap={2}
      >
        <Alert severity="error" sx={{ maxWidth: 400 }}>
          {error}
        </Alert>
        <Typography variant="body2" color="text.secondary">
          3秒後にログインページに戻ります...
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      bgcolor="#f5f5f5"
      gap={2}
    >
      <CircularProgress size={60} />
      <Typography variant="h6">認証処理中...</Typography>
      <Typography variant="body2" color="text.secondary">
        しばらくお待ちください
      </Typography>
    </Box>
  );
};

export default AuthCallback;
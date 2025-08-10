import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import axios from '../../config/axios';
import { useAuth } from '../../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get Google OAuth URL from backend
      const authUrlResponse = await axios.get('/api/auth/google');
      const { authUrl, state } = authUrlResponse.data.data;
      
      // Store state for later verification
      sessionStorage.setItem('oauth_state', state);
      
      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (err: any) {
      console.error('Login initiation error:', err);
      setError(err.response?.data?.error?.message || 'ログインの開始に失敗しました');
      setIsLoading(false);
    }
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      bgcolor="#f5f5f5"
    >
      <Card sx={{ maxWidth: 400, width: '100%', mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            従業員管理システム
          </Typography>
          
          <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
            Googleアカウントでログインしてください
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Button
            fullWidth
            variant="contained"
            size="large"
            startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <GoogleIcon />}
            onClick={() => handleGoogleLogin()}
            disabled={isLoading}
            sx={{
              py: 1.5,
              textTransform: 'none',
              fontSize: '1rem',
            }}
          >
            {isLoading ? 'ログイン中...' : 'Googleでログイン'}
          </Button>

          <Typography variant="caption" color="text.secondary" align="center" sx={{ mt: 3, display: 'block' }}>
            このシステムは承認されたユーザーのみ利用可能です
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginPage;
import React from 'react';
import { Box, Typography, Button, Card, CardContent } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useAuth } from '../../contexts/AuthContext';

const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      bgcolor="#f5f5f5"
    >
      <Card sx={{ maxWidth: 500, width: '100%', mx: 2 }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <ErrorOutlineIcon sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
          
          <Typography variant="h4" component="h1" gutterBottom>
            アクセス権限がありません
          </Typography>
          
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            申し訳ありませんが、このページにアクセスする権限がありません。
            {user && (
              <>
                <br />
                現在のアカウント: {user.email}
                <br />
                権限レベル: {user.roles.join(', ')}
              </>
            )}
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="contained"
              onClick={() => navigate('/dashboard')}
            >
              ダッシュボードに戻る
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/login')}
            >
              ログアウトして再ログイン
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UnauthorizedPage;
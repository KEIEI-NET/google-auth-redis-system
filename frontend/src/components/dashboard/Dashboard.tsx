import React, { useCallback, useMemo } from 'react';
import {
  AppBar,
  Box,
  Button,
  Container,
  Toolbar,
  Typography,
  Card,
  CardContent,
  CardActions,
  Grid,
  Avatar,
  Chip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PeopleIcon from '@mui/icons-material/People';
import SecurityIcon from '@mui/icons-material/Security';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import { hasAnyRole } from '../../utils/auth';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Performance optimization: Memoize role checks
  const isAdmin = useMemo(() => 
    user ? hasAnyRole(user, [UserRole.ADMIN, UserRole.SUPER_ADMIN]) : false, 
    [user]
  );
  const isManager = useMemo(() => 
    user ? hasAnyRole(user, [UserRole.MANAGER]) : false, 
    [user]
  );

  // Performance optimization: Memoize navigation handlers
  const handleAdminNavigation = useCallback(() => {
    navigate('/admin');
  }, [navigate]);

  const handleLogout = useCallback(() => {
    void logout();
  }, [logout]);

  // Security: Verify user object integrity AFTER hooks
  if (!user || !user.firstName || !user.lastName || !user.email || !Array.isArray(user.roles)) {
    console.error('Invalid user data detected');
    return null;
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            従業員管理システム
          </Typography>
          <Button color="inherit" onClick={handleLogout} startIcon={<LogoutIcon />}>
            ログアウト
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Grid container spacing={3}>
          {/* User Profile Card */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box display="flex" flexDirection="column" alignItems="center">
                  <Avatar sx={{ width: 80, height: 80, mb: 2, bgcolor: 'primary.main' }}>
                    <PersonIcon sx={{ fontSize: 40 }} />
                  </Avatar>
                  <Typography variant="h5" gutterBottom>
                    {user.firstName} {user.lastName}
                  </Typography>
                  <Typography color="text.secondary" gutterBottom>
                    {user.email}
                  </Typography>
                  {user.department && (
                    <Typography variant="body2" color="text.secondary">
                      部署: {user.department}
                    </Typography>
                  )}
                  {user.position && (
                    <Typography variant="body2" color="text.secondary">
                      役職: {user.position}
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Roles Card */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  割り当てられた権限
                </Typography>
                <Box sx={{ mt: 2 }}>
                  {user.roles.map((role) => (
                    <Chip
                      key={role}
                      label={role}
                      color="primary"
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Management Tools */}
          {isAdmin && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <AdminPanelSettingsIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                    <Box>
                      <Typography variant="h6">
                        管理者機能
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        従業員の管理とシステム設定
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
                <CardActions>
                  <Button
                    variant="contained"
                    startIcon={<SecurityIcon />}
                    onClick={handleAdminNavigation}
                    fullWidth
                  >
                    管理者ページを開く
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          )}

          {/* Quick Access */}
          <Grid item xs={12} md={isAdmin ? 6 : 12}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <PeopleIcon sx={{ fontSize: 40, color: 'info.main', mr: 2 }} />
                  <Box>
                    <Typography variant="h6">
                      ダッシュボード
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ようこそ、{user.firstName}さん
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body1" color="text.secondary">
                  従業員管理システムへのアクセスが確認されました。
                  {isAdmin && ' 管理者権限が有効です。'}
                  {isManager && ' マネージャー権限が有効です。'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* System Status */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  システム情報
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="primary.main">
                        {new Date().getHours()}:{String(new Date().getMinutes()).padStart(2, '0')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        現在時刻
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="success.main">
                        Online
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        システム状態
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="info.main">
                        {user.roles.length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        割り当て権限数
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="warning.main">
                        Active
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        アカウント状態
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Dashboard;
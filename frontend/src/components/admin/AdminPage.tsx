import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Grid,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Pagination,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import PeopleIcon from '@mui/icons-material/People';
import SecurityIcon from '@mui/icons-material/Security';
import HistoryIcon from '@mui/icons-material/History';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { useAuth } from '../../contexts/AuthContext';
import axios from '../../config/axios';

interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  department?: string;
  position?: string;
  roles: string[];
  isActive: boolean;
  lastLoginAt?: string;
}

interface AuditLog {
  id: number;
  eventType: string;
  severity: string;
  employeeId: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  resource: string | null;
  action: string | null;
  result: string | null;
  details: any;
  timestamp: string;
  employee: {
    employeeId: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}

interface Statistics {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  recentLogins: number;
  roleDistribution: {
    roleCode: string;
    roleName: string;
    count: number;
  }[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const AdminPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  
  // Statistics data
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [statisticsLoading, setStatisticsLoading] = useState(false);
  const [statisticsError, setStatisticsError] = useState<string | null>(null);
  
  // Employees data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  
  // Audit logs data
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditFilter, setAuditFilter] = useState({
    eventType: '',
    severity: '',
    startDate: '',
    endDate: '',
  });

  // Data fetching functions
  const fetchStatistics = async () => {
    try {
      setStatisticsLoading(true);
      const response = await axios.get('/api/admin/statistics');
      setStatistics(response.data.data);
      setStatisticsError(null);
    } catch (err: any) {
      console.error('Failed to fetch statistics:', err);
      setStatisticsError(err.response?.data?.error?.message || '統計情報の取得に失敗しました');
    } finally {
      setStatisticsLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      setEmployeesLoading(true);
      const response = await axios.get('/api/admin/employees');
      setEmployees(response.data.data.employees || []);
      setEmployeesError(null);
    } catch (err: any) {
      console.error('Failed to fetch employees:', err);
      setEmployeesError(err.response?.data?.error?.message || '従業員データの取得に失敗しました');
    } finally {
      setEmployeesLoading(false);
    }
  };

  const fetchAuditLogs = async (page: number = 1) => {
    try {
      setAuditLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...Object.fromEntries(
          Object.entries(auditFilter).filter(([, value]) => value !== '')
        ),
      });
      
      const response = await axios.get(`/api/admin/audit-logs?${params}`);
      setAuditLogs(response.data.data.logs || []);
      setAuditError(null);
    } catch (err: any) {
      console.error('Failed to fetch audit logs:', err);
      setAuditError(err.response?.data?.error?.message || '監査ログの取得に失敗しました');
    } finally {
      setAuditLoading(false);
    }
  };

  // Load data based on active tab
  useEffect(() => {
    switch (tabValue) {
      case 0: // Statistics
        fetchStatistics();
        break;
      case 1: // Employees
        fetchEmployees();
        break;
      case 2: // Audit Logs
        fetchAuditLogs(auditPage);
        break;
      default:
        break;
    }
  }, [tabValue]);

  useEffect(() => {
    if (tabValue === 2) {
      fetchAuditLogs(auditPage);
    }
  }, [auditPage, auditFilter, tabValue]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getRoleColor = (role: string): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' => {
    switch (role) {
      case 'SUPER_ADMIN': return 'error';
      case 'ADMIN': return 'primary';
      case 'MANAGER': return 'secondary';
      case 'EMPLOYEE': return 'info';
      case 'VIEWER': return 'default';
      default: return 'default';
    }
  };

  const getSeverityColor = (severity: string): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' => {
    switch (severity) {
      case 'CRITICAL': return 'error';
      case 'HIGH': return 'warning';
      case 'MEDIUM': return 'info';
      case 'LOW': return 'success';
      default: return 'default';
    }
  };

  const formatLastLogin = (lastLogin?: string) => {
    if (!lastLogin) return '未ログイン';
    return new Date(lastLogin).toLocaleString('ja-JP');
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ja-JP');
  };

  // Statistics Tab Component
  const StatisticsTab = () => (
    <Box>
      {statisticsError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {statisticsError}
        </Alert>
      )}
      
      {statisticsLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : statistics && (
        <Grid container spacing={3}>
          {/* Stats Cards */}
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <PeopleIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                  <Box>
                    <Typography color="text.secondary" gutterBottom>
                      総従業員数
                    </Typography>
                    <Typography variant="h4">
                      {statistics.totalEmployees}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <SecurityIcon sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
                  <Box>
                    <Typography color="text.secondary" gutterBottom>
                      アクティブユーザー
                    </Typography>
                    <Typography variant="h4">
                      {statistics.activeEmployees}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <SecurityIcon sx={{ fontSize: 40, color: 'error.main', mr: 2 }} />
                  <Box>
                    <Typography color="text.secondary" gutterBottom>
                      非アクティブ
                    </Typography>
                    <Typography variant="h4">
                      {statistics.inactiveEmployees}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <HistoryIcon sx={{ fontSize: 40, color: 'info.main', mr: 2 }} />
                  <Box>
                    <Typography color="text.secondary" gutterBottom>
                      24時間以内ログイン
                    </Typography>
                    <Typography variant="h4">
                      {statistics.recentLogins}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Role Distribution */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  ロール別分布
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>ロール</TableCell>
                        <TableCell>ロール名</TableCell>
                        <TableCell>人数</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {statistics.roleDistribution.map((role) => (
                        <TableRow key={role.roleCode}>
                          <TableCell>
                            <Chip
                              label={role.roleCode}
                              color={getRoleColor(role.roleCode)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{role.roleName}</TableCell>
                          <TableCell>{role.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );

  // Employees Tab Component
  const EmployeesTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        従業員一覧
      </Typography>
      
      {employeesError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {employeesError}
        </Alert>
      )}

      {employeesLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>名前</TableCell>
                <TableCell>メールアドレス</TableCell>
                <TableCell>部署</TableCell>
                <TableCell>役職</TableCell>
                <TableCell>権限</TableCell>
                <TableCell>状態</TableCell>
                <TableCell>最終ログイン</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    {employee.firstName} {employee.lastName}
                  </TableCell>
                  <TableCell>{employee.email}</TableCell>
                  <TableCell>{employee.department || '-'}</TableCell>
                  <TableCell>{employee.position || '-'}</TableCell>
                  <TableCell>
                    {employee.roles.map((role) => (
                      <Chip
                        key={role}
                        label={role}
                        color={getRoleColor(role)}
                        size="small"
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    ))}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={employee.isActive ? 'アクティブ' : '無効'}
                      color={employee.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {formatLastLogin(employee.lastLoginAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );

  // Audit Logs Tab Component
  const AuditLogsTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        監査ログ
      </Typography>

      {/* Filters */}
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>イベント種別</InputLabel>
              <Select
                value={auditFilter.eventType}
                onChange={(e) => setAuditFilter(prev => ({ ...prev, eventType: e.target.value }))}
                label="イベント種別"
              >
                <MenuItem value="">すべて</MenuItem>
                <MenuItem value="LOGIN_SUCCESS">ログイン成功</MenuItem>
                <MenuItem value="LOGIN_FAILED">ログイン失敗</MenuItem>
                <MenuItem value="LOGOUT">ログアウト</MenuItem>
                <MenuItem value="ACCESS_DENIED">アクセス拒否</MenuItem>
                <MenuItem value="SUSPICIOUS_ACTIVITY">疑わしいアクティビティ</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>重要度</InputLabel>
              <Select
                value={auditFilter.severity}
                onChange={(e) => setAuditFilter(prev => ({ ...prev, severity: e.target.value }))}
                label="重要度"
              >
                <MenuItem value="">すべて</MenuItem>
                <MenuItem value="LOW">低</MenuItem>
                <MenuItem value="MEDIUM">中</MenuItem>
                <MenuItem value="HIGH">高</MenuItem>
                <MenuItem value="CRITICAL">重大</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>
      
      {auditError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {auditError}
        </Alert>
      )}

      {auditLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>日時</TableCell>
                  <TableCell>イベント</TableCell>
                  <TableCell>重要度</TableCell>
                  <TableCell>ユーザー</TableCell>
                  <TableCell>リソース</TableCell>
                  <TableCell>アクション</TableCell>
                  <TableCell>結果</TableCell>
                  <TableCell>IPアドレス</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{formatTimestamp(log.timestamp)}</TableCell>
                    <TableCell>{log.eventType}</TableCell>
                    <TableCell>
                      <Chip
                        label={log.severity}
                        color={getSeverityColor(log.severity)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {log.employee ? `${log.employee.firstName} ${log.employee.lastName}` : '-'}
                    </TableCell>
                    <TableCell>{log.resource || '-'}</TableCell>
                    <TableCell>{log.action || '-'}</TableCell>
                    <TableCell>{log.result || '-'}</TableCell>
                    <TableCell>{log.ipAddress || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          {auditLogs.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={10} // このページネーションは実際のデータに基づいて調整する必要があります
                page={auditPage}
                onChange={(event, value) => setAuditPage(value)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <SecurityIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            管理者ページ - 従業員管理システム
          </Typography>
          <Button color="inherit" onClick={logout} startIcon={<LogoutIcon />}>
            ログアウト
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="admin tabs">
            <Tab
              label="ダッシュボード"
              icon={<DashboardIcon />}
              iconPosition="start"
              id="admin-tab-0"
              aria-controls="admin-tabpanel-0"
            />
            <Tab
              label="従業員管理"
              icon={<PeopleIcon />}
              iconPosition="start"
              id="admin-tab-1"
              aria-controls="admin-tabpanel-1"
            />
            <Tab
              label="監査ログ"
              icon={<HistoryIcon />}
              iconPosition="start"
              id="admin-tab-2"
              aria-controls="admin-tabpanel-2"
            />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <StatisticsTab />
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          <EmployeesTab />
        </TabPanel>
        
        <TabPanel value={tabValue} index={2}>
          <AuditLogsTab />
        </TabPanel>
      </Container>
    </Box>
  );
};

export default AdminPage;
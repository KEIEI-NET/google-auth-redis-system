import express from 'express';
import cors from 'cors';
import { config } from './config/env';

const app = express();

// Middleware
app.use(cors({
  origin: config.cors.allowedOrigins,
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.server.nodeEnv
  });
});

// Auth endpoints stub
app.get('/api/auth/google', (req, res) => {
  const state = Math.random().toString(36).substring(7);
  const codeVerifier = Math.random().toString(36).substring(7);
  
  // In real implementation, save state and codeVerifier to session
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${config.google.clientId}&` +
    `redirect_uri=${encodeURIComponent(config.google.redirectUri)}&` +
    `response_type=code&` +
    `scope=openid email profile&` +
    `state=${state}&` +
    `code_challenge=${codeVerifier}&` +
    `code_challenge_method=plain&` +
    `access_type=offline&` +
    `prompt=consent`;
    
  res.json({ authUrl });
});

app.post('/api/auth/google/callback', (req, res) => {
  // Stub implementation
  res.json({ 
    success: true,
    message: 'Authentication endpoint stub',
    data: {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      user: {
        id: 1,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        roles: ['EMPLOYEE']
      }
    }
  });
});

app.get('/api/auth/me', (req, res) => {
  // Stub implementation
  res.json({
    success: true,
    data: {
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      roles: ['EMPLOYEE']
    }
  });
});

// Start server
const PORT = config.server.port || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Simple server running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth endpoint: http://localhost:${PORT}/api/auth/google`);
});
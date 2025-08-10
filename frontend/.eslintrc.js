module.exports = {
  extends: [
    'react-app',
    'react-app/jest',
  ],
  rules: {
    // React specific rules
    'react-hooks/exhaustive-deps': 'warn',
    
    // General rules
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
  },
};
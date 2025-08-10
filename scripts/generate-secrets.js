#!/usr/bin/env node

/**
 * セキュリティ用のシークレット生成スクリプト
 * 本番環境で使用する強固なシークレットを生成します
 */

const crypto = require('crypto');

// JWT Secret生成（32文字以上）
const generateJWTSecret = () => {
  return crypto.randomBytes(64).toString('hex');
};

// Session Secret生成
const generateSessionSecret = () => {
  return crypto.randomBytes(32).toString('hex');
};

// 暗号化キー生成（32バイト = 256ビット）
const generateEncryptionKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

// ランダムパスワード生成
const generatePassword = (length = 16) => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }
  
  return password;
};

console.log('🔐 セキュリティシークレット生成ツール\n');

console.log('以下の値を .env ファイルにコピーしてください：\n');

console.log('# JWT Configuration');
console.log(`JWT_SECRET=${generateJWTSecret()}\n`);

console.log('# Session Configuration');
console.log(`SESSION_SECRET_CURRENT=${generateSessionSecret()}`);
console.log(`SESSION_SECRET_PREVIOUS=${generateSessionSecret()}\n`);

console.log('# Database Encryption');
console.log(`DB_ENCRYPTION_KEY=${generateEncryptionKey()}\n`);

console.log('# Database Password (PostgreSQL)');
console.log(`DATABASE_PASSWORD=${generatePassword()}\n`);

console.log('# Redis Password');
console.log(`REDIS_PASSWORD=${generatePassword()}\n`);

console.log('⚠️  重要な注意事項:');
console.log('1. これらの値は本番環境で一度だけ生成し、安全に保管してください');
console.log('2. バージョン管理システムにはコミットしないでください');
console.log('3. Google Client Secretは Google Cloud Console から取得してください');
console.log('4. 2025年6月以降、Client Secretは作成時のみ表示されます\n');
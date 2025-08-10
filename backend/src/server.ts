import { createApp, prisma } from './app';
import { createServer } from 'http';
import { config } from './config/env';
import { connectRedis, disconnectRedis, redisClient } from './config/redis';

// サーバーの起動
async function startServer() {
  try {
    // Redis接続
    await connectRedis();
    // eslint-disable-next-line no-console
    console.log('✅ Redis接続が確立されました');

    // データベース接続確認
    await prisma.$connect();
    // eslint-disable-next-line no-console
    console.log('✅ データベース接続が確立されました');

    // Expressアプリケーションの作成
    const app = createApp();
    const server = createServer(app);

    // ポート設定
    const PORT = config.server.port;

    // サーバー起動
    server.listen(PORT, () => {
      // eslint-disable-next-line no-console
    console.log(`
🚀 サーバーが起動しました
📍 URL: http://localhost:${PORT}
🌍 環境: ${config.server.nodeEnv}
📅 起動時刻: ${new Date().toLocaleString('ja-JP')}
      `);
    });

    // グレースフルシャットダウンの設定
    const gracefulShutdown = async (signal: string) => {
      // eslint-disable-next-line no-console
      console.log(`\n⚠️  ${signal}シグナルを受信しました。グレースフルシャットダウンを開始します...`);

      // 新規リクエストの受付を停止
      server.close(async () => {
        // eslint-disable-next-line no-console
        console.log('✅ HTTPサーバーを閉じました');

        try {
          // Redis接続を閉じる
          await disconnectRedis();
          // eslint-disable-next-line no-console
          console.log('✅ Redis接続を閉じました');

          // データベース接続を閉じる
          await prisma.$disconnect();
          // eslint-disable-next-line no-console
          console.log('✅ データベース接続を閉じました');

          // eslint-disable-next-line no-console
          console.log('👋 シャットダウンが完了しました');
          process.exit(0);
        } catch (error) {
          console.error('❌ シャットダウン中にエラーが発生しました:', error);
          process.exit(1);
        }
      });

      // 30秒でタイムアウト
      setTimeout(() => {
        console.error('❌ グレースフルシャットダウンがタイムアウトしました。強制終了します。');
        process.exit(1);
      }, 30000);
    };

    // シグナルハンドラーの登録
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // 未処理のエラーハンドリング
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ 未処理のPromise拒否:', reason);
      console.error('Promise:', promise);
      // 本番環境では適切にログを記録し、必要に応じてシャットダウン
      if (config.isProduction) {
        gracefulShutdown('UNHANDLED_REJECTION');
      }
    });

    process.on('uncaughtException', (error) => {
      console.error('❌ キャッチされていない例外:', error);
      // 本番環境では即座にシャットダウン
      if (config.isProduction) {
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ サーバー起動中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// サーバー起動
void startServer();
# ローカル環境セットアップガイド

## Dockerを使用する場合

1. **Docker Desktopを起動**
   - Windows: Docker Desktopアプリケーションを起動
   - システムトレイのDockerアイコンが緑色になるまで待つ

2. **コンテナを起動**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

3. **起動確認**
   ```bash
   docker ps
   ```

## Dockerを使用しない場合（ローカルインストール）

### PostgreSQL 15のインストール

1. **Windows**
   - [PostgreSQL公式サイト](https://www.postgresql.org/download/windows/)からインストーラーをダウンロード
   - インストール時に以下を設定:
     - Password: `^0-_EYRsymZEc7d3`
     - Port: `5432`
   - pgAdminも一緒にインストールされます

2. **データベース作成**
   ```sql
   CREATE DATABASE employee_db;
   ```

### Redis 7のインストール

1. **Windows**
   - [Redis公式GitHub](https://github.com/microsoftarchive/redis/releases)からダウンロード
   - または[Memurai](https://www.memurai.com/)（Windows向けRedis互換）を使用

2. **設定**
   - `redis.windows.conf`を編集:
   ```
   requirepass 8ix6Mo7fUmRVno4v
   ```

3. **起動**
   ```bash
   redis-server redis.windows.conf
   ```

## 接続テスト

### PostgreSQL
```bash
psql -U postgres -d employee_db -h localhost -p 5432
```

### Redis
```bash
redis-cli -a 8ix6Mo7fUmRVno4v
```

## 開発開始

環境が整ったら、以下のコマンドでPrismaのセットアップを行います：

```bash
cd backend
npx prisma generate
npx prisma migrate dev
```
#!/bin/bash

echo "🐳 Docker環境セットアップスクリプト"
echo "=================================="

# カラー定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Dockerが起動しているか確認
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Dockerが起動していません。Dockerを起動してください。${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Dockerが起動しています${NC}"

# 既存のコンテナを停止
echo -e "\n${YELLOW}既存のコンテナを停止中...${NC}"
docker-compose -f docker-compose.dev.yml down

# ボリュームをクリーンアップ（オプション）
read -p "既存のデータベースデータを削除しますか？ (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}ボリュームを削除中...${NC}"
    docker volume rm employee_db_postgres_data employee_db_redis_data employee_db_pgadmin_data 2>/dev/null
fi

# コンテナを起動
echo -e "\n${YELLOW}Dockerコンテナを起動中...${NC}"
docker-compose -f docker-compose.dev.yml up -d

# ヘルスチェック
echo -e "\n${YELLOW}サービスの起動を待機中...${NC}"
sleep 5

# PostgreSQLの接続確認
echo -n "PostgreSQL: "
if docker exec employee_db_postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 起動完了${NC}"
else
    echo -e "${RED}❌ 起動失敗${NC}"
fi

# Redisの接続確認
echo -n "Redis: "
if docker exec employee_db_redis redis-cli -a "8ix6Mo7fUmRVno4v" ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 起動完了${NC}"
else
    echo -e "${RED}❌ 起動失敗${NC}"
fi

echo -e "\n${GREEN}セットアップ完了！${NC}"
echo -e "\n接続情報:"
echo "PostgreSQL: postgresql://postgres:^0-_EYRsymZEc7d3@localhost:5432/employee_db"
echo "Redis: redis://:8ix6Mo7fUmRVno4v@localhost:6379"
echo -e "\n管理ツール:"
echo "pgAdmin: http://localhost:5050 (admin@example.com / admin123)"
echo "Redis Commander: http://localhost:8081"
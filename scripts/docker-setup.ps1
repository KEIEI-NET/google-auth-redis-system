# Windows用 Docker環境セットアップスクリプト

Write-Host "🐳 Docker環境セットアップスクリプト" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

# Dockerが起動しているか確認
try {
    docker info | Out-Null
    Write-Host "✅ Dockerが起動しています" -ForegroundColor Green
}
catch {
    Write-Host "❌ Dockerが起動していません。Dockerを起動してください。" -ForegroundColor Red
    exit 1
}

# 既存のコンテナを停止
Write-Host "`n既存のコンテナを停止中..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml down

# ボリュームをクリーンアップ（オプション）
$response = Read-Host "既存のデータベースデータを削除しますか？ (y/N)"
if ($response -eq 'y' -or $response -eq 'Y') {
    Write-Host "ボリュームを削除中..." -ForegroundColor Yellow
    docker volume rm employee_db_postgres_data employee_db_redis_data employee_db_pgadmin_data 2>$null
}

# コンテナを起動
Write-Host "`nDockerコンテナを起動中..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml up -d

# ヘルスチェック
Write-Host "`nサービスの起動を待機中..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# PostgreSQLの接続確認
Write-Host -NoNewline "PostgreSQL: "
$pgResult = docker exec employee_db_postgres pg_isready -U postgres 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 起動完了" -ForegroundColor Green
} else {
    Write-Host "❌ 起動失敗" -ForegroundColor Red
}

# Redisの接続確認
Write-Host -NoNewline "Redis: "
$redisResult = docker exec employee_db_redis redis-cli -a "8ix6Mo7fUmRVno4v" ping 2>$null
if ($redisResult -eq "PONG") {
    Write-Host "✅ 起動完了" -ForegroundColor Green
} else {
    Write-Host "❌ 起動失敗" -ForegroundColor Red
}

Write-Host "`nセットアップ完了！" -ForegroundColor Green
Write-Host "`n接続情報:" -ForegroundColor Cyan
Write-Host "PostgreSQL: postgresql://postgres:^0-_EYRsymZEc7d3@localhost:5432/employee_db"
Write-Host "Redis: redis://:8ix6Mo7fUmRVno4v@localhost:6379"
Write-Host "`n管理ツール:" -ForegroundColor Cyan
Write-Host "pgAdmin: http://localhost:5050 (admin@example.com / admin123)"
Write-Host "Redis Commander: http://localhost:8081"
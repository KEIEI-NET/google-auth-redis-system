# MCP Setup Script for Windows
# このスクリプトは、Claude DesktopのMCP設定を自動化します

param(
    [string]$GithubToken,
    [string]$SupabaseUrl,
    [string]$SupabaseKey
)

# カラー出力用の関数
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Claude Desktop MCP セットアップ    " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 設定ファイルのパス
$configPath = "$env:APPDATA\Claude\claude_desktop_config.json"
$configDir = "$env:APPDATA\Claude"

# ディレクトリが存在しない場合は作成
if (-not (Test-Path -Path $configDir)) {
    Write-Host "📁 Claudeディレクトリを作成中..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

# 既存の設定ファイルのバックアップ
if (Test-Path -Path $configPath) {
    $backupPath = "$configPath.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Write-Host "📋 既存の設定をバックアップ中: $backupPath" -ForegroundColor Yellow
    Copy-Item -Path $configPath -Destination $backupPath
}

# トークンの入力（パラメータで提供されていない場合）
if (-not $GithubToken) {
    Write-Host "GitHub Personal Access Tokenを入力してください:" -ForegroundColor Green
    $GithubToken = Read-Host -AsSecureString | ConvertFrom-SecureString -AsPlainText
}

if (-not $SupabaseUrl) {
    Write-Host "Supabase Project URLを入力してください (例: https://your-project.supabase.co):" -ForegroundColor Green
    $SupabaseUrl = Read-Host
}

if (-not $SupabaseKey) {
    Write-Host "Supabase Service Role Keyを入力してください:" -ForegroundColor Green
    $SupabaseKey = Read-Host -AsSecureString | ConvertFrom-SecureString -AsPlainText
}

# 設定オブジェクトの作成
$config = @{
    mcpServers = @{
        github = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-github")
            env = @{
                GITHUB_PERSONAL_ACCESS_TOKEN = $GithubToken
            }
        }
        supabase = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-supabase")
            env = @{
                SUPABASE_URL = $SupabaseUrl
                SUPABASE_SERVICE_ROLE_KEY = $SupabaseKey
            }
        }
        context7 = @{
            command = "npx"
            args = @("-y", "@context7/mcp-server")
            env = @{}
        }
    }
}

# JSONファイルとして保存
Write-Host "💾 設定ファイルを保存中..." -ForegroundColor Yellow
$config | ConvertTo-Json -Depth 10 | Set-Content -Path $configPath -Encoding UTF8

Write-Host "✅ 設定ファイルが正常に作成されました: $configPath" -ForegroundColor Green
Write-Host ""

# Claude Desktopプロセスの確認
$claudeProcess = Get-Process -Name "Claude" -ErrorAction SilentlyContinue

if ($claudeProcess) {
    Write-Host "⚠️  Claude Desktopが実行中です。" -ForegroundColor Yellow
    Write-Host "   MCPを有効にするには、Claude Desktopを再起動する必要があります。" -ForegroundColor Yellow
    
    $restart = Read-Host "今すぐClaude Desktopを再起動しますか？ (Y/N)"
    
    if ($restart -eq 'Y' -or $restart -eq 'y') {
        Write-Host "🔄 Claude Desktopを再起動中..." -ForegroundColor Yellow
        
        # Claude Desktopを終了
        Stop-Process -Name "Claude" -Force
        Start-Sleep -Seconds 2
        
        # Claude Desktopを起動（パスは環境により異なる可能性があります）
        $claudePath = "$env:LOCALAPPDATA\Programs\claude\Claude.exe"
        if (Test-Path -Path $claudePath) {
            Start-Process -FilePath $claudePath
            Write-Host "✅ Claude Desktopが再起動されました。" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Claude.exeが見つかりません。手動で起動してください。" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "ℹ️  Claude Desktopは現在実行されていません。" -ForegroundColor Cyan
    Write-Host "   次回起動時にMCP設定が有効になります。" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "        セットアップ完了！            " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📚 次のステップ:" -ForegroundColor Green
Write-Host "1. Claude Desktopを起動（まだの場合）" -ForegroundColor White
Write-Host "2. Claudeで 'GitHubのリポジトリを検索' を試す" -ForegroundColor White
Write-Host "3. 'Supabaseのテーブル一覧を表示' を試す" -ForegroundColor White
Write-Host ""
Write-Host "🔍 問題が発生した場合:" -ForegroundColor Yellow
Write-Host "   ログファイル: $env:APPDATA\Claude\logs\" -ForegroundColor White
Write-Host "   設定ファイル: $configPath" -ForegroundColor White
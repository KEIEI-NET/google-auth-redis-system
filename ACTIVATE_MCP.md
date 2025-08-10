# MCP サーバーの有効化手順

## 現在の状態
- GitHub MCP: ✅ 接続済み
- Supabase MCP: ❌ 接続失敗（パッケージの問題）

## MCPを有効化する方法

### 1. Claude Codeの再起動
```bash
# 現在のClaude Codeセッションを終了
exit

# 新しいセッションを開始
claude
```

### 2. MCPサーバーの確認
新しいセッションで以下を実行：
```bash
/mcp
```

これで利用可能なMCPサーバーが表示されます。

### 3. GitHub MCPの使用例
GitHub MCPが有効になっている場合、以下のような機能が使えます：
- リポジトリの検索
- イシューの作成・更新
- プルリクエストの作成
- ファイルの読み書き

### 4. Supabase MCPの修正
Supabaseを使用する場合は、正しいパッケージをインストール：
```bash
claude mcp remove supabase
claude mcp add supabase "npx -y @supabase/mcp-server" --env SUPABASE_URL="https://xkoqiznjvisnkpgckoed.supabase.co" --env SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhrb3Fpem5qdmlzbmtwZ2Nrb2VkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDgzMzE2NywiZXhwIjoyMDcwNDA5MTY3fQ.5XNJ6DsYEvtutrw8LWpISlR4dplczYUzdfU9YudLWNg"
```

## トラブルシューティング

### MCPが表示されない場合
1. Claude Codeのバージョンを確認：
   ```bash
   claude --version
   ```

2. 設定ファイルを確認：
   ```bash
   claude config list
   ```

3. MCPサーバーのヘルスチェック：
   ```bash
   claude mcp list
   ```

### 接続エラーの場合
- ネットワーク接続を確認
- プロキシ設定を確認
- ファイアウォール設定を確認

## 次のステップ
MCPが有効になったら、GitHub統合を使用してコードの管理や、イシュー・PRの作成が可能になります。
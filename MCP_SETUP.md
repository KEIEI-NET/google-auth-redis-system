# MCP (Model Context Protocol) セットアップガイド

このドキュメントでは、Claude DesktopでGitHub、Supabase、Context7のMCPサーバーを設定する方法を説明します。

## 📋 前提条件

- Claude Desktop アプリケーションがインストールされていること
- Node.js 18以上がインストールされていること
- 各サービスのアカウントとAPIキーを取得済みであること

## 🔧 設定ファイルの場所

Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- 実際のパス: `C:\Users\kenji\AppData\Roaming\Claude\claude_desktop_config.json`

## 📝 必要な環境変数の設定

### 1. GitHub Personal Access Token の取得

1. GitHubにログイン
2. Settings → Developer settings → Personal access tokens → Tokens (classic)
3. "Generate new token (classic)" をクリック
4. 必要なスコープを選択：
   - `repo` - プライベートリポジトリへのアクセス
   - `read:org` - 組織情報の読み取り（必要に応じて）
   - `gist` - Gistの作成・編集（必要に応じて）
5. トークンをコピーして安全に保管

### 2. Supabase 認証情報の取得

1. [Supabase Dashboard](https://app.supabase.com) にログイン
2. プロジェクトを選択
3. Settings → API から以下を取得：
   - **Project URL**: `https://[プロジェクトID].supabase.co`
   - **Service Role Key**: `service_role` キー（管理者権限を持つ秘密鍵）

⚠️ **重要**: Service Role Keyは非常に強力な権限を持つため、絶対に公開しないでください。

### 3. 設定ファイルの更新

`claude_desktop_config.json`を以下のように更新します：

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx"
      }
    },
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-supabase"
      ],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      }
    },
    "context7": {
      "command": "npx",
      "args": [
        "-y",
        "@context7/mcp-server"
      ],
      "env": {}
    }
  }
}
```

## 🚀 MCPサーバーの有効化

1. **設定ファイルを保存**
2. **Claude Desktopを完全に終了**
   - システムトレイのアイコンも確認
   - タスクマネージャーで`Claude.exe`プロセスが残っていないことを確認
3. **Claude Desktopを再起動**

## ✅ 動作確認

### GitHub MCPの確認
Claudeで以下のコマンドを試してください：
- 「GitHubのリポジトリを検索して」
- 「最近のイシューを確認して」
- 「プルリクエストの一覧を表示して」

### Supabase MCPの確認
- 「Supabaseのテーブル一覧を表示して」
- 「データベースのスキーマを確認して」
- 「ユーザーテーブルのデータを取得して」

### Context7の確認
Context7は、コンテキスト管理と知識ベースの機能を提供します。

## 🔍 トラブルシューティング

### MCPが認識されない場合

1. **ログの確認**
   - Windows: `%APPDATA%\Claude\logs\`
   - エラーメッセージを確認

2. **npxのキャッシュクリア**
   ```bash
   npx clear-npx-cache
   ```

3. **手動インストール**（必要に応じて）
   ```bash
   npm install -g @modelcontextprotocol/server-github
   npm install -g @modelcontextprotocol/server-supabase
   npm install -g @context7/mcp-server
   ```

4. **設定ファイルの検証**
   - JSONの構文エラーがないか確認
   - 環境変数の値が正しく設定されているか確認

### 接続エラーの場合

- **GitHub**: トークンの有効期限とスコープを確認
- **Supabase**: URLとService Role Keyが正しいプロジェクトのものか確認
- **ファイアウォール/プロキシ**: 企業ネットワークの場合、設定が必要な場合があります

## 🔐 セキュリティに関する注意事項

1. **APIキーの管理**
   - 設定ファイルは他人と共有しない
   - Gitリポジトリにコミットしない
   - 定期的にトークンをローテーション

2. **権限の最小化**
   - 必要最小限のスコープ/権限のみを付与
   - 本番環境のSupabaseには読み取り専用アクセスを検討

3. **監査ログ**
   - GitHub、Supabaseの監査ログを定期的に確認
   - 不審なアクティビティがないか監視

## 📚 参考リンク

- [MCP公式ドキュメント](https://modelcontextprotocol.io/docs)
- [GitHub MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/github)
- [Supabase MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/supabase)
- [Context7 Documentation](https://context7.ai/docs)

## 💡 活用例

### GitHub連携
- コードレビューの自動化
- イシューの管理と追跡
- PRの作成と更新
- リポジトリ全体の分析

### Supabase連携
- データベーススキーマの管理
- データの検索と更新
- リアルタイムデータの監視
- バックアップとリストア

### Context7連携
- プロジェクトコンテキストの管理
- ナレッジベースの構築
- チーム間の情報共有
- AIアシスタントの文脈理解向上

---

設定が完了したら、Claude DesktopでこれらのMCPサーバーが利用可能になります。
問題が発生した場合は、ログファイルを確認し、上記のトラブルシューティング手順を試してください。
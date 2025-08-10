# Serena MCPインストールガイド（ユーザーディレクトリ版）

このガイドでは、Serena MCPサーバーをユーザーディレクトリ（`C:\Users\kenji`）にインストールする手順を説明します。

## 📋 前提条件

1. **Python 3.11のインストール**
   - [Python 3.11.x](https://www.python.org/downloads/)をダウンロード
   - インストール時に「Add Python to PATH」を必ずチェック
   - インストール後、コマンドプロンプトで確認：
     ```cmd
     python --version
     ```
     Python 3.11.x が表示されることを確認

2. **Git**がインストールされていること

## 📦 インストール手順

### ステップ1: ユーザーディレクトリへ移動

コマンドプロンプト（cmd）またはPowerShellを**管理者として実行**し、以下のコマンドを実行：

```cmd
cd C:\Users\kenji
```

### ステップ2: Serenaリポジトリのクローン

```cmd
git clone https://github.com/oraios/serena.git
cd serena
```

### ステップ3: Python仮想環境の作成（推奨）

```cmd
python -m venv venv
venv\Scripts\activate
```

### ステップ4: uvパッケージマネージャーのインストール

```cmd
pip install uv
```

### ステップ5: Serenaの依存関係インストール

```cmd
uv sync
```

このコマンドで以下がインストールされます：
- Serenaの全依存関係
- 言語サーバー（自動ダウンロード）
- MCPサーバー実行環境

### ステップ6: Serena MCPサーバーのテスト

```cmd
uv run serena-mcp-server --help
```

ヘルプが表示されれば、インストール成功です。

## 🔧 Claude Codeへの設定

### 方法1: コマンドラインで設定

```bash
claude mcp add serena -- C:\Users\kenji\serena\venv\Scripts\python.exe C:\Users\kenji\serena\src\serena\mcp_server.py
```

### 方法2: uvランチャーを使用

```bash
claude mcp add serena -- cmd /c "cd C:\Users\kenji\serena && uv run serena-mcp-server"
```

### 方法3: バッチファイルを作成

1. `C:\Users\kenji\serena\run-serena.bat`を作成：
   ```batch
   @echo off
   cd C:\Users\kenji\serena
   call venv\Scripts\activate
   python src\serena\mcp_server.py %*
   ```

2. Claude Codeに追加：
   ```bash
   claude mcp add serena -- C:\Users\kenji\serena\run-serena.bat
   ```

## ✅ 動作確認

1. **MCPサーバーリストの確認**
   ```bash
   claude mcp list
   ```
   Serenaが「Connected」と表示されることを確認

2. **Serenaツールの確認**
   Claude Codeで以下を試す：
   - 「このプロジェクトのシンボル一覧を表示」
   - 「main関数の定義を探して」
   - 「クラスの実装を見せて」

## 🛠️ トラブルシューティング

### Python 3.11が見つからない場合

```cmd
# Pythonの場所を確認
where python

# パスが表示されない場合は、環境変数PATHに追加
# システムのプロパティ → 環境変数 → Path に以下を追加
C:\Users\kenji\AppData\Local\Programs\Python\Python311
C:\Users\kenji\AppData\Local\Programs\Python\Python311\Scripts
```

### uvコマンドが見つからない場合

```cmd
# pipでuvを再インストール
python -m pip install --upgrade pip
python -m pip install uv
```

### Serenaが接続できない場合

1. **ログを確認**
   ```cmd
   cd C:\Users\kenji\serena
   uv run serena-mcp-server --debug
   ```

2. **言語サーバーの再インストール**
   ```cmd
   cd C:\Users\kenji\serena
   rm -rf .cache
   uv sync --refresh
   ```

## 📚 Serenaの主な機能

### 言語サポート
- Python, TypeScript/JavaScript, Go, Rust
- Java, C#, Ruby, Swift
- PHP, Elixir, Clojure, Bash
- C/C++

### 主要なツール
- **シンボル検索** - 関数、クラス、変数の定義を探す
- **定義への移動** - シンボルの実装箇所へジャンプ
- **参照検索** - シンボルが使用されている場所を列挙
- **セマンティック編集** - シンボルレベルでの正確な編集
- **プロジェクトメモリ** - プロジェクト知識の永続化

## 🔐 セキュリティ考慮事項

- Serenaはローカルで実行され、外部サーバーには接続しません
- 言語サーバーは必要に応じて自動ダウンロードされます
- プロジェクトメモリは`.serena/memories/`に保存されます

## 📝 設定のカスタマイズ

`C:\Users\kenji\.serena\serena_config.yml`で設定をカスタマイズできます：

```yaml
# 有効化するツール
enabled_tools:
  - file_tools
  - symbol_tools
  - memory_tools

# デフォルトのコンテキスト
default_context: agent

# デフォルトのモード
default_mode: editing
```

## 🚀 次のステップ

1. Pythonプロジェクトでシンボル検索を試す
2. TypeScriptプロジェクトでリファクタリングを実行
3. プロジェクトメモリ機能を活用した知識管理

---

インストール完了後、Claude CodeでSerenaの強力なコード分析機能を活用できます！
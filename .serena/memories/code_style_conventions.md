# コードスタイル・規約

## TypeScript規約
- 厳密型チェック有効
- `any`型の使用禁止
- 明示的型注釈を推奨
- Promise処理は必ずawaitまたはvoid演算子使用

## React規約
- 関数コンポーネント使用
- Hooksパターン採用
- Context使用時は適切な分離
- Material-UI v5のsx propスタイル

## ファイル命名
- PascalCase: Reactコンポーネント
- camelCase: 関数・変数
- kebab-case: URLパス

## エラーハンドリング
- AppErrorクラス使用
- 統一JSONレスポンス形式
- セキュリティ情報の漏洩防止

## セキュリティ規約
- 入力値は必ず検証・サニタイズ
- 認証チェックは多層防御
- ログには機密情報を記録しない
- OWASP Top 10対策必須
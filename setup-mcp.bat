@echo off
echo ======================================
echo   Claude Desktop MCP Setup
echo ======================================
echo.

REM PowerShellスクリプトを実行
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\setup-mcp.ps1"

pause
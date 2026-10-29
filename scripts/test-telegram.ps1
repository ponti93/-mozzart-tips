# Sends one test message to the channel.
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\test-telegram.ps1
#
# It asks for the bot token. You can paste only the token, or the whole
# BotFather message - the token is extracted automatically.

param(
    [string]$Token,
    [string]$ChatId = "-1003836810117"
)

$ErrorActionPreference = "Stop"

if (-not $Token) {
    Write-Host "Paste the token from BotFather (the line that looks like 7945382103:AAH...)" -ForegroundColor Cyan
    $Token = Read-Host "Token"
}

# accept "7945382103:AAH..." even when surrounded by other text
if ($Token -match '(\d{6,}:[A-Za-z0-9_-]{30,})') {
    $Token = $Matches[1]
} else {
    Write-Host ""
    Write-Host "That does not look like a bot token." -ForegroundColor Red
    Write-Host "It must look like:  7945382103:AAHk3Ld9xQwErTyUiOpAsDfGhJkLzXcVbNm" -ForegroundColor Yellow
    Write-Host "In Telegram open @BotFather -> /mybots -> your bot -> API Token." -ForegroundColor Yellow
    exit 1
}

if (-not $ChatId) {
    $ChatId = Read-Host "Channel id (-100...)"
}
$ChatId = $ChatId.Trim()

$env:TELEGRAM_BOT_TOKEN = $Token.Trim()
$env:TELEGRAM_CHAT_ID = $ChatId

# 1. does the token work at all?
try {
    $me = Invoke-RestMethod -Uri "https://api.telegram.org/bot$($env:TELEGRAM_BOT_TOKEN)/getMe" -TimeoutSec 30
    Write-Host "[ok] token works - bot is @$($me.result.username)" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "Telegram rejected the token (401 Unauthorized)." -ForegroundColor Red
    Write-Host "Copy it again from @BotFather: /mybots -> your bot -> API Token." -ForegroundColor Yellow
    exit 1
}

# 2. send the real test message
Push-Location (Join-Path $PSScriptRoot "..")
try {
    node src/index.js --test-send
} finally {
    Pop-Location
}

# Sends one test message to the channel.
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\test-telegram.ps1
# It asks for the bot token (paste it, Enter) and uses the channel id below.

param(
    [string]$Token,
    [string]$ChatId = "-1003836810117"
)

$ErrorActionPreference = "Stop"

if (-not $Token) {
    $Token = Read-Host "Paste the bot token from BotFather"
}
if (-not $ChatId) {
    $ChatId = Read-Host "Channel id (-100...)"
}

$env:TELEGRAM_BOT_TOKEN = $Token.Trim()
$env:TELEGRAM_CHAT_ID = $ChatId.Trim()

Push-Location (Join-Path $PSScriptRoot "..")
try {
    node src/index.js --test-send
} finally {
    Pop-Location
}

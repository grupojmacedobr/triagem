@echo off
rem Gera a senha da atualizacao diaria automatica (CRON_SECRET) e salva na Area de Trabalho.
rem A senha NAO fica nesta pasta (nao vai para o GitHub). Cole na Vercel do projeto triagem.
set ARQ=%USERPROFILE%\Desktop\CRON_SECRET_TRIAGEM.txt
powershell -NoProfile -Command "$b = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString('x2') }) -join '' | Set-Content -Encoding ascii -NoNewline $env:ARQ"
echo Senha salva em %ARQ%
notepad "%ARQ%"

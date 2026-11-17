@echo off
rem Gera a senha da atualizacao diaria automatica (CRON_SECRET) e salva na Area de Trabalho.
rem A senha NAO fica nesta pasta (nao vai para o GitHub). Cole na Vercel do projeto triagem.
rem Usa a Area de Trabalho real (tambem quando ela fica dentro do OneDrive).
powershell -NoProfile -Command "$d = [Environment]::GetFolderPath('Desktop'); $arq = Join-Path $d 'CRON_SECRET_TRIAGEM.txt'; $b = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); $s = ($b | ForEach-Object { $_.ToString('x2') }) -join ''; [IO.File]::WriteAllText($arq, $s); Write-Host ('Senha salva em ' + $arq); Start-Process notepad.exe $arq"
echo.
pause

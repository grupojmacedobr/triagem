@echo off
chcp 65001 >nul
title Triagem - Enviar para o GitHub
color 1F
cd /d "%~dp0"

set "REPO=https://github.com/grupojmacedobr/triagem.git"

echo ================================================
echo   TRIAGEM - GRUPO J.MACEDO
echo   Enviando o projeto para o GitHub...
echo ================================================
echo.

REM ---------- 1. Procura o Git ----------
if exist "%ProgramFiles%\Git\cmd\git.exe" set "PATH=%ProgramFiles%\Git\cmd;%PATH%"
if exist "%ProgramFiles(x86)%\Git\cmd\git.exe" set "PATH=%ProgramFiles(x86)%\Git\cmd;%PATH%"
if exist "%LocalAppData%\Programs\Git\cmd\git.exe" set "PATH=%LocalAppData%\Programs\Git\cmd;%PATH%"

where git >nul 2>nul
if not errorlevel 1 goto TEM_GIT

color 4F
echo [!] O Git nao foi encontrado neste computador.
echo.
echo  1. Na pagina que vai abrir, clique em "Click here to download"
echo  2. Abra o arquivo baixado e clique Next em todas as telas
echo  3. No final clique Install e depois Finish
echo  4. De dois cliques neste ENVIAR_GITHUB.bat de novo
echo.
start "" "https://git-scm.com/install/windows"
pause
exit /b

:TEM_GIT
git --version

REM ---------- 2. Primeira vez: prepara a pasta ----------
if exist ".git" goto CONFIG
echo Primeira vez: preparando a pasta...
git init
git branch -M main
git remote add origin %REPO%

:CONFIG
git config user.name >nul 2>nul || git config user.name "grupojmacedobr"
git config user.email >nul 2>nul || git config user.email "grupojmacedobr@users.noreply.github.com"

REM ---------- 3. Mensagem do envio ----------
echo.
set "MSG="
if not "%~1"=="" set "MSG=%~1"

:SEM_PERGUNTA
if "%MSG%"=="" set "MSG=Atualizacao %date% %time:~0,5%"

REM ---------- 4. Registra as alteracoes ----------
git add -A
git commit -m "%MSG%"

REM ---------- 5. Envia ----------
echo.
echo Enviando para o GitHub...
echo Na primeira vez vai abrir uma janela para voce autorizar o login.
git push -u origin main
if not errorlevel 1 goto SUCESSO

echo.
echo Ajustando com o que ja existe no GitHub e tentando de novo...
git pull origin main --allow-unrelated-histories --no-edit -X ours
git push -u origin main
if not errorlevel 1 goto SUCESSO

color 4F
echo.
echo ================================================
echo   [X] NAO FOI POSSIVEL ENVIAR.
echo   Tire um print desta janela e mande para o Claude.
echo ================================================
echo.
pause
exit /b

:SUCESSO
color 2F
echo.
echo ================================================
echo   [OK] ENVIADO COM SUCESSO!
echo   https://github.com/grupojmacedobr/triagem
echo ================================================
echo.
pause

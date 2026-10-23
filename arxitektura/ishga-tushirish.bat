@echo off
rem Pillar Architecture - Windows uchun ishga tushirish (ikki marta bosing)
chcp 65001 >nul
cd /d "%~dp0"

rem Python'ni topish: avval "py" ishga tushirgichi, keyin "python"
set "PY="
where py >nul 2>nul && set "PY=py -3"
if not defined PY (
  where python >nul 2>nul && set "PY=python"
)
if not defined PY (
  echo.
  echo  Python topilmadi.
  echo  https://www.python.org/downloads/ saytidan Python 3 ni o'rnating
  echo  ^(o'rnatishda "Add python.exe to PATH" belgisini qo'ying^), keyin qayta urinib ko'ring.
  echo.
  pause
  exit /b 1
)

echo.
echo  Pillar Architecture ishga tushmoqda...
echo  Brauzer o'zi ochiladi. To'xtatish uchun shu oynani yoping yoki Ctrl+C bosing.
echo.

rem Server tayyor bo'lishi uchun brauzerni 2 soniyadan keyin ochamiz
start "" cmd /c "timeout /t 2 >nul & start "" http://localhost:8000"
%PY% server.py

echo.
echo  Server to'xtadi. Agar xato chiqqan bo'lsa, yuqoridagi xabarni o'qing.
pause

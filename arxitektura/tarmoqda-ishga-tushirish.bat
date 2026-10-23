@echo off
rem Pillar Architecture - tarmoqda ishga tushirish: bir Wi-Fi'dagi telefon va kompyuterlar ham ochadi
chcp 65001 >nul
cd /d "%~dp0"
set "PY="
where py >nul 2>nul && set "PY=py -3"
if not defined PY (
  where python >nul 2>nul && set "PY=python"
)
if not defined PY (
  echo  Python topilmadi. https://www.python.org/downloads/ dan o'rnating.
  pause
  exit /b 1
)
echo.
echo  Server tarmoqda ochilmoqda.
echo  Pastda chiqadigan "http://192.168....:8000" manzilini shu Wi-Fi'ga ulangan
echo  telefon yoki kompyuterning Chrome brauzerida oching.
echo  Windows xavfsizlik oynasi chiqsa, Python uchun "Ruxsat berish"ni bosing.
echo.
start "" cmd /c "timeout /t 2 >nul & start "" http://localhost:8000"
%PY% server.py --lan
echo.
pause
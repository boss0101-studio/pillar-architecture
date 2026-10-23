#!/usr/bin/env sh
# Pillar Architecture — macOS / Linux uchun ishga tushirish
# Terminalda: sh ishga-tushirish.sh
cd "$(dirname "$0")" || exit 1

if command -v python3 >/dev/null 2>&1; then PY=python3
elif command -v python >/dev/null 2>&1; then PY=python
else
  echo "Python topilmadi. https://www.python.org/downloads/ saytidan Python 3 ni o'rnating."
  exit 1
fi

echo "Pillar Architecture ishga tushmoqda: http://localhost:8000"
echo "To'xtatish uchun Ctrl+C bosing."

# Server tayyor bo'lishi uchun brauzerni biroz kechiktirib ochamiz
( sleep 2; (open http://localhost:8000 || xdg-open http://localhost:8000) >/dev/null 2>&1 ) &
exec "$PY" server.py

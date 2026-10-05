#!/bin/zsh
# Doble clic para abrir las apps internas de TuBroki en local.
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Necesitas Node 22 o superior: https://nodejs.org"
  read -k 1 "?Pulsa una tecla para cerrar…"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Instalando dependencias (solo la primera vez)…"
  npm install
fi

if [ ! -f .env.local ]; then
  echo "Falta .env.local — copia .env.example y rellena los valores."
  read -k 1 "?Pulsa una tecla para cerrar…"
  exit 1
fi

if lsof -tiTCP:4747 -sTCP:LISTEN >/dev/null 2>&1; then
  open "http://127.0.0.1:4747/"
  exit 0
fi

exec node scripts/dev.mjs

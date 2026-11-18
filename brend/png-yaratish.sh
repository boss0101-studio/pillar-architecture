#!/usr/bin/env bash
# SVG logotiplardan PNG nusxalar (Microsoft Edge "ekransiz" rejimi; Windows Git Bash).
# Ishlatish:  bash brend/png-yaratish.sh      (avval: python brend/yaratish.py)
set -e
cd "$(dirname "$0")"
E="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
[ -f "$E" ] || E="/c/Program Files/Microsoft/Edge/Application/msedge.exe"
TMP_U="$(mktemp -d)"; TMP_W="$(cygpath -m "$TMP_U")"; DIR_W="$(cygpath -m "$PWD")"
mkdir -p png
while read -r n svg w h; do
  [ -z "$n" ] && continue
  printf '<!DOCTYPE html><html><body style="margin:0"><img src="%s/%s" style="display:block;width:%spx;height:%spx"></body></html>' "file:///$DIR_W" "$svg" "$w" "$h" > "$TMP_U/$n.html"
  # har bir rasmga alohida profil: ochiq Edge oynasi bilan to'qnashmasin
  timeout 40 "$E" --headless=new --disable-gpu --no-first-run --hide-scrollbars --allow-file-access-from-files \
    --user-data-dir="$TMP_W/p_$n" --default-background-color=00000000 --window-size="$w,$h" \
    --screenshot="$TMP_W/$n.png" "file:///$TMP_W/$n.html" >/dev/null 2>&1 || true
  cp "$TMP_U/$n.png" "png/$n.png" && echo "png/$n.png ${w}x${h}"
done <<'LIST'
pillar-logo-1200 pillar-logo.svg 1200 435
pillar-logo-tungi-1200 pillar-logo-tungi.svg 1200 435
pillar-logo-vertikal-800 pillar-logo-vertikal.svg 800 1010
pillar-ikonka-512 pillar-ikonka.svg 512 512
pillar-belgi-512 pillar-belgi.svg 512 512
favicon-32 favicon.svg 32 32
apple-touch-icon-180 favicon.svg 180 180
LIST
rm -rf "$TMP_U"

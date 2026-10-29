#!/usr/bin/env bash
# Diagnostic: shows which fetch route works from this machine.
set -u
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
URL='https://mozzart1x2.com/'

echo "== 1. direct curl =="
for i in 1 2 3; do
  code=$(curl -sS -o /tmp/p.html -w '%{http_code}' -A "$UA" -H 'accept-language: en-US,en;q=0.9' -m 30 "$URL" || echo ERR)
  bytes=$(wc -c < /tmp/p.html 2>/dev/null || echo 0)
  chal=$(grep -c 'cf_chl_opt' /tmp/p.html 2>/dev/null || echo 0)
  single=$(grep -c 'Single :' /tmp/p.html 2>/dev/null || echo 0)
  echo "attempt $i: http=$code bytes=$bytes challenge=$chal hasSingle=$single"
  sleep 2
done

echo
echo "== 2. node fetch (undici) =="
node -e "
const ua='$UA';
fetch('$URL',{headers:{'user-agent':ua,accept:'text/html'}})
  .then(async r=>{const t=await r.text();console.log('http',r.status,'bytes',t.length,'challenge',t.includes('cf_chl_opt'))})
  .catch(e=>console.log('error',e.message));
" || true

echo
echo "== 3. r.jina.ai =="
curl -sS -o /tmp/j.html -w 'http=%{http_code}\n' -m 90 -H 'x-respond-with: html' "https://r.jina.ai/$URL" || echo ERR
echo "bytes=$(wc -c < /tmp/j.html 2>/dev/null || echo 0) challenge=$(grep -c 'cf_chl_opt' /tmp/j.html 2>/dev/null || echo 0) hasSingle=$(grep -c 'Single :' /tmp/j.html 2>/dev/null || echo 0)"

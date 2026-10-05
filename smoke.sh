#!/usr/bin/env bash
# Usage: ./smoke.sh <worker-url> <token>   (sends ONE real test email)
set -u
U=${1%/}; T=$2; fail=0
check() { [ "$2" = "$3" ] && echo "ok   $1" || { echo "FAIL $1 (got $2, want $3)"; fail=1; }; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
J=(-H "Content-Type: application/json")

check "rejects missing token"  "$(code -X POST "$U" "${J[@]}" -d '{}')" 401
check "rejects wrong token"    "$(code -X POST "$U" "${J[@]}" -H "Authorization: Bearer wrong" -d '{}')" 401
check "rejects empty body"     "$(code -X POST "$U" "${J[@]}" -H "Authorization: Bearer $T" -d '{"subject":"x"}')" 400
check "mcp lists tool"         "$(curl -s -X POST "$U/mcp" "${J[@]}" -H "Authorization: Bearer $T" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | grep -o send_email_notification | head -1)" send_email_notification
check "sends test email"       "$(code -X POST "$U" "${J[@]}" -H "Authorization: Bearer $T" \
  -d '{"subject":"agent-notify test","html":"<p>✅ Your agent-notify Worker works.</p>"}')" 200
exit $fail

#!/usr/bin/env bash
# Smoke test suite for Delicious24 API
# Usage: bash scripts/smoke-test.sh [base_url]
# Results written to: test-results/smoke-YYYY-MM-DD.json and .txt

set -euo pipefail

BASE="${1:-http://127.0.0.1:3001}"
RESULTS_DIR="$(cd "$(dirname "$0")/.." && pwd)/test-results"
DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date +%Y-%m-%dT%H:%M:%S)
JSON_OUT="$RESULTS_DIR/smoke-$DATE.json"
TXT_OUT="$RESULTS_DIR/smoke-$DATE.txt"

mkdir -p "$RESULTS_DIR"

PASS=0
FAIL=0
ERRORS=()
declare -A RESULTS

# ── helpers ──────────────────────────────────────────────────────────────────

assert() {
  local name="$1" expected="$2" actual="$3"
  if [[ "$actual" == *"$expected"* ]]; then
    echo "  ✓ $name"
    PASS=$((PASS+1))
    RESULTS["$name"]="PASS"
  else
    echo "  ✗ $name"
    echo "    expected: $expected"
    echo "    got:      $actual"
    FAIL=$((FAIL+1))
    RESULTS["$name"]="FAIL: expected '$expected' in '$actual'"
    ERRORS+=("$name")
  fi
}

section() { echo; echo "── $1 ──────────────────────────────────────────"; }

# ── 1. Infrastructure ─────────────────────────────────────────────────────────
section "1. Infrastructure"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/menu-items")
assert "API responds on /api/menu-items" "200" "$HEALTH"

SWAGGER=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/docs")
assert "Swagger UI available at /api/docs" "200" "$SWAGGER"

# ── 2. Menu items ─────────────────────────────────────────────────────────────
section "2. Menu items"
CREATE_MENU=$(curl -s -X POST "$BASE/api/menu-items" \
  -H "Content-Type: application/json" \
  -d '{"name":"Jollof Rice","price":"1500.00"}')
assert "POST /api/menu-items returns success" '"success":true' "$CREATE_MENU"
MENU_ID=$(echo "$CREATE_MENU" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null || echo "")

LIST_MENU=$(curl -s "$BASE/api/menu-items")
assert "GET /api/menu-items returns items" '"success":true' "$LIST_MENU"

if [[ -n "$MENU_ID" ]]; then
  PATCH_MENU=$(curl -s -X PATCH "$BASE/api/menu-items/$MENU_ID" \
    -H "Content-Type: application/json" \
    -d '{"price":"1800.00"}')
  assert "PATCH /api/menu-items/:id updates price" '"success":true' "$PATCH_MENU"
fi

# ── 3. Customers ──────────────────────────────────────────────────────────────
section "3. Customers"
# Use timestamp suffix for unique phone per run
TS=$(date +%s)
TEST_PHONE="+234800${TS: -7}"
CREATE_C=$(curl -s -X POST "$BASE/api/customers" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Ngozi Adeyemi\",\"phone\":\"$TEST_PHONE\",\"email\":\"ngozi@test.com\"}")
assert "POST /api/customers creates customer" '"success":true' "$CREATE_C"
CUST_ID=$(echo "$CREATE_C" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null || echo "")

DUPE_C=$(curl -s -X POST "$BASE/api/customers" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Other\",\"phone\":\"$TEST_PHONE\"}")
assert "POST /api/customers duplicate phone → 409" "PHONE_ALREADY_EXISTS" "$DUPE_C"

if [[ -n "$CUST_ID" ]]; then
  PATCH_C=$(curl -s -X PATCH "$BASE/api/customers/$CUST_ID" \
    -H "Content-Type: application/json" \
    -d '{"name":"Ngozi A. Adeyemi"}')
  assert "PATCH /api/customers/:id updates name" '"success":true' "$PATCH_C"

  PATCH_404=$(curl -s -X PATCH "$BASE/api/customers/00000000-0000-0000-0000-000000000000" \
    -H "Content-Type: application/json" \
    -d '{"name":"Ghost"}')
  assert "PATCH /api/customers/:id unknown id → 404" "CUSTOMER_NOT_FOUND" "$PATCH_404"
fi

SEARCH=$(curl -s "$BASE/api/customers/search?q=Ngozi")
assert "GET /api/customers/search returns results" '"success":true' "$SEARCH"

SEARCH_EMPTY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/customers/search?q=")
assert "GET /api/customers/search empty q → 400 validation" "400" "$SEARCH_EMPTY_STATUS"

# ── 4. Orders ─────────────────────────────────────────────────────────────────
section "4. Orders"
if [[ -n "$CUST_ID" && -n "$MENU_ID" ]]; then
  # 4a PAID order — total must match line sum (item was patched to 1800.00, qty=1)
  PAID_ORDER=$(curl -s -X POST "$BASE/api/orders" \
    -H "Content-Type: application/json" \
    -H "x-actor: test-admin" \
    -d "{\"customer_id\":\"$CUST_ID\",\"type\":\"PAID\",\"total\":\"1800.00\",\"items\":[{\"menu_item_id\":$MENU_ID,\"qty\":1}]}")
  assert "POST /api/orders PAID order" '"success":true' "$PAID_ORDER"

  # 4b CREDIT order (due in 7 days) — items required for CREDIT type
  DUE=$(date -d "+7 days" +%Y-%m-%d 2>/dev/null || date -v+7d +%Y-%m-%d)
  CREDIT_ORDER=$(curl -s -X POST "$BASE/api/orders" \
    -H "Content-Type: application/json" \
    -H "x-actor: test-admin" \
    -d "{\"customer_id\":\"$CUST_ID\",\"type\":\"CREDIT\",\"total\":\"1800.00\",\"due_date\":\"$DUE\",\"items\":[{\"menu_item_id\":$MENU_ID,\"qty\":1}]}")
  assert "POST /api/orders CREDIT order" '"success":true' "$CREDIT_ORDER"
  CREDIT_ID=$(echo "$CREDIT_ORDER" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d.get('credit_id',''))" 2>/dev/null || echo "")

  # 4c Missing due_date on CREDIT → 400
  BAD_ORDER=$(curl -s -X POST "$BASE/api/orders" \
    -H "Content-Type: application/json" \
    -H "x-actor: test-admin" \
    -d "{\"customer_id\":\"$CUST_ID\",\"type\":\"CREDIT\",\"total\":\"1000.00\"}")
  assert "POST /api/orders CREDIT without due_date → 400" "400" \
    "$(echo "$BAD_ORDER" | python3 -c "import sys,json; print(json.load(sys.stdin).get('statusCode',''))" 2>/dev/null || echo '')"
fi

# ── 5. Ledger ─────────────────────────────────────────────────────────────────
section "5. Ledger"
if [[ -n "$CUST_ID" ]]; then
  LEDGER=$(curl -s "$BASE/api/customers/$CUST_ID/ledger")
  assert "GET /api/customers/:id/ledger returns data" '"success":true' "$LEDGER"

  CSV_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/customers/$CUST_ID/ledger/export.csv")
  assert "GET /api/customers/:id/ledger/export.csv returns 200" "200" "$CSV_STATUS"
fi

# ── 6. Payments ───────────────────────────────────────────────────────────────
section "6. Payments"
if [[ -n "${CREDIT_ID:-}" && -n "$CREDIT_ID" ]]; then
  PAY=$(curl -s -X POST "$BASE/api/credits/$CREDIT_ID/confirm-payment" \
    -H "Content-Type: application/json" \
    -H "x-actor: test-admin" \
    -d '{"amount":"1000.00","note":"partial test payment"}')
  assert "POST /api/credits/:id/confirm-payment partial" '"success":true' "$PAY"

  # Idempotency: same key twice
  IDEM1=$(curl -s -X POST "$BASE/api/credits/$CREDIT_ID/confirm-payment" \
    -H "Content-Type: application/json" \
    -H "x-actor: test-admin" \
    -d '{"amount":"500.00","idempotency_key":"idem-test-001"}')
  IDEM2=$(curl -s -X POST "$BASE/api/credits/$CREDIT_ID/confirm-payment" \
    -H "Content-Type: application/json" \
    -H "x-actor: test-admin" \
    -d '{"amount":"500.00","idempotency_key":"idem-test-001"}')
  assert "Idempotency: second call same key returns same body" \
    "$(echo "$IDEM1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('payment_amount',''))" 2>/dev/null)" \
    "$(echo "$IDEM2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('payment_amount',''))" 2>/dev/null)"
fi

# ── 7. Webhook ────────────────────────────────────────────────────────────────
section "7. Webhook"
WH=$(curl -s -X POST "$BASE/api/webhooks/inbound" \
  -H "Content-Type: application/json" \
  -d '{"from_phone":"+2348012345601","message_text":"i sent 5k"}')
assert "POST /api/webhooks/inbound creates candidate" '"success":true' "$WH"
assert "Webhook parsed 5k as 5000" '"parsed_amount":"5000"' "$WH"

WH2=$(curl -s -X POST "$BASE/api/webhooks/inbound" \
  -H "Content-Type: application/json" \
  -d '{"from_phone":"+2348099999999","message_text":"hello boss"}')
assert "Webhook no-keyword → null parsed_amount" '"parsed_amount":null' "$WH2"

# ── 8. Pending payments ───────────────────────────────────────────────────────
section "8. Pending payments"
PP=$(curl -s "$BASE/api/pending-payments")
assert "GET /api/pending-payments returns list" '"success":true' "$PP"

PP_NEW=$(curl -s "$BASE/api/pending-payments?status=NEW")
assert "GET /api/pending-payments?status=NEW filters" '"success":true' "$PP_NEW"

# Get first candidate id and update status
PP_ID=$(echo "$PP" | python3 -c "import sys,json; items=json.load(sys.stdin)['data']['items']; print(items[0]['id'] if items else '')" 2>/dev/null || echo "")
if [[ -n "$PP_ID" ]]; then
  PP_PATCH=$(curl -s -X PATCH "$BASE/api/pending-payments/$PP_ID" \
    -H "Content-Type: application/json" \
    -d '{"status":"REVIEWED"}')
  assert "PATCH /api/pending-payments/:id → REVIEWED" '"success":true' "$PP_PATCH"
fi

# ── 9. Sync ───────────────────────────────────────────────────────────────────
section "9. Sync"
SYNC=$(curl -s -X POST "$BASE/api/sync" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"test-device-01","changes":[{"temp_id":"tmp-c1","entity_type":"CUSTOMER","payload":{"phone":"+2348055550001","name":"Sync Test User"}},{"temp_id":"tmp-m1","entity_type":"MENU_ITEM","payload":{"name":"Test Dish","price":"800.00"}},{"temp_id":"tmp-f1","entity_type":"ORDER","payload":{"total":"500"}}]}')
assert "POST /api/sync returns results" '"success":true' "$SYNC"
assert "Sync CUSTOMER upsert ok=true" '"ok":true' "$SYNC"
assert "Sync financial ORDER → FINANCIAL_CONFLICT" "FINANCIAL_CONFLICT" "$SYNC"

# Reconciliation list
RECON=$(curl -s "$BASE/api/reconciliation-tasks")
assert "GET /api/reconciliation-tasks returns list" '"success":true' "$RECON"

# ── 10. Scheduled jobs ────────────────────────────────────────────────────────
section "10. Scheduled jobs"
JOBS=$(curl -s "$BASE/api/scheduled-jobs")
assert "GET /api/scheduled-jobs returns list" '"success":true' "$JOBS"

# ── 11. Audit log ─────────────────────────────────────────────────────────────
section "11. Audit log"
AUDIT=$(curl -s "$BASE/api/audit-log")
assert "GET /api/audit-log returns entries" '"success":true' "$AUDIT"

# ── Summary ───────────────────────────────────────────────────────────────────
TOTAL=$((PASS+FAIL))
echo
echo "══════════════════════════════════════"
echo "  Smoke Test Results — $TIMESTAMP"
echo "  $PASS/$TOTAL passed   $([ $FAIL -eq 0 ] && echo '✅ ALL PASS' || echo "❌ $FAIL FAILED")"
echo "══════════════════════════════════════"
if [[ ${#ERRORS[@]} -gt 0 ]]; then
  echo "  Failed:"
  for e in "${ERRORS[@]}"; do echo "    - $e"; done
fi

# ── Write JSON results ────────────────────────────────────────────────────────
{
  echo "{"
  echo "  \"timestamp\": \"$TIMESTAMP\","
  echo "  \"base_url\": \"$BASE\","
  echo "  \"summary\": { \"pass\": $PASS, \"fail\": $FAIL, \"total\": $TOTAL },"
  echo "  \"tests\": {"
  FIRST=1
  for name in "${!RESULTS[@]}"; do
    safe_name=$(echo "$name" | sed 's/"/\\"/g')
    safe_val=$(echo "${RESULTS[$name]}" | sed 's/"/\\"/g')
    [[ $FIRST -eq 0 ]] && echo ","
    printf '    "%s": "%s"' "$safe_name" "$safe_val"
    FIRST=0
  done
  echo
  echo "  }"
  echo "}"
} > "$JSON_OUT"

# ── Write plain-text results ──────────────────────────────────────────────────
{
  echo "Delicious24 API Smoke Test — $TIMESTAMP"
  echo "Base URL: $BASE"
  echo "Result: $PASS/$TOTAL passed"
  echo
  for name in "${!RESULTS[@]}"; do
    echo "${RESULTS[$name]}: $name"
  done
} > "$TXT_OUT"

echo
echo "Results written:"
echo "  JSON: $JSON_OUT"
echo "  TXT:  $TXT_OUT"

exit $FAIL

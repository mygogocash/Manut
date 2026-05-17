#!/usr/bin/env bash
# Print (and optionally verify) DNS records required for manut.xyz TLS on Railway.
#
# Root cause when the browser shows "Not secure" / certificate mismatch:
#   manut.xyz has two A records (GCP VM + Railway). Hitting Railway by IP
#   serves a *.up.railway.app cert, not manut.xyz. Railway expects a CNAME.
#
# Usage:
#   ./scripts/manut-dns-railway-tls.sh          # show required records + dig check
#   ./scripts/manut-dns-railway-tls.sh --open   # also open Spaceship DNS manager
set -euo pipefail

OPEN_BROWSER=false
if [[ "${1:-}" == "--open" ]]; then
  OPEN_BROWSER=true
fi

DOMAIN=manut.xyz
RAILWAY_SERVICE_ID=60a64cda-bd2e-422c-94f7-9087193ccf63
RAILWAY_CONFIG="${HOME}/.railway/config.json"

if [[ ! -f "$RAILWAY_CONFIG" ]]; then
  echo "Missing ~/.railway/config.json — run: railway login && railway link" >&2
  exit 1
fi

TOKEN="$(python3 - "$RAILWAY_CONFIG" <<'PY'
import json, sys
print(json.load(open(sys.argv[1]))["user"]["accessToken"])
PY
)"

QUERY='query { service(id: "'"$RAILWAY_SERVICE_ID"'") { name serviceInstances { edges { node { domains { customDomains { domain status { verified certificateStatus certificateErrorMessage dnsRecords { hostlabel fqdn requiredValue recordType status } verificationDnsHost verificationToken } } } } } } } }'

RESP="$(curl -fsS https://backboard.railway.com/graphql/v2 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(python3 -c 'import json; print(json.dumps({"query": open("/dev/stdin").read()}))' <<<"$QUERY")")"

python3 - "$RESP" "$DOMAIN" <<'PY'
import json, sys

data = json.loads(sys.argv[1])
domain = sys.argv[2]
custom = (
    data.get("data", {})
    .get("service", {})
    .get("serviceInstances", {})
    .get("edges", [{}])[0]
    .get("node", {})
    .get("domains", {})
    .get("customDomains", [])
)
match = next((c for c in custom if c.get("domain") == domain), None)
if not match:
    print(f"No Railway custom domain found for {domain}", file=sys.stderr)
    sys.exit(1)

st = match["status"]
print(f"Railway custom domain: {domain}")
print(f"  verified: {st.get('verified')}")
print(f"  certificate: {st.get('certificateStatus')}")
if st.get("certificateErrorMessage"):
    print(f"  cert error: {st['certificateErrorMessage']}")

print("\nUpdate DNS at Spaceship (Advanced DNS) for manut.xyz:\n")
print("  1. DELETE all A / AAAA records for @ (and www if pointing at old IPs).")
print("     Current bad setup often includes:")
print("       - 34.142.207.33  (legacy GCP VM)")
print("       - 66.33.22.31     (Railway A — wrong; use CNAME instead)\n")

for rec in st.get("dnsRecords", []):
    host = rec.get("hostlabel") or "@"
    rtype = rec.get("recordType", "").replace("DNS_RECORD_TYPE_", "")
    print(f"  2. ADD {rtype}  host={host}  →  {rec.get('requiredValue')}")
    print(f"     (Railway status: {rec.get('status', '')})\n")

vh = st.get("verificationDnsHost")
vt = st.get("verificationToken")
if vh and vt:
    print(f"  3. ADD TXT  host={vh}  →  {vt}\n")

print("  4. If the registrar does not allow CNAME at apex (@), use ALIAS/ANAME")
print("     to the same target hostname (Spaceship resolves ALIAS like CNAME).\n")
print("  5. Wait 5–15 minutes, then verify:")
print("       dig +short manut.xyz CNAME")
print("       curl -vI https://manut.xyz  # subject should be CN=manut.xyz\n")
PY

echo "=== Current public DNS ==="
dig +short "$DOMAIN" A
dig +short "$DOMAIN" AAAA
dig +short "$DOMAIN" CNAME
dig +short "_railway-verify.$DOMAIN" TXT

echo ""
echo "=== TLS check (each A record) ==="
while read -r ip; do
  [[ -z "$ip" ]] && continue
  subj="$(echo | openssl s_client -connect "$ip:443" -servername "$DOMAIN" 2>/dev/null \
    | openssl x509 -noout -subject 2>/dev/null || echo "no cert")"
  echo "  $ip → $subj"
done < <(dig +short "$DOMAIN" A)

if $OPEN_BROWSER; then
  open "https://www.spaceship.com/application/domain/manage/${DOMAIN}/dns" 2>/dev/null \
    || open "https://www.spaceship.com/domains" 2>/dev/null \
    || true
fi

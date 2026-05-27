#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SMOKE_SCRIPT="$ROOT/scripts/gcp/smoke-test-cloud-run.sh"

pick_port() {
  node -e 'const net = require("node:net"); const server = net.createServer(); server.listen(0, "127.0.0.1", () => { console.log(server.address().port); server.close(); });'
}

start_fixture_server() {
  local mode="$1"
  local port="$2"

  node - "$mode" "$port" <<'NODE' &
const http = require('node:http');

const mode = process.argv[2];
const port = Number(process.argv[3]);
const html = '<!doctype html><title>Manut</title>';

const server = http.createServer((req, res) => {
  if (req.url === '/info') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(
      '{"compatibility":"0.26.3","message":"Manut","type":"selfhosted"}'
    );
    return;
  }

  if (req.url === '/api/server-config' || req.url === '/api/version') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (req.url === '/graphql') {
    if (mode === 'html_graphql') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    const initialized = mode !== 'uninitialized';
    const features =
      mode === 'missing_manut'
        ? ['Comment', 'Copilot']
        : ['Comment', 'Manut', 'Copilot'];
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        data: {
          serverConfig: {
            version: '0.26.3',
            type: 'Affine',
            initialized,
            features,
          },
        },
      })
    );
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
server.listen(port, '127.0.0.1');
NODE
}

wait_for_server() {
  local port="$1"
  local deadline=$((SECONDS + 10))
  until curl -sS -o /dev/null "http://127.0.0.1:${port}/info"; do
    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "[smoke-test] fixture server did not start on port ${port}" >&2
      return 1
    fi
    sleep 0.2
  done
}

run_case() {
  local mode="$1"
  local expectation="$2"
  local port
  local pid

  port="$(pick_port)"
  start_fixture_server "$mode" "$port"
  pid="$!"
  trap 'kill "$pid" >/dev/null 2>&1 || true' RETURN
  wait_for_server "$port"

  if BASE_URL="http://127.0.0.1:${port}" TIMEOUT_SECONDS=2 SLEEP_SECONDS=0.2 "$SMOKE_SCRIPT" >/tmp/manut-smoke-${mode}.log 2>&1; then
    if [ "$expectation" = "fail" ]; then
      cat "/tmp/manut-smoke-${mode}.log" >&2
      echo "[smoke-test] expected ${mode} smoke to fail, but it passed" >&2
      return 1
    fi
  else
    if [ "$expectation" = "pass" ]; then
      cat "/tmp/manut-smoke-${mode}.log" >&2
      echo "[smoke-test] expected ${mode} smoke to pass, but it failed" >&2
      return 1
    fi
  fi

  kill "$pid" >/dev/null 2>&1 || true
  trap - RETURN
}

run_case healthy pass
run_case missing_manut fail
run_case html_graphql fail
run_case uninitialized fail

echo "[smoke-test] Cloud Run smoke validation passed"

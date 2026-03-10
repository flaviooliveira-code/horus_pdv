#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "[ERRO] Variável obrigatória ausente: $name" >&2
    exit 1
  fi
}

require_cmd() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "[ERRO] Comando obrigatório não encontrado: $name" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd mktemp

HPDV_BASE_URL="${HPDV_BASE_URL:-http://localhost}"
LOGIN_ENDPOINT="${HPDV_LOGIN_ENDPOINT:-${HPDV_BASE_URL}/backend/app/controllers/login_controller.php}"
RECOVER_ENDPOINT="${HPDV_RECOVER_ENDPOINT:-${HPDV_BASE_URL}/backend/app/controllers/recover_password_controller.php}"
CHANGE_ENDPOINT="${HPDV_CHANGE_ENDPOINT:-${HPDV_BASE_URL}/backend/app/controllers/change_password_controller.php}"

require_var HPDV_TEST_USER
require_var HPDV_TEST_PASSWORD
require_var HPDV_TEST_CPF

CSRF_TOKEN="${HPDV_CSRF_TOKEN:-}"
CSRF_URL="${HPDV_CSRF_URL:-}"

COOKIE_FILE="$(mktemp)"
cleanup() {
  rm -f "$COOKIE_FILE"
}
trap cleanup EXIT

extract_csrf() {
  local html="$1"
  local token

  token=$(printf '%s' "$html" | tr '\n' ' ' | sed -nE 's/.*name=["'"'"']csrfToken["'"'"'][^>]*value=["'"'"']([^"'"'"']+)["'"'"'].*/\1/p' | head -n1)
  if [[ -n "$token" ]]; then
    printf '%s' "$token"
    return 0
  fi

  token=$(printf '%s' "$html" | tr '\n' ' ' | sed -nE 's/.*csrfToken[^A-Za-z0-9._-]+([A-Za-z0-9._-]{16,}).*/\1/p' | head -n1)
  if [[ -n "$token" ]]; then
    printf '%s' "$token"
    return 0
  fi

  return 1
}

if [[ -z "$CSRF_TOKEN" && -n "$CSRF_URL" ]]; then
  echo "[INFO] Obtendo CSRF token de: $CSRF_URL"
  CSRF_HTML="$(curl -sS -c "$COOKIE_FILE" -b "$COOKIE_FILE" "$CSRF_URL")"
  CSRF_TOKEN="$(extract_csrf "$CSRF_HTML" || true)"
fi

if [[ -z "$CSRF_TOKEN" ]]; then
  echo "[ERRO] CSRF token não informado. Defina HPDV_CSRF_TOKEN ou HPDV_CSRF_URL." >&2
  exit 1
fi

echo "[TESTE 1/3] Login"
LOGIN_RESPONSE="$(curl -sS -c "$COOKIE_FILE" -b "$COOKIE_FILE" -X POST \
  --data-urlencode "csrfToken=$CSRF_TOKEN" \
  --data-urlencode "accessUser=${HPDV_TEST_USER}" \
  --data-urlencode "accessPassword=${HPDV_TEST_PASSWORD}" \
  "$LOGIN_ENDPOINT")"

echo "  Resposta: $LOGIN_RESPONSE"
if [[ "$LOGIN_RESPONSE" != *"Login efetuado com sucesso"* ]]; then
  echo "[FALHA] Login não retornou sucesso." >&2
  exit 1
fi

echo "[TESTE 2/3] Recuperação de senha"
RECOVER_RESPONSE="$(curl -sS -c "$COOKIE_FILE" -b "$COOKIE_FILE" -X POST \
  --data-urlencode "cpf=${HPDV_TEST_CPF}" \
  --data-urlencode "accessUser=${HPDV_TEST_USER}" \
  "$RECOVER_ENDPOINT")"

echo "  Resposta: $RECOVER_RESPONSE"
if [[ "$RECOVER_RESPONSE" != *"Foi enviado um link de recuperação de senha"* ]]; then
  echo "[FALHA] Recuperação de senha não retornou sucesso." >&2
  exit 1
fi

echo "[TESTE 3/3] Troca de senha com token inválido (deve falhar)"
CHANGE_INVALID_RESPONSE="$(curl -sS -c "$COOKIE_FILE" -b "$COOKIE_FILE" -X POST \
  --data-urlencode "newPassword=SenhaTeste2026!" \
  --data-urlencode "repeatPassword=SenhaTeste2026!" \
  --data-urlencode "value=token-invalido-para-teste" \
  --data-urlencode "atrribute=${HPDV_TEST_USER}" \
  "$CHANGE_ENDPOINT")"

echo "  Resposta: $CHANGE_INVALID_RESPONSE"
if [[ "$CHANGE_INVALID_RESPONSE" != *"Token inválido"* ]]; then
  echo "[FALHA] Fluxo de token inválido não retornou erro esperado." >&2
  exit 1
fi

echo "[OK] Smoke tests concluídos com sucesso."

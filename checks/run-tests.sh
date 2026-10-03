#!/bin/sh
# Runs the repository's existing tests under Deno with file access limited to this
# repository and no outbound network. Browser tests (*.browser.cjs) are not included.
#
#   sh checks/run-tests.sh
#
# The two pinned test packages are kept outside the repository in $AIWISE_TEST_DEPS
# (default ~/.cache/aiwise-test-deps) and are downloaded once if missing.
set -u
DENO="${DENO:-$HOME/.deno/bin/deno}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
DEPS="${AIWISE_TEST_DEPS:-$HOME/.cache/aiwise-test-deps}"

if [ ! -d "$DEPS/node_modules/linkedom" ] || [ ! -d "$DEPS/node_modules/@electric-sql/pglite" ]; then
  mkdir -p "$DEPS" || exit 2
  printf '%s\n' '{ "private": true, "dependencies": { "linkedom": "0.18.12", "@electric-sql/pglite": "0.3.14" } }' > "$DEPS/package.json"
  printf '%s\n' '{ "nodeModulesDir": "auto" }' > "$DEPS/deno.json"
  (cd "$DEPS" && "$DENO" install) || { echo "Could not download the test packages."; exit 2; }
fi

export LINKEDOM_MODULE="$DEPS/node_modules/linkedom" PGLITE_MODULE="$DEPS/node_modules/@electric-sql/pglite" NO_COLOR=1
# The Edge Function files start a local server when imported under Deno, so tests that
# import them need this one listening address. No other network access is granted.
LISTEN="--allow-net=0.0.0.0:8000"
READ="--allow-read=$REPO,$DEPS"
LOG="$(mktemp -d)"
cd "$REPO" || exit 2
failed=0

for f in workspace/tests/*.test.cjs supabase/tests/*.test.mjs; do
  out="$LOG/$(basename "$f").log"
  if "$DENO" test --no-prompt "$READ" --allow-env $LISTEN "$f" > "$out" 2>&1; then
    echo "PASS  $f  $(grep -E '^ok \|' "$out" | tail -1)"
  else
    failed=$((failed+1)); echo "FAIL  $f"; grep -E '=> |error:|AssertionError' "$out" | head -6
  fi
done

# Database tests are plain scripts that print PASS. An imported Edge Function keeps its
# local server open under Deno, so each script is stopped once it reports or after 120 seconds.
for f in supabase/tests/*.cjs; do
  out="$LOG/$(basename "$f").log"
  "$DENO" run --no-prompt "$READ" --allow-env $LISTEN "$f" > "$out" 2>&1 &
  pid=$!; waited=0
  while kill -0 "$pid" 2>/dev/null && ! grep -q '^PASS ' "$out" && [ "$waited" -lt 240 ]; do
    perl -e 'select(undef,undef,undef,0.5)'; waited=$((waited+1))
  done
  kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
  if grep -q '^PASS ' "$out"; then
    echo "PASS  $f"
  else
    failed=$((failed+1)); echo "FAIL  $f"; tail -4 "$out"
  fi
done

echo
if [ "$failed" -eq 0 ]; then echo "All test files passed."; else echo "$failed test file(s) failed. Logs: $LOG"; fi
exit "$failed"

#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)

if ! "$root/node_modules/.bin/conformance_test_runner" --help 2>&1 | grep -q "Usage: conformance-test-runner"; then
  "$root/.agents/build-conformance-runner"
fi

if [ "${1-}" = "--test" ]; then
  exec "$root/node_modules/.bin/conformance_test_runner" \
    --maximum_edition MAX \
    --enforce_recommended \
    "$@" \
    "$root/test/conformance/testee.ts"
fi

exec "$root/node_modules/.bin/conformance_test_runner" \
  --maximum_edition MAX \
  --enforce_recommended \
  --failure_list "$root/test/conformance/failing_tests.txt" \
  --text_format_failure_list "$root/test/conformance/failing_tests_text_format.txt" \
  "$@" \
  "$root/test/conformance/testee.ts"

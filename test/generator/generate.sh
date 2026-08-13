#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
mkdir -p "$root/test/generator/gen"
protoc -I "$root/test/generator" \
  --plugin="protoc-gen-effect=$root/src/protoc-gen-effect.ts" \
  --effect_out=target=ts:"$root/test/generator/gen" edition_2023.proto imported.proto legacy.proto representative.proto

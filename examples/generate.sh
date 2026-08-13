#!/bin/sh
set -eu
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
rm -rf "$here/src/gen"
mkdir -p "$here/src/gen"
protoc -I "$here/proto" --plugin="protoc-gen-effect=$here/../src/protoc-gen-effect.ts" \
  --effect_out=target=ts:"$here/src/gen" address_book.proto

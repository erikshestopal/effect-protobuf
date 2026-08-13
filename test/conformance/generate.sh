#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
proto="$root/test/conformance/proto"
generated="$root/test/conformance/gen"

rm -rf "$proto/conformance" "$proto/google" "$generated"
mkdir -p "$proto" "$generated"

"$root/node_modules/.bin/conformance_proto_eject" "$proto"
"$root/node_modules/.bin/protoc-gen-es" --version >/dev/null
find "$proto" -type f -name '*.proto' ! -name '*_unstable.proto' -print0 | xargs -0 protoc \
  --proto_path="$proto" \
  --plugin="protoc-gen-es=$root/node_modules/.bin/protoc-gen-es" \
  --es_out="$generated" \
  --es_opt=target=ts

# protoc rejects the conformance suite's synthetic UNSTABLE edition. Reuse the
# same protoc-gen-es output vendored with protobuf-es until protoc can emit it.
cp "$root/repos/protobuf-es/packages/protobuf-conformance/src/gen/google/protobuf/test_messages_edition_unstable_pb.ts" \
  "$generated/google/protobuf/test_messages_edition_unstable_pb.ts"

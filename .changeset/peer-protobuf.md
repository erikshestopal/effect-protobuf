---
"protobuf-effect": minor
---

Move `@bufbuild/protobuf` from `dependencies` to `peerDependencies` (`^2.14.0`) so consumers resolve a single copy and generated message types stay assignable. Consumers must now install `@bufbuild/protobuf` themselves. `@bufbuild/protoc-gen-es` and `@bufbuild/protoplugin` remain dependencies for the `protoc-gen-effect` plugin.

# protobuf-effect

## 1.1.0

### Minor Changes

- [`cf4c81f`](https://github.com/erikshestopal/effect-protobuf/commit/cf4c81f) Thanks [@erikshestopal](https://github.com/erikshestopal)! - Move `@bufbuild/protobuf` from `dependencies` to `peerDependencies` (`^2.14.0`) so consumers resolve a single copy and generated message types stay assignable. Consumers must now install `@bufbuild/protobuf` themselves. `@bufbuild/protoc-gen-es` and `@bufbuild/protoplugin` remain dependencies for the `protoc-gen-effect` plugin.

## 1.0.2

### Patch Changes

- [`5bf6e2e`](https://github.com/erikshestopal/effect-protobuf/commit/5bf6e2ee983413252a50b8c006ed0d2de99baad1) Thanks [@erikshestopal](https://github.com/erikshestopal)! - Use Effect as a peer dependency so applications can supply newer compatible Effect versions.

## 1.0.1

### Patch Changes

- Run the published `protoc-gen-effect` executable with Node without requiring the development-only `tsx` loader.

## 1.0.0

### Major Changes

- [`dd5f2cf`](https://github.com/erikshestopal/effect-protobuf/commit/dd5f2cf916e2962661522d5f2bb97638d46a54c2) Thanks [@erikshestopal](https://github.com/erikshestopal)! - Release the first stable version of protobuf-effect with protobuf-es-backed Effect Schemas and conformant binary, ProtoJSON, and text codecs.

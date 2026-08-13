# protobuf-effect Plan

## Product Goal

Build the Effect integration layer for Protocol Buffers without maintaining a second protobuf implementation.

- protobuf-es owns generated TypeScript message shapes, descriptors, reflection, extensions, binary, ProtoJSON, text format, unknown fields, Well-Known Types, proto2, proto3, and Editions semantics.
- protobuf-effect derives Effect Schemas from protobuf-es message descriptors and supplies typed Effect adapters and errors.
- The official pinned conformance suite must remain completely green: 5,631 binary/ProtoJSON cases and 909 text cases for protobuf 35.1, with no failures or skips.
- Performance is measured continuously. The thin synchronous path should remain within benchmark noise of calling protobuf-es directly.
- Rust is out of scope unless profiling later identifies a workload protobuf-es cannot address.

## Value Model

Generated values use protobuf-es's ordinary TypeScript representation directly. There is no conversion layer.

- Explicit presence uses optional properties.
- Repeated fields use arrays.
- Maps use ordinary object records.
- Oneofs use `{ case, value }`.
- Messages are plain protobuf-es objects carrying `$typeName` and optional `$unknown` metadata.
- 64-bit integers use `bigint`; bytes use `Uint8Array`.

This representation is intentional: converting every value to `Option`, `HashMap`, Schema classes, or a second tagged-union representation would add allocation, reduce interoperability, and erase the performance benefit of delegating to protobuf-es.

## Generated API

`protoc-gen-effect` composes protobuf-es generation with one Effect Schema declaration per message:

```ts
export type Person = Message<"example.Person"> & {
  name: string;
  email?: string;
  labels: string[];
};

export const PersonSchema: GenMessage<Person> = messageDesc(file_example, 0);
export const Person = Protobuf.schema(PersonSchema);
```

The type and Effect Schema intentionally share the concise `Person` name in their separate TypeScript namespaces. Applications construct messages with `Person.make(init)` and use `Person` wherever an Effect Schema is required. The descriptor and protobuf-es constructor are generator/runtime implementation details, not part of normal application code.

```ts
const person = Person.make({ name: "Ada" });
const checked = Schema.decodeUnknownSync(Person)(person);
const bytes = Protobuf.encodeBinarySync(Person)(checked);
```

`Protobuf.schema()` recursively derives and caches Effect schemas for:

- scalar bounds and scalar runtime types
- enum openness
- optional and required presence
- repeated fields and maps
- recursive messages
- protobuf-es oneofs
- wrapper Well-Known Types
- protobuf metadata fields

The protobuf-es message descriptor is attached to the resulting Effect Schema as metadata used by format adapters. Applications can retrieve it explicitly with `Protobuf.descriptor()` when reflection is required.

## Codec API

Binary, ProtoJSON, and text remain distinct curried operations in `protobuf-effect/Protobuf`:

```ts
Protobuf.decodeBinaryEffect(Person)(bytes);
Protobuf.decodeBinarySync(Person)(bytes);
Protobuf.encodeBinaryResult(Person)(person);
Protobuf.decodeJsonSync(Person)(json);
Protobuf.encodeTextSync(Person)(person);
```

The adapter families expose Effect, Exit, Option, Result, Promise, and Sync variants where applicable. protobuf-es exceptions are mapped to schema-backed `DecodeError` and `EncodeError` values.

Synchronous adapters call protobuf-es directly rather than constructing and running an Effect. Effect adapters use `Effect.try`. Bind an adapter once in hot code:

```ts
const decode = Protobuf.decodeBinarySync(Person);
const value = decode(bytes);
```

## Generator and Runtime Boundaries

```text
.proto → protoc / Buf → protoc-gen-effect → protobuf-es declarations + Effect Schemas
```

- `@bufbuild/protoc-gen-es` owns generated message, enum, extension, service, and descriptor code.
- `@bufbuild/protobuf` is a production dependency and owns protobuf format semantics.
- protobuf-effect must not fork or copy protobuf-es codec algorithms.
- Generated messages have no serialization methods; the public Effect adapters remain the integration boundary.
- RPC transports remain outside this package. Generated service descriptors are transport-neutral.

## Conformance and Compatibility

The release gate is the pinned official runner with required and recommended tests enabled and empty binary/JSON and text failure lists. Focused tests additionally cover schema derivation, generator output, recursion, wrapper fields, oneofs, maps, packed and expanded encodings, merge behavior, unknown fields, imports, services, and typed failures.

The former Schema-class representation and custom descriptor/codec implementation have been removed. Generated output and the conformance testee both use the protobuf-es-backed path.

## Performance Discipline

- Establish a repeatable baseline before each optimization.
- Compare identical descriptors, payloads, and runtime values.
- Keep only changes that materially improve repeated measurements without reducing correctness or coverage.
- Benchmark large conformance messages and representative small generated messages across binary and ProtoJSON.
- Treat protobuf-es direct calls as the floor. A thin wrapper may occasionally measure faster from noise or JIT layout, but it must not claim an algorithmic win over the function it delegates to.
- Do not add value conversions, validation passes in hot codec paths, wrappers, caches, native modules, or generated specialization without benchmark evidence.

## Next Steps

1. Complete adapter option parity and focused type-level tests without adding work to the default hot path.
2. Package compiled ESM and declarations with `vp pack` before the first npm release.
3. Repeat benchmarks after dependency upgrades and track representative results in documentation.

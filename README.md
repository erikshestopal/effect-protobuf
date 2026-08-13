# effect-protobuf

Protocol Buffers for Effect. Generate native Effect Schemas from `.proto` files, construct validated messages with `Schema` conventions, and encode or decode binary, ProtoJSON, and protobuf text with typed Effect errors.

The wire implementation is powered by protobuf-es. That keeps protobuf semantics, descriptors, extensions, and codec performance in one mature runtime while `effect-protobuf` owns the Effect-facing API. Normal application code works with generated schemas and ordinary TypeScript values; it does not call protobuf-es codecs directly.

## Install

```sh
npm install effect effect-protobuf
```

The generator requires `protoc` or [Buf](https://buf.build/docs/installation/).

## Generate schemas

Given `proto/address_book.proto`:

```proto
syntax = "proto3";
package example;

message Person {
  string name = 1;
  optional string email = 2;
  repeated string labels = 3;
}
```

Generate TypeScript with `protoc`:

```sh
protoc -I proto --effect_out=target=ts:src/gen proto/address_book.proto
```

Or configure the local plugin in `buf.gen.yaml` and run `buf generate`:

```yaml
version: v2
plugins:
  - local: protoc-gen-effect
    out: src/gen
    opt: target=ts
```

The generated module exports protobuf descriptors and an Effect Schema for every message:

```ts
import { Person, PersonSchema } from "./gen/address_book_pb.ts";

const ada = Person.make({
  name: "Ada",
  email: "ada@example.com",
  labels: ["compiler"],
});
```

`Person` is a `Schema.Codec` with Effect's standard schema operations, including `make`, `makeOption`, `check`, and `annotate`. `PersonSchema` is the lower-level protobuf descriptor. Most application code only needs `Person`.

Construction applies protobuf defaults and validates field constraints. Message values use familiar TypeScript shapes: optional properties, arrays, object records, `bigint` for 64-bit integers, and `{ case, value }` unions for oneofs.

If another tool already generated a protobuf-es descriptor, derive the same schema manually:

```ts
import * as Protobuf from "effect-protobuf/Protobuf";
import { PersonSchema } from "./gen/address_book_pb.ts";

const Person = Protobuf.schema(PersonSchema);
```

## Encode and decode

The primary APIs return `Effect` values with typed `EncodeError` or `DecodeError` failures:

```ts
import { Effect } from "effect";
import * as Protobuf from "effect-protobuf/Protobuf";
import { Person } from "./gen/address_book_pb.ts";

const program = Effect.gen(function* () {
  const person = Person.make({ name: "Ada" });
  const bytes = yield* Protobuf.encodeBinaryEffect(Person)(person);
  const decoded = yield* Protobuf.decodeBinaryEffect(Person)(bytes);
  return yield* Protobuf.encodeJsonEffect(Person)(decoded);
});
```

Synchronous APIs are available for trusted boundaries and hot paths:

```ts
const encode = Protobuf.encodeBinarySync(Person);
const decode = Protobuf.decodeBinarySync(Person);

const bytes = encode(Person.make({ name: "Ada" }));
const person = decode(bytes);
```

Codec functions follow the same curried, schema-first convention as Effect Schema: configure the schema and reusable options first, then apply the input. They are intentionally not `dual`; the first call builds a message-specific operation rather than supplying the data argument to a single data-first/data-last operation. Options may also be overridden for one invocation:

```ts
const decode = Protobuf.decodeBinaryEffect(Person, {
  retainUnknownFields: true,
  limits: { maxBytes: 1_000_000 },
});

const effect = decode(bytes, { limits: { maxBytes: 4_000 } });
```

Binary and ProtoJSON codecs provide `Effect`, `Exit`, `Option`, `Result`, `Promise`, and synchronous variants. Text-format codecs provide `Effect` and synchronous variants. For example:

```ts
const result = Protobuf.decodeJsonResult(Person)(json);
const exit = Protobuf.encodeBinaryExit(Person)(person);
const text = Protobuf.encodeTextSync(Person)(person);
```

Errors are `Schema.TaggedError` classes and include the format and protobuf message name. Their guards are derived with `Schema.is`:

```ts
import { Result } from "effect";

const result = Protobuf.decodeBinaryResult(Person)(bytes);

if (Result.isFailure(result) && Protobuf.isDecodeError(result.failure)) {
  console.error(result.failure.format, result.failure.messageType, result.failure.issue);
}
```

## Protobuf support

Binary decoding supports recursion and byte limits, unknown-field retention, and extension validation through a protobuf registry. ProtoJSON and text format accept registries for extensions and `Any` resolution. Generated service descriptors remain available for transport integrations; this package does not prescribe an RPC client or server.

The pinned official `protobuf-conformance@35.1.0` suite passes all 5,631 binary and ProtoJSON cases and all 909 text-format cases, including proto2, proto3, Editions, unknown fields, and extension behavior.

## Performance

Serialization delegates directly to protobuf-es without converting messages into alternate Effect-specific containers. Bind a schema-specific codec once in a hot path, as shown above, to avoid repeatedly creating the adapter closure.

The benchmark verifies equivalent results before comparing protobuf-es and `effect-protobuf` over the same descriptors and payloads:

```sh
vp run benchmark
```

Run performance comparisons on otherwise idle, dedicated hardware. Results from different machines or JavaScript runtimes are not directly comparable.

## Development

```sh
bun install
vp run check          # format, lint, ast-grep, tests, and tsgo
vp run coverage       # enforce 100% runtime source coverage
vp run conformance    # official protobuf conformance runner
vp run build          # compiled ESM, declarations, publint, and ATTW
vp run benchmark
```

The package uses TypeScript 7's `tsgo`, exact optional property types, Vite+ (`vp pack`), and Changesets.

## Manual release

User-visible changes should include `vp run changeset`. To publish a reviewed release manually:

```sh
vp run version
git add . && git commit -m "Release effect-protobuf"
npm login
vp run release
```

`vp run version` consumes pending changesets and updates the version and changelog. `vp run release` runs the complete project checks, official conformance suite, package build, and tarball inspection before `changeset publish` publishes to the public npm registry. There is no automatic CI publishing.

## License

[MIT](LICENSE)

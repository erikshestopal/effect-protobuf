---
name: encoding-messages
description: >
  Encodes and decodes protobuf-effect messages as protobuf binary, ProtoJSON,
  and text using Effect, Sync, Result, Exit, Option, and Promise APIs. Use when
  selecting codec variants, binding schema-first operations, handling typed
  DecodeError or EncodeError failures, or configuring registries and limits.
metadata:
  type: core
  library: protobuf-effect
  library_version: 1.0.0
sources:
  - erikshestopal/effect-protobuf:README.md
  - erikshestopal/effect-protobuf:src/Protobuf.ts
---

# Encoding and Decoding Messages

## Setup

Use Effect variants at application boundaries:

```ts
import { Effect } from "effect";
import * as Protobuf from "protobuf-effect/Protobuf";
import { Person } from "./gen/address_book_pb.ts";

const program = Effect.gen(function* () {
  const person = Person.make({ name: "Ada" });
  const bytes = yield* Protobuf.encodeBinaryEffect(Person)(person);
  const decoded = yield* Protobuf.decodeBinaryEffect(Person)(bytes);
  return yield* Protobuf.encodeJsonEffect(Person)(decoded);
});
```

## Core Patterns

### Bind codecs once for a hot path

```ts
import * as Protobuf from "protobuf-effect/Protobuf";
import { Person } from "./gen/address_book_pb.ts";

const encodePerson = Protobuf.encodeBinarySync(Person);
const decodePerson = Protobuf.decodeBinarySync(Person);

const bytes = encodePerson(Person.make({ name: "Ada" }));
const person = decodePerson(bytes);
```

### Keep expected failures as values

```ts
import { Result } from "effect";
import * as Protobuf from "protobuf-effect/Protobuf";
import { Person } from "./gen/address_book_pb.ts";

const result = Protobuf.decodeBinaryResult(Person)(Uint8Array.of(10, 3, 65));

if (Result.isFailure(result) && Protobuf.isDecodeError(result.failure)) {
  console.error(result.failure.messageType, result.failure.issue);
}
```

### Apply reusable binary limits

```ts
import * as Protobuf from "protobuf-effect/Protobuf";
import { Person } from "./gen/address_book_pb.ts";

const decodePerson = Protobuf.decodeBinaryEffect(Person, {
  retainUnknownFields: true,
  limits: { maxBytes: 1_000_000 },
});

const decoded = decodePerson(Uint8Array.of(10, 3, 65, 100, 97));
```

## Common Mistakes

### HIGH Passing data before binding the schema

Wrong:

```ts
import * as Protobuf from "protobuf-effect/Protobuf";
import { Person } from "./gen/address_book_pb.ts";

const person = Protobuf.decodeBinarySync(Uint8Array.of())(Person);
```

Correct:

```ts
import * as Protobuf from "protobuf-effect/Protobuf";
import { Person } from "./gen/address_book_pb.ts";

const person = Protobuf.decodeBinarySync(Person)(Uint8Array.of());
```

Codec families are schema-first builders, not dual data-first/data-last functions.

Source: README.md § Encode and decode

### HIGH Converting bytes through JSON codecs

Wrong:

```ts
import * as Protobuf from "protobuf-effect/Protobuf";
import { Person } from "./gen/address_book_pb.ts";

const person = Protobuf.decodeJsonSync(Person)(Uint8Array.of(10, 3, 65, 100, 97));
```

Correct:

```ts
import * as Protobuf from "protobuf-effect/Protobuf";
import { Person } from "./gen/address_book_pb.ts";

const person = Protobuf.decodeBinarySync(Person)(Uint8Array.of(10, 3, 65, 100, 97));
```

Binary, ProtoJSON, and protobuf text are separate formats with separate codec families.

Source: README.md § Encode and decode

### MEDIUM Rebinding codecs for every message

Wrong:

```ts
import * as Protobuf from "protobuf-effect/Protobuf";
import { Person } from "./gen/address_book_pb.ts";

const bytes = ["Ada", "Grace"].map((name) => Protobuf.encodeBinarySync(Person)(Person.make({ name })));
```

Correct:

```ts
import * as Protobuf from "protobuf-effect/Protobuf";
import { Person } from "./gen/address_book_pb.ts";

const encodePerson = Protobuf.encodeBinarySync(Person);
const bytes = ["Ada", "Grace"].map((name) => encodePerson(Person.make({ name })));
```

Binding once avoids repeatedly creating the schema adapter closure in a hot path.

Source: README.md § Performance

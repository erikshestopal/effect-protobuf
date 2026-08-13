---
name: generating-schemas
description: >
  Generates protobuf-effect Effect Schemas from .proto files with
  protoc-gen-effect, protoc, or Buf. Use when configuring code generation,
  constructing generated messages with Schema.make conventions, or validating
  generated message input without exposing protobuf-es descriptors.
metadata:
  type: core
  library: protobuf-effect
  library_version: 1.0.0
sources:
  - erikshestopal/effect-protobuf:README.md
  - erikshestopal/effect-protobuf:src/protoc-gen-effect.ts
  - erikshestopal/effect-protobuf:src/internal/MessageSchema.ts
---

# Generating protobuf-effect Schemas

## Setup

Install the runtime, then generate TypeScript from a protobuf source:

```sh
npm install effect protobuf-effect
protoc -I proto --effect_out=target=ts:src/gen proto/address_book.proto
```

For this protobuf:

```proto
syntax = "proto3";
package example;

message Person {
  string name = 1;
  optional string email = 2;
  repeated string labels = 3;
}
```

use the generated Effect Schema directly:

```ts
import { Person } from "./gen/address_book_pb.ts";

const ada = Person.make({
  name: "Ada",
  email: "ada@example.com",
  labels: ["compiler"],
});
```

## Core Patterns

### Configure Buf generation

```yaml
version: v2
plugins:
  - local: protoc-gen-effect
    out: src/gen
    opt: target=ts
```

Run `buf generate` after placing this configuration in `buf.gen.yaml`.

### Validate construction without throwing

```ts
import { Option } from "effect";
import { Person } from "./gen/address_book_pb.ts";

const person = Person.makeOption({ name: "Ada", labels: [] });

if (Option.isSome(person)) {
  console.log(person.value.name);
}
```

## Common Mistakes

### HIGH Replacing generated schemas with plain classes

Wrong:

```ts
class Person {
  constructor(readonly name: string) {}
}
```

Correct:

```ts
import { Person } from "./gen/address_book_pb.ts";

const person = Person.make({ name: "Ada" });
```

The generated `Person` is the Effect Schema and applies protobuf defaults and field validation during construction.

Source: README.md § Generate schemas

### HIGH Calling protobuf-es create in application code

Wrong:

```ts
import { create } from "@bufbuild/protobuf";
import { PersonSchema } from "./gen/address_book_pb.ts";

const person = create(PersonSchema, { name: "Ada" });
```

Correct:

```ts
import { Person } from "./gen/address_book_pb.ts";

const person = Person.make({ name: "Ada" });
```

Calling `create` bypasses the Effect Schema construction boundary exposed by generated modules.

Source: README.md § Generate schemas

### MEDIUM Reconstructing a generated schema manually

Wrong:

```ts
import { messageDesc } from "@bufbuild/protobuf/codegenv2";
import * as Protobuf from "protobuf-effect/Protobuf";
import { file_address_book } from "./gen/address_book_pb.ts";

const Person = Protobuf.schema(messageDesc(file_address_book, 0));
```

Correct:

```ts
import { Person } from "./gen/address_book_pb.ts";

const person = Person.make({ name: "Ada" });
```

The generator already exports the Effect Schema and keeps its backing message descriptor private.

Source: README.md § Generate schemas

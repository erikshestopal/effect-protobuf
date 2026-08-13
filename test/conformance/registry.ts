import { createRegistry, type DescFile, type DescMessage, type Message } from "@bufbuild/protobuf";
import { Array as Arr, Effect, String as Str } from "effect";
import * as Protobuf from "effect-protobuf/Protobuf";
import { file_google_protobuf_test_messages_edition2023 } from "./gen/google/protobuf/test_messages_edition2023_pb.ts";
import { file_google_protobuf_test_messages_edition_unstable } from "./gen/google/protobuf/test_messages_edition_unstable_pb.ts";
import { file_google_protobuf_test_messages_proto2_editions } from "./gen/google/protobuf/test_messages_proto2_editions_pb.ts";
import { file_google_protobuf_test_messages_proto2 } from "./gen/google/protobuf/test_messages_proto2_pb.ts";
import { file_google_protobuf_test_messages_proto3_editions } from "./gen/google/protobuf/test_messages_proto3_editions_pb.ts";
import { file_google_protobuf_test_messages_proto3 } from "./gen/google/protobuf/test_messages_proto3_pb.ts";
import type { BoundCodec, CodecRegistry } from "./conformance.ts";

const files: ReadonlyArray<DescFile> = [
  file_google_protobuf_test_messages_proto2,
  file_google_protobuf_test_messages_proto3,
  file_google_protobuf_test_messages_proto2_editions,
  file_google_protobuf_test_messages_proto3_editions,
  file_google_protobuf_test_messages_edition2023,
  file_google_protobuf_test_messages_edition_unstable,
];

const registry = createRegistry(...files, ...Arr.flatMap(files, (file) => file.dependencies));

const bind = (message: DescMessage): BoundCodec => {
  const schema = Protobuf.schema(message);
  const decodeBinary = Protobuf.decodeBinarySync(schema, { registry });
  const encodeBinary = Protobuf.encodeBinarySync(schema);
  const decodeJson = Protobuf.decodeJsonSync(schema, { registry });
  const encodeJson = Protobuf.encodeJsonSync(schema, { registry });
  const decodeText = Protobuf.decodeTextSync(schema, { registry });
  const encodeText = Protobuf.encodeTextSync(schema, { registry });
  return {
    decodeBinary,
    decodeJson,
    decodeText,
    encodeBinary: (value) => encodeBinary(value as Message),
    encodeJson: (value) => encodeJson(value as Message),
    encodeText: (value, options) => encodeText(value as Message, options),
  };
};

export const conformanceRegistry: CodecRegistry = Effect.runSync(
  Effect.sync(() => {
    const codecs: Record<string, BoundCodec> = {};
    for (const type of registry) {
      if (type.kind === "message" && Str.startsWith("TestAllTypes")(type.name)) {
        codecs[type.typeName] = bind(type);
      }
    }
    return codecs;
  }),
);

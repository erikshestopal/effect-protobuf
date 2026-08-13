import { create, equals, fromBinary, fromJsonString, toBinary, toJsonString } from "@bufbuild/protobuf";
import { fileDesc, messageDesc } from "@bufbuild/protobuf/codegenv2";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Array as Arr, Effect, Record as Rec, Schema } from "effect";
import { bench, do_not_optimize, group, run, summary } from "mitata";
import * as Protobuf from "../src/Protobuf.ts";
import { TestAllTypesProto3Schema } from "../test/conformance/gen/google/protobuf/test_messages_proto3_pb.ts";
import { Node as GeneratedNode } from "../test/generator/gen/representative_pb.ts";

class BenchmarkInvariantError extends Schema.TaggedError<BenchmarkInvariantError>()("BenchmarkInvariantError", {
  issue: Schema.String,
}) {}

// The protobuf-es descriptor for test/generator/representative.proto. Keeping the
// descriptor here avoids checking a second generator's golden files into test/.
const importedFile = fileDesc(
  "Cg5pbXBvcnRlZC5wcm90bxISZ2VuZXJhdG9yLmltcG9ydGVkIhcKBkRldGFpbBINCgV2YWx1ZRgBIAEoCSozCgZTdGF0dXMSFgoSU1RBVFVTX1VOU1BFQ0lGSUVEEAASEQoNU1RBVFVTX0FDVElWRRABYgZwcm90bzM",
);
const representativeFile = fileDesc(
  "ChRyZXByZXNlbnRhdGl2ZS5wcm90bxIOZ2VuZXJhdG9yLnRlc3Qi7gMKBE5vZGUSCgoCaWQYASABKAUSEgoFbGFiZWwYAiABKAlIAYgBARIkCgVzdGF0ZRgDIAEoDjIVLmdlbmVyYXRvci50ZXN0LlN0YXRlEgwKBHRhZ3MYBCADKAkSNAoIY291bnRlcnMYBSADKAsyIi5nZW5lcmF0b3IudGVzdC5Ob2RlLkNvdW50ZXJzRW50cnkSDwoFZW1haWwYBiABKAlIABIPCgVwaG9uZRgHIAEoA0gAEisKBmRldGFpbBgIIAEoCzIbLmdlbmVyYXRvci50ZXN0Lk5vZGUuRGV0YWlsEiMKBWNoaWxkGAkgASgLMhQuZ2VuZXJhdG9yLnRlc3QuTm9kZRIPCgdlbmFibGVkGAogASgIEg8KB3BheWxvYWQYCyABKAwSMwoPaW1wb3J0ZWRfZGV0YWlsGAwgASgLMhouZ2VuZXJhdG9yLmltcG9ydGVkLkRldGFpbBIzCg9pbXBvcnRlZF9zdGF0dXMYDSABKA4yGi5nZW5lcmF0b3IuaW1wb3J0ZWQuU3RhdHVzGhYKBkRldGFpbBIMCgRub3RlGAEgASgJGi8KDUNvdW50ZXJzRW50cnkSCwoDa2V5GAEgASgJEg0KBXZhbHVlGAIgASgDOgI4AUIJCgdjb250YWN0QggKBl9sYWJlbCovCgVTdGF0ZRIVChFTVEFURV9VTlNQRUNJRklFRBAAEg8KC1NUQVRFX1JFQURZEAEyfQoLTm9kZVNlcnZpY2USNwoDR2V0EhQuZ2VuZXJhdG9yLnRlc3QuTm9kZRoaLmdlbmVyYXRvci5pbXBvcnRlZC5EZXRhaWwSNQoFV2F0Y2gSFC5nZW5lcmF0b3IudGVzdC5Ob2RlGhQuZ2VuZXJhdG9yLnRlc3QuTm9kZTABYgZwcm90bzM",
  [importedFile],
);
const RepresentativeNodeSchema = messageDesc(representativeFile, 0);
const EffectTestAllTypesSchema = Protobuf.schema(TestAllTypesProto3Schema);

const main = Effect.gen(function* () {
  const integers = Arr.range(1, 256);
  const protobufValue = create(TestAllTypesProto3Schema, {
    optionalInt32: -123,
    optionalInt64: -9_007_199_254_740_991n,
    optionalUint32: 4_294_967_295,
    optionalUint64: 18_446_744_073_709_551_615n,
    optionalFloat: 0.75,
    optionalDouble: -0.125,
    optionalBool: true,
    optionalString: "effect-protobuf benchmark",
    optionalBytes: new TextEncoder().encode("representative binary payload"),
    optionalNestedMessage: { a: 42 },
    repeatedInt32: integers,
    repeatedInt64: Arr.map(integers, BigInt),
    repeatedString: Arr.map(integers, (value) => `value-${value}`),
    repeatedNestedMessage: Arr.map(integers, (a) => ({ a })),
    mapStringString: Rec.fromEntries(Arr.map(integers, (value) => [`key-${value}`, `value-${value}`] as const)),
    oneofField: { case: "oneofString", value: "representative oneof" },
  });
  const binary = toBinary(TestAllTypesProto3Schema, protobufValue);
  const json = toJsonString(TestAllTypesProto3Schema, protobufValue);
  // @effect-diagnostics-next-line preferSchemaOverJson:off -- this benchmark intentionally isolates the native floor
  const parsedJson = JSON.parse(json);
  const successfulEffect = Effect.succeed(protobufValue);

  const generatedValue = GeneratedNode.make({
    id: 42,
    label: "root",
    state: 1,
    tags: ["effect", "protobuf"],
    counters: { visits: 9n },
    contact: { case: "email", value: "effect@example.com" },
    detail: { note: "nested" },
    child: { id: 21 },
    importedDetail: { value: "cross-file" },
    importedStatus: 1,
  });
  const generatedBinary = Protobuf.encodeBinarySync(GeneratedNode)(generatedValue);
  const generatedJson = Protobuf.encodeJsonSync(GeneratedNode)(generatedValue);
  const decodeGeneratedBinary = Protobuf.decodeBinarySync(GeneratedNode);
  const encodeGeneratedBinary = Protobuf.encodeBinarySync(GeneratedNode);
  const decodeGeneratedJson = Protobuf.decodeJsonSync(GeneratedNode);
  const encodeGeneratedJson = Protobuf.encodeJsonSync(GeneratedNode);
  const protobufGeneratedValue = fromBinary(RepresentativeNodeSchema, generatedBinary);
  const decodeDelegatedBinary = Protobuf.decodeBinarySync(EffectTestAllTypesSchema);
  const encodeDelegatedBinary = Protobuf.encodeBinarySync(EffectTestAllTypesSchema);
  const decodeDelegatedJson = Protobuf.decodeJsonSync(EffectTestAllTypesSchema);
  const encodeDelegatedJson = Protobuf.encodeJsonSync(EffectTestAllTypesSchema);

  yield* Effect.filterOrFail(
    Effect.sync(() => encodeDelegatedBinary(decodeDelegatedBinary(binary))),
    (encoded) => equals(TestAllTypesProto3Schema, fromBinary(TestAllTypesProto3Schema, encoded), protobufValue),
    () => new BenchmarkInvariantError({ issue: "Effect and protobuf-es produced semantically different output" }),
  );

  yield* Effect.filterOrFail(
    Effect.sync(() => toBinary(RepresentativeNodeSchema, protobufGeneratedValue)),
    (encoded) =>
      equals(
        RepresentativeNodeSchema,
        fromBinary(RepresentativeNodeSchema, encodeGeneratedBinary(decodeGeneratedBinary(encoded))),
        protobufGeneratedValue,
      ),
    () => new BenchmarkInvariantError({ issue: "Generated Effect and protobuf-es descriptors did not interoperate" }),
  );

  group("hard floors / stages", () => {
    bench("JSON.parse only", () => do_not_optimize(JSON.parse(json)));
    bench("JSON.stringify prebuilt JSON value", () => do_not_optimize(JSON.stringify(parsedJson)));
    // @effect-diagnostics-next-line runEffectInsideEffect:off -- the operation being measured is specifically runSync
    bench("Effect.runSync successful effect", () => do_not_optimize(Effect.runSync(successfulEffect)));
  });
  yield* Effect.filterOrFail(
    Effect.sync(() => encodeDelegatedJson(decodeDelegatedJson(json))),
    (encoded) => equals(TestAllTypesProto3Schema, fromJsonString(TestAllTypesProto3Schema, encoded), protobufValue),
    () => new BenchmarkInvariantError({ issue: "Effect and protobuf-es produced semantically different ProtoJSON" }),
  );

  group(`binary decode (${binary.length} bytes)`, () => {
    summary(() => {
      bench("protobuf-es", () => do_not_optimize(fromBinary(TestAllTypesProto3Schema, binary))).baseline();
      bench("effect-protobuf", () => do_not_optimize(decodeDelegatedBinary(binary)));
    });
  });

  group(`binary encode (${binary.length} bytes)`, () => {
    summary(() => {
      bench("protobuf-es", () => do_not_optimize(toBinary(TestAllTypesProto3Schema, protobufValue))).baseline();
      bench("effect-protobuf", () => do_not_optimize(encodeDelegatedBinary(protobufValue)));
    });
  });

  group(`ProtoJSON decode (${json.length} bytes)`, () => {
    summary(() => {
      bench("protobuf-es", () => do_not_optimize(fromJsonString(TestAllTypesProto3Schema, json))).baseline();
      bench("effect-protobuf", () => do_not_optimize(decodeDelegatedJson(json)));
    });
  });

  group(`ProtoJSON encode (${json.length} bytes)`, () => {
    summary(() => {
      bench("protobuf-es", () => do_not_optimize(toJsonString(TestAllTypesProto3Schema, protobufValue))).baseline();
      bench("effect-protobuf", () => do_not_optimize(encodeDelegatedJson(protobufValue)));
    });
  });

  group(`generated Node binary decode (${generatedBinary.length} bytes)`, () => {
    summary(() => {
      bench("protobuf-es", () => do_not_optimize(fromBinary(RepresentativeNodeSchema, generatedBinary))).baseline();
      bench("effect-protobuf", () => do_not_optimize(decodeGeneratedBinary(generatedBinary)));
    });
  });

  group(`generated Node binary encode (${generatedBinary.length} bytes)`, () => {
    summary(() => {
      bench("protobuf-es", () =>
        do_not_optimize(toBinary(RepresentativeNodeSchema, protobufGeneratedValue))).baseline();
      bench("effect-protobuf", () => do_not_optimize(encodeGeneratedBinary(generatedValue)));
    });
  });

  group(`generated Node ProtoJSON decode (${generatedJson.length} bytes)`, () => {
    summary(() => {
      bench("protobuf-es", () => do_not_optimize(fromJsonString(RepresentativeNodeSchema, generatedJson))).baseline();
      bench("effect-protobuf", () => do_not_optimize(decodeGeneratedJson(generatedJson)));
    });
  });

  group(`generated Node ProtoJSON encode (${generatedJson.length} bytes)`, () => {
    summary(() => {
      bench("protobuf-es", () =>
        do_not_optimize(toJsonString(RepresentativeNodeSchema, protobufGeneratedValue))).baseline();
      bench("effect-protobuf", () => do_not_optimize(encodeGeneratedJson(generatedValue)));
    });
  });

  yield* Effect.promise(() => run({ throw: true, colors: false, format: "markdown" }));
});

main.pipe(NodeRuntime.runMain);

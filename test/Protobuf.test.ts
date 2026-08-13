import { assert, describe, it } from "@effect/vitest";
import { create, createRegistry, setExtension, toBinary } from "@bufbuild/protobuf";
import { Effect, Exit, Option, Result, Schema } from "effect";
import * as Protobuf from "effect-protobuf/Protobuf";
import {
  extension_int32,
  TestAllTypesProto2Schema,
} from "./conformance/gen/google/protobuf/test_messages_proto2_pb.ts";
import { TestAllTypesProto3Schema } from "./conformance/gen/google/protobuf/test_messages_proto3_pb.ts";

describe("Protobuf schemas", () => {
  it("derives an Effect Schema and delegates protobuf formats for protobuf-es messages", () => {
    const Message = Protobuf.schema(TestAllTypesProto3Schema);
    const value = Message.make({
      optionalInt32: 42,
      optionalNestedMessage: { a: 7 },
      repeatedString: ["effect", "protobuf"],
      mapStringString: { key: "value" },
      oneofField: { case: "oneofString", value: "selected" },
      optionalInt32Wrapper: 9,
    });

    assert.isTrue(Schema.is(Message)(value));
    assert.strictEqual(Protobuf.descriptor(Message), TestAllTypesProto3Schema);
    const binary = Protobuf.encodeBinarySync(Message)(value);
    const decoded = Protobuf.decodeBinarySync(Message)(binary);
    assert.isTrue(Schema.is(Message)(decoded));
    assert.strictEqual(decoded.optionalNestedMessage?.a, 7);
    assert.deepStrictEqual(decoded.mapStringString, { key: "value" });
    assert.deepStrictEqual(decoded.oneofField, { case: "oneofString", value: "selected" });

    const json = Protobuf.encodeJsonSync(Message)(value);
    assert.isTrue(Schema.is(Message)(Protobuf.decodeJsonSync(Message)(json)));
    const text = Protobuf.encodeTextSync(Message)(value);
    assert.isTrue(Schema.is(Message)(Protobuf.decodeTextSync(Message)(text)));
  });

  it("uses schema-derived guards for codec errors", () => {
    const Message = Protobuf.schema(TestAllTypesProto3Schema);
    const result = Protobuf.decodeBinaryResult(Message)(Uint8Array.of(0x80));
    assert.isTrue(Result.isFailure(result));
    if (Result.isFailure(result)) {
      assert.isTrue(Protobuf.isDecodeError(result.failure));
      assert.strictEqual(result.failure.format, "binary");
    }
  });

  it.effect("supports every Effect adapter and operation-level options", () =>
    Effect.gen(function* () {
      const Message = Protobuf.schema(TestAllTypesProto3Schema);
      const value = Message.make({ optionalInt32: 42 });
      const bytes = Protobuf.encodeBinarySync(Message)(value);
      const invalidBytes = Uint8Array.of(0x80);

      assert.strictEqual((yield* Protobuf.decodeBinaryEffect(Message)(bytes)).optionalInt32, 42);
      assert.isTrue(Exit.isSuccess(Protobuf.decodeBinaryExit(Message)(bytes)));
      assert.isTrue(Option.isSome(Protobuf.decodeBinaryOption(Message)(bytes)));
      assert.strictEqual((yield* Effect.promise(() => Protobuf.decodeBinaryPromise(Message)(bytes))).optionalInt32, 42);
      assert.isTrue(Exit.isFailure(Protobuf.decodeBinaryExit(Message)(invalidBytes)));
      assert.isTrue(Option.isNone(Protobuf.decodeBinaryOption(Message)(invalidBytes)));
      yield* Effect.promise(() =>
        Protobuf.decodeBinaryPromise(Message)(invalidBytes).then(
          () => assert.fail("expected binary decoding to fail"),
          (error) => assert.isTrue(Protobuf.isDecodeError(error)),
        ),
      );
      assert.throws(() => Protobuf.decodeBinarySync(Message)(invalidBytes), Protobuf.DecodeError);
      const throwingBytes = new Proxy(bytes, {
        get: () => {
          throw "invalid binary";
        },
      });
      assert.isTrue(Exit.isFailure(Protobuf.decodeBinaryExit(Message)(throwingBytes)));
      assert.throws(
        () => Protobuf.decodeBinarySync(Message, { limits: { maxBytes: 100 } })(bytes, { limits: { maxBytes: 0 } }),
        Protobuf.DecodeError,
      );
      assert.strictEqual(
        Protobuf.decodeBinarySync(Message)(bytes, { retainUnknownFields: false, limits: { maxDepth: 100 } })
          .optionalInt32,
        42,
      );

      const Proto2 = Protobuf.schema(TestAllTypesProto2Schema);
      const extended = create(TestAllTypesProto2Schema);
      setExtension(extended, extension_int32, 7);
      const extensionBytes = toBinary(TestAllTypesProto2Schema, extended);
      const registry = createRegistry(extension_int32);
      assert.doesNotThrow(() =>
        Protobuf.decodeBinarySync(Proto2, {
          registry,
          limits: { maxDepth: 100 },
        })(Uint8Array.from([...extensionBytes, 0xd0, 0x29, 0x01])),
      );
      assert.doesNotThrow(() => Protobuf.decodeBinarySync(Proto2, { registry })(extensionBytes));

      assert.deepStrictEqual(yield* Protobuf.encodeBinaryEffect(Message)(value), bytes);
      assert.isTrue(Exit.isSuccess(Protobuf.encodeBinaryExit(Message)(value)));
      assert.isTrue(Option.isSome(Protobuf.encodeBinaryOption(Message)(value)));
      assert.isTrue(Result.isSuccess(Protobuf.encodeBinaryResult(Message)(value)));
      assert.deepStrictEqual(yield* Effect.promise(() => Protobuf.encodeBinaryPromise(Message)(value)), bytes);
      assert.deepStrictEqual(Protobuf.encodeBinarySync(Message)(value, { writeUnknownFields: false }), bytes);
      assert.isTrue(Exit.isFailure(Protobuf.encodeBinaryExit(Message, { limits: { maxBytes: 0 } })(value)));
      assert.isTrue(Option.isNone(Protobuf.encodeBinaryOption(Message, { limits: { maxBytes: 0 } })(value)));
      assert.isTrue(Result.isFailure(Protobuf.encodeBinaryResult(Message, { limits: { maxBytes: 0 } })(value)));
      yield* Effect.promise(() =>
        Protobuf.encodeBinaryPromise(Message, { limits: { maxBytes: 0 } })(value).then(
          () => assert.fail("expected binary encoding to fail"),
          (error) => assert.isTrue(Protobuf.isEncodeError(error)),
        ),
      );
      assert.throws(
        () => Protobuf.encodeBinarySync(Message, { limits: { maxBytes: 100 } })(value, { limits: { maxBytes: 0 } }),
        Protobuf.EncodeError,
      );

      const json = Protobuf.encodeJsonSync(Message)(value);
      assert.strictEqual((yield* Protobuf.decodeJsonEffect(Message)(json)).optionalInt32, 42);
      assert.isTrue(Exit.isSuccess(Protobuf.decodeJsonExit(Message)(json)));
      assert.isTrue(Option.isSome(Protobuf.decodeJsonOption(Message)(json)));
      assert.strictEqual((yield* Effect.promise(() => Protobuf.decodeJsonPromise(Message)(json))).optionalInt32, 42);
      assert.isTrue(Exit.isFailure(Protobuf.decodeJsonExit(Message)("{")));
      assert.isTrue(Option.isNone(Protobuf.decodeJsonOption(Message)("{")));
      yield* Effect.promise(() =>
        Protobuf.decodeJsonPromise(Message)("{").then(
          () => assert.fail("expected JSON decoding to fail"),
          (error) => assert.isTrue(Protobuf.isDecodeError(error)),
        ),
      );
      assert.throws(() => Protobuf.decodeJsonSync(Message)("{"), Protobuf.DecodeError);

      assert.strictEqual(yield* Protobuf.encodeJsonEffect(Message)(value), json);
      assert.isTrue(Exit.isSuccess(Protobuf.encodeJsonExit(Message)(value)));
      assert.isTrue(Option.isSome(Protobuf.encodeJsonOption(Message)(value)));
      assert.isTrue(Result.isSuccess(Protobuf.encodeJsonResult(Message)(value)));
      assert.strictEqual(yield* Effect.promise(() => Protobuf.encodeJsonPromise(Message)(value)), json);
      assert.include(
        Protobuf.encodeJsonSync(Message)(value, {
          emitDefaultValues: true,
          useProtoFieldName: true,
          registry: createRegistry(),
        }),
        "optional_int32",
      );
      const invalidValue = { ...value, optionalInt64: Symbol("invalid") } as unknown as typeof value;
      assert.isTrue(Exit.isFailure(yield* Protobuf.encodeJsonEffect(Message)(invalidValue).pipe(Effect.exit)));
      assert.throws(() => Protobuf.encodeJsonSync(Message)(invalidValue), Protobuf.EncodeError);

      const text = Protobuf.encodeTextSync(Message)(value);
      assert.strictEqual((yield* Protobuf.decodeTextEffect(Message)(text)).optionalInt32, 42);
      assert.isTrue(Exit.isFailure(yield* Protobuf.decodeTextEffect(Message)("{").pipe(Effect.exit)));
      assert.throws(() => Protobuf.decodeTextSync(Message)("{"), Protobuf.DecodeError);
      assert.strictEqual(yield* Protobuf.encodeTextEffect(Message)(value), text);
      assert.strictEqual(Protobuf.encodeTextSync(Message)(value, { printUnknownFields: false }), text);
      const throwingValue = new Proxy(value, {
        get: () => {
          throw "invalid message";
        },
      });
      assert.isTrue(Exit.isFailure(yield* Protobuf.encodeTextEffect(Message)(throwingValue).pipe(Effect.exit)));
      assert.throws(() => Protobuf.encodeTextSync(Message)(throwingValue), Protobuf.EncodeError);
    }),
  );
});

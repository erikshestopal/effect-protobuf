import { create, fromBinary } from "@bufbuild/protobuf";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Stream } from "effect";
import { handleRequest } from "./conformance/conformance.ts";
import {
  ConformanceRequestSchema,
  FailureSetSchema,
  WireFormat,
} from "./conformance/gen/conformance/conformance_pb.ts";
import { decodeFrames, encodeFrame } from "./conformance/transport.ts";

describe("conformance transport", () => {
  it.effect("decodes frames split across arbitrary chunks", () =>
    Effect.gen(function* () {
      const first = encodeFrame(Uint8Array.of(1, 2, 3));
      const second = encodeFrame(Uint8Array.of(4, 5));
      const bytes = new Uint8Array(first.byteLength + second.byteLength);
      bytes.set(first);
      bytes.set(second, first.byteLength);

      const decoded = yield* Stream.fromIterable([bytes.slice(0, 2), bytes.slice(2, 7), bytes.slice(7)]).pipe(
        decodeFrames,
        Stream.runCollect,
      );

      assert.deepStrictEqual(decoded, [Uint8Array.of(1, 2, 3), Uint8Array.of(4, 5)]);
    }),
  );
});

describe("conformance adapter", () => {
  it.effect("answers the runner failure-set handshake", () =>
    Effect.gen(function* () {
      const request = create(ConformanceRequestSchema, {
        messageType: FailureSetSchema.typeName,
        requestedOutputFormat: WireFormat.PROTOBUF,
      });
      const result = (yield* handleRequest({}, request)).result;

      assert.strictEqual(result.case, "protobufPayload");
      if (result.case === "protobufPayload") {
        const failureSet = fromBinary(FailureSetSchema, result.value);
        assert.deepStrictEqual(failureSet.test, []);
      }
    }),
  );

  it.effect("uses codecs that are bound once per schema", () =>
    Effect.gen(function* () {
      const calls: Array<string> = [];
      const request = create(ConformanceRequestSchema, {
        messageType: "example.Message",
        payload: { case: "protobufPayload", value: Uint8Array.of(8, 1) },
        requestedOutputFormat: WireFormat.PROTOBUF,
      });
      const result = (yield* handleRequest(
        {
          "example.Message": {
            decodeBinary: (input) => {
              calls.push(`decode:${input.byteLength}`);
              return 1;
            },
            decodeJson: () => 1,
            decodeText: () => 1,
            encodeBinary: (value) => {
              calls.push(`encode:${String(value)}`);
              return Uint8Array.of(8, 1);
            },
            encodeJson: () => "{}",
            encodeText: () => "",
          },
        },
        request,
      )).result;

      assert.strictEqual(result.case, "protobufPayload");
      assert.deepStrictEqual(calls, ["decode:2", "encode:1"]);
      if (result.case === "protobufPayload") {
        assert.deepStrictEqual(result.value, Uint8Array.of(8, 1));
      }
    }),
  );
});

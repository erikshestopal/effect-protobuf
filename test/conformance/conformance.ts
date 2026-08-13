import { create, toBinary } from "@bufbuild/protobuf";
import { Effect, Predicate, Schema } from "effect";
import type { ConformanceRequest, ConformanceResponse } from "./gen/conformance/conformance_pb.ts";
import {
  ConformanceResponseSchema,
  FailureSetSchema,
  TestCategory,
  WireFormat,
} from "./gen/conformance/conformance_pb.ts";

export interface BoundCodec {
  readonly decodeBinary: (input: Uint8Array) => unknown;
  readonly decodeJson: (input: string, options?: { readonly ignoreUnknownFields?: boolean }) => unknown;
  readonly decodeText: (input: string) => unknown;
  readonly encodeBinary: (value: unknown) => Uint8Array;
  readonly encodeJson: (value: unknown) => string;
  readonly encodeText: (value: unknown, options: { readonly printUnknownFields: boolean }) => string;
}

export type CodecRegistry = Readonly<Record<string, BoundCodec>>;

class CodecOperationError extends Schema.TaggedError<CodecOperationError>()("CodecOperationError", {
  cause: Schema.Defect(),
}) {}

const response = (result: ConformanceResponse["result"]): ConformanceResponse =>
  create(ConformanceResponseSchema, { result });

const runtimeError = (message: string): ConformanceResponse => response({ case: "runtimeError", value: message });

const attempt = <A>(evaluate: () => A): Effect.Effect<A, CodecOperationError> =>
  Effect.try({
    try: evaluate,
    catch: (cause) => new CodecOperationError({ cause }),
  });

const errorMessage = (cause: unknown): string =>
  Predicate.hasProperty(cause, "issue") && Predicate.isString(cause.issue) ? cause.issue : String(cause);

const parse = (request: ConformanceRequest, codec: BoundCodec): Effect.Effect<unknown, CodecOperationError> => {
  if (request.payload.case === "protobufPayload") {
    const input = request.payload.value;
    return attempt(() => codec.decodeBinary(input));
  }
  if (request.payload.case === "jsonPayload") {
    const input = request.payload.value;
    return attempt(() =>
      codec.decodeJson(input, {
        ignoreUnknownFields: request.testCategory === TestCategory.JSON_IGNORE_UNKNOWN_PARSING_TEST,
      }),
    );
  }
  if (request.payload.case === "textPayload") {
    const input = request.payload.value;
    return attempt(() => codec.decodeText(input));
  }
  return Effect.fail(new CodecOperationError({ cause: "JSPB or missing input is not supported" }));
};

const serialize = (
  request: ConformanceRequest,
  codec: BoundCodec,
  value: unknown,
): Effect.Effect<ConformanceResponse, CodecOperationError> => {
  if (request.requestedOutputFormat === WireFormat.PROTOBUF) {
    return attempt(() => response({ case: "protobufPayload", value: codec.encodeBinary(value) }));
  }
  if (request.requestedOutputFormat === WireFormat.JSON) {
    return attempt(() => response({ case: "jsonPayload", value: codec.encodeJson(value) }));
  }
  if (request.requestedOutputFormat === WireFormat.TEXT_FORMAT) {
    return attempt(() =>
      response({
        case: "textPayload",
        value: codec.encodeText(value, { printUnknownFields: request.printUnknownFields }),
      }),
    );
  }
  if (request.requestedOutputFormat === WireFormat.JSPB) {
    return Effect.succeed(response({ case: "skipped", value: "JSPB is not supported" }));
  }
  return Effect.succeed(runtimeError(`unknown output format ${request.requestedOutputFormat}`));
};

export const handleRequest = (
  registry: CodecRegistry,
  request: ConformanceRequest,
): Effect.Effect<ConformanceResponse> => {
  if (request.messageType === FailureSetSchema.typeName) {
    const failureSet = create(FailureSetSchema);
    return Effect.succeed(response({ case: "protobufPayload", value: toBinary(FailureSetSchema, failureSet) }));
  }

  const codec = registry[request.messageType];
  if (codec === undefined) {
    return Effect.succeed(runtimeError(`unknown request message type ${request.messageType}`));
  }

  return parse(request, codec).pipe(
    Effect.matchEffect({
      onFailure: (error) => Effect.succeed(response({ case: "parseError", value: errorMessage(error.cause) })),
      onSuccess: (value) =>
        serialize(request, codec, value).pipe(
          Effect.match({
            onFailure: (error) => response({ case: "serializeError", value: errorMessage(error.cause) }),
            onSuccess: (result) => result,
          }),
        ),
    }),
  );
};

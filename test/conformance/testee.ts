#!/usr/bin/env -S node --import=tsx

import { fromBinary, toBinary } from "@bufbuild/protobuf";
import { NodeRuntime, NodeStdio } from "@effect/platform-node";
import { Effect, Schema, Stdio, Stream } from "effect";
import { handleRequest } from "./conformance.ts";
import { ConformanceRequestSchema, ConformanceResponseSchema } from "./gen/conformance/conformance_pb.ts";
import { conformanceRegistry } from "./registry.ts";
import { decodeFrames, encodeFrame } from "./transport.ts";

class ConformanceProtocolError extends Schema.TaggedError<ConformanceProtocolError>()("ConformanceProtocolError", {
  cause: Schema.Defect(),
}) {}

const processFrame = Effect.fnUntraced(function* (requestBytes: Uint8Array) {
  const request = yield* Effect.try({
    try: () => fromBinary(ConformanceRequestSchema, requestBytes),
    catch: (cause) => new ConformanceProtocolError({ cause }),
  });
  const response = yield* handleRequest(conformanceRegistry, request);
  const responseBytes = yield* Effect.try({
    try: () => toBinary(ConformanceResponseSchema, response),
    catch: (cause) => new ConformanceProtocolError({ cause }),
  });
  return encodeFrame(responseBytes);
});

const program = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio;
  yield* stdio.stdin.pipe(decodeFrames, Stream.mapEffect(processFrame), Stream.run(stdio.stdout()));
});

program.pipe(Effect.provide(NodeStdio.layer), NodeRuntime.runMain);

import { Array as Arr, Effect, Option, Schema, Stream } from "effect";

const frameHeaderSize = 4;

export class ConformanceTransportError extends Schema.TaggedError<ConformanceTransportError>()(
  "ConformanceTransportError",
  {
    reason: Schema.Literal("IncompleteFrame"),
    remainingBytes: Schema.Int,
  },
) {}

export const encodeFrame = (payload: Uint8Array): Uint8Array => {
  const frame = new Uint8Array(frameHeaderSize + payload.byteLength);
  new DataView(frame.buffer).setUint32(0, payload.byteLength, true);
  frame.set(payload, frameHeaderSize);
  return frame;
};

const append = (left: Uint8Array<ArrayBuffer>, right: Uint8Array<ArrayBufferLike>): Uint8Array<ArrayBuffer> => {
  const result = new Uint8Array(left.byteLength + right.byteLength);
  result.set(left);
  result.set(right, left.byteLength);
  return result;
};

const decodeAvailable = (
  previous: Uint8Array<ArrayBuffer>,
  chunk: Uint8Array<ArrayBufferLike>,
): readonly [Uint8Array<ArrayBuffer>, ReadonlyArray<Uint8Array>] => {
  let buffered = append(previous, chunk);
  const frames = Arr.empty<Uint8Array>();

  while (buffered.byteLength >= frameHeaderSize) {
    const view = new DataView(buffered.buffer, buffered.byteOffset, buffered.byteLength);
    const payloadSize = view.getUint32(0, true);
    const frameSize = frameHeaderSize + payloadSize;
    if (buffered.byteLength < frameSize) {
      break;
    }
    frames.push(buffered.slice(frameHeaderSize, frameSize));
    buffered = buffered.slice(frameSize);
  }

  return [buffered, frames];
};

export const decodeFrames = <E, R>(
  input: Stream.Stream<Uint8Array, E, R>,
): Stream.Stream<Uint8Array, E | ConformanceTransportError, R> =>
  input.pipe(
    Stream.map(Option.some),
    Stream.concat(Stream.succeed(Option.none<Uint8Array>())),
    Stream.mapAccumEffect(
      () => new Uint8Array(0),
      (buffered, chunk) =>
        Option.match(chunk, {
          onNone: () =>
            buffered.byteLength === 0
              ? Effect.succeed([buffered, Arr.empty<Uint8Array>()] as const)
              : Effect.fail(
                  new ConformanceTransportError({
                    reason: "IncompleteFrame",
                    remainingBytes: buffered.byteLength,
                  }),
                ),
          onSome: (bytes) => Effect.succeed(decodeAvailable(buffered, bytes)),
        }),
    ),
  );

/**
 * Provides Effect Schemas and protobuf codecs for generated message
 * descriptors.
 *
 * @since 1.0.0
 */
import {
  fromBinary as protobufFromBinary,
  fromJsonString as protobufFromJsonString,
  getExtension as protobufGetExtension,
  toBinary as protobufToBinary,
  toJsonString as protobufToJsonString,
  type DescMessage,
  type MessageShape,
  type Registry,
} from "@bufbuild/protobuf";
import { fromText as protobufFromText, toText as protobufToText } from "@bufbuild/protobuf/txtpb";
import { Effect, Exit, Option, Predicate, Result, Schema } from "effect";
import {
  descriptor as getDescriptor,
  make as makeMessageSchema,
  type MessageSchema,
} from "./internal/MessageSchema.ts";

/**
 * @category models
 * @since 1.0.0
 */
export type { MessageSchema } from "./internal/MessageSchema.ts";

/**
 * @category models
 * @since 1.0.0
 */
export declare namespace MessageSchema {
  /**
   * @category models
   * @since 1.0.0
   */
  export type Any = MessageSchema<DescMessage>;
  /**
   * @category models
   * @since 1.0.0
   */
  export type Type<S> = S extends MessageSchema<infer Desc> ? MessageShape<Desc> : never;
  /**
   * @category models
   * @since 1.0.0
   */
  export type Descriptor<S> = S extends MessageSchema<infer Desc> ? Desc : never;
}

/**
 * @category models
 * @since 1.0.0
 */
export const Format = Schema.Literals(["binary", "json", "text"]);

/**
 * @category models
 * @since 1.0.0
 */
export type Format = typeof Format.Type;

/**
 * Contains the serialization format, fully-qualified protobuf message name,
 * human-readable issue, and original cause of a failed decode.
 *
 * @category errors
 * @since 1.0.0
 */
export class DecodeError extends Schema.TaggedError<DecodeError>()("DecodeError", {
  format: Format,
  messageType: Schema.String,
  issue: Schema.String,
  cause: Schema.Defect(),
}) {}

/**
 * @category guards
 * @since 1.0.0
 */
export const isDecodeError = Schema.is(DecodeError);

/**
 * Contains the serialization format, fully-qualified protobuf message name,
 * human-readable issue, and original cause of a failed encode.
 *
 * @category errors
 * @since 1.0.0
 */
export class EncodeError extends Schema.TaggedError<EncodeError>()("EncodeError", {
  format: Format,
  messageType: Schema.String,
  issue: Schema.String,
  cause: Schema.Defect(),
}) {}

/**
 * @category guards
 * @since 1.0.0
 */
export const isEncodeError = Schema.is(EncodeError);

/**
 * Derives an Effect Schema whose constructor applies protobuf defaults and
 * validates the descriptor's field constraints. Schemas are cached by
 * descriptor identity, including recursive descriptors.
 *
 * @category constructors
 * @since 1.0.0
 */
export const schema = <Desc extends DescMessage>(descriptor: Desc): MessageSchema<Desc> =>
  makeMessageSchema(descriptor);

/**
 * @category getters
 * @since 1.0.0
 */
export const descriptor = <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>): Desc =>
  getDescriptor(messageSchema);

const mergeOptions = <A extends object>(defaults?: A, overrides?: A) =>
  Predicate.isUndefined(overrides)
    ? defaults
    : Predicate.isUndefined(defaults)
      ? overrides
      : { ...defaults, ...overrides };

const decodeFailure = (format: Format, descriptor: DescMessage, cause: unknown): DecodeError =>
  new DecodeError({
    format,
    messageType: descriptor.typeName,
    issue: Predicate.isError(cause) ? cause.message : `invalid ${format}`,
    cause,
  });

const encodeFailure = (format: Format, descriptor: DescMessage, cause: unknown): EncodeError =>
  new EncodeError({
    format,
    messageType: descriptor.typeName,
    issue: Predicate.isError(cause) ? cause.message : `invalid ${format}`,
    cause,
  });

/**
 * Bounds serialized input or output size and protobuf recursion depth.
 *
 * @category models
 * @since 1.0.0
 */
export interface Limits {
  /** Maximum binary input or output size in bytes. */
  readonly maxBytes?: number;
  /** Maximum nested-message recursion depth. */
  readonly maxDepth?: number;
}

/**
 * @category models
 * @since 1.0.0
 */
export interface BinaryDecodeOptions {
  /** Retains unknown wire fields so they can be re-encoded. */
  readonly retainUnknownFields?: boolean;
  /** Resolves and validates registered extensions. */
  readonly registry?: Registry;
  /** Bounds binary input size and nested-message depth. */
  readonly limits?: Limits;
}

/**
 * @category models
 * @since 1.0.0
 */
export interface BinaryEncodeOptions {
  /** Emits unknown wire fields retained during decoding. */
  readonly writeUnknownFields?: boolean;
  /** Bounds binary output size. */
  readonly limits?: Limits;
}

const validateBinaryExtensions = (
  descriptor: DescMessage,
  message: MessageShape<DescMessage>,
  registry?: Registry,
  maxDepth?: number,
): void => {
  if (Predicate.isUndefined(registry) || Predicate.isUndefined(message.$unknown)) {
    return;
  }
  for (const field of message.$unknown) {
    const extension = registry.getExtensionFor(descriptor, field.no);
    if (Predicate.isNotUndefined(extension)) {
      protobufGetExtension(message, extension, Predicate.isUndefined(maxDepth) ? {} : { recursionLimit: maxDepth });
    }
  }
};

const decodeBinaryUnsafe = <Desc extends DescMessage>(
  messageSchema: MessageSchema<Desc>,
  input: Uint8Array,
  options?: BinaryDecodeOptions,
): MessageShape<Desc> => {
  const messageDescriptor = getDescriptor(messageSchema);
  const maxBytes = options?.limits?.maxBytes;
  if (Predicate.isNotUndefined(maxBytes) && input.length > maxBytes) {
    throw new RangeError(`input exceeds maxBytes ${maxBytes}`);
  }
  const retainUnknownFields = options?.retainUnknownFields;
  const maxDepth = options?.limits?.maxDepth;
  const message = protobufFromBinary(messageDescriptor, input, {
    ...(Predicate.isUndefined(retainUnknownFields) ? {} : { readUnknownFields: retainUnknownFields }),
    ...(Predicate.isUndefined(maxDepth) ? {} : { recursionLimit: maxDepth }),
  });
  validateBinaryExtensions(messageDescriptor, message, options?.registry, maxDepth);
  return message;
};

/**
 * @category decoding
 * @since 1.0.0
 */
export const decodeBinaryEffect =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: BinaryDecodeOptions) =>
  (input: Uint8Array, inputOptions?: BinaryDecodeOptions): Effect.Effect<MessageShape<Desc>, DecodeError> =>
    Effect.try({
      try: () => decodeBinaryUnsafe(messageSchema, input, mergeOptions(options, inputOptions)),
      catch: (cause) => decodeFailure("binary", getDescriptor(messageSchema), cause),
    });

/**
 * @category decoding
 * @since 1.0.0
 */
export const decodeBinaryExit =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: BinaryDecodeOptions) =>
  (input: Uint8Array, inputOptions?: BinaryDecodeOptions): Exit.Exit<MessageShape<Desc>, DecodeError> =>
    Effect.runSync(decodeBinaryEffect(messageSchema, options)(input, inputOptions).pipe(Effect.exit));

/**
 * @category decoding
 * @since 1.0.0
 */
export const decodeBinaryOption =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: BinaryDecodeOptions) =>
  (input: Uint8Array, inputOptions?: BinaryDecodeOptions): Option.Option<MessageShape<Desc>> =>
    Effect.runSync(decodeBinaryEffect(messageSchema, options)(input, inputOptions).pipe(Effect.option));

/**
 * @category decoding
 * @since 1.0.0
 */
export const decodeBinaryResult =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: BinaryDecodeOptions) =>
  (input: Uint8Array, inputOptions?: BinaryDecodeOptions): Result.Result<MessageShape<Desc>, DecodeError> =>
    Effect.runSync(decodeBinaryEffect(messageSchema, options)(input, inputOptions).pipe(Effect.result));

/**
 * @category decoding
 * @since 1.0.0
 */
export const decodeBinaryPromise =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: BinaryDecodeOptions) =>
  (input: Uint8Array, inputOptions?: BinaryDecodeOptions): Promise<MessageShape<Desc>> =>
    Effect.runPromise(decodeBinaryEffect(messageSchema, options)(input, inputOptions));

/**
 * @category decoding
 * @since 1.0.0
 */
export const decodeBinarySync =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: BinaryDecodeOptions) =>
  (input: Uint8Array, inputOptions?: BinaryDecodeOptions): MessageShape<Desc> => {
    try {
      return decodeBinaryUnsafe(messageSchema, input, mergeOptions(options, inputOptions));
    } catch (cause) {
      throw decodeFailure("binary", getDescriptor(messageSchema), cause);
    }
  };

const encodeBinaryUnsafe = <Desc extends DescMessage>(
  messageSchema: MessageSchema<Desc>,
  value: MessageShape<Desc>,
  options?: BinaryEncodeOptions,
): Uint8Array => {
  const writeUnknownFields = options?.writeUnknownFields;
  const output = protobufToBinary(
    getDescriptor(messageSchema),
    value,
    Predicate.isUndefined(writeUnknownFields) ? {} : { writeUnknownFields },
  );
  const maxBytes = options?.limits?.maxBytes;
  if (Predicate.isNotUndefined(maxBytes) && output.length > maxBytes) {
    throw new RangeError(`output exceeds maxBytes ${maxBytes}`);
  }
  return output;
};

/**
 * @category encoding
 * @since 1.0.0
 */
export const encodeBinaryEffect =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: BinaryEncodeOptions) =>
  (value: MessageShape<Desc>, inputOptions?: BinaryEncodeOptions): Effect.Effect<Uint8Array, EncodeError> =>
    Effect.try({
      try: () => encodeBinaryUnsafe(messageSchema, value, mergeOptions(options, inputOptions)),
      catch: (cause) => encodeFailure("binary", getDescriptor(messageSchema), cause),
    });

/**
 * @category encoding
 * @since 1.0.0
 */
export const encodeBinaryExit =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: BinaryEncodeOptions) =>
  (value: MessageShape<Desc>, inputOptions?: BinaryEncodeOptions): Exit.Exit<Uint8Array, EncodeError> =>
    Effect.runSync(encodeBinaryEffect(messageSchema, options)(value, inputOptions).pipe(Effect.exit));

/**
 * @category encoding
 * @since 1.0.0
 */
export const encodeBinaryOption =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: BinaryEncodeOptions) =>
  (value: MessageShape<Desc>, inputOptions?: BinaryEncodeOptions): Option.Option<Uint8Array> =>
    Effect.runSync(encodeBinaryEffect(messageSchema, options)(value, inputOptions).pipe(Effect.option));

/**
 * @category encoding
 * @since 1.0.0
 */
export const encodeBinaryResult =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: BinaryEncodeOptions) =>
  (value: MessageShape<Desc>, inputOptions?: BinaryEncodeOptions): Result.Result<Uint8Array, EncodeError> =>
    Effect.runSync(encodeBinaryEffect(messageSchema, options)(value, inputOptions).pipe(Effect.result));

/**
 * @category encoding
 * @since 1.0.0
 */
export const encodeBinaryPromise =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: BinaryEncodeOptions) =>
  (value: MessageShape<Desc>, inputOptions?: BinaryEncodeOptions): Promise<Uint8Array> =>
    Effect.runPromise(encodeBinaryEffect(messageSchema, options)(value, inputOptions));

/**
 * @category encoding
 * @since 1.0.0
 */
export const encodeBinarySync =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: BinaryEncodeOptions) =>
  (value: MessageShape<Desc>, inputOptions?: BinaryEncodeOptions): Uint8Array => {
    try {
      return encodeBinaryUnsafe(messageSchema, value, mergeOptions(options, inputOptions));
    } catch (cause) {
      throw encodeFailure("binary", getDescriptor(messageSchema), cause);
    }
  };

/**
 * @category models
 * @since 1.0.0
 */
export interface JsonDecodeOptions {
  /** Ignores JSON fields that are absent from the message descriptor. */
  readonly ignoreUnknownFields?: boolean;
  /** Resolves extensions and `Any` message types. */
  readonly registry?: Registry;
}

/**
 * @category models
 * @since 1.0.0
 */
export interface JsonEncodeOptions {
  /** Emits fields with implicit protobuf defaults. */
  readonly emitDefaultValues?: boolean;
  /** Uses source `.proto` field names instead of lowerCamelCase JSON names. */
  readonly useProtoFieldName?: boolean;
  /** Resolves extensions and `Any` message types. */
  readonly registry?: Registry;
}

const decodeJsonUnsafe = <Desc extends DescMessage>(
  messageSchema: MessageSchema<Desc>,
  input: string,
  options?: JsonDecodeOptions,
): MessageShape<Desc> => protobufFromJsonString(getDescriptor(messageSchema), input, options);

/**
 * @category decoding
 * @since 1.0.0
 */
export const decodeJsonEffect =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: JsonDecodeOptions) =>
  (input: string, inputOptions?: JsonDecodeOptions): Effect.Effect<MessageShape<Desc>, DecodeError> =>
    Effect.try({
      try: () => decodeJsonUnsafe(messageSchema, input, mergeOptions(options, inputOptions)),
      catch: (cause) => decodeFailure("json", getDescriptor(messageSchema), cause),
    });

/**
 * @category decoding
 * @since 1.0.0
 */
export const decodeJsonExit =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: JsonDecodeOptions) =>
  (input: string, inputOptions?: JsonDecodeOptions): Exit.Exit<MessageShape<Desc>, DecodeError> =>
    Effect.runSync(decodeJsonEffect(messageSchema, options)(input, inputOptions).pipe(Effect.exit));

/**
 * @category decoding
 * @since 1.0.0
 */
export const decodeJsonOption =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: JsonDecodeOptions) =>
  (input: string, inputOptions?: JsonDecodeOptions): Option.Option<MessageShape<Desc>> =>
    Effect.runSync(decodeJsonEffect(messageSchema, options)(input, inputOptions).pipe(Effect.option));

/**
 * @category decoding
 * @since 1.0.0
 */
export const decodeJsonResult =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: JsonDecodeOptions) =>
  (input: string, inputOptions?: JsonDecodeOptions): Result.Result<MessageShape<Desc>, DecodeError> =>
    Effect.runSync(decodeJsonEffect(messageSchema, options)(input, inputOptions).pipe(Effect.result));

/**
 * @category decoding
 * @since 1.0.0
 */
export const decodeJsonPromise =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: JsonDecodeOptions) =>
  (input: string, inputOptions?: JsonDecodeOptions): Promise<MessageShape<Desc>> =>
    Effect.runPromise(decodeJsonEffect(messageSchema, options)(input, inputOptions));

/**
 * @category decoding
 * @since 1.0.0
 */
export const decodeJsonSync =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: JsonDecodeOptions) =>
  (input: string, inputOptions?: JsonDecodeOptions): MessageShape<Desc> => {
    try {
      return decodeJsonUnsafe(messageSchema, input, mergeOptions(options, inputOptions));
    } catch (cause) {
      throw decodeFailure("json", getDescriptor(messageSchema), cause);
    }
  };

const encodeJsonUnsafe = <Desc extends DescMessage>(
  messageSchema: MessageSchema<Desc>,
  value: MessageShape<Desc>,
  options?: JsonEncodeOptions,
): string => {
  const emitDefaultValues = options?.emitDefaultValues;
  const useProtoFieldName = options?.useProtoFieldName;
  return protobufToJsonString(getDescriptor(messageSchema), value, {
    ...(Predicate.isUndefined(emitDefaultValues) ? {} : { alwaysEmitImplicit: emitDefaultValues }),
    ...(Predicate.isUndefined(useProtoFieldName) ? {} : { useProtoFieldName }),
    ...(Predicate.isUndefined(options?.registry) ? {} : { registry: options.registry }),
  });
};

/**
 * @category encoding
 * @since 1.0.0
 */
export const encodeJsonEffect =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: JsonEncodeOptions) =>
  (value: MessageShape<Desc>, inputOptions?: JsonEncodeOptions): Effect.Effect<string, EncodeError> =>
    Effect.try({
      try: () => encodeJsonUnsafe(messageSchema, value, mergeOptions(options, inputOptions)),
      catch: (cause) => encodeFailure("json", getDescriptor(messageSchema), cause),
    });

/**
 * @category encoding
 * @since 1.0.0
 */
export const encodeJsonExit =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: JsonEncodeOptions) =>
  (value: MessageShape<Desc>, inputOptions?: JsonEncodeOptions): Exit.Exit<string, EncodeError> =>
    Effect.runSync(encodeJsonEffect(messageSchema, options)(value, inputOptions).pipe(Effect.exit));

/**
 * @category encoding
 * @since 1.0.0
 */
export const encodeJsonOption =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: JsonEncodeOptions) =>
  (value: MessageShape<Desc>, inputOptions?: JsonEncodeOptions): Option.Option<string> =>
    Effect.runSync(encodeJsonEffect(messageSchema, options)(value, inputOptions).pipe(Effect.option));

/**
 * @category encoding
 * @since 1.0.0
 */
export const encodeJsonResult =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: JsonEncodeOptions) =>
  (value: MessageShape<Desc>, inputOptions?: JsonEncodeOptions): Result.Result<string, EncodeError> =>
    Effect.runSync(encodeJsonEffect(messageSchema, options)(value, inputOptions).pipe(Effect.result));

/**
 * @category encoding
 * @since 1.0.0
 */
export const encodeJsonPromise =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: JsonEncodeOptions) =>
  (value: MessageShape<Desc>, inputOptions?: JsonEncodeOptions): Promise<string> =>
    Effect.runPromise(encodeJsonEffect(messageSchema, options)(value, inputOptions));

/**
 * @category encoding
 * @since 1.0.0
 */
export const encodeJsonSync =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: JsonEncodeOptions) =>
  (value: MessageShape<Desc>, inputOptions?: JsonEncodeOptions): string => {
    try {
      return encodeJsonUnsafe(messageSchema, value, mergeOptions(options, inputOptions));
    } catch (cause) {
      throw encodeFailure("json", getDescriptor(messageSchema), cause);
    }
  };

/**
 * @category models
 * @since 1.0.0
 */
export interface TextDecodeOptions {
  /** Maximum nested-message recursion depth. */
  readonly recursionLimit?: number;
  /** Resolves extensions and `Any` message types. */
  readonly registry?: Registry;
}

/**
 * @category models
 * @since 1.0.0
 */
export interface TextEncodeOptions {
  /** Includes retained unknown wire fields in the text output. */
  readonly printUnknownFields?: boolean;
  /** Resolves extensions and `Any` message types. */
  readonly registry?: Registry;
}

/**
 * @category decoding
 * @since 1.0.0
 */
export const decodeTextEffect =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: TextDecodeOptions) =>
  (input: string, inputOptions?: TextDecodeOptions): Effect.Effect<MessageShape<Desc>, DecodeError> =>
    Effect.try({
      try: () => protobufFromText(getDescriptor(messageSchema), input, mergeOptions(options, inputOptions)),
      catch: (cause) => decodeFailure("text", getDescriptor(messageSchema), cause),
    });

/**
 * @category decoding
 * @since 1.0.0
 */
export const decodeTextSync =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: TextDecodeOptions) =>
  (input: string, inputOptions?: TextDecodeOptions): MessageShape<Desc> => {
    try {
      return protobufFromText(getDescriptor(messageSchema), input, mergeOptions(options, inputOptions));
    } catch (cause) {
      throw decodeFailure("text", getDescriptor(messageSchema), cause);
    }
  };

/**
 * @category encoding
 * @since 1.0.0
 */
export const encodeTextEffect =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: TextEncodeOptions) =>
  (value: MessageShape<Desc>, inputOptions?: TextEncodeOptions): Effect.Effect<string, EncodeError> =>
    Effect.try({
      try: () => protobufToText(getDescriptor(messageSchema), value, mergeOptions(options, inputOptions)),
      catch: (cause) => encodeFailure("text", getDescriptor(messageSchema), cause),
    });

/**
 * @category encoding
 * @since 1.0.0
 */
export const encodeTextSync =
  <Desc extends DescMessage>(messageSchema: MessageSchema<Desc>, options?: TextEncodeOptions) =>
  (value: MessageShape<Desc>, inputOptions?: TextEncodeOptions): string => {
    try {
      return protobufToText(getDescriptor(messageSchema), value, mergeOptions(options, inputOptions));
    } catch (cause) {
      throw encodeFailure("text", getDescriptor(messageSchema), cause);
    }
  };

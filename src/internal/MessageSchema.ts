import {
  ScalarType,
  type DescEnum,
  type DescField,
  type DescMessage,
  type MessageInitShape,
  type MessageShape,
} from "@bufbuild/protobuf";
import { FeatureSet_FieldPresence, isWrapperDesc } from "@bufbuild/protobuf/wkt";
import { Array as Arr, Effect, Predicate, Schema } from "effect";
import type { Codec } from "effect/Schema";

export const ProtobufSchemaAnnotation = "protobuf-effect/message-schema";

export interface MessageSchema<Desc extends DescMessage> extends Codec<MessageShape<Desc>> {
  make(input: MessageInitShape<Desc>, options?: Schema.MakeOptions): MessageShape<Desc>;
}

const cache = new WeakMap<DescMessage, MessageSchema<DescMessage>>();

export const descriptor = <Desc extends DescMessage>(schema: MessageSchema<Desc>): Desc =>
  Schema.resolveAnnotations(schema)?.[ProtobufSchemaAnnotation] as Desc;

const scalar = (type: ScalarType, longAsString = false): Schema.Constraint => {
  if (type === ScalarType.INT32 || type === ScalarType.SINT32 || type === ScalarType.SFIXED32) {
    return Schema.Int.check(Schema.isInt32());
  }
  if (type === ScalarType.UINT32 || type === ScalarType.FIXED32) {
    return Schema.Int.check(Schema.isUint32());
  }
  if (type === ScalarType.INT64 || type === ScalarType.SINT64 || type === ScalarType.SFIXED64) {
    if (longAsString) {
      return Schema.String;
    }
    return Schema.BigInt.check(
      Schema.isBetweenBigInt({ minimum: -9_223_372_036_854_775_808n, maximum: 9_223_372_036_854_775_807n }),
    );
  }
  if (type === ScalarType.UINT64 || type === ScalarType.FIXED64) {
    if (longAsString) {
      return Schema.String;
    }
    return Schema.BigInt.check(Schema.isBetweenBigInt({ minimum: 0n, maximum: 18_446_744_073_709_551_615n }));
  }
  if (type === ScalarType.BOOL) {
    return Schema.Boolean;
  }
  if (type === ScalarType.STRING) {
    return Schema.String;
  }
  if (type === ScalarType.BYTES) {
    return Schema.Uint8Array;
  }
  return Schema.Number;
};

const scalarDefault = (field: Extract<DescField, { readonly fieldKind: "scalar" }>): unknown => {
  if (field.scalar === ScalarType.STRING) {
    return "";
  }
  if (field.scalar === ScalarType.BOOL) {
    return false;
  }
  if (field.scalar === ScalarType.BYTES) {
    return new Uint8Array(0);
  }
  if (
    !field.longAsString &&
    (field.scalar === ScalarType.INT64 ||
      field.scalar === ScalarType.UINT64 ||
      field.scalar === ScalarType.SINT64 ||
      field.scalar === ScalarType.FIXED64 ||
      field.scalar === ScalarType.SFIXED64)
  ) {
    return 0n;
  }
  return field.longAsString ? "0" : 0;
};

const constructorDefault = (schema: Schema.Constraint, make: () => unknown): Schema.Constraint =>
  Schema.withConstructorDefault(Effect.sync(make))(
    schema as Schema.Constraint & Schema.WithoutConstructorDefault,
  ) as Schema.Constraint;

const enumeration = (descriptor: DescEnum): Schema.Constraint =>
  descriptor.open
    ? Schema.Int.check(Schema.isInt32())
    : Schema.Literals(Arr.map(descriptor.values, (value) => value.number));

type SingularField = Exclude<DescField, { readonly fieldKind: "list" | "map" }>;

const singular = (field: SingularField): Schema.Constraint => {
  if (field.fieldKind === "scalar") {
    return scalar(field.scalar, field.longAsString);
  }
  if (field.fieldKind === "enum") {
    return enumeration(field.enum);
  }
  return isWrapperDesc(field.message) ? scalar(field.message.fields[0].scalar) : make(field.message);
};

const value = (field: DescField): Schema.Constraint => {
  if (field.fieldKind === "scalar" || field.fieldKind === "enum" || field.fieldKind === "message") {
    return singular(field);
  }
  if (field.fieldKind === "list") {
    return Schema.Array(
      field.listKind === "scalar"
        ? scalar(field.scalar, field.longAsString)
        : field.listKind === "enum"
          ? enumeration(field.enum)
          : isWrapperDesc(field.message)
            ? scalar(field.message.fields[0].scalar)
            : make(field.message),
    );
  }
  return Schema.Record(
    Schema.String,
    field.mapKind === "scalar"
      ? scalar(field.scalar)
      : field.mapKind === "enum"
        ? enumeration(field.enum)
        : make(field.message),
  );
};

const oneof = (fields: ReadonlyArray<DescField>): Schema.Constraint => {
  const members: Array<Schema.Constraint> = [Schema.Struct({ case: Schema.Undefined })];
  for (const field of fields) {
    members.push(Schema.Struct({ case: Schema.Literal(field.localName), value: singular(field as SingularField) }));
  }
  return constructorDefault(Schema.Union(members), () => ({ case: undefined }));
};

export const make = <Desc extends DescMessage>(descriptor: Desc): MessageSchema<Desc> => {
  const cached = cache.get(descriptor);
  if (Predicate.isNotUndefined(cached)) {
    return cached as MessageSchema<Desc>;
  }

  let resolved: MessageSchema<DescMessage>;
  const suspended = Schema.suspend(() => resolved) as unknown as MessageSchema<DescMessage>;
  cache.set(descriptor, suspended);

  const fields: Record<string, Schema.Constraint> = {
    $typeName: constructorDefault(Schema.Literal(descriptor.typeName), () => descriptor.typeName),
    $unknown: Schema.optionalKey(Schema.Unknown),
  };
  for (const member of descriptor.members) {
    if (member.kind === "oneof") {
      fields[member.localName] = oneof(member.fields);
      continue;
    }
    const fieldSchema = value(member);
    fields[member.localName] = fieldSchema;
    if (member.fieldKind === "list") {
      fields[member.localName] = constructorDefault(fieldSchema, () => []);
    } else if (member.fieldKind === "map") {
      fields[member.localName] = constructorDefault(fieldSchema, () => ({}));
    } else if (member.presence === FeatureSet_FieldPresence.EXPLICIT) {
      fields[member.localName] = Schema.optionalKey(fieldSchema);
    } else if (member.presence === FeatureSet_FieldPresence.LEGACY_REQUIRED) {
      fields[member.localName] = fieldSchema;
    } else {
      fields[member.localName] =
        member.fieldKind === "scalar"
          ? constructorDefault(fieldSchema, () => scalarDefault(member))
          : constructorDefault(
              fieldSchema,
              () => (member as Extract<DescField, { readonly fieldKind: "enum" }>).enum.values[0]!.number,
            );
    }
  }

  resolved = Schema.Struct(fields).annotate({
    [ProtobufSchemaAnnotation]: descriptor,
  }) as unknown as MessageSchema<DescMessage>;
  cache.set(descriptor, resolved);
  return resolved as MessageSchema<Desc>;
};

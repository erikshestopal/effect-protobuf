import { assert, describe, it } from "@effect/vitest";
import { spawnSync } from "node:child_process";
import { Option, Result, Schema } from "effect";
import * as Protobuf from "protobuf-effect/Protobuf";
import { EditionMessage } from "./generator/gen/edition_2023_pb.ts";
import { Legacy } from "./generator/gen/legacy_pb.ts";
import * as Representative from "./generator/gen/representative_pb.ts";
import { Node, Node_Detail, NodeService } from "./generator/gen/representative_pb.ts";

describe("protoc-gen-effect", () => {
  it("is executable by protoc and reproduces the checked-in golden", () => {
    const result = spawnSync(new URL("./generator/generate.sh", import.meta.url).pathname);
    assert.strictEqual(result.status, 0, result.stderr.toString());
  });

  it("generates protobuf-es message types with derived Effect Schemas", () => {
    assert.notProperty(Representative, "NodeSchema");
    assert.notProperty(Representative, "Node_DetailSchema");
    const value = Node.make({
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

    assert.isTrue(Schema.is(Node)(value));
    const binary = Protobuf.encodeBinarySync(Node)(value);
    const decoded = Protobuf.decodeBinarySync(Node)(binary);
    assert.isTrue(Schema.is(Node)(decoded));
    assert.isTrue(Schema.is(Node_Detail)(decoded.detail));
    assert.strictEqual(decoded.detail?.note, "nested");
    assert.strictEqual(decoded.child?.id, 21);
    assert.deepStrictEqual(decoded.child?.tags, []);
    assert.strictEqual(decoded.importedDetail?.value, "cross-file");
    assert.strictEqual(decoded.counters.visits, 9n);
    assert.isTrue(Option.isNone(Node.makeOption({ id: 1.5 })));
    assert.throws(() => Node.make({ id: 1.5 }));
    const annotated = Node.annotate({ description: "annotated" }) as typeof Node;
    const annotatedValue = annotated.make({ id: 1 });
    assert.deepStrictEqual(annotatedValue.tags, []);
    assert.deepStrictEqual(
      Protobuf.decodeBinarySync(annotated)(Protobuf.encodeBinarySync(annotated)(annotatedValue)).tags,
      [],
    );
    const checked = Node.check(Schema.makeFilter((node) => node.id >= 0)) as typeof Node;
    assert.deepStrictEqual(checked.make({ id: 1 }).counters, {});
    assert.throws(() => checked.make({ id: -1 }));

    const json = Protobuf.encodeJsonSync(Node)(value);
    assert.isTrue(Schema.is(Node)(Protobuf.decodeJsonSync(Node)(json)));
    const text = Protobuf.encodeTextSync(Node)(value);
    assert.isTrue(Schema.is(Node)(Protobuf.decodeTextSync(Node)(text)));
  });

  it("preserves proto2, Editions, service, merge, oneof, map, packing, and unknown-field semantics", () => {
    const legacy = Legacy.make({ id: 7, values: [1, 2] });
    assert.isTrue(Schema.is(Legacy)(legacy));
    assert.deepStrictEqual(Protobuf.decodeBinarySync(Legacy)(Protobuf.encodeBinarySync(Legacy)(legacy)).values, [1, 2]);
    const legacyDescriptor = Protobuf.descriptor(Legacy);
    const legacyState = legacyDescriptor.field.state;
    const legacyValues = legacyDescriptor.field.values;
    assert.strictEqual(legacyState.fieldKind, "enum");
    assert.isTrue(legacyState.fieldKind === "enum" && !legacyState.enum.open);
    assert.isTrue(legacyValues.fieldKind === "list" && !legacyValues.packed);

    const edition = EditionMessage.make({ name: "edition", values: [1, 2], state: 1 });
    assert.isTrue(Schema.is(EditionMessage)(edition));
    const editionValues = Protobuf.descriptor(EditionMessage).field.values;
    assert.isTrue(editionValues.fieldKind === "list" && editionValues.packed);

    assert.strictEqual(NodeService.typeName, "generator.test.NodeService");
    assert.strictEqual(NodeService.method.get.input.typeName, "generator.test.Node");
    assert.strictEqual(NodeService.method.get.output.typeName, "generator.imported.Detail");
    assert.strictEqual(NodeService.method.watch.methodKind, "server_streaming");

    const stringLongs = Node.make({
      id: 1,
      signedString: "-1",
      unsignedString: "1",
      wrapperCounters: { count: { value: 1 } },
    });
    assert.strictEqual(stringLongs.signedString, "-1");
    assert.strictEqual(stringLongs.unsignedString, "1");
    assert.strictEqual(stringLongs.wrapperCounters.count?.value, 1);

    const merged = Protobuf.decodeBinarySync(Node)(Uint8Array.of(0x4a, 0x02, 0x08, 0x15, 0x4a, 0x03, 0x12, 0x01, 0x78));
    assert.strictEqual(merged.child?.id, 21);
    assert.strictEqual(merged.child?.label, "x");

    const oneof = Protobuf.decodeBinarySync(Node)(Uint8Array.of(0x32, 0x01, 0x61, 0x38, 0x05)).contact;
    assert.deepStrictEqual(oneof, { case: "phone", value: 5n });
    const map = Protobuf.decodeBinarySync(Node)(
      Uint8Array.of(0x2a, 0x05, 0x0a, 0x01, 0x6b, 0x10, 0x01, 0x2a, 0x05, 0x0a, 0x01, 0x6b, 0x10, 0x02),
    );
    assert.strictEqual(map.counters.k, 2n);

    const packed = Protobuf.decodeBinarySync(Legacy)(
      Uint8Array.of(0x08, 0x01, 0x20, 0x01, 0x22, 0x02, 0x02, 0x03, 0x20, 0x04),
    );
    assert.deepStrictEqual(packed.values, [1, 2, 3, 4]);

    const unknownInput = Uint8Array.of(0x98, 0x06, 0x01, 0x08, 0x2a);
    const unknown = Protobuf.decodeBinarySync(Node)(unknownInput);
    assert.deepStrictEqual(Protobuf.encodeBinarySync(Node)(unknown), Uint8Array.of(0x08, 0x2a, 0x98, 0x06, 0x01));
  });

  it("uses protobuf-es ProtoJSON validation and typed Effect failures", () => {
    assert.isTrue(Result.isFailure(Protobuf.decodeJsonResult(Node)('{"bogus":1}')));
    assert.strictEqual(Protobuf.decodeJsonSync(Node)('{"bogus":1}', { ignoreUnknownFields: true }).id, 0);
    assert.isTrue(Result.isFailure(Protobuf.decodeJsonResult(Node)('{"email":"a","phone":"5"}')));
    assert.isTrue(Result.isFailure(Protobuf.decodeJsonResult(Node)('{"id":1.5}')));
  });
});

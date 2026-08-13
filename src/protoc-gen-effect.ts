#!/usr/bin/env -S node --import=tsx
import { createFileRegistry, create, type DescMessage } from "@bufbuild/protobuf";
import { FileDescriptorSetSchema } from "@bufbuild/protobuf/wkt";
import type { Plugin } from "@bufbuild/protoplugin";
import { runNodeJs } from "@bufbuild/protoplugin";
import { protocGenEs } from "@bufbuild/protoc-gen-es/dist/cjs/src/protoc-gen-es-plugin.js";
import { Array as Arr, Predicate, String as Str } from "effect";

const generatedName = (message: DescMessage): string => {
  const names = [message.name];
  let parent = message.parent;
  while (Predicate.isNotUndefined(parent)) {
    names.unshift(parent.name);
    parent = parent.parent;
  }
  return Arr.join(names, "_");
};

const protocGenEffect: Plugin = {
  name: "protoc-gen-effect",
  version: "v0.0.0-beta",
  run(request) {
    const response = protocGenEs.run(request);
    const registry = createFileRegistry(create(FileDescriptorSetSchema, { file: request.protoFile }));
    for (const output of response.file) {
      if (
        Predicate.isUndefined(output.name) ||
        Predicate.isUndefined(output.content) ||
        !Str.endsWith("_pb.ts")(output.name)
      ) {
        continue;
      }
      const sourceName = `${output.name.slice(0, -"_pb.ts".length)}.proto`;
      if (!Arr.contains(request.fileToGenerate, sourceName)) {
        continue;
      }
      const messages: Array<DescMessage> = [];
      for (const descriptor of registry) {
        if (descriptor.kind === "message" && `${descriptor.file.name}.proto` === sourceName) {
          messages.push(descriptor);
        }
      }
      if (messages.length === 0) {
        continue;
      }
      output.content += '\nimport * as Protobuf from "effect-protobuf/Protobuf";\n';
      for (const message of messages) {
        const name = generatedName(message);
        output.content += `export const ${name} = Protobuf.schema(${name}Schema);\n`;
      }
    }
    return response;
  },
};

runNodeJs(protocGenEffect);

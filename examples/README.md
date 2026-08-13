# Generated SDK example

This directory is a small consumer package. From the repository root:

```sh
vp run example:generate
vp run example
```

`generate.sh` demonstrates the standard `protoc` plugin protocol. An equivalent direct command is:

```sh
protoc -I examples/proto \
  --plugin=protoc-gen-effect=./src/protoc-gen-effect.ts \
  --effect_out=target=ts:examples/src/gen address_book.proto
```

Buf uses `buf.yaml` and `buf.gen.yaml`:

```sh
cd examples
buf generate
```

The generated class is an Effect Schema and is passed to the public `Protobuf` operations; generated files do not contain serialization methods.

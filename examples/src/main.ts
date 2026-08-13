import { Effect } from "effect";
import * as Protobuf from "protobuf-effect/Protobuf";
import { Person } from "./gen/address_book_pb.ts";

const program = Effect.gen(function* () {
  const person = Person.make({ name: "Ada", email: "ada@example.com", labels: ["compiler"] });
  const bytes = Protobuf.encodeBinarySync(Person)(person);
  const decoded = Protobuf.decodeBinarySync(Person)(bytes);

  yield* Effect.log(Protobuf.encodeJsonSync(Person)(decoded));
});

Effect.runFork(program);

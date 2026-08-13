# effect-protobuf

Single-package Effect TS project using Bun for dependency installation, Vite+ (`vp`), TypeScript 7 RC, tsgo, oxlint, Vitest, and ast-grep.

## Project Intent

- Read `PLAN.md` before designing or implementing protobuf APIs, generated code, descriptors, codecs, conformance infrastructure, or performance work.
- Treat `PLAN.md` as the source of truth for project goals, invariants, public interface, generated-code shape, and implementation sequence. Update it when a settled design decision changes.

## Conventions

- All source and test code lives under `src` and `test`.
- All code must compile with `exactOptionalPropertyTypes`; omit absent optional properties instead of assigning `undefined`.
- Never use plain JavaScript classes. Classes must be native Effect abstractions such as `Schema.Class`, `Data.TaggedError`, or `Context.Service`; operation-local mutable state must be created and encapsulated by Effect.
- Use Effect APIs and data types first; avoid native JS helpers where ast-grep rules enforce Effect alternatives.
- Prefer one options object over multiple positional parameters for exported functions.
- Tests use `@effect/vitest`, `it.effect`, and `assert`.
- Typecheck with `vp run typecheck` (`tsgo --noEmit`); do not use `tsc`.
- This template intentionally has no build/emit path yet.

## Commands

- `vp run --log labeled check:all` — lint + ast-grep + tests + `tsgo --noEmit`.
- `vp run typecheck` — typecheck only with `tsgo --noEmit`.
- `sg scan src test` — ast-grep rules only.
- `buf lint test/conformance/proto --exclude-path test/conformance/proto/google/protobuf` — lint conformance protobuf sources.
- `vp test run` — tests only.

After every code-writing pass, run `vp run check` to apply formatting and lint fixes and validate the complete project.

Pre-commit hook runs `vp staged` (`vp check --fix` on staged files).

## Vendored Reference Sources

- Treat source code under `repos/` as read-only reference material; do not modify it directly.
- When working with Effect v4 code, consult `repos/effect-v4` for local research and align implementations with its patterns and best practices.
- Use `repos/protobuf-es` as the primary TypeScript reference for protobuf conformance, descriptors, Editions, generation, codec algorithms, tests, and portable performance patterns.
- Use `repos/protobuf-py` as an independent conformance and descriptor reference and as research material for optional Rust acceleration.

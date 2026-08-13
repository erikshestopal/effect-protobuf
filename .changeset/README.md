# Changesets

Every user-visible change should include a changeset:

```sh
bun run changeset
```

Choose `patch`, `minor`, or `major` according to semantic versioning and describe the change for package users. Before publishing, run `bun run version`, review the generated version and changelog, then run `bun run release`.

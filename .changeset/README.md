# Changesets

Every user-visible change should include a changeset:

```sh
vp run changeset
```

Choose `patch`, `minor`, or `major` according to semantic versioning and describe the change for package users. Before publishing, run `vp run version`, review the generated version and changelog, then run `vp run release`.

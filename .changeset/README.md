This folder is used by Changesets.

Project workflow:

1. Run `npm run changeset` for every user-facing change.
2. Commit the generated markdown file in this folder.
3. Merge to `main`.
4. The Changesets release workflow opens or updates a release PR.
5. When that PR is merged, package versions, changelog entries, and npm publish are handled automatically.

Notes:

- Summary text in each changeset becomes the basis for changelog entries.
- Use `patch`, `minor`, and `major` intentionally.
- Docs-only or internal-only changes do not always need a changeset.

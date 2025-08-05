# Publishing

We decided to use `changeset` to manage our versions and release cycle. The new release pipeline should work as follows.

- First all contributions should go to the `next` branch, either internal or community. This will allow us to create a backlog of changes for the new releases of the plugins.

- When we decided to release the changes in `next`, the developer responsible for that should create a new changeset. This will prompt some questions on what versions to bump, and the summary of the changes. It will generate a temporary file for the changelog.

```shell
> yarn changeset
```

- After generating the changeset we should merge `next` into `main`. Altho this will send the code to `main` the release won't happen immediately. If everything works as expected, Github Actions will create a new PR with the new versions of all affected plugins and updated CHANGELOG.

- In order to _actually_ release the plugins we just need to merge this new PR into `main`, which will automatically detect the versions missing in **npmjs** and publish them.

### Caveat

Currently we're using `yarn` and `changeset`, to build the project and manage releases, respectively. The problem is that `changeset` does not work with `yarn` yet (or ever, follow this [PR](https://github.com/changesets/changesets/pull/674) to know more). The issue now, is that because we're leveraging yarn workspace's feature Workspace Protocol to reference packages internally, and because `changeset` uses `npm`, the replacement for real semversions never happens. To workaround it, for now, we'll be using the `/scripts/replace-versions.js` script that tries to simulate the same behavior during `prepack`.

# Publishing

We decided to use `changeset` to manage our versions and release cycle. The new release pipeline should work as follows.

- First all contributions should go to the `next` branch, either internal or community. This will allow us to create a backlog of changes for the new releases of the plugins.

- When we decided to release the changes in `next`, the developer responsible for that should create a new changeset. This will prompt some questions on what versions to bump, and the summary of the changes. It will generate a temporary file for the changelog.

```shell
> yarn changeset
```

- After generating the changeset we should merge `next` into `main`. Altho this will send the code to `main` the release won't happen immediately. If everything works as expected, Github Actions will create a new PR with the new versions of all affected plugins and updated CHANGELOG.

- In order to _actually_ release the plugins we just need to merge this new PR into `main`, which will automatically detect the versions missing in **npmjs** and publish them.
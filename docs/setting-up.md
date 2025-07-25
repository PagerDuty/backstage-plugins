# Setting up

Install all the dependencies.
```shell
yarn install
```

Build the entire plugin ecosystem.
```shell
yarn build
```

Before starting the Backstage instance make sure you have the correct environment variables set for testing.

```shell
export PAGERDUTY_CLIENT_ID=<your_oauth_2_client_id>
export PAGERDUTY_CLIENT_SECRET=<your_oauth_2_client_secret>
export PAGERDUTY_SUBDOMAIN=<your_pd_subdomain>
```

Also, you should update your `examples/entities.yaml` file to use your own service ID.

Then, run the backstage instance.
```shell
yarn start
```

## Running single plugins

If instead of running the entire project you just want to run a specific plugin you can simply run:

```
yarn --cwd plugins/<name-of-the-plugin> start
```

This will provide you hot reload, which makes developing more comfortable.
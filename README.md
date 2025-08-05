# [Backstage](https://backstage.io)

**Bring the power of PagerDuty to Backstage!**

## Monorepo composition

### Plugins

#### `backstage-plugin`

The PagerDuty plugin reduces the cognitive load on developers responsible for maintaining services in production. Instead of having to go to PagerDuty's console, you can now access the necessary information directly within Backstage. This includes finding active incidents or opening a new incident, reviewing recent changes made to the service, and checking who is on-call.

#### `backstage-plugin-backend`

The PagerDuty backend plugin augments the capabilities of the PagerDuty frontend plugin (`backstage-plugin`) by improving security and enabling PagerDuty a standardization through easy configuration.

#### `backstage-plugin-entity-processor`

The PagerDuty Entity Processor package allows users to map their existing PagerDuty services to existing Backstage entities by leveraging point and click instead of updating all configuration files on every single service. We will make the necessary changes to the configuration files for you automatically. With this we want to ease the path for existing PagerDuty customers to integrate easily with Backstage and smoothly transition to a configuration based approach.

#### `backstage-plugin-scaffolder-actions`

The PagerDuty Scaffolder Actions package allows users to create services in PagerDuty directly from their Software Templates in a single step by leveraging the pagerduty:service:create custom action.

#### `backstage-plugin-common`

Provides plugin-shared TS types.

## Setting up the project

Check [Setting Up](./docs/setting-up.md) for information about how to set up the project.

## Contributing

**TODO**: Please update this section correctly before we publicly announce this repository.

## Publishing packages

Check [Publishing](./docs/publishing.md) for informations about how to publish new plugin version.

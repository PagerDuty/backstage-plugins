# PagerDuty plugin for Backstage - Entity Processor

[![Release](https://github.com/PagerDuty/backstage-plugin-entity-processor/actions/workflows/on_release_created.yml/badge.svg)](https://github.com/PagerDuty/backstage-plugin-entity-processor/actions/workflows/on_release_created.yml)
[![npm version](https://badge.fury.io/js/@pagerduty%2Fbackstage-plugin-entity-processor.svg)](https://badge.fury.io/js/@pagerduty%2Fbackstage-plugin--entity-processor)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**Bring the power of PagerDuty to Backstage!**
The PagerDuty plugin reduces the cognitive load on developers responsible for maintaining services in production. Instead of having to go to PagerDuty's console, you can now access the necessary information directly within Backstage. This includes finding active incidents or opening a new incident, reviewing recent changes made to the service, and checking who is on-call.

The PagerDuty Entity Processor package allows users to map their existing PagerDuty services to existing Backstage entities by leveraging point and click instead of updating all configuration files on every single service. We will make the necessary changes to the configuration files for you automatically. With this we want to ease the path for existing PagerDuty customers to integrate easily with Backstage and smoothly transition to a configuration based approach.

## Features

- **Entity processor** This feature augments Backstage entities with the appropiate PagerDuty annotations to allow easy mapping between Backstage entities and existing PagerDuty services.

## Getting Started

Find the complete project's documentation [here](https://pagerduty.github.io/backstage-plugin-docs/).

### Installation

The installation of the PagerDuty plugin for Backstage is done with *yarn* as all other plugins in Backstage. This plugin follows a modular approach which means that every individual component will be a separate package (e.g. frontend, backend, common). In this case, you are installing a **backend plugin**.

To install this plugin run the following command from the Backstage root folder.

```bash
yarn add --cwd packages/backend @pagerduty/backstage-plugin-entity-processor
```

### Configuration

To configure the entity processor plugin follow the instructions on the project's documentation [here](https://pagerduty.github.io/backstage-plugin-docs/).

## Support

If you need help with this plugin, please open an issue in [GitHub](https://github.com/PagerDuty/backstage-plugin-entity-provider), reach out on the [Backstage Discord server](https://discord.gg/backstage-687207715902193673) or [PagerDuty's community forum](https://community.pagerduty.com).

## Contributing

If you are interested in contributing to this project, please refer to our [Contributing Guidelines](https://github.com/PagerDuty/backstage-plugin-backend/blob/main/CONTRIBUTING.md).

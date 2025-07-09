# PagerDuty plugin for Backstage - Scaffolder Actions

[![Release](https://github.com/PagerDuty/backstage-plugin-scaffolder-actions/actions/workflows/on_release_created.yml/badge.svg)](https://github.com/PagerDuty/backstage-plugin-scaffolder-actions/actions/workflows/on_release_created.yml)
[![npm version](https://badge.fury.io/js/@pagerduty%2Fbackstage-plugin-scaffolder-actions.svg)](https://badge.fury.io/js/@pagerduty%2Fbackstage-plugin--scaffolder-actions)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**Bring the power of PagerDuty to Backstage!**
The PagerDuty plugin reduces the cognitive load on developers responsible for maintaining services in production. Instead of having to go to PagerDuty's console, you can now access the necessary information directly within Backstage. This includes finding active incidents or opening a new incident, reviewing recent changes made to the service, and checking who is on-call.

The PagerDuty Scaffolder Actions package allows users to create services in PagerDuty directly from their Software Templates in a single step by leveraging the `pagerduty:service:create` custom action.

## Features

- **Scaffolder Action for creating services** This feature enables teams to create project templates that automatically generate a corresponding service in PagerDuty. These services come with a built-in integration to Backstage, which conveniently configures the frontend plugin for your service.

## Getting Started

Find the complete project's documentation [here](https://pagerduty.github.io/backstage-plugin-docs/).

### Installation

The installation of the PagerDuty plugin for Backstage is done with _yarn_ as all other plugins in Backstage. This plugin follows a modular approach which means that every individual component will be a separate package (e.g. frontend, backend, common). In this case, you are installing a **backend plugin**.

To install this plugin run the following command from the Backstage root folder.

```bash
yarn add --cwd packages/backend @pagerduty/backstage-plugin-scaffolder-actions @pagerduty/backstage-plugin-common
```

### Configuration

To use the custom actions as part of your custom project templates follow the instructions on the `Create PagerDuty service with Software Templates` section of the project's documentation [here](https://pagerduty.github.io/backstage-plugin-docs/advanced/create-service-software-template/).

## Support

If you need help with this plugin, please open an issue in [GitHub](https://github.com/PagerDuty/backstage-plugin-scaffolder-actions), reach out on the [Backstage Discord server](https://discord.gg/backstage-687207715902193673) or [PagerDuty's community forum](https://community.pagerduty.com).

## Contributing

If you are interested in contributing to this project, please refer to our [Contributing Guidelines](https://github.com/PagerDuty/backstage-plugin-backend/blob/main/CONTRIBUTING.md).

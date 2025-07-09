# PagerDuty plugin for Backstage - Backend

[![Release](https://github.com/PagerDuty/backstage-plugin-backend/actions/workflows/on_release_created.yml/badge.svg)](https://github.com/PagerDuty/backstage-plugin-backend/actions/workflows/on_release_created.yml)
[![npm version](https://badge.fury.io/js/@pagerduty%2Fbackstage-plugin-backend.svg)](https://badge.fury.io/js/@pagerduty%2Fbackstage-plugin-backend)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**Bring the power of PagerDuty to Backstage!**
The PagerDuty backend plugin reduces the cognitive load on developers responsible for maintaining services in production. Instead of having to go to PagerDuty's console, you can now access the necessary information directly within Backstage. This includes finding active incidents or opening a new incident, reviewing recent changes made to the service, and checking who is on-call.

The PagerDuty backend plugin augments the capabilities of the [PagerDuty frontend plugin](https://github.com/PagerDuty/backstage-plugin) by improving security and enabling PagerDuty a standardization through easy configuration.

## Features

- **REST APIs** The backend is responsible for all requests to PagerDuty REST APIs. Centralizing these in the backend plugin allows us to only expose the information the frontend needs and therefore improve security and performance.

## Getting Started

Find the complete project's documentation [here](https://pagerduty.github.io/backstage-plugin-docs/).

### Installation

The installation of the PagerDuty plugin for Backstage is done with *yarn* as all other plugins in Backstage. This plugin follows a modular approach which means that every individual component will be a separate package (e.g. frontend, backend, common). In this case, you are installing a **backend plugin**.

To install this plugin run the following command from the Backstage root folder.

```bash
yarn add --cwd packages/backend @pagerduty/backstage-plugin-backend @pagerduty/backstage-plugin-common
```

### Configuration

To use the backend plugin follow the instructions on the `Add the backend plugin to your application` section of the project's documentation [here](https://pagerduty.github.io/backstage-plugin-docs/getting-started/backstage/#add-the-backend-plugin-to-your-application).

## Support

If you need help with this plugin, please open an issue in [GitHub](https://github.com/PagerDuty/backstage-plugin-backend), reach out on the [Backstage Discord server](https://discord.gg/backstage-687207715902193673) or [PagerDuty's community forum](https://community.pagerduty.com).

## Contributing

If you are interested in contributing to this project, please refer to our [Contributing Guidelines](https://github.com/PagerDuty/backstage-plugin-backend/blob/main/CONTRIBUTING.md).

<a href="https://next.ossinsight.io/widgets/official/compose-contributors?limit=30&repo_id=721084927" target="_blank" style="display: block" align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://next.ossinsight.io/widgets/official/compose-contributors/thumbnail.png?limit=30&repo_id=721084927&image_size=auto&color_scheme=dark" width="655" height="auto">
    <img alt="Contributors of PagerDuty/backstage-plugin-backend" src="https://next.ossinsight.io/widgets/official/compose-contributors/thumbnail.png?limit=30&repo_id=721084927&image_size=auto&color_scheme=light" width="655" height="auto">
  </picture>
</a>

<!-- Made with [OSS Insight](https://ossinsight.io/) -->

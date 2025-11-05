# Backstage/Portal + PagerDuty Benefits

- Display relevant PagerDuty information about an entity within Backstage or Portal, such as active incidents or recent changes.
- Quickly check who is on call for a service.
- Trigger an incident to the current on-call responder(s) for a service.
- Easily map PagerDuty Services to Backstage or Portal entities.
- Map service dependencies with either Backstage/Portal or PagerDuty as the source of truth.

# Requirements

## To Configure the Integration

**In Backstage**

- Administrator access to install new plugins
  **In PagerDuty**
- Account owner or global admin access to install new integrations

## To Use the Integration

Access to the Backstage or Portal instance

# How it Works

- Services are mapped between Backstage/Portal and PagerDuty.
- Information related to your PagerDuty services are available within Backstage/Portal.
- Data syncs automatically run on regular intervals to ensure mapped data is kept up to date.

# Version

There are two versions of the plugin:

- **Backstage**: Open source plugin.
- **Portal**: Paid/hosted version of Backstage.

# Integration Walkthrough

## In PagerDuty

1. From the top menu, navigate to **Integrations** :fa-arrow-right: **Developer Tools** :fa-arrow-right: **App Registration**.

2. Click **New App** and perform the following:
   1. **Name**: Enter a name for the app.
   2. **Description**: Enter a description for the app.
3. **OAuth 2.0**: Check the OAuth 2.0 check-box.
4. Click **Next**.
5. On the next screen, select **Scoped OAuth** as the preferred authorization mechanism.
6. In the **Permission Scope** section we recommend selecting the following permissions to ensure that the plugin works as expected: 1. `abilities.read` (Used in scaffolder only) 2. `Analytics.read` 3. `Escalation_policies.read` 4. `Incidents.read` 5. `Oncalls.read` 6. `Schedules.read` 7. `Services.read` 8. `services.write` (Used in scaffolder only) 9. `Standards.read` 10. `Teams.read` 11. `Users.read` 12. `vendors.read` (Used in scaffolder only)

> 🚧 Warning
>
> You don't have to assign all the above permissions to your application, but not doing so might prevent the plugin from running as expected, and you might see errors on the PagerDuty card. 6. Once you’ve selected permissions scopes, click **Register App**. 7. Copy the **Client ID** and **Client Secret** and store them somewhere safe. You will use them later when configuring Backstage.

## Install the PagerDuty Plugin

You can install the PagerDuty plugin in Backstage or in Portal using instructions in the following sections:

- [In Backstage](#in-backstage)
- [In Portal](#in-portal)

## In Portal

To make the plugin visible on your Portal instance, you will need to install it first. The way this works in Portal is that it references the name of the plugin package, and Portal will manage it for you - it will install the latest version and refer to related plugins.
Our main plugin is `@pagerduty/backstage-plugin`. By including this one, you will have `@pagerduty/backstage-plugin-backend` presented for installation too.  
To install in Portal:

Navigate to**Plugins** :fa-arrow-right: **Install Plugin**.

Add `@pagerduty/backstage-plugin` to the **Package Name** input.

3. There are two other plugins (backend modules) necessary to have the full suite of features exposed by `@pagerduty/backstage-plugin`:
   `@pagerduty/backstage-plugin-entity-processor`
   `@pagerduty/backstage-plugin-scaffolder-actions`

4. To add theseon the **Plugins** page, click **Add Another button** twice, and include the above packages.

After you’ve completed installation you should now be able to see the PagerDuty plugin on the **Plugins** page.

To activate the backend module plugins, you need to navigate to the plugins being extended and activate them one by one:
**Plugins** :fa-arrow-right: **Catalog (View)** :fa-arrow-right: **Modules** :fa-arrow-right: `@pagerduty/backstage-plugin-entity-processor` (Manage Module) :fa-arrow-right: **Start Module**
**Plugins** :fa-arrow-right: **Scaffolder (View)** :fa-arrow-right: **Modules** :fa-arrow-right: `@pagerduty/backstage-plugin-scaffolder-actions` (Manage Module) :fa-arrow-right: **Start Module**
Now everything should be installed and ready to configure.

The most important part of the configuration is the OAuth section, where you should input the information collected in the previous step:
`clientId`: Private application client ID
`clientSecret`: Private application client Secret
`subDomain`: Your account’s subdomain name on `<name>.pagerduty.com`
`region`: Your account’s [service region](https://support.pagerduty.com/main/docs/service-regions) (US and EU are the available regions). Defaults to US, if none is provided.

## In Backstage

To install the PagerDuty plugin in Backstage, run the following commands from your Backstage root directory:

```
yarn --cwd packages/app add @pagerduty/backstage-plugin
yarn --cwd packages/backend add @pagerduty/backstage-plugin-backend
```

Once complete, you will then add the plugin to Backstage and your services.

### Add the Frontend Plugin to Your Application

You will need to add the frontend plugin to your application, and currently that requires some code changes to the Backstage application. You can do that by updating the `EntityPage.tsx` file in packages/app/src/components/catalog.
Add the following imports to the top of the file:

```
import {
isPluginApplicableToEntity as isPagerDutyAvailable,
EntityPagerDutyCard,
} from '@pagerduty/backstage-plugin';
```

Find `const overviewContent` in `EntityPage.tsx`, and add the following snippet inside the outermost Grid defined there, just before the closing </Grid> tag:

```
<EntitySwitch>
<EntitySwitch.Case if={isPagerDutyAvailable}>
<Grid item md={6}>
<EntityPagerDutyCard />
</Grid>
</EntitySwitch.Case>
</EntitySwitch>
```

Once you are done, the `overviewContent` definition should look similar to this:

```
const overviewContent = (
<Grid ...>
 ...
<EntitySwitch>
<EntitySwitch.Case if={isPagerDutyAvailable}>
<Grid item md={6}>
<EntityPagerDutyCard />
</Grid>
</EntitySwitch.Case>
</EntitySwitch>
</Grid>
);
```

Now the PagerDuty plugin will display in all your components that include PagerDuty annotations.

> 📘 Note
>
> The code samples provided above reflect the default configuration of the PagerDutyCard entity. You have at your disposal some parameters that allow you to [prevent users from creating incidents](https://pagerduty.github.io/backstage-plugin-docs/advanced/enable-read-only-mode), or [hide the change events tab](https://pagerduty.github.io/backstage-plugin-docs/advanced/hide-change-events) or even [hide the on-call](https://pagerduty.github.io/backstage-plugin-docs/advanced/hide-oncall) section of the card.

> 🚨 Important
>
> From version 0.16.0 and later, you need to import the Backstage UI CSS at the root (`src/index.tsx`) of
your backstage application (`import '@backstage/ui/css/styles.css'`), otherwise the Plugin
widgets won't look as they should.

### Configure the Frontend plugin

You’ve now added the PagerDuty frontend plugin to your application, but in order for it to show up you will need to configure your entities and the application itself.

#### Annotating Entities

For every component that shows up in your Backstage catalog, you have a .yaml file with its configuration. Add an annotation to the entity like this:

```
annotations:
pagerduty.com/service-id: [SERVICE-ID]
```

By default, if you only specify the `pagerduty.com/service-id` annotation, the PagerDutyCard component will disable the **Create Incident** button. But if you are using one of the latest versions (@pagerduty/backstage-plugin-backend:0.9.0 or higher) there is a mechanism to automatically create an integration in your PagerDuty services and add a `pagerduty.com/integration-key` annotation to the corresponding Backstage entity. This enables the option to create incidents from the PagerDutyCard.
You can optionally decide to annotate with an `integration-key` instead.The plugin will get the corresponding `service-id` and add it as an annotation, but since it requires more steps we recommend that you annotate with `pagerduty.com/service-id`.

> 📘 Note

> If you’re using multiple PagerDuty accounts in your setup, you should add an account annotation to your Backstage entities. This way the plugin knows with which instance to communicate with. If you don't provide one, the account that you selected as default will be used.
> annotations:
> pagerduty.com/account: [PAGERDUTY-ACCOUNT]

### Add the backend plugin to your application

> 📘 Note
>
> Version 0.6.0 of the backend plugin (@pagerduty/backstage-plugin-backend) introduced support for Backstage's [new backend system](https://backstage.io/docs/backend-system/) which simplifies the backend configuration and requires less code.
> Once you’ve completed steps in [Installing the Plugin](#installing-the-plugin), you’ve added the PagerDuty backend plugin to your application. That said, in order for it to expose its capabilities to the frontend plugin, you need to configure it. There are two approaches for configuration:

- Legacy Backend System
- New Backend System.
  > 🚧 Warning
  >
  > If you were using the PagerDuty plugin for Backstage before the release of @pagerduty/backstage-plugin-backend@0.6.0, then you already have the Backend configured. In this case, please see our [migration guidance](https://pagerduty.github.io/backstage-plugin-docs/advanced/backend-system-migration) instead of following steps below.

#### Legacy Backend System

Create a new file called `pagerduty.ts` at `packages/backend/src/plugins/pagerduty.ts` and add the following content:

```
import { Router } from 'express';
import { PluginEnvironment } from '../types';
import { createRouter } from '@pagerduty/backstage-plugin-backend';
export default async function createPlugin(
env: PluginEnvironment,
): Promise<Router> {
return await createRouter({
config: env.config,
logger: env.logger,
});
}
```

This creates the backend plugin that you can now configure in your application.
In `packages/backend/src/index.ts`, import your plugin and add a route for the APIs exposed by PagerDuty's backend plugin.

```
import pagerduty from './plugins/pagerduty';
// ...
async function main() {
 // …
const pagerdutyEnv = useHotMemoize(module, () => createEnv('pagerduty'));
 // ...
 apiRouter.use('/pagerduty', await pagerduty(pagerdutyEnv));
```

#### New Backend System

Backstage's new backend system requires less code to set up plugins. Just open the `packages/backend/src/index.ts` file and add the PagerDuty backend plugin to your Backstage App as shown below.

```
// pageduty plugin
backend.add(import('@pagerduty/backstage-plugin-backend'));
```

### Configure API Authorization

The PagerDuty plugin requires access to PagerDuty APIs, so you’ll need to configure our Backstage app with the necessary credentials to reach them. This step requires using an access token, for OAuth, or an API token.

> 📘 Note
> If you don’t already have this information, please follow previous steps to [Register an App](#in-pagerduty) to get the client id and client secret for OAuth authorization, or [Generate a General Access REST API Token](https://support.pagerduty.com/main/docs/api-access-keys#generate-a-general-access-rest-api-key) to generate a REST API Token.

#### Single PagerDuty Account

If all your services exist in a single PagerDuty account, you should follow the instructions below.

**Scoped OAuth (recommended)**
In the `app-config.yaml` file, add the following configuration and set your OAuth configuration:

```
pagerDuty:
  oauth:
    clientId: ${PD_CLIENT_ID}
    clientSecret: ${PD_CLIENT_SECRET}
    subDomain: ${PD_ACCOUNT_SUBDOMAIN}
    region: ${PD_ACCOUNT_REGION}        // Optional.
                                        // Allowed values: 'us', 'eu'.
                                        // Defaults to 'us'.
```

> 📘 Note
> The `subDomain` property only requiresthe first segment of your PagerDuty account URL. **Example**: If your PagerDuty account URL is `https://myaccount.pagerduty.com` then your `subDomain` value should be `myaccount`.
> Configuring it with an invalid value might cause authentication to fail.

**REST API Token**
In the `app-config.yaml` file add the following configuration to set your REST API Token:

```
pagerDuty:
  apiToken: ${PAGERDUTY_TOKEN}
```

> 🚧 Warning

> If you were using the plugin before version 0.8.1 of the frontend or version 0.3.1 of the backend, you need to configure a proxy configuration instead. That configuration is now deprecated, so use the above configuration instead.

#### Multiple PagerDuty Accounts

If your organization has multiple PagerDuty accounts, we added multi-account support on version 0.14.0 of the frontend plugin (@pagerduty/backstage-plugin). In order to configure it, you should follow the steps below.

**Scoped OAuth (recommended)**
In the `app-config.yaml` file, add the following configuration and set your OAuth configuration:

```
pagerDuty:
  accounts:
  - id: ${PD_ACCOUNT_SUBDOMAIN_1}    // The ID must be the subdomain for the account
    isDefault: true                  // Only one account can be defined as the default/fallback
    apiBaseUrl: ${PD_API_BASE_URL_1}
    oauth:
      clientId: ${PD_CLIENT_ID_1}
      clientSecret: ${PD_CLIENT_SECRET_1}
      subDomain: ${PD_ACCOUNT_SUBDOMAIN_1}
      region: ${PD_ACCOUNT_REGION_1}  // Optional. allowed values: 'us', 'eu'.
                                  // Defaults to 'us'.
  - id: ${PD_ACCOUNT_SUBDOMAIN_2}
    apiBaseUrl: ${PD_API_BASE_URL_2}
    oauth:
      clientId: ${PD_CLIENT_ID_2}
      clientSecret: ${PD_CLIENT_SECRET_2}
      subDomain: ${PD_ACCOUNT_SUBDOMAIN_2}
```

> 📘 Note
> The `subDomain` property requires only the first segment of your PagerDuty account URL. **Example**: If your PagerDuty account URL is `https://myaccount.pagerduty.com` then your `subDomain` value should be `myaccount`.
> Configuring it with an invalid value might cause authentication to fail.

**REST API Token**
In the `app-config.yaml` file, add the following configuration to set your REST API Token:

```
pagerDuty:
  accounts:
  - id: ${PD_ACCOUNT_SUBDOMAIN_1}    // The ID must be the subdomain for the account
    isDefault: true                  // Only one account can be defined as the default/fallback
    apiBaseUrl: ${PD_API_BASE_URL_1}
    apiToken: ${PAGERDUTY_TOKEN}
  - id: ${PD_ACCOUNT_SUBDOMAIN_2}
    apiToken: ${PAGERDUTY_TOKEN}
```

> 📘 Note
>
> In the new multi-account setup, you can configure accounts with Scoped OAuth and others with a REST API Token. You can also specify the custom API base URL and events URL for some and not others. All optional properties will revert to default values if not present.

### Test Your Configuration

Start your Backstage app, passing the PagerDuty API token or OAuth parameters as environment variables.

**For Scoped OAuth**

```
PD_CLIENT_ID='<ID>' PD_CLIENT_SECRET='<SECRET>' PD_ACCOUNT_SUBDOMAIN='<SUBDOMAIN>' PD_ACCOUNT_REGION='<REGION>'  yarn dev
```

**For REST API Token**

`PAGERDUTY_TOKEN='<TOKEN>' yarn dev`
This will add an Authorization header to all requests made to PagerDuty REST APIs.

# Multi-Account Support

The PagerDuty plugin for Backstage is prepared for multi-account. If that’s how you want to operate, instead of filling the OAuth section, instead create new items in the **Accounts** section by clicking **Add Items**. This allows you to set up multiple client credentials for each of your accounts (you need to create an OAuth private application for each account). Be mindful that providing only one account makes it the default.

# Backstage User Guide

Go to your Backstage or Portal account to view the integrated PagerDuty experience which is present as part of a PagerDuty page within your instance as well as on a PagerDuty card on the Backstage entity page for your services.

# Uninstall the Backstage Integration

In PagerDuty, navigate to **Integrations** :fa-arrow-right: **Developer Tools** :fa-arrow-right: **App Registration**.
To the right of the app that you’re using power the Backstage or Portal integration, click the :fa-ellipsis-h: overflow menu and select **Delete**. In the confirmation modal that appears, click **Delete** again to confirm.

# Getting help

PagerDuty plugin for Backstage is an open source project maintained by PagerDuty. PagerDuty employees and the Backstage community contribute based on their availability. If you encounter an issue or have a feature request, please file an issue here: https://github.com/PagerDuty/backstage-plugins/issues/new.

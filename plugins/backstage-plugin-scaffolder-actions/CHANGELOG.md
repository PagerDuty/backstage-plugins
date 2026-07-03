# @pagerduty/backstage-plugin-scaffolder-actions

## 0.3.1

### Patch Changes

- Updated dependencies [bee64f1]
  - @pagerduty/backstage-plugin-common@0.5.0

## 0.3.0

### Minor Changes

- e1f99a7: Remove deprecated @backstage/backend-common library. This is a potential breaking change for users who are still on the old backend system:

  - `createPagerDutyServiceAction(...)` now requires its `config` prop.
  - `createRouter(...)` now requires its `auth` prop.

  Note that none of this is breaking for users of the new backend system.

### Patch Changes

- Updated dependencies [9941800]
- Updated dependencies [ef0af04]
  - @pagerduty/backstage-plugin-common@0.4.0

## 0.2.9

### Patch Changes

- Updated dependencies [ae2a9c3]
  - @pagerduty/backstage-plugin-common@0.3.0

## 0.2.8

### Patch Changes

- 47afbbc: Make changesets mandatory for all the packages
- Updated dependencies [47afbbc]
  - @pagerduty/backstage-plugin-common@0.2.6

## 0.2.7

### Patch Changes

- 63a9957: Fix issue related to the use of backstage:^ token as a version for Backstage dependencies
- Updated dependencies [63a9957]
  - @pagerduty/backstage-plugin-common@0.2.5

## 0.2.6

### Patch Changes

- 2947469: Remove unnecessary dependencies
- Updated dependencies [2947469]
  - @pagerduty/backstage-plugin-common@0.2.4

## 0.2.5

### Patch Changes

- 444e9b3: Update NPM releases to use Trusted Publisher

## 0.2.4

### Patch Changes

- 7e65a56: Fix package.json metadata to improve Portal relations

## 0.2.3

### Patch Changes

- 44ea32e: Release new patch version to use new release pipeline

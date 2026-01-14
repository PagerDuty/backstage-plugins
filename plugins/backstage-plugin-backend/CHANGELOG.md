# @pagerduty/backstage-plugin-backend

## 0.10.3

### Patch Changes

- 63a9957: Fix issue related to the use of backstage:^ token as a version for Backstage dependencies
- Updated dependencies [63a9957]
  - @pagerduty/backstage-plugin-common@0.2.5

## 0.10.2

### Patch Changes

- 2947469: Remove unnecessary dependencies
- Updated dependencies [2947469]
  - @pagerduty/backstage-plugin-common@0.2.4

## 0.10.1

### Patch Changes

- 444e9b3: Update NPM releases to use Trusted Publisher

## 0.10.0

### Minor Changes

- b29f897: Disables unauthenticated access to plugin routes by default
  - **breaking change**: this change sets the default access for the backend plugin to authenticated. Previous uses of the plugin made it unauthenticated which if it was your case, now you need to set `enableUnauthenticatedAccess` to true.

## 0.9.11

### Patch Changes

- 7e65a56: Remove remainings of old backend system
- 7e65a56: Fix package.json metadata to improve Portal relations

## 0.9.10

### Patch Changes

- 987dda8: Release package with correct type definition

## 0.9.9

### Patch Changes

- 44ea32e: Release new patch version to use new release pipeline

## 0.9.8

### Patch Changes

- 60c1117: Release healthy versions

## 0.9.7

### Patch Changes

- 1abe215: testing version bump

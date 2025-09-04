import {
  ApiBlueprint,
  configApiRef,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';
import { pagerDutyApiRef, PagerDutyClient } from '../api';

/** @alpha */
export const pagerDutyApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: pagerDutyApiRef,
      deps: {
        configApi: configApiRef,
        fetchApi: fetchApiRef,
        discoveryApi: discoveryApiRef,
      },
      factory({ configApi, fetchApi, discoveryApi }) {
        return PagerDutyClient.fromConfig(configApi, {
          fetchApi,
          discoveryApi,
        });
      },
    }),
});

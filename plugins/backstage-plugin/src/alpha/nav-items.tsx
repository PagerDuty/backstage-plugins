import { NavItemBlueprint } from "@backstage/frontend-plugin-api";
import { rootRouteRef } from "../routes";
import { PagerDutyIcon } from "../components";
import { convertLegacyRouteRef } from "@backstage/core-compat-api";

/** @alpha */
export const pagerDutyNavBarItem = NavItemBlueprint.make({
  name: 'PagerDutyNavBarItem',
  params: {
    title: 'PagerDuty',
    icon: PagerDutyIcon,
    routeRef: convertLegacyRouteRef(rootRouteRef),
  }
});
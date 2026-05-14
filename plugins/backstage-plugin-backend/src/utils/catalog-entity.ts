import { GetEntitiesByRefsResponse, GetEntitiesResponse } from "@backstage/catalog-client";
import { getServiceByIntegrationKey } from "../apis/pagerduty";

// simplification of the CatalogEntity type - this type is not publicly exposed by the catalog-client package.
interface CatalogEntity {
  kind: string;
  metadata: {
    namespace?: string;
    name: string;
    annotations?: {
      [key: string]: string;
    };
  };  
}

export function entityRef(entity: CatalogEntity): string {
  return `${entity.kind}:${entity.metadata.namespace ?? 'default'}/${entity.metadata.name}`.toLowerCase();
}

export function getPagerDutyIntegrationKey(entity: CatalogEntity): string | undefined {
  return entity.metadata.annotations?.['pagerduty.com/integration-key'];
}

export function getPagerDutyServiceId(entity: CatalogEntity): string | undefined {
  return entity.metadata.annotations?.['pagerduty.com/service-id'];
}

export function getPagerDutyAccount(entity: CatalogEntity): string | undefined {
  return entity.metadata.annotations?.['pagerduty.com/account'];
}

export async function createComponentEntitiesReferenceDict({
  items: componentEntities,
}: GetEntitiesResponse | GetEntitiesByRefsResponse): Promise<Record<string, { ref: string; name: string }>> {
  const componentEntitiesDict: Record<string, { ref: string; name: string }> = {};

  await Promise.all(
    componentEntities.map(async entity => {
      const serviceId = getPagerDutyServiceId(entity!);
      const integrationKey = getPagerDutyIntegrationKey(entity!);
      const account = getPagerDutyAccount(entity!);

      if (serviceId) {
        componentEntitiesDict[serviceId] = {
          ref: entityRef(entity!),
          name: entity?.metadata.name ?? '',
        };
      } else if (integrationKey) {
        // get service id from integration key, we ignore errors here since we're focused
        // only on building a mapping between valid service IDs and the corresponding Backstage entity
        const service = await getServiceByIntegrationKey(integrationKey, account,).catch(() => undefined);

        if (service) {
          componentEntitiesDict[service.id] = {
            ref: entityRef(entity!).toLowerCase(),
            name: entity?.metadata.name ?? '',
          };
        }
      }
    }),
  );

  return componentEntitiesDict;
}

import { getAllServices } from '../apis/pagerduty';
import {
  normalizePagerDutyService,
  normalizeBackstageComponent,
  type NormalizedService,
} from '../utils/normalization';
import type { CatalogApi } from '@backstage/catalog-client';
import type { PagerDutyService } from '@pagerduty/backstage-plugin-common';
import type { Entity } from '@backstage/catalog-model';

export class ServiceLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceLoadError';
  }
}

export interface DataLoaderContext {
  catalogApi: CatalogApi;
}

export interface LoadedSources {
  pdServices: NormalizedService[];
  bsComponents: NormalizedService[];
}

export async function loadPagerDutyServices(): Promise<NormalizedService[]> {
  try {
    const services: PagerDutyService[] = await getAllServices();

    const normalizedServices: NormalizedService[] = services.map(service => {
      const teamName = service.teams?.[0]?.summary ?? '';

      return normalizePagerDutyService(
        service.name,
        teamName,
        service.id,
      );
    });

    return normalizedServices;
  } catch (error) {
    throw new ServiceLoadError(
      `Failed to load PagerDuty services: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export async function loadBackstageComponents({
  catalogApi,
}: DataLoaderContext): Promise<NormalizedService[]> {
  try {

    const response = await catalogApi.getEntities({
      filter: {
        kind: 'Component',
      },
    });

    const normalizedComponents: NormalizedService[] = response.items.map(
      (entity: Entity) => {
        const entityRef =
          `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`.toLowerCase();

        const owner =
          typeof entity.spec?.owner === 'string' ? entity.spec.owner : '';

        return normalizeBackstageComponent(
          entity.metadata.name,
          owner,
          entityRef,
        );
      },
    );

    return normalizedComponents;
  } catch (error) {
    throw new ServiceLoadError(
      `Failed to load Backstage components: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export async function loadBothSources(
  context: DataLoaderContext,
): Promise<LoadedSources> {
  const [pdServices, bsComponents] = await Promise.all([
    loadPagerDutyServices(),
    loadBackstageComponents(context),
  ]);

  return {
    pdServices,
    bsComponents,
  };
}

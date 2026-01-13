/**
 * Data Loader Module for Auto-Matching Algorithm
 *
 * This module loads services from both PagerDuty and Backstage,
 * normalizes them using utilities from Step 1, and prepares them
 * for the matching algorithm.
 *
 * @packageDocumentation
 */

import { getAllServices } from '../apis/pagerduty';
import {
  normalizeService,
  type NormalizedService,
} from '../utils/normalization';
import type { CatalogApi } from '@backstage/catalog-client';
import type { PagerDutyService } from '@pagerduty/backstage-plugin-common';
import type { Entity } from '@backstage/catalog-model';

/**
 * Context required for data loading operations.
 *
 * This interface defines the dependencies needed to load data from both sources.
 */
export interface DataLoaderContext {
  /** Backstage Catalog API client for querying entities */
  catalogApi: CatalogApi;
}

/**
 * Result structure returned by loadBothSources().
 *
 * Contains normalized arrays from both PagerDuty and Backstage,
 * ready for the matching algorithm.
 */
export interface LoadedSources {
  /** Normalized PagerDuty services */
  pdServices: NormalizedService[];
  /** Normalized Backstage components */
  bsComponents: NormalizedService[];
}

/**
 * Loads all PagerDuty services and normalizes them for matching.
 *
 * This function:
 * 1. Calls the existing `getAllServices()` API
 * 2. Extracts relevant fields (id, name, teams)
 * 3. Applies basic normalization using `normalizeService()`
 * 4. Returns an array of `NormalizedService` objects
 *
 * @returns Promise resolving to array of normalized PagerDuty services
 * @throws Error if PagerDuty API call fails
 *
 * @example
 * ```typescript
 * const pdServices = await loadPagerDutyServices();
 * console.log(`Loaded ${pdServices.length} PagerDuty services`);
 * ```
 */
export async function loadPagerDutyServices(): Promise<NormalizedService[]> {
  try {
    // Fetch all services from PagerDuty API
    const services: PagerDutyService[] = await getAllServices();

    // Transform each PD service into NormalizedService format
    const normalizedServices: NormalizedService[] = services.map(service => {
      // Extract team name from first team (if exists)
      // PagerDuty services can have multiple teams, we take the first one
      const teamName = service.teams?.[0]?.summary ?? '';

      // Apply normalization using utilities from Step 1
      // useAdvancedPreprocessing = false for initial loading (basic normalization)
      return normalizeService(
        service.name,
        teamName,
        service.id,
        'pagerduty',
        false, // Use basic normalization (Stage 3 matching)
      );
    });

    return normalizedServices;
  } catch (error) {
    throw new Error(
      `Failed to load PagerDuty services: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Loads all Backstage components and normalizes them for matching.
 *
 * This function:
 * 1. Queries the Backstage Catalog API for all Component entities
 * 2. Extracts relevant fields (entityRef, name, owner)
 * 3. Applies basic normalization using `normalizeService()`
 * 4. Returns an array of `NormalizedService` objects
 *
 * @param context - Data loader context containing catalogApi
 * @returns Promise resolving to array of normalized Backstage components
 * @throws Error if Catalog API call fails
 *
 * @example
 * ```typescript
 * const bsComponents = await loadBackstageComponents({ catalogApi });
 * console.log(`Loaded ${bsComponents.length} Backstage components`);
 * ```
 */
export async function loadBackstageComponents(
  context: DataLoaderContext,
): Promise<NormalizedService[]> {
  try {
    const { catalogApi } = context;

    // Query catalog for all Component entities
    const response = await catalogApi.getEntities({
      filter: {
        kind: 'Component',
      },
    });

    // Transform each Backstage entity into NormalizedService format
    const normalizedComponents: NormalizedService[] = response.items.map(
      (entity: Entity) => {
        // Create entity reference in format: kind:namespace/name (lowercase)
        const entityRef =
          `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`.toLowerCase();

        // Extract owner (team) from spec
        // Backstage entities have spec.owner which can be a user or group/team
        const owner = (entity.spec?.owner as string | undefined) ?? '';

        // Apply normalization using utilities from Step 1
        // useAdvancedPreprocessing = false for initial loading (basic normalization)
        return normalizeService(
          entity.metadata.name,
          owner,
          entityRef,
          'backstage',
          false, // Use basic normalization (Stage 3 matching)
        );
      },
    );

    return normalizedComponents;
  } catch (error) {
    throw new Error(
      `Failed to load Backstage components: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Loads and normalizes data from both PagerDuty and Backstage in parallel.
 *
 * This is the main orchestrator function that:
 * 1. Calls both loaders simultaneously using Promise.all() for performance
 * 2. Waits for both to complete
 * 3. Returns both arrays in a single object
 *
 * **Performance:** Parallel loading reduces total wait time:
 * - Sequential: ~3 seconds (2s PD + 1s BS)
 * - Parallel: ~2 seconds (max of both)
 *
 * @param context - Data loader context containing catalogApi
 * @returns Promise resolving to both normalized arrays
 * @throws Error if either loader fails
 *
 * @example
 * ```typescript
 * const { pdServices, bsComponents } = await loadBothSources({ catalogApi });
 * console.log(`Loaded ${pdServices.length} PD services`);
 * console.log(`Loaded ${bsComponents.length} BS components`);
 * console.log(`Total comparisons needed: ${pdServices.length * bsComponents.length}`);
 * ```
 */
export async function loadBothSources(
  context: DataLoaderContext,
): Promise<LoadedSources> {
  try {
    // Load both sources in parallel for better performance
    const [pdServices, bsComponents] = await Promise.all([
      loadPagerDutyServices(),
      loadBackstageComponents(context),
    ]);

    return {
      pdServices,
      bsComponents,
    };
  } catch (error) {
    throw new Error(
      `Failed to load sources: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

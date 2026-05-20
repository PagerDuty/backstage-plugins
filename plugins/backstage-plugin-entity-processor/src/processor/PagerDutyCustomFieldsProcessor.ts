import { AuthService, DiscoveryService, LoggerService } from '@backstage/backend-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { CatalogProcessor, CatalogProcessorEmit } from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { PagerDutyClient } from '../apis/client';
import { extractValueAtPath } from './extractEntityValue';
import { PagerDutyServiceCustomFieldValue } from '@pagerduty/backstage-plugin-common';

export interface PagerDutyCustomFieldsProcessorOptions {
  logger: LoggerService;
  discovery: DiscoveryService;
  auth: AuthService;
}

export class PagerDutyCustomFieldsProcessor implements CatalogProcessor {
  private readonly logger: LoggerService;
  private readonly client: PagerDutyClient;

  constructor({ auth, logger, discovery }: PagerDutyCustomFieldsProcessorOptions) {
    this.logger = logger;
    this.client = new PagerDutyClient({ auth, discovery, logger });
  }

  getProcessorName(): string {
    return 'PagerDutyCustomFieldsProcessor';
  }

  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (entity.kind !== 'Component') return entity;

    const serviceId = entity.metadata.annotations?.['pagerduty.com/service-id'];
    if (!serviceId) return entity;

    const account = entity.metadata.annotations?.['pagerduty.com/account'];

    try {
      const fields = await this.client.getEnabledCustomFields(account);
      if (fields.length === 0) return entity;

      const values: PagerDutyServiceCustomFieldValue[] = [];
      for (const field of fields) {
        const result = extractValueAtPath(entity, field.backstageEntityMappingPath);
        if (!result.ok) {
          this.logger.warn(
            `Skipping custom field "${field.pagerdutyCustomFieldDisplayName}" for entity ${entity.metadata.name} (service ${serviceId}): ${result.reason}`,
          );
          continue;
        }
        values.push({ id: field.pagerdutyCustomFieldId, value: result.value });
      }

      if (values.length > 0) {
        await this.client.pushCustomFieldValues(serviceId, values, account);
        this.logger.debug(
          `Pushed ${values.length} custom field value(s) for service ${serviceId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to push custom field values for entity ${entity.metadata.name} (service ${serviceId}): ${error}`,
      );
    }

    return entity;
  }
}

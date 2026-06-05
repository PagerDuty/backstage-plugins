import { AuthService, DiscoveryService, LoggerService } from '@backstage/backend-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { CatalogProcessor, CatalogProcessorEmit } from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { PagerDutyClient } from '../apis/client';
import { extractValueAtPath } from './extractEntityValue';
import {
  BackstageCustomField,
  PagerDutyServiceCustomFieldValue,
} from '@pagerduty/backstage-plugin-common';

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
    const serviceName = entity.metadata.name;

    try {
      // Customers must explicitly opt in to the data sync before any data is
      // pushed to PagerDuty. The toggle is stored org-wide in the settings table.
      const dataSyncEnabled = await this.client.isDataSyncEnabled();
      if (!dataSyncEnabled) return entity;

      const fields = await this.client.getEnabledCustomFields(account);
      if (fields.length === 0) return entity;

      const values: PagerDutyServiceCustomFieldValue[] = [];
      const pushedFields: BackstageCustomField[] = [];
      for (const field of fields) {
        const result = extractValueAtPath(entity, field.backstageEntityMappingPath);
        if (!result.ok) {
          this.logger.warn(
            `Skipping custom field "${field.pagerdutyCustomFieldDisplayName}" (path="${field.backstageEntityMappingPath}") for entity ${entity.metadata.name} (service ${serviceId}): ${result.reason}`,
          );
          void this.client
            .createSyncLog(
              {
                errorCode: 'INVALID_PATH',
                customFieldId: field.pagerdutyCustomFieldId,
                customFieldName: field.pagerdutyCustomFieldDisplayName,
                entityPath: field.backstageEntityMappingPath,
                serviceId,
                serviceName,
                errorMessage: result.reason,
              },
              account,
            )
            .catch(error =>
              this.logger.warn(
                `Sync log write failed (best-effort): ${error}`,
              ),
            );
          continue;
        }
        values.push({ id: field.pagerdutyCustomFieldId, value: result.value });
        pushedFields.push(field);
      }

      if (values.length > 0) {
        try {
          await this.client.pushCustomFieldValues(serviceId, values, account);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Failed to push custom field values for entity ${entity.metadata.name} (service ${serviceId}, account=${account ?? 'default'}): ${errorMessage}`,
          );
          for (const field of pushedFields) {
            void this.client
              .createSyncLog(
                {
                  errorCode: 'PD_API_ERROR',
                  customFieldId: field.pagerdutyCustomFieldId,
                  customFieldName: field.pagerdutyCustomFieldDisplayName,
                  entityPath: field.backstageEntityMappingPath,
                  serviceId,
                  serviceName,
                  errorMessage,
                },
                account,
              )
              .catch(err =>
                this.logger.warn(`Sync log write failed (best-effort): ${err}`),
              );
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to process custom field values for entity ${entity.metadata.name} (service ${serviceId}): ${error}`,
      );
    }

    return entity;
  }
}

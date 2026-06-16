import { LoggerService } from '@backstage/backend-plugin-api';
import { Request, Response } from 'express';
import { PagerDutyBackendStore } from '../db/PagerDutyBackendDatabase';
import {
  createCustomField,
  deleteCustomField,
  setServiceCustomFieldValues,
  updateCustomField,
} from '../apis/pagerduty';
import {
  BackstageCustomFieldCreateRequest,
  BackstageCustomFieldToggleEnabledRequest,
  BackstageCustomFieldUpdateRequest,
  BackstageCustomFieldsResponse,
  CustomFieldSyncLogCreateRequest,
  HttpError,
  PagerDutyCustomFieldCreateRequest,
  PagerDutyCustomFieldUpdateRequest,
  PagerDutyServiceCustomFieldValue,
} from '@pagerduty/backstage-plugin-common';

export interface CustomFieldsControllerOptions {
  logger: LoggerService;
  store: PagerDutyBackendStore;
}

export class CustomFieldsController {
  private readonly logger: LoggerService;
  private readonly store: PagerDutyBackendStore;

  constructor(options: CustomFieldsControllerOptions) {
    this.logger = options.logger;
    this.store = options.store;
  }

  async createCustomField(request: Request, response: Response): Promise<void> {
    let backstageRecordId: number | undefined;

    try {
      const { name, entityPath, description } =
        request.body as BackstageCustomFieldCreateRequest;

      const sanitizedName = this.validateFieldInput(name, entityPath);
      const subdomain = this.getSubdomainFromRequest(request);
      const normalizedDescription = this.normalizeDescription(description, entityPath);

      // Step 1: Create in Backstage DB first with temporary PagerDuty ID
      const tempPagerDutyId = `PENDING_${Date.now()}`;
      try {
        const backstageRecord = await this.store.insertCustomField({
          pagerdutyCustomFieldId: tempPagerDutyId,
          pagerdutyCustomFieldDisplayName: name,
          pagerdutyCustomFieldEnabled: true,
          backstageEntityMappingPath: entityPath,
          pagerdutySubdomain: subdomain,
          description: normalizedDescription,
        });
        backstageRecordId = backstageRecord.id;

        this.logger.info(
          `Created temporary Backstage record (id=${backstageRecordId}) for custom field: ${name}`,
        );
      } catch (error) {
        this.handleDbError(error);
      }

      // Step 2: Create in PagerDuty
      const pagerDutyRequest: PagerDutyCustomFieldCreateRequest = {
        field: {
          data_type: 'string',
          description: normalizedDescription,
          display_name: name,
          enabled: true,
          field_type: 'single_value',
          name: sanitizedName,
        },
      };

      let pagerDutyField;
      try {
        const pagerDutyResponse = await createCustomField({
          request: pagerDutyRequest,
          account: subdomain,
        });
        pagerDutyField = pagerDutyResponse.field;

        this.logger.info(
          `Created PagerDuty custom field: ${name} (${pagerDutyField.id})`,
        );
      } catch (error) {
        // Rollback: Delete the Backstage record since PagerDuty creation failed
        if (backstageRecordId) {
          await this.store.deleteCustomField(backstageRecordId);
          this.logger.info(
            `Rolled back Backstage record (id=${backstageRecordId}) due to PagerDuty creation failure`,
          );
        }
        if (error instanceof HttpError) this.handlePagerDutyError(error);
        throw error;
      }

      // Step 3: Update Backstage record with real PagerDuty ID
      try {
        await this.store.updateCustomFieldPagerDutyId(backstageRecordId!, pagerDutyField.id);

        const customField = await this.store.findCustomFieldById(backstageRecordId!);

        this.logger.info(
          `Successfully created custom field: ${name} (${pagerDutyField.id}) mapped to ${entityPath}`,
        );
        response.status(201).json({ customField });
      } catch (error) {
        this.logger.error(
          `Failed to update Backstage record with PagerDuty ID. Manual cleanup may be required for PagerDuty field ${pagerDutyField.id}`,
        );
        throw error;
      }
    } catch (error) {
      this.handleUnexpectedError(error, 'creating the custom field', response);
    }
  }

  async getCustomFields(request: Request, response: Response): Promise<void> {
    try {
      const subdomain = this.getSubdomainFromRequest(request);
      const enabled = parseEnabledQuery(request.query.enabled);
      const customFields = await this.store.getAllCustomFields(subdomain, {
        enabled,
      });
      const responseData: BackstageCustomFieldsResponse = { customFields };
      response.status(200).json(responseData);
    } catch (error) {
      this.handleUnexpectedError(error, 'fetching custom fields', response);
    }
  }

  async syncCustomFieldValues(
    request: Request,
    response: Response,
  ): Promise<void> {
    try {
      const { serviceId, values } = request.body as {
        serviceId?: string;
        values?: PagerDutyServiceCustomFieldValue[];
      };
      const subdomain = this.getSubdomainFromRequest(request);

      if (!serviceId) {
        throw new HttpError('Missing required field: serviceId', 400);
      }
      if (!Array.isArray(values) || values.length === 0) {
        response.status(204).end();
        return;
      }

      try {
        const result = await setServiceCustomFieldValues({
          serviceId,
          request: { custom_fields: values },
          account: subdomain,
        });
        this.logger.info(
          `Synced ${values.length} custom field value(s) to PagerDuty service ${serviceId}`,
        );
        response.status(200).json(result);
      } catch (error) {
        if (error instanceof HttpError) this.handlePagerDutyError(error);
        throw error;
      }
    } catch (error) {
      this.handleUnexpectedError(
        error,
        'syncing custom field values',
        response,
      );
    }
  }

  async updateCustomField(request: Request, response: Response): Promise<void> {
    try {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) throw new HttpError('Invalid id parameter', 400);

      const existing = await this.store.findCustomFieldById(id);
      if (!existing) throw new HttpError('Custom field not found', 404);

      const { name, entityPath, description } =
        request.body as BackstageCustomFieldUpdateRequest;

      this.validateFieldInput(name, entityPath);

      // Validate uniqueness constraints BEFORE making any changes
      await this.validateUniqueConstraints(
        id,
        name,
        entityPath,
        existing.pagerdutySubdomain,
      );

      const normalizedDescription = this.normalizeDescription(description, entityPath);

      // Snapshot current values for rollback
      const snapshot = {
        pagerdutyCustomFieldDisplayName: existing.pagerdutyCustomFieldDisplayName,
        backstageEntityMappingPath: existing.backstageEntityMappingPath,
        description: existing.description,
      };

      // Step 1: Update Backstage DB first
      try {
        await this.store.updateCustomField(id, {
          pagerdutyCustomFieldDisplayName: name,
          backstageEntityMappingPath: entityPath,
          description: normalizedDescription,
        });

        this.logger.info(`Updated Backstage record for custom field id=${id}`);
      } catch (error) {
        this.handleDbError(error);
      }

      // Step 2: Update PagerDuty
      const pagerDutyRequest: PagerDutyCustomFieldUpdateRequest = {
        field: { display_name: name, description: normalizedDescription },
      };

      try {
        await updateCustomField({
          fieldId: existing.pagerdutyCustomFieldId,
          request: pagerDutyRequest,
          account: existing.pagerdutySubdomain,
        });

        this.logger.info(`Updated PagerDuty custom field: ${name} (${existing.pagerdutyCustomFieldId})`);
      } catch (error) {
        // Rollback: Revert Backstage DB to snapshot
        try {
          await this.store.updateCustomField(id, snapshot);
          this.logger.info(
            `Rolled back Backstage record (id=${id}) to previous values due to PagerDuty update failure`,
          );
        } catch (rollbackError) {
          this.logger.error(
            `CRITICAL: Failed to rollback Backstage record (id=${id}) after PagerDuty failure. Manual intervention required.`,
            rollbackError as Error,
          );
        }

        if (error instanceof HttpError) this.handlePagerDutyError(error);
        throw error;
      }

      // Step 3: Return updated record
      const customField = await this.store.findCustomFieldById(id);
      this.logger.info(`Successfully updated custom field id=${id} (${name})`);
      response.status(200).json({ customField });
    } catch (error) {
      this.handleUnexpectedError(error, 'updating the custom field', response);
    }
  }

  async toggleCustomFieldEnabled(
    request: Request,
    response: Response,
  ): Promise<void> {
    try {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) throw new HttpError('Invalid id parameter', 400);

      const { enabled } = request.body as BackstageCustomFieldToggleEnabledRequest;
      if (typeof enabled !== 'boolean') {
        throw new HttpError('Invalid enabled value', 400);
      }

      const existing = await this.store.findCustomFieldById(id);
      if (!existing) throw new HttpError('Custom field not found', 404);

      // No-op if already in the requested state
      if (existing.pagerdutyCustomFieldEnabled === enabled) {
        response.status(200).json({ customField: existing });
        return;
      }

      const previousEnabled = existing.pagerdutyCustomFieldEnabled;

      // Step 1: Update Backstage DB first
      try {
        await this.store.setCustomFieldEnabled(id, enabled);
        this.logger.info(
          `Updated Backstage record for custom field id=${id} (enabled=${enabled})`,
        );
      } catch (error) {
        this.handleDbError(error);
      }

      // Step 2: Update PagerDuty. display_name is required by the update request,
      // so we send the existing name unchanged alongside the enabled flag.
      const pagerDutyRequest: PagerDutyCustomFieldUpdateRequest = {
        field: {
          display_name: existing.pagerdutyCustomFieldDisplayName,
          enabled,
        },
      };

      try {
        await updateCustomField({
          fieldId: existing.pagerdutyCustomFieldId,
          request: pagerDutyRequest,
          account: existing.pagerdutySubdomain,
        });
        this.logger.info(
          `Updated PagerDuty custom field enabled=${enabled}: ${existing.pagerdutyCustomFieldDisplayName} (${existing.pagerdutyCustomFieldId})`,
        );
      } catch (error) {
        // Rollback: revert Backstage DB to its previous enabled state
        try {
          await this.store.setCustomFieldEnabled(id, previousEnabled);
          this.logger.info(
            `Rolled back Backstage record (id=${id}) to enabled=${previousEnabled} due to PagerDuty update failure`,
          );
        } catch (rollbackError) {
          this.logger.error(
            `CRITICAL: Failed to rollback Backstage record (id=${id}) after PagerDuty failure. Manual intervention required.`,
            rollbackError as Error,
          );
        }

        if (error instanceof HttpError) this.handlePagerDutyError(error);
        throw error;
      }

      const customField = await this.store.findCustomFieldById(id);
      this.logger.info(
        `Successfully toggled custom field id=${id} to enabled=${enabled}`,
      );
      response.status(200).json({ customField });
    } catch (error) {
      this.handleUnexpectedError(
        error,
        'toggling the custom field enabled state',
        response,
      );
    }
  }

  async deleteCustomField(request: Request, response: Response): Promise<void> {
    try {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) throw new HttpError('Invalid id parameter', 400);

      const existing = await this.store.findCustomFieldById(id);
      if (!existing) throw new HttpError('Custom field not found', 404);

      // Step 1: Delete from PagerDuty first
      try {
        await deleteCustomField({
          fieldId: existing.pagerdutyCustomFieldId,
          account: existing.pagerdutySubdomain,
        });
        this.logger.info(
          `Deleted PagerDuty custom field: ${existing.pagerdutyCustomFieldDisplayName} (${existing.pagerdutyCustomFieldId})`,
        );
      } catch (error) {
        if (error instanceof HttpError) this.handlePagerDutyError(error);
        throw error;
      }

      // Step 2: Delete from Backstage DB
      await this.store.deleteCustomField(id);
      this.logger.info(
        `Deleted Backstage custom field record id=${id} (${existing.pagerdutyCustomFieldDisplayName})`,
      );

      response.status(204).end();
    } catch (error) {
      this.handleUnexpectedError(error, 'deleting the custom field', response);
    }
  }

  private async validateUniqueConstraints(
    currentId: number,
    name: string,
    entityPath: string,
    subdomain: string,
  ): Promise<void> {
    const allFields = await this.store.getAllCustomFields(subdomain);

    // Check if another field (not the current one) has the same display name
    const duplicateName = allFields.find(
      field =>
        field.id !== currentId &&
        field.pagerdutyCustomFieldDisplayName === name,
    );
    if (duplicateName) {
      throw new HttpError(
        'A custom field with this display name already exists',
        409,
      );
    }

    // Check if another field (not the current one) has the same entity path
    const duplicateEntityPath = allFields.find(
      field =>
        field.id !== currentId &&
        field.backstageEntityMappingPath === entityPath,
    );
    if (duplicateEntityPath) {
      throw new HttpError(
        'A custom field with this entity path already exists',
        409,
      );
    }
  }

  private validateFieldInput(
    name: string | undefined,
    entityPath: string | undefined,
  ): string {
    if (!name || !entityPath) {
      throw new HttpError(
        'Missing required fields: name and entityPath are required',
        400,
      );
    }
    const sanitizedName = this.sanitizeFieldName(name);
    if (!sanitizedName) {
      throw new HttpError(
        'Field name must contain at least one alphanumeric character',
        400,
      );
    }
    return sanitizedName;
  }

  private sanitizeFieldName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  }

  private normalizeDescription(
    description: string | undefined,
    entityPath: string,
  ): string {
    return (description ?? '').trim() || `Backstage custom field: ${entityPath}`;
  }

  private getSubdomainFromRequest(request: Request): string {
    return (request.query.account as string) || 'default';
  }

  private handleDbError(error: unknown): never {
    const msg = error instanceof Error ? error.message : String(error);
    const code = (error as { code?: string })?.code;

    const isUniqueViolation =
      code === '23505' || // PostgreSQL
      msg.toLowerCase().includes('unique constraint') || // SQLite / generic
      msg.toLowerCase().includes('unique violation');

    if (isUniqueViolation) {
      if (
        msg.includes('pagerduty_cf_entitypath_subdomain_unique') ||
        msg.includes('backstageEntityMappingPath')
      ) {
        throw new HttpError(
          'A custom field with this entity path already exists',
          409,
        );
      }
      if (
        msg.includes('pagerduty_cf_displayname_subdomain_unique') ||
        msg.includes('pagerdutyCustomFieldDisplayName')
      ) {
        throw new HttpError(
          'A custom field with this display name already exists',
          409,
        );
      }
      throw new HttpError('A custom field with these values already exists', 409);
    }

    throw error instanceof Error ? error : new Error(String(error));
  }

  private handlePagerDutyError(error: HttpError): never {
    if (error.status === 400) {
      const message = error.message.toLowerCase().includes('product limit reached')
        ? 'PagerDuty custom field limit reached. Maximum number of custom fields (15 or 30) has been exceeded.'
        : error.message;
      throw new HttpError(message, 400);
    }
    if (error.status === 401) {
      throw new HttpError(
        'Authentication failed. Please check your PagerDuty API credentials.',
        401,
      );
    }
    if (error.status === 403) {
      throw new HttpError(
        'Authorization failed. You do not have permission to manage custom fields in PagerDuty.',
        403,
      );
    }
    if (error.status === 404) {
      throw new HttpError('Custom field or service not found in PagerDuty', 404);
    }
    if (error.status === 409) {
      throw new HttpError(
        'A custom field with this name already exists in PagerDuty',
        409,
      );
    }
    if (error.status === 429) {
      throw new HttpError(
        'PagerDuty API rate limit exceeded. Please try again in a few moments.',
        429,
      );
    }
    throw error;
  }

  private handleUnexpectedError(
    error: unknown,
    context: string,
    response: Response,
  ): void {
    this.logger.error(`Failed ${context}: ${error}`);
    if (error instanceof HttpError) {
      response.status(error.status).json({ errors: [error.message] });
    } else {
      response.status(500).json({
        errors: [`An unexpected error occurred while ${context}`],
      });
    }
  }

  async createSyncLog(request: Request, response: Response): Promise<void> {
    try {
      const log = request.body as CustomFieldSyncLogCreateRequest;
      const subdomain = this.getSubdomainFromRequest(request);

      if (
        !log.errorCode ||
        !log.customFieldId ||
        !log.customFieldName ||
        !log.entityPath ||
        !log.serviceId ||
        !log.serviceName ||
        !log.errorMessage
      ) {
        throw new HttpError('Missing required fields in sync log', 400);
      }

      await this.store.insertSyncLog({
        errorCode: log.errorCode,
        customFieldId: log.customFieldId,
        customFieldName: log.customFieldName,
        entityPath: log.entityPath,
        serviceId: log.serviceId,
        serviceName: log.serviceName,
        errorMessage: log.errorMessage,
        subdomain,
      });

      response.status(201).end();
    } catch (error) {
      this.handleUnexpectedError(error, 'creating sync log', response);
    }
  }

  async getSyncLogs(
    request: Request,
    response: Response,
  ): Promise<void> {
    try {
      const subdomain = this.getSubdomainFromRequest(request);
      const limit = request.query.limit
        ? parseInt(request.query.limit as string, 10)
        : undefined;
      const offset = request.query.offset
        ? parseInt(request.query.offset as string, 10)
        : undefined;
      const severityParam = (request.query.severity as string) || undefined;
      const severity =
        severityParam === 'error' || severityParam === 'warning'
          ? severityParam
          : undefined;
      const search = (request.query.search as string) || undefined;
      const customFieldName =
        (request.query.customFieldName as string) || undefined;
      const entityPath = (request.query.entityPath as string) || undefined;
      const serviceName = (request.query.serviceName as string) || undefined;

      const result = await this.store.getSyncLogs(subdomain, {
        limit,
        offset,
        severity,
        search,
        customFieldName,
        entityPath,
        serviceName,
      });
      response.status(200).json(result);
    } catch (error) {
      this.handleUnexpectedError(error, 'fetching sync logs', response);
    }
  }
}

function parseEnabledQuery(value: unknown): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

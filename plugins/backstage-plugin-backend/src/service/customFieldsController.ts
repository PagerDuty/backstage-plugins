import { LoggerService } from '@backstage/backend-plugin-api';
import { Request, Response } from 'express';
import { PagerDutyBackendStore } from '../db/PagerDutyBackendDatabase';
import { createCustomField, updateCustomField } from '../apis/pagerduty';
import {
  BackstageCustomFieldCreateRequest,
  BackstageCustomFieldUpdateRequest,
  BackstageCustomFieldsResponse,
  HttpError,
  PagerDutyCustomFieldCreateRequest,
  PagerDutyCustomFieldUpdateRequest,
} from '@pagerduty/backstage-plugin-common';
import {
  getSubdomainFromRequest,
  handleDbError,
  handlePagerDutyError,
  handleUnexpectedError,
  normalizeDescription,
  validateFieldInput,
} from './customFieldsHelpers';

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
    try {
      const { name, entityPath, description } =
        request.body as BackstageCustomFieldCreateRequest;

      const sanitizedName = validateFieldInput(name, entityPath);
      const subdomain = getSubdomainFromRequest(request);
      const normalizedDesc = normalizeDescription(description, entityPath);

      const pagerDutyRequest: PagerDutyCustomFieldCreateRequest = {
        field: {
          data_type: 'string',
          description: normalizedDesc,
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
      } catch (error) {
        if (error instanceof HttpError) handlePagerDutyError(error);
        throw error;
      }

      try {
        const customField = await this.store.insertCustomField({
          pagerdutyCustomFieldId: pagerDutyField.id,
          pagerdutyCustomFieldDisplayName: pagerDutyField.display_name,
          pagerdutyCustomFieldEnabled: pagerDutyField.enabled,
          backstageEntityMappingPath: entityPath,
          pagerdutySubdomain: subdomain,
          description: normalizedDesc,
        });

        this.logger.info(
          `Successfully created custom field: ${name} (${pagerDutyField.id}) mapped to ${entityPath}`,
        );
        response.status(201).json({ customField });
      } catch (error) {
        handleDbError(error);
      }
    } catch (error) {
      handleUnexpectedError(this.logger, error, 'creating the custom field', response);
    }
  }

  async getCustomFields(request: Request, response: Response): Promise<void> {
    try {
      const subdomain = getSubdomainFromRequest(request);
      const customFields = await this.store.getAllCustomFields(subdomain);
      const responseData: BackstageCustomFieldsResponse = { customFields };
      response.status(200).json(responseData);
    } catch (error) {
      handleUnexpectedError(this.logger, error, 'fetching custom fields', response);
    }
  }

  async updateCustomField(request: Request, response: Response): Promise<void> {
    try {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) throw new HttpError('Invalid id parameter', 400);

      const { name, entityPath, description } =
        request.body as BackstageCustomFieldUpdateRequest;

      validateFieldInput(name, entityPath);

      const existing = await this.store.findCustomFieldById(id);
      if (!existing) throw new HttpError('Custom field not found', 404);

      const normalizedDesc = normalizeDescription(description, entityPath);

      const pagerDutyRequest: PagerDutyCustomFieldUpdateRequest = {
        field: { display_name: name, description: normalizedDesc },
      };

      try {
        await updateCustomField({
          fieldId: existing.pagerdutyCustomFieldId,
          request: pagerDutyRequest,
          account: existing.pagerdutySubdomain,
        });
      } catch (error) {
        if (error instanceof HttpError) handlePagerDutyError(error);
        throw error;
      }

      try {
        const customField = await this.store.updateCustomField(id, {
          pagerdutyCustomFieldDisplayName: name,
          backstageEntityMappingPath: entityPath,
          description: normalizedDesc,
        });

        this.logger.info(`Successfully updated custom field id=${id} (${name})`);
        response.status(200).json({ customField });
      } catch (error) {
        handleDbError(error);
      }
    } catch (error) {
      handleUnexpectedError(this.logger, error, 'updating the custom field', response);
    }
  }
}

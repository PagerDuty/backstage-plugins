import { LoggerService } from '@backstage/backend-plugin-api';
import { Request, Response } from 'express';
import { PagerDutyBackendStore } from '../db/PagerDutyBackendDatabase';
import { createCustomField } from '../apis/pagerduty';
import {
  BackstageCustomFieldCreateRequest,
  BackstageCustomFieldsResponse,
  HttpError,
  PagerDutyCustomFieldCreateRequest,
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
    try {
      const { name, entityPath, description } = request.body as BackstageCustomFieldCreateRequest;

      // Validate input
      if (!name || !entityPath) {
        response.status(400).json({
          errors: ['Missing required fields: name and entityPath are required'],
        });
        return;
      }

      const sanitizedName = this.sanitizeFieldName(name);
      if (!sanitizedName) {
        response.status(400).json({
          errors: ['Field name must contain at least one alphanumeric character'],
        });
        return;
      }

      const normalizedDescription =
        (description ?? '').trim() || `Backstage entity field: ${entityPath}`;

      // Get subdomain from config (or use 'default' for single account setup)
      const subdomain = this.getSubdomainFromRequest(request);

      // Create the custom field on PagerDuty
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
      } catch (error) {
        if (error instanceof HttpError) {
          if (error.status === 409) {
            response.status(409).json({
              errors: ['A custom field with this name already exists in PagerDuty'],
            });
            return;
          } else if (
            error.status === 400 && 
            (error.message.toLowerCase().includes('product limit reached'))) {
            response.status(400).json({
              errors: ['PagerDuty custom field limit reached. Maximum number of custom fields (15 or 30) has been exceeded.'],
            });
            return;
          } else if (error.status === 400) {
            // Pass through other 400 errors with clean message
            response.status(400).json({
              errors: [error.message],
            });
            return;
          }
        }
        throw error;
      }

      // Store the mapping in the database
      const customField = await this.store.insertCustomField({
        pagerdutyCustomFieldId: pagerDutyField.id,
        pagerdutyCustomFieldDisplayName: pagerDutyField.display_name,
        pagerdutyCustomFieldEnabled: pagerDutyField.enabled,
        backstageEntityMappingPath: entityPath,
        pagerdutySubdomain: subdomain,
        description: normalizedDescription,
      });

      this.logger.info(
        `Successfully created custom field: ${name} (${pagerDutyField.id}) mapped to ${entityPath}`,
      );

      response.status(201).json({
        customField,
      });
    } catch (error) {
      this.logger.error(`Failed to create custom field: ${error}`);
      
      if (error instanceof HttpError) {
        response.status(error.status).json({
          errors: [error.message],
        });
      } else {
        response.status(500).json({
          errors: ['An unexpected error occurred while creating the custom field'],
        });
      }
    }
  }

  async getCustomFields(request: Request, response: Response): Promise<void> {
    try {
      const subdomain = this.getSubdomainFromRequest(request);
      const customFields = await this.store.getAllCustomFields(subdomain);

      const responseData: BackstageCustomFieldsResponse = {
        customFields,
      };

      response.status(200).json(responseData);
    } catch (error) {
      this.logger.error(`Failed to get custom fields: ${error}`);
      response.status(500).json({
        errors: ['An unexpected error occurred while fetching custom fields'],
      });
    }
  }

  private getSubdomainFromRequest(request: Request): string {
    // Try to get account from query parameter or use 'default'
    const account = (request.query.account as string) || 'default';
    return account;
  }

  private sanitizeFieldName(name: string): string {
    // PagerDuty field names should be lowercase and use underscores
    return name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  }
}

import { LoggerService } from '@backstage/backend-plugin-api';
import { Request, Response } from 'express';
import { HttpError } from '@pagerduty/backstage-plugin-common';
import { PagerDutyBackendStore } from '../db/PagerDutyBackendDatabase';

/** Validates name + entityPath and returns the sanitized PD field name.
 *  Throws HttpError(400) if validation fails. */
export function validateFieldInput(
  name: string | undefined,
  entityPath: string | undefined,
): string {
  if (!name || !entityPath) {
    throw new HttpError(
      'Missing required fields: name and entityPath are required',
      400,
    );
  }
  const sanitizedName = sanitizeFieldName(name);
  if (!sanitizedName) {
    throw new HttpError(
      'Field name must contain at least one alphanumeric character',
      400,
    );
  }
  return sanitizedName;
}

/** Throws HttpError(409) if another field (excluding `excludeId`) already
 *  uses the given entity path. */
export async function checkEntityPathUnique(
  store: PagerDutyBackendStore,
  entityPath: string,
  excludeId?: number,
): Promise<void> {
  const conflict = await store.findCustomFieldByEntityPath(entityPath, excludeId);
  if (conflict) {
    throw new HttpError(
      'A custom field with this entity path already exists',
      409,
    );
  }
}

/** Translates well-known PagerDuty HttpErrors into clean HttpErrors and
 *  re-throws them to be handled by the outer catch. */
export function handlePagerDutyError(error: HttpError): never {
  if (error.status === 409) {
    throw new HttpError(
      'A custom field with this name already exists in PagerDuty',
      409,
    );
  }
  if (error.status === 404) {
    throw new HttpError('Custom field not found in PagerDuty', 404);
  }
  if (error.status === 400) {
    const message = error.message.toLowerCase().includes('product limit reached')
      ? 'PagerDuty custom field limit reached. Maximum number of custom fields (15 or 30) has been exceeded.'
      : error.message;
    throw new HttpError(message, 400);
  }
  throw error;
}

/** Logs and sends a 500 (or mapped HttpError status) for unexpected errors. */
export function handleUnexpectedError(
  logger: LoggerService,
  error: unknown,
  context: string,
  response: Response,
): void {
  logger.error(`Failed ${context}: ${error}`);
  if (error instanceof HttpError) {
    response.status(error.status).json({ errors: [error.message] });
  } else {
    response.status(500).json({
      errors: [`An unexpected error occurred while ${context}`],
    });
  }
}

export function normalizeDescription(
  description: string | undefined,
  entityPath: string,
): string {
  return (description ?? '').trim() || `Backstage custom field: ${entityPath}`;
}

export function getSubdomainFromRequest(request: Request): string {
  return (request.query.account as string) || 'default';
}

export function sanitizeFieldName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

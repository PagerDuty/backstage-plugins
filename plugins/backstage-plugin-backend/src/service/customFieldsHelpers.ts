import { LoggerService } from '@backstage/backend-plugin-api';
import { Request, Response } from 'express';
import { HttpError } from '@pagerduty/backstage-plugin-common';

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

/**
 * Detects DB unique constraint violations and throws an HttpError(409) with a
 * descriptive message. Re-throws the original error for all other cases.
 */
export function handleDbError(error: unknown): never {
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

/** Translates well-known PagerDuty HttpErrors into clean HttpErrors and
 *  re-throws them to be handled by the outer catch. */
export function handlePagerDutyError(error: HttpError): never {
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
    throw new HttpError('Custom field not found in PagerDuty', 404);
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

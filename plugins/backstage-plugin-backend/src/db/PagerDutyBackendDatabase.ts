import {
  PagerDutyEntityMapping,
  PagerDutySetting,
  BackstageCustomField,
  CustomFieldSyncLog,
  CustomFieldSyncLogFilters,
} from '@pagerduty/backstage-plugin-common';
import { resolvePackagePath } from '@backstage/backend-plugin-api';
import { Knex } from 'knex';
import { v4 as uuid } from 'uuid';

export type RawDbEntityResultRow = {
  id: string;
  entityRef: string;
  serviceId: string;
  integrationKey: string;
  account?: string;
  processedDate?: Date;
};

export type RawDbCustomFieldRow = {
  id: number;
  pagerdutyCustomFieldId: string;
  pagerdutyCustomFieldDisplayName: string;
  pagerdutyCustomFieldEnabled: boolean;
  backstageEntityMappingPath: string;
  pagerdutySubdomain: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type RawDbSyncLogRow = {
  id: number;
  timestamp: Date;
  errorCode: string;
  customFieldId: string;
  customFieldName: string;
  entityPath: string;
  serviceId: string;
  serviceName: string;
  errorMessage: string;
  subdomain: string;
};

/** @public */
export interface PagerDutyBackendStore {
  insertEntityMapping(entity: PagerDutyEntityMapping): Promise<string>;
  bulkInsertEntityMappings(
    entities: PagerDutyEntityMapping[],
  ): Promise<string[]>;
  getAllEntityMappings(): Promise<RawDbEntityResultRow[]>;
  findEntityMappingByEntityRef(
    entityRef: string,
  ): Promise<RawDbEntityResultRow | undefined>;
  findEntityMappingByServiceId(
    serviceId: string,
  ): Promise<RawDbEntityResultRow | undefined>;
  updateSetting(setting: PagerDutySetting): Promise<string>;
  findSetting(settingId: string): Promise<PagerDutySetting | undefined>;
  getAllSettings(): Promise<PagerDutySetting[]>;
  insertCustomField(customField: Omit<BackstageCustomField, 'id' | 'createdAt' | 'updatedAt'>): Promise<BackstageCustomField>;
  getAllCustomFields(subdomain: string): Promise<BackstageCustomField[]>;
  findCustomFieldById(id: number): Promise<BackstageCustomField | undefined>;
  updateCustomField(
    id: number,
    updates: {
      pagerdutyCustomFieldDisplayName: string;
      backstageEntityMappingPath: string;
      description?: string;
    },
  ): Promise<BackstageCustomField>;
  deleteCustomField(id: number): Promise<void>;
  updateCustomFieldPagerDutyId(id: number, pagerdutyCustomFieldId: string): Promise<void>;
  insertSyncLog(
    log: Omit<CustomFieldSyncLog, 'id' | 'timestamp'>,
  ): Promise<void>;
  getSyncLogs(
    subdomain: string,
    options?: SyncLogQueryOptions,
  ): Promise<{
    logs: CustomFieldSyncLog[];
    total: number;
    customFieldNames: string[];
    entityPaths: string[];
    serviceNames: string[];
  }>;
}

/** @public */
export type SyncLogQueryOptions = CustomFieldSyncLogFilters & {
  limit?: number;
  offset?: number;
};

const ERROR_SEVERITY_CODES = ['PD_API_ERROR', 'INVALID_PATH'] as const;

type Options = {
  skipMigrations?: boolean;
};

/** @public */
export class PagerDutyBackendDatabase implements PagerDutyBackendStore {
  static async create(
    knex: Knex,
    options?: Options,
  ): Promise<PagerDutyBackendStore> {
    if (!options?.skipMigrations) {
      const migrationsDir = resolvePackagePath(
        '@pagerduty/backstage-plugin-backend',
        'migrations',
      );

      await knex.migrate.latest({
        directory: migrationsDir,
        extension: 'js',
      });
    }

    return new PagerDutyBackendDatabase(knex);
  }

  constructor(private readonly db: Knex) {}

  async insertEntityMapping(entity: PagerDutyEntityMapping): Promise<string> {
    const entityMappingId = uuid();

    const [result] = await this.db<RawDbEntityResultRow>(
      'pagerduty_entity_mapping',
    )
      .insert({
        id: entityMappingId,
        entityRef: entity.entityRef,
        serviceId: entity.serviceId,
        integrationKey: entity.integrationKey,
        account: entity.account,
        processedDate: new Date(),
      })
      .onConflict(['serviceId'])
      .merge(['entityRef', 'integrationKey', 'account', 'processedDate'])
      .returning('id');

    return result.id;
  }

  async bulkInsertEntityMappings(
    entities: PagerDutyEntityMapping[],
  ): Promise<string[]> {
    if (entities.length === 0) {
      return [];
    }

    const rows = entities.map(entity => ({
      id: uuid(),
      entityRef: entity.entityRef,
      serviceId: entity.serviceId,
      integrationKey: entity.integrationKey,
      account: entity.account,
    }));

    const results = await this.db<RawDbEntityResultRow>(
      'pagerduty_entity_mapping',
    )
      .insert(rows)
      .returning('id');

    return results.map(r => r.id);
  }

  async getAllEntityMappings(): Promise<RawDbEntityResultRow[]> {
    const rawEntities = await this.db<RawDbEntityResultRow>(
      'pagerduty_entity_mapping',
    );

    if (!rawEntities) {
      return [];
    }

    return rawEntities;
  }

  async findEntityMappingByEntityRef(
    entityRef: string,
  ): Promise<RawDbEntityResultRow | undefined> {
    const rawEntity = await this.db<RawDbEntityResultRow>(
      'pagerduty_entity_mapping',
    )
      .where('entityRef', entityRef)
      .first();

    return rawEntity;
  }

  async findEntityMappingByServiceId(
    serviceId: string,
  ): Promise<RawDbEntityResultRow | undefined> {
    const rawEntity = await this.db<RawDbEntityResultRow>(
      'pagerduty_entity_mapping',
    )
      .where('serviceId', serviceId)
      .first();

    return rawEntity;
  }

  async updateSetting(setting: PagerDutySetting): Promise<string> {
    const [result] = await this.db<PagerDutySetting>('pagerduty_settings')
      .insert({
        id: setting.id,
        value: setting.value,
      })
      .onConflict(['id'])
      .merge(['value'])
      .returning('id');

    return result.id;
  }

  async findSetting(settingId: string): Promise<PagerDutySetting | undefined> {
    const rawEntity = await this.db<PagerDutySetting>('pagerduty_settings')
      .where('id', settingId)
      .first();

    return rawEntity;
  }

  async getAllSettings(): Promise<PagerDutySetting[]> {
    const rawEntities = await this.db<PagerDutySetting>('pagerduty_settings');

    if (!rawEntities) {
      return [];
    }

    return rawEntities;
  }

  async insertCustomField(
    customField: Omit<BackstageCustomField, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<BackstageCustomField> {
    await this.db<RawDbCustomFieldRow>('pagerduty_custom_fields').insert({
      pagerdutyCustomFieldId: customField.pagerdutyCustomFieldId,
      pagerdutyCustomFieldDisplayName: customField.pagerdutyCustomFieldDisplayName,
      pagerdutyCustomFieldEnabled: customField.pagerdutyCustomFieldEnabled,
      backstageEntityMappingPath: customField.backstageEntityMappingPath,
      pagerdutySubdomain: customField.pagerdutySubdomain,
      description: customField.description,
    });

    const result = await this.db<RawDbCustomFieldRow>(
      'pagerduty_custom_fields',
    )
      .where({
        pagerdutyCustomFieldId: customField.pagerdutyCustomFieldId,
        pagerdutySubdomain: customField.pagerdutySubdomain,
      })
      .orderBy('createdAt', 'desc')
      .first();

    if (!result) {
      throw new Error(
        'Failed to retrieve custom field after insert into pagerduty_custom_fields',
      );
    }

    return {
      id: result.id,
      pagerdutyCustomFieldId: result.pagerdutyCustomFieldId,
      pagerdutyCustomFieldDisplayName: result.pagerdutyCustomFieldDisplayName,
      pagerdutyCustomFieldEnabled: result.pagerdutyCustomFieldEnabled,
      backstageEntityMappingPath: result.backstageEntityMappingPath,
      pagerdutySubdomain: result.pagerdutySubdomain,
      description: result.description,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  async findCustomFieldById(id: number): Promise<BackstageCustomField | undefined> {
    const result = await this.db<RawDbCustomFieldRow>('pagerduty_custom_fields')
      .where('id', id)
      .first();

    return result;
  }

  async updateCustomField(
    id: number,
    updates: {
      pagerdutyCustomFieldDisplayName: string;
      backstageEntityMappingPath: string;
      description?: string;
    },
  ): Promise<BackstageCustomField> {
    const rowsAffected = await this.db<RawDbCustomFieldRow>('pagerduty_custom_fields')
      .where('id', id)
      .update({
        pagerdutyCustomFieldDisplayName: updates.pagerdutyCustomFieldDisplayName,
        backstageEntityMappingPath: updates.backstageEntityMappingPath,
        description: updates.description,
        updatedAt: new Date(),
      });

    if (rowsAffected === 0) {
      throw new Error(`Custom field with id ${id} does not exist`);
    }

    const result = await this.db<RawDbCustomFieldRow>('pagerduty_custom_fields')
      .where('id', id)
      .first();

    if (!result) {
      throw new Error(`Failed to retrieve custom field after update for id: ${id}`);
    }

    return result;
  }

  async getAllCustomFields(subdomain: string): Promise<BackstageCustomField[]> {
    const rawFields = await this.db<RawDbCustomFieldRow>(
      'pagerduty_custom_fields',
    ).where('pagerdutySubdomain', subdomain);

    if (!rawFields) {
      return [];
    }

    return rawFields.map(field => ({
      id: field.id,
      pagerdutyCustomFieldId: field.pagerdutyCustomFieldId,
      pagerdutyCustomFieldDisplayName: field.pagerdutyCustomFieldDisplayName,
      pagerdutyCustomFieldEnabled: field.pagerdutyCustomFieldEnabled,
      backstageEntityMappingPath: field.backstageEntityMappingPath,
      pagerdutySubdomain: field.pagerdutySubdomain,
      description: field.description,
      createdAt: field.createdAt,
      updatedAt: field.updatedAt,
    }));
  }

  async deleteCustomField(id: number): Promise<void> {
    await this.db<RawDbCustomFieldRow>('pagerduty_custom_fields')
      .where('id', id)
      .delete();
  }

  async updateCustomFieldPagerDutyId(
    id: number,
    pagerdutyCustomFieldId: string,
  ): Promise<void> {
    await this.db<RawDbCustomFieldRow>('pagerduty_custom_fields')
      .where('id', id)
      .update({
        pagerdutyCustomFieldId,
        updatedAt: new Date(),
      });
  }

  async insertSyncLog(
    log: Omit<CustomFieldSyncLog, 'id' | 'timestamp'>,
  ): Promise<void> {
    await this.db<RawDbSyncLogRow>('pagerduty_custom_field_sync_logs').insert({
      errorCode: log.errorCode,
      customFieldId: log.customFieldId,
      customFieldName: log.customFieldName,
      entityPath: log.entityPath,
      serviceId: log.serviceId,
      serviceName: log.serviceName,
      errorMessage: log.errorMessage,
      subdomain: log.subdomain,
    });
  }

  async getSyncLogs(
    subdomain: string,
    options?: SyncLogQueryOptions,
  ): Promise<{
    logs: CustomFieldSyncLog[];
    total: number;
    customFieldNames: string[];
    entityPaths: string[];
    serviceNames: string[];
  }> {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const baseQuery = () => {
      let q = this.db<RawDbSyncLogRow>('pagerduty_custom_field_sync_logs')
        .where('subdomain', subdomain);

      if (options?.severity === 'error') {
        q = q.where(builder =>
          builder
            .whereIn('errorCode', [...ERROR_SEVERITY_CODES])
            .orWhereRaw('LOWER(??) LIKE ?', ['errorCode', '%error%']),
        );
      } else if (options?.severity === 'warning') {
        q = q
          .whereNotIn('errorCode', [...ERROR_SEVERITY_CODES])
          .whereRaw('LOWER(??) NOT LIKE ?', ['errorCode', '%error%']);
      }

      if (options?.customFieldName) {
        q = q.where('customFieldName', options.customFieldName);
      }
      if (options?.entityPath) {
        q = q.where('entityPath', options.entityPath);
      }
      if (options?.serviceName) {
        q = q.where('serviceName', options.serviceName);
      }
      if (options?.search) {
        const pattern = `%${options.search.toLowerCase()}%`;
        q = q.where(builder =>
          builder
            .whereRaw('LOWER(??) LIKE ?', ['errorMessage', pattern])
            .orWhereRaw('LOWER(??) LIKE ?', ['customFieldName', pattern])
            .orWhereRaw('LOWER(??) LIKE ?', ['entityPath', pattern])
            .orWhereRaw('LOWER(??) LIKE ?', ['serviceName', pattern])
            .orWhereRaw('LOWER(??) LIKE ?', ['errorCode', pattern]),
        );
      }

      return q;
    };

    const [logs, countResult, customFields, entityPaths, services] =
      await Promise.all([
        baseQuery().orderBy('timestamp', 'desc').limit(limit).offset(offset),
        baseQuery().count('* as count').first(),
        this.db<RawDbSyncLogRow>('pagerduty_custom_field_sync_logs')
          .where('subdomain', subdomain)
          .whereNotNull('customFieldName')
          .distinct('customFieldName')
          .orderBy('customFieldName', 'asc'),
        this.db<RawDbSyncLogRow>('pagerduty_custom_field_sync_logs')
          .where('subdomain', subdomain)
          .whereNotNull('entityPath')
          .distinct('entityPath')
          .orderBy('entityPath', 'asc'),
        this.db<RawDbSyncLogRow>('pagerduty_custom_field_sync_logs')
          .where('subdomain', subdomain)
          .whereNotNull('serviceName')
          .distinct('serviceName')
          .orderBy('serviceName', 'asc'),
      ]);

    const total = countResult ? Number((countResult as any).count) : 0;

    return {
      logs: logs || [],
      total,
      customFieldNames: customFields.map(r => r.customFieldName).filter(Boolean),
      entityPaths: entityPaths.map(r => r.entityPath).filter(Boolean),
      serviceNames: services.map(r => r.serviceName).filter(Boolean),
    };
  }
}

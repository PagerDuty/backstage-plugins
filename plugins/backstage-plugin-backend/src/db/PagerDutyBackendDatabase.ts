import {
  PagerDutyEntityMapping,
  PagerDutySetting,
  BackstageCustomField,
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
}

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
}

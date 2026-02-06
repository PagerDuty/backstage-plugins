import {
  PagerDutyEntityMapping,
  PagerDutySetting,
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
}

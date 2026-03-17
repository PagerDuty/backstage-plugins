/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('pagerduty_custom_fields', table => {
    table.unique(
      ['backstageEntityMappingPath', 'pagerdutySubdomain'],
      { indexName: 'pagerduty_cf_entitypath_subdomain_unique' },
    );
    table.unique(
      ['pagerdutyCustomFieldDisplayName', 'pagerdutySubdomain'],
      { indexName: 'pagerduty_cf_displayname_subdomain_unique' },
    );
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('pagerduty_custom_fields', table => {
    table.dropUnique([], 'pagerduty_cf_entitypath_subdomain_unique');
    table.dropUnique([], 'pagerduty_cf_displayname_subdomain_unique');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */


exports.up = async function up(knex) {
  return knex.schema.createTable('pagerduty_custom_fields', table => {
    table.increments('id').primary();
    table.string('pagerdutyCustomFieldId').notNullable();
    table.string('pagerdutyCustomFieldDisplayName').notNullable();
    table.boolean('pagerdutyCustomFieldEnabled').notNullable().defaultTo(true);
    table.string('backstageEntityMappingPath').notNullable();
    table.string('pagerdutySubdomain').notNullable();
    table.string('description');
    table.index(['pagerdutyCustomFieldId'], 'pagerduty_custom_field_id_idx');
    table.dateTime('updatedAt').defaultTo(knex.fn.now());
    table.dateTime('createdAt').defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('pagerduty_custom_fields', table => {
    table.dropIndex([], 'pagerduty_custom_field_id_idx');
  });
  return knex.schema.dropTable('pagerduty_custom_fields');
};

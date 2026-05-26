/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  return knex.schema.createTable('pagerduty_custom_field_sync_logs', table => {
    table.increments('id').primary();
    table.dateTime('timestamp').notNullable().defaultTo(knex.fn.now());
    table.string('errorCode').notNullable();
    table.string('customFieldId').notNullable();
    table.string('customFieldName').notNullable();
    table.string('entityPath').notNullable();
    table.string('serviceId').notNullable();
    table.string('serviceName').notNullable();
    table.text('errorMessage').notNullable();
    table.string('subdomain').notNullable();
    table.index(['subdomain', 'timestamp'], 'sync_logs_subdomain_timestamp_idx');
    table.index(['serviceId'], 'sync_logs_service_id_idx');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('pagerduty_custom_field_sync_logs', table => {
    table.dropIndex([], 'sync_logs_subdomain_timestamp_idx');
    table.dropIndex([], 'sync_logs_service_id_idx');
  });
  return knex.schema.dropTable('pagerduty_custom_field_sync_logs');
};

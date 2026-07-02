/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  return knex.schema.alterTable('pagerduty_custom_field_sync_logs', table => {
    table.index(['timestamp'], 'sync_logs_timestamp_idx');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  return knex.schema.alterTable('pagerduty_custom_field_sync_logs', table => {
    table.dropIndex([], 'sync_logs_timestamp_idx');
  });
};

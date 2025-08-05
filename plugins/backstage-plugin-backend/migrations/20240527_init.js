/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('pagerduty_entity_mapping', table => {
    table.bigIncrements('index').notNullable();
    table.string('id').notNullable();
    table.string('serviceId').unique().notNullable();
    table.string('integrationKey');
    table.string('entityRef');
    table.dateTime('processedDate').defaultTo(knex.fn.now());
    table.index('index', 'entity_mapping_index_idx');
    table.index(['serviceId', 'entityRef'], 'entity_mapping_service_id_idx');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('pagerduty_entity_mapping', table => {
    table.dropIndex([], 'entity_mapping_index_idx');
    table.dropIndex([], 'entity_mapping_service_id_idx');
  });
  await knex.schema.dropTable('pagerduty_entity_mapping');
};

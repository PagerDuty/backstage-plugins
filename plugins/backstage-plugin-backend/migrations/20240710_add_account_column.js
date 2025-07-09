/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
    await knex.schema.alterTable('pagerduty_entity_mapping', table => {
        table.string('account');
        table.dropIndex(['serviceId', 'entityRef'], 'entity_mapping_service_id_idx');
        table.index(['serviceId', 'entityRef', 'account'], 'entity_mapping_service_id_idx');
    });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
    await knex.schema.alterTable('pagerduty_entity_mapping', table => {
        table.dropColumn('account');
        table.dropIndex([], 'entity_mapping_service_id_idx');
    });
};
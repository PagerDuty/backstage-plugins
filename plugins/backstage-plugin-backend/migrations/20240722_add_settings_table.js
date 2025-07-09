/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
    await knex.schema.createTable('pagerduty_settings', table => {
        table
            .string('id')
            .unique()
            .notNullable();
        table
            .string('value');
        table
            .dateTime('updatedAt')
            .defaultTo(knex.fn.now());
        table.index(['id'], 'settings_id_idx');
    });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
    await knex.schema.alterTable('pagerduty_settings', table => {
        table.dropIndex([], 'settings_id_idx');
    });
    await knex.schema.dropTable('pagerduty_settings');
};
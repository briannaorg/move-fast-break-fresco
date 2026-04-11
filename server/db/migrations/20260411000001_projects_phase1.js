// Recreates projects with nullable template_id (Phase 1 projects are
// categorization buckets — template is chosen later in Sinopia).
// Also adds project_images for the image→project association with
// template_type and blend_mode metadata.
//
// Safe to drop/recreate project_layers and project_pages: no data in those
// tables at this point in Phase 1.

exports.up = async function (knex) {
  await knex.schema.dropTableIfExists('project_pages');
  await knex.schema.dropTableIfExists('project_layers');
  await knex.schema.dropTableIfExists('projects');

  await knex.schema.createTable('projects', (t) => {
    t.increments('id').primary();
    t.integer('user_id').notNullable().references('id').inTable('users');
    t.string('name').notNullable();
    t.string('template_id'); // nullable until chosen in Sinopia
    t.text('customizations').defaultTo('{}');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('project_layers', (t) => {
    t.increments('id').primary();
    t.integer('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    t.integer('image_id').references('id').inTable('images');
    t.string('layer_name').notNullable();
    t.string('blend_mode');
    t.text('settings').defaultTo('{}');
  });

  await knex.schema.createTable('project_pages', (t) => {
    t.increments('id').primary();
    t.integer('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    t.string('page_name').notNullable();
    t.text('content').defaultTo('{}');
    t.integer('page_order').defaultTo(0);
  });

  await knex.schema.createTable('project_images', (t) => {
    t.increments('id').primary();
    t.integer('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    t.integer('image_id').notNullable().references('id').inTable('images').onDelete('CASCADE');
    t.text('template_types').defaultTo('[]'); // JSON string[]
    t.text('blend_modes').defaultTo('[]');    // JSON string[]
    t.unique(['project_id', 'image_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('project_images');
  await knex.schema.dropTableIfExists('project_pages');
  await knex.schema.dropTableIfExists('project_layers');
  await knex.schema.dropTableIfExists('projects');
};

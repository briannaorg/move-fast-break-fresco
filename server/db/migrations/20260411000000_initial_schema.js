exports.up = function (knex) {
  return knex.schema
    .createTable('users', (t) => {
      t.increments('id').primary();
      t.string('username').notNullable();
      t.string('email').notNullable().unique();
      t.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('images', (t) => {
      t.increments('id').primary();
      t.integer('user_id').notNullable().references('id').inTable('users');
      t.string('source').notNullable();
      t.string('source_id').notNullable();
      t.string('title');
      t.string('artist');
      t.string('date');
      t.string('original_path');
      t.string('source_url');
      t.text('metadata').defaultTo('{}');
      t.text('palette').defaultTo('[]');
      t.string('status').defaultTo('pending');
      t.text('error_message');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.unique(['source', 'source_id', 'user_id']);
    })
    .createTable('image_variants', (t) => {
      t.increments('id').primary();
      t.integer('image_id').notNullable().references('id').inTable('images').onDelete('CASCADE');
      t.string('variant_type').notNullable();
      t.string('path').notNullable();
      t.integer('width');
      t.integer('height');
    })
    .createTable('image_tags', (t) => {
      t.increments('id').primary();
      t.integer('image_id').notNullable().references('id').inTable('images').onDelete('CASCADE');
      t.string('tag').notNullable();
    })
    .raw('CREATE INDEX idx_image_tags_image_id ON image_tags(image_id)')
    .raw('CREATE INDEX idx_image_tags_tag ON image_tags(tag)')
    .createTable('projects', (t) => {
      t.increments('id').primary();
      t.integer('user_id').notNullable().references('id').inTable('users');
      t.string('name').notNullable();
      t.string('template_id').notNullable();
      t.text('customizations').defaultTo('{}');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('project_layers', (t) => {
      t.increments('id').primary();
      t.integer('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
      t.integer('image_id').references('id').inTable('images');
      t.string('layer_name').notNullable();
      t.string('blend_mode');
      t.text('settings').defaultTo('{}');
    })
    .createTable('project_pages', (t) => {
      t.increments('id').primary();
      t.integer('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
      t.string('page_name').notNullable();
      t.text('content').defaultTo('{}');
      t.integer('page_order').defaultTo(0);
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('project_pages')
    .dropTableIfExists('project_layers')
    .dropTableIfExists('projects')
    .dropTableIfExists('image_tags')
    .dropTableIfExists('image_variants')
    .dropTableIfExists('images')
    .dropTableIfExists('users');
};

exports.seed = async function (knex) {
  const existing = await knex('users').where({ id: 1 }).first();
  if (!existing) {
    await knex('users').insert({
      id: 1,
      username: 'default',
      email: 'default@fresco.local',
    });
  }
};

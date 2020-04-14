exports.up = (knex) =>
  knex.schema.createTable(process.env.JWT_ORACLE_TABLE_NAME, (table) => {
    table.string("key", 255).primary();
    table.bigInteger("expiredAt").unsigned().defaultTo(Number.MAX_SAFE_INTEGER);
  });

exports.down = (knex) =>
  knex.schema.dropTable(process.env.JWT_ORACLE_TABLE_NAME);

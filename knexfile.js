module.exports = {
  development: {
    client: "oracledb",
    connection: {
      host: process.env.DATABASE_HOST,
      port: process.env.DATABASE_PORT,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: "knex_migrations",
      directory: `src/migrations`,
    },
    seeds: {
      directory: `src/seeds`,
    },
    debug: process.env.SQL_DEBUG === "true",
  },
};

# jwt-knex

This library completely repeats the entire functionality of the library [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken), with one important addition.
jwt-knex allows you to store the token label in database with [knex](https://www.npmjs.com/package/knex) to verify validity.
The absence of a token label in redis makes the token not valid. To destroy the token in **jwt-knex**, there is a destroy method.
This makes it possible to make a token not valid until it expires.

The package is tested with oracledb but should be working just when passing an instance of **knex** in.

This package is inspired by [jwt-redis](https://www.npmjs.com/package/jwt-redis)

## Installation

```bash
npm install jwt-knex
```

## Support

This library is implemented as a part of other project and might contains bugs. Please create an issue on github, any contribution are welcomed.

## Quick start

```javascript
const knex = require("knex")(knexConfig);
const JWT = require("jwt-knex");

const secretOrPrivateKey = "secret";
const jwt = new JwtKnex({
  knex,
  secretOrPrivateKey,
});

const payload = {
  sub: "1234567890",
  name: "John Doe",
  admin: true,
  jti: "jti",
};

jwt
  .sign({ payload, expiresIn: "10h" })
  .then(token => jwt.verify({ token }))
  .then(() => jwt.destroy({ jti: payload.jti }));
```

// TODO: documenting the APIs

## Contribution

1. Clone this repo
2. Start the docker compose
    ```properties
    docker-compose up
    ```
1. Migrate the database
    ```properties
    npm run knex -- migrate:latest
    ```
1. Run tests
    ```properties
    npm t
    ```
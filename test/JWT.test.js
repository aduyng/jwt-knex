const JsonWebToken = require("jsonwebtoken");
const Knex = require("knex");
const TokenDestroyedError = require("../src/error/TokenDestroyedError");
const knexConfig = require("../knexfile");
const JWT = require("../src/JWT");

describe("JWT", () => {
  let knex;
  const tableName = process.env.JWT_ORACLE_TABLE_NAME || "JWT_ORACLE";

  beforeAll(async () => {
    knex = Knex(knexConfig[process.env.NODE_ENV]);
  });

  beforeEach(async () => {
    await knex(tableName).truncate();
  });

  test("should create an instance of JWT", () => {
    const secretOrPrivateKey = "shhh";
    const options = { algorithm: "RS256" };
    const secretOrPublicKey = "public-key";
    const jwt = new JWT({
      knex,
      secretOrPrivateKey,
      secretOrPublicKey,
      tableName,
      ...options,
    });
    expect(jwt).toBeInstanceOf(JWT);
    expect(jwt).toHaveProperty("tableName");
    expect(jwt.tableName).toEqual(tableName);
    expect(jwt.knex).toBe(knex);
    expect(jwt.secretOrPrivateKey).toEqual(secretOrPrivateKey);
    expect(jwt.secretOrPublicKey).toEqual(secretOrPublicKey);
    expect(jwt.options).toEqual(options);
  });

  test("should sign correctly", async () => {
    const secretOrPrivateKey = "shhh";
    const options = { algorithm: "HS256" };
    const jwt = new JWT({ knex, secretOrPrivateKey, tableName, ...options });
    const payload = {
      sub: "1234567890",
      name: "John Doe",
      admin: true,
      jti: "jti",
    };
    const signOptions = { expiresIn: "10h" };
    const token = await jwt.sign({ payload, ...signOptions });
    const expected = JsonWebToken.sign(
      payload,
      secretOrPrivateKey,
      signOptions
    );
    expect(token).toEqual(expected);
    expect(await knex(tableName).count("key")).toEqual([{ 'COUNT("KEY")': 1 }]);
    const row = await knex(tableName).first();
    expect(row).toHaveProperty("expiredAt");
    expect(row).toHaveProperty("key");
  });

  test("should sign correctly without any expiration", async () => {
    const secretOrPrivateKey = "shhh";
    const options = { algorithm: "HS256" };
    const jwt = new JWT({ knex, secretOrPrivateKey, tableName, ...options });
    const payload = {
      sub: "1234567890",
      name: "John Doe",
      admin: true,
      jti: "jti",
    };
    const signOptions = {};
    const token = await jwt.sign({ payload, ...signOptions });
    const expected = JsonWebToken.sign(
      payload,
      secretOrPrivateKey,
      signOptions
    );
    expect(token).toEqual(expected);
    expect(await knex(tableName).count("key")).toEqual([{ 'COUNT("KEY")': 1 }]);
    const row = await knex(tableName).first();
    expect(row.expiredAt).toEqual(Number.MAX_SAFE_INTEGER);
    expect(row.key).toEqual("jwt_labeljti");
  });

  test("should sign correctly with random jti", async () => {
    const secretOrPrivateKey = "shhh";
    const options = { algorithm: "HS256" };
    const jwt = new JWT({ knex, secretOrPrivateKey, tableName, ...options });
    const payload = {
      sub: "1234567890",
      name: "John Doe",
      admin: true,
    };
    const signOptions = { expiresIn: "1d" };
    const token = await jwt.sign({ payload, ...signOptions });

    expect(await knex(tableName).count("key")).toEqual([{ 'COUNT("KEY")': 1 }]);
    const row = await knex(tableName).first();
    expect(row).toHaveProperty("expiredAt");
    expect(row).toHaveProperty("key");
    expect(token).toBeTruthy();
  });

  test("should destroy correctly", async () => {
    const secretOrPrivateKey = "shhh";
    const options = { algorithm: "HS256" };
    const jwt = new JWT({ knex, secretOrPrivateKey, tableName, ...options });
    const payload = {
      sub: "1234567890",
      name: "John Doe",
      admin: true,
      jti: "jti",
    };
    const signOptions = { expiresIn: "10h" };
    await jwt.sign({ payload, ...signOptions });
    expect(await knex(tableName).count("key")).toEqual([{ 'COUNT("KEY")': 1 }]);
    await jwt.destroy({ jti: payload.jti });
    expect(await knex(tableName).count("key")).toEqual([{ 'COUNT("KEY")': 0 }]);
  });

  test("should decode correctly", async () => {
    const secretOrPrivateKey = "shhh";
    const options = { algorithm: "HS256" };
    const jwt = new JWT({ knex, secretOrPrivateKey, tableName, ...options });
    const payload = {
      sub: "1234567890",
      name: "John Doe",
      admin: true,
      jti: "jti",
    };
    const signOptions = { expiresIn: "2d" };
    const token = await jwt.sign({ payload, ...signOptions });
    const decoded = jwt.decode({ token });
    const decodeByOriginalJWT = JsonWebToken.decode(token);
    expect(decoded).toEqual(decodeByOriginalJWT);
  });

  test("should verify correctly", async () => {
    const secretOrPrivateKey = "shhh";
    const options = { algorithm: "HS256" };
    const jwt = new JWT({ knex, secretOrPrivateKey, tableName, ...options });
    const payload = {
      sub: "1234567890",
      name: "John Doe",
      admin: true,
      jti: "jti99",
    };
    const signOptions = { expiresIn: "2d" };
    const token = await jwt.sign({ payload, ...signOptions });
    const decoded = await jwt.verify({ token });
    expect(decoded.sub).toEqual(payload.sub);
    expect(decoded.name).toEqual(payload.name);
    expect(decoded.admin).toEqual(payload.admin);
    expect(decoded.jti).toEqual(payload.jti);
  });

  test("should verify and return expired token", async () => {
    const secretOrPrivateKey = "shhh";
    const options = { algorithm: "HS256" };
    const jwt = new JWT({ knex, secretOrPrivateKey, tableName, ...options });
    const payload = {
      sub: "1234567890",
      name: "John Doe",
      admin: true,
      jti: "jti99",
    };
    const signOptions = { expiresIn: "1m" };
    const token = await jwt.sign({ payload, ...signOptions });
    await knex(tableName).update({
      expiredAt: Math.floor(Date.now() / 1000 - 61000),
    });
    let thrown;
    try {
      await jwt.verify({ token });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(TokenDestroyedError);
  });
});

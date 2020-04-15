const JsonWebToken = require("jsonwebtoken");
const TokenDestroyedError = require("./error/TokenDestroyedError");
const TokenInvalidError = require("./error/TokenInvalidError");
const generateId = require("./generateId");

class JWT {
  constructor({
    knex,
    tableName = process.env.JWT_ORACLE_TABLE_NAME || "JWT_ORACLE",
    keyPrefix = "jwt_label",
    secretOrPrivateKey,
    secretOrPublicKey,
    ...options
  }) {
    this.knex = knex;
    this.tableName = tableName;
    this.secretOrPrivateKey = secretOrPrivateKey;
    this.secretOrPublicKey = secretOrPublicKey;
    this.keyPrefix = keyPrefix;
    this.options = options;
  }

  getKey({ jti }) {
    return this.keyPrefix + jti;
  }

  sign({ payload, secretOrPrivateKey, ...options }) {
    const jti = payload.jti || generateId(10);
    return new Promise((resolve, reject) => {
      JsonWebToken.sign(
        { ...payload, jti },
        secretOrPrivateKey || this.secretOrPrivateKey,
        { ...this.options, ...options },
        (error, token) => {
          if (error) {
            return reject(error);
          }

          return resolve(token);
        }
      );
    }).then((token) => {
      const decoded = JsonWebToken.decode(token);
      const key = this.getKey({ jti });
      if (decoded.exp) {
        return this.knex(this.tableName)
          .insert({
            key,
            expiredAt: decoded.exp,
          })
          .then(() => token);
      }
      return this.knex(this.tableName)
        .insert({ key })
        .then(() => token);
    });
  }

  destroy({ jti }) {
    const key = this.getKey({ jti });
    return this.knex(this.tableName).where("key", key).del();
  }

  decode({ token, ...options }) {
    return JsonWebToken.decode(token, { ...this.options, ...options });
  }

  verify({ token, secretOrPublicKey, ...options }) {
    return new Promise((resolve, reject) => {
      return JsonWebToken.verify(
        token,
        secretOrPublicKey || this.secretOrPublicKey || this.secretOrPrivateKey,
        { ...this.options, ...options },
        (err, decoded) => {
          if (err) {
            return reject(err);
          }
          return resolve(decoded);
        }
      );
    }).then((decoded) => {
      if (!decoded.jti) {
        throw new TokenInvalidError();
      }
      const key = this.getKey({ jti: decoded.jti });
      return this.knex(this.tableName)
        .where("key", key)
        .where("expiredAt", ">=", Math.floor(Date.now() / 1000))
        .limit(1)
        .first()
        .then((result) => {
          if (!result) {
            throw new TokenDestroyedError();
          }
          return decoded;
        });
    });
  }
}

module.exports = JWT;

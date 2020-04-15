const JsonWebToken = require("jsonwebtoken");
const TokenDestroyedError = require("./error/TokenDestroyedError");
const TokenInvalidError = require("./error/TokenInvalidError");
const generateId = require("./generateId");

class JWT {
  /**
   * @constructor
   * @param {Knex} knex the knex connection
   * @param {String} tableName the table name, default to process.env.JWT_ORACLE_TABLE_NAME or "JWT_ORACLE" (optional)
   * @param {String} keyPrefix the prefix to create jti (optional)
   * @param {String} secretOrPrivateKey the secret or private key
   * @param {String} secretOrPublicKey the public or private key, default to secretOrPrivateKey (optional)
   * @param {Object} options additional options (optional)
   */
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

  /**
   * append prefix with key
   * @param {String} jti
   * @returns {string} the jti appended with prefix
   * @private
   */
  getKey({ jti }) {
    return this.keyPrefix + jti;
  }

  /**
   * sign the token
   * @param {Object} payload the payload to sign
   * @param {String} secretOrPrivateKey the secret or private key (optional)
   * @param {Object} options additional options (optional)
   * @returns {Promise<{token, jtk}>} the result with token included
   * @public
   */
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
          .then(() => ({ ...decoded, token }));
      }
      return this.knex(this.tableName)
        .insert({ key })
        .then(() => ({ ...decoded, token }));
    });
  }

  /**
   * destroying the token based on jti
   * @param {String} jti the jti used to create the key in Knex table
   * @returns {Promise<Boolean>} true if successfully deleted
   * @public
   */
  destroy({ jti }) {
    const key = this.getKey({ jti });
    return this.knex(this.tableName)
      .where("key", key)
      .del()
      .then(() => true);
  }

  /**
   * decoding the token
   * @param {String} token the token to decode
   * @param {Object} options additional options (optional)
   * @returns {null|{payload, signature, header: (string|{isValid: *, message: string})}}
   * @public
   */
  decode({ token, ...options }) {
    return JsonWebToken.decode(token, { ...this.options, ...options });
  }

  /**
   * verifying token
   * @param {String} token the token to verify
   * @param {String} secretOrPublicKey the secret or public key (optional)
   * @param {Object }options the remaining options (optional)
   * @returns {Promise<null|{payload, signature, header: (string|{isValid: *, message: string})}>} the decoded payload
   * @public
   */
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

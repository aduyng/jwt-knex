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
    log = console,
    selfClean = true,
    ...options
  }) {
    this.knex = knex;
    this.tableName = tableName;
    this.secretOrPrivateKey = secretOrPrivateKey;
    this.secretOrPublicKey = secretOrPublicKey;
    this.keyPrefix = keyPrefix;
    this.options = options;
    this.log = log;
    this.selfClean = selfClean;
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
   * perform self cleaning
   * @returns {Promise<void>|Promise<boolean>}
   * @private
   */
  clean() {
    if (!this.selfClean) {
      return Promise.resolve(true);
    }
    const expiredAt = Math.floor(Date.now() / 1000);
    return this.knex(this.tableName)
      .where("expiredAt", "<", expiredAt)
      .del()
      .then((deleted) =>
        this.log.debug(`${__filename}$ ${deleted} entries have been removed.`)
      );
  }

  /**
   * sign the token
   * @param {Object} payload the payload to sign
   * @param {String} secretOrPrivateKey the secret or private key (optional)
   * @param {Object} options additional options (optional)
   * @returns {Promise<token>} the signed token
   * @public
   */
  sign({ payload, secretOrPrivateKey, ...options }) {
    const jti = payload.jti || generateId(10);
    const body = { ...payload, jti };
    const secret = secretOrPrivateKey || this.secretOrPrivateKey;
    const opts = { ...this.options, ...options };
    this.log.debug(
      `${__filename}$ about to sign payload: ${JSON.stringify(
        body
      )}, options: ${JSON.stringify(opts)}`
    );
    return new Promise((resolve, reject) => {
      JsonWebToken.sign(body, secret, opts, (error, token) => {
        if (error) {
          return reject(error);
        }

        return resolve(token);
      });
    })
      .then((token) => {
        const decoded = JsonWebToken.decode(token);
        const key = this.getKey({ jti });

        this.log.debug(`${__filename}$ token signed: ${token}, key: ${key}`);

        if (decoded.exp) {
          this.log.debug(`${__filename}$ token will expires at ${decoded.exp}`);
          return this.knex(this.tableName)
            .insert({
              key,
              expiredAt: decoded.exp,
            })
            .then(() => token);
        }
        this.log.debug(`${__filename}$ token won't be expired`);
        return this.knex(this.tableName)
          .insert({ key })
          .then(() => token);
      })
      .then((token) => this.clean().then(() => token));
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
      .then(() => this.clean())
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
      const secret =
        secretOrPublicKey || this.secretOrPublicKey || this.secretOrPrivateKey;
      const opts = { ...this.options, ...options };
      this.log.debug(
        `${__filename}$ verifying token ${token}, options: ${JSON.stringify(
          opts
        )}`
      );
      return JsonWebToken.verify(token, secret, opts, (err, decoded) => {
        if (err) {
          return reject(err);
        }
        return resolve(decoded);
      });
    }).then((decoded) => {
      if (!decoded.jti) {
        this.log.debug(`${__filename}$ decoded token does not have jti`);
        throw new TokenInvalidError("jti is missing from the decoded token");
      }
      const key = this.getKey({ jti: decoded.jti });
      const expiredAt = Math.floor(Date.now() / 1000);
      this.log.debug(
        `${__filename}$ querying with key ${key}, expiredAt: ${expiredAt}`
      );
      return this.knex(this.tableName)
        .where("key", key)
        .where("expiredAt", ">=", expiredAt)
        .limit(1)
        .first()
        .then((result) => {
          if (!result) {
            throw new TokenDestroyedError("token is not found.");
          }
          return this.clean().then(() => decoded);
        });
    });
  }
}

module.exports = JWT;

const { randomUUID } = require("node:crypto");
const Game = require("./game");

const ROOM_TTL_SECONDS = 24 * 60 * 60;
const LOCK_TTL_MS = 10000;

class GameStore {
  constructor(redis = null) {
    this.redis = redis;
    this.local = new Map();
    this.localQueues = new Map();
  }

  key(roomId) {
    return `ace-race:room:${roomId}`;
  }

  async get(roomId) {
    if (!roomId) return null;
    if (!this.redis) return this.local.get(roomId) || null;
    const raw = await this.redis.get(this.key(roomId));
    return raw ? Game.fromJSON(JSON.parse(raw)) : null;
  }

  async create(game) {
    if (!this.redis) {
      if (this.local.has(game.gameId)) return false;
      this.local.set(game.gameId, game);
      return true;
    }
    const result = await this.redis.set(
      this.key(game.gameId),
      JSON.stringify(game),
      "EX",
      ROOM_TTL_SECONDS,
      "NX",
    );
    return result === "OK";
  }

  async update(roomId, change) {
    if (!this.redis) {
      const previous = this.localQueues.get(roomId) || Promise.resolve();
      const work = previous
        .catch(() => {})
        .then(async () => {
          const game = this.local.get(roomId);
          if (!game) return null;
          const result = await change(game);
          if (result?.delete) this.local.delete(roomId);
          return result;
        });
      this.localQueues.set(roomId, work);
      try {
        return await work;
      } finally {
        if (this.localQueues.get(roomId) === work) this.localQueues.delete(roomId);
      }
    }

    const lockKey = `${this.key(roomId)}:lock`;
    const token = randomUUID();
    let acquired = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      acquired =
        (await this.redis.set(lockKey, token, "PX", LOCK_TTL_MS, "NX")) === "OK";
      if (acquired) break;
      await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 30));
    }
    if (!acquired) throw new Error(`Room ${roomId} is busy`);

    try {
      const game = await this.get(roomId);
      if (!game) return null;
      const result = await change(game);
      if (result?.delete) await this.redis.del(this.key(roomId));
      else if (result) {
        await this.redis.set(
          this.key(roomId),
          JSON.stringify(game),
          "EX",
          ROOM_TTL_SECONDS,
        );
      }
      return result;
    } finally {
      await this.redis.eval(
        'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end',
        1,
        lockKey,
        token,
      );
    }
  }
}

module.exports = GameStore;

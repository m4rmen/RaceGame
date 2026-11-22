const assert = require("node:assert/strict");
const test = require("node:test");
const Game = require("./game");
const GameStore = require("./gameStore");

class FakeRedis {
  entries = new Map();
  expiresAt = new Map();
  now = 0;

  get(key) {
    if (this.expiresAt.get(key) <= this.now) this.del(key);
    return this.entries.get(key) || null;
  }

  async set(key, value, ...options) {
    const existing = this.get(key);
    if (options.includes("NX") && existing) return null;
    if (options.includes("XX") && !existing) return null;
    this.entries.set(key, value);
    const seconds = options.indexOf("EX");
    const milliseconds = options.indexOf("PX");
    if (seconds !== -1) this.expiresAt.set(key, this.now + options[seconds + 1] * 1000);
    else if (milliseconds !== -1)
      this.expiresAt.set(key, this.now + options[milliseconds + 1]);
    else if (!options.includes("KEEPTTL")) this.expiresAt.delete(key);
    return "OK";
  }

  del(key) {
    this.expiresAt.delete(key);
    return Number(this.entries.delete(key));
  }

  async eval(_script, _keyCount, key, token) {
    if (this.entries.get(key) !== token) return 0;
    return this.del(key);
  }
}

test("room state remains usable when another server instance reads it", async () => {
  const redis = new FakeRedis();
  const first = new GameStore(redis);
  const second = new GameStore(redis);
  const game = new Game("1234", "host-id");
  game.addPlayer("Ada", "player-id");
  assert.equal(await first.create(game), true);
  assert.equal(await second.create(new Game("1234", "another-host")), false);

  await second.update("1234", (current) => {
    current.players[0].bet.clubs = 3;
    current.players[0].betConfirmed = true;
    return { changed: true };
  });

  const restored = await first.get("1234");
  assert.equal(restored.players[0].bet.clubs, 3);
  restored.players[0].resetBet();
  assert.equal(restored.players[0].bet.clubs, 0);
  assert.equal(restored.sockets["player-id"], restored.players[0]);

  await Promise.all([
    first.update("1234", async (current) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      current.drinkIndex += 1;
      return { changed: true };
    }),
    second.update("1234", (current) => {
      current.drinkIndex += 1;
      return { changed: true };
    }),
  ]);
  assert.equal((await first.get("1234")).drinkIndex, 2);
});

test("room writes preserve the one-hour deadline, including a write that crosses it", async () => {
  const redis = new FakeRedis();
  const rooms = new GameStore(redis);
  await rooms.create(new Game("1234", "host-id"));

  redis.now = 59 * 60 * 1000;
  await rooms.update("1234", (game) => {
    game.addPlayer("Ada", "player-id");
    return true;
  });
  assert.equal((await rooms.get("1234")).players.length, 1);

  redis.now = 60 * 60 * 1000 - 1;
  assert.equal(
    await rooms.update("1234", () => {
      redis.now += 1;
      return true;
    }),
    null,
  );
  assert.equal(await rooms.get("1234"), null);
});

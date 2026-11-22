const assert = require("node:assert/strict");
const test = require("node:test");
const Game = require("./game");
const GameStore = require("./gameStore");

class FakeRedis {
  entries = new Map();

  async get(key) {
    return this.entries.get(key) || null;
  }

  async set(key, value, ...options) {
    if (options.includes("NX") && this.entries.has(key)) return null;
    this.entries.set(key, value);
    return "OK";
  }

  async del(key) {
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

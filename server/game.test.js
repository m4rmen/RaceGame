const assert = require("node:assert/strict");
const test = require("node:test");
const Game = require("./game");

test("a side card flips only after every horse clears its link", () => {
  const game = new Game("test-room", "host");
  game.crampCards[6] = "clubs_3";

  for (const suit of ["clubs", "diamonds", "hearts"]) {
    game.moveAce(`${suit}_2`);
    assert.equal(game.grid[7][4], "back_of_card");
  }

  game.moveAce("spades_2");

  assert.equal(game.grid[7][4], "clubs_3");
  assert.equal(game.grid[7][0], "clubs_ace", "the revealed card sets clubs back");
  assert.equal(game.grid[6][3], "spades_ace");
  assert.equal(game.grid[6][4], "back_of_card");
});

test("the host ceremony confirms players in order before racing", () => {
  const game = new Game("test-room", "host");
  game.addPlayer("Ada", "ada");
  game.addPlayer("Bea", "bea");
  game.startDrinkingCeremony();

  assert.equal(game.phase, "drinking");
  assert.deepEqual(game.drinkQueue, ["ada", "bea"]);
  assert.equal(game.confirmDrink("bea"), false);
  assert.equal(game.confirmDrink("ada"), true);
  assert.equal(game.confirmDrink("ada"), false, "a repeated click cannot skip Bea");
  assert.equal(game.phase, "drinking");
  assert.equal(game.confirmDrink("bea"), true);
  assert.equal(game.phase, "racing");
});

test("a player leaving during the ceremony does not stall the queue", () => {
  const game = new Game("test-room", "host");
  game.addPlayer("Ada", "ada");
  game.addPlayer("Bea", "bea");
  game.startDrinkingCeremony();
  game.confirmDrink("ada");
  game.removePlayer("bea");

  assert.equal(game.phase, "racing");
});

test("the finish-line ceremony must complete before replay", () => {
  const game = new Game("test-room", "host");
  game.addPlayer("Ada", "ada");
  game.addPlayer("Bea", "bea");
  game.phase = "finished";

  assert.equal(game.startPostDrinkingCeremony(), true);
  assert.equal(game.phase, "postDrinking");
  assert.equal(game.confirmPostDrink("bea"), false);
  assert.equal(game.confirmPostDrink("ada"), true);
  assert.equal(game.confirmPostDrink("ada"), false);
  assert.equal(game.phase, "postDrinking");
  assert.equal(game.confirmPostDrink("bea"), true);
  assert.equal(game.phase, "complete");
});

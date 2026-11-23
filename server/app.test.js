const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const test = require("node:test");
const { io } = require("socket.io-client");
const { server, ensureReady, gameStore } = require("./app");

test("a host and player can resume a shared room after reconnecting", async () => {
  await ensureReady();
  await new Promise((resolve) => server.listen(0, resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const hostId = randomUUID();
  const playerId = randomUUID();
  const absentId = randomUUID();
  const roomId = String(Math.floor(1000 + Math.random() * 9000));
  const sockets = [];
  const connect = async (sessionId) => {
    const socket = io(url, {
      path: "/api/socket.io",
      transports: ["websocket"],
      auth: { sessionId },
      reconnection: false,
    });
    sockets.push(socket);
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });
    return socket;
  };

  try {
    const health = await fetch(`${url}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });
    const host = await connect(hostId);
    const player = await connect(playerId);
    const absent = await connect(absentId);
    assert.deepEqual(await host.timeout(2000).emitWithAck("createRoom", roomId), {
      success: true,
    });
    assert.equal(
      (await player.timeout(2000).emitWithAck("createRoom", roomId)).success,
      false,
    );
    assert.deepEqual(
      await player.timeout(2000).emitWithAck("joinRoom", "Ada", roomId),
      { success: true },
    );
    assert.deepEqual(
      await absent.timeout(2000).emitWithAck("joinRoom", "Bea", roomId),
      { success: true },
    );
    host.emit("startBettingPhase", roomId);
    await new Promise((resolve) => player.once("bettingPhase", resolve));
    player.emit(
      "playerBetChange",
      { clubs: 2, spades: 0, hearts: 0, diamonds: 0 },
      roomId,
    );
    const betConfirmed = new Promise((resolve) =>
      host.on("updatePlayers", (players) => {
        if (players.find((entry) => entry.socketId === playerId)?.betConfirmed)
          resolve();
      }),
    );
    player.emit("betsPlaced", roomId);
    await betConfirmed;
    const ceremony = new Promise((resolve) => host.once("drinkingCeremony", resolve));
    assert.deepEqual(
      await host.timeout(2000).emitWithAck("removePlayer", roomId, absentId),
      { success: true },
    );
    await ceremony;
    assert.equal(
      (await absent.timeout(2000).emitWithAck("resumeRoom", roomId)).success,
      false,
    );

    host.disconnect();
    player.disconnect();
    const resumedHost = await connect(hostId);
    const resumedPlayer = await connect(playerId);
    const hostState = await resumedHost.timeout(2000).emitWithAck("resumeRoom", roomId);
    const playerState = await resumedPlayer
      .timeout(2000)
      .emitWithAck("resumeRoom", roomId);
    assert.equal(hostState.success, true);
    assert.equal(hostState.isHost, true);
    assert.equal(hostState.state.phase, "drinking");
    assert.equal(playerState.success, true);
    assert.equal(playerState.state.players[0].socketId, playerId);
    assert.equal(playerState.state.players[0].bet.clubs, 2);
    assert.equal(playerState.state.players[0].betConfirmed, true);
    assert.deepEqual(
      await resumedHost.timeout(2000).emitWithAck("confirmDrink", roomId, playerId),
      { success: true },
    );
    const raceState = await resumedPlayer
      .timeout(2000)
      .emitWithAck("resumeRoom", roomId);
    assert.equal(raceState.state.phase, "racing");

    await gameStore.update(roomId, (game) => {
      game.crampCards[6] = "clubs_3";
      game.deck = ["clubs_2"];
      for (const suit of ["diamonds", "hearts", "spades"]) game.moveAce(`${suit}_2`);
      return { changed: true };
    });
    const gridUpdate = new Promise((resolve) =>
      resumedPlayer.once("updateGrid", (grid, sideCard) => resolve({ grid, sideCard })),
    );
    const recentDraws = new Promise((resolve) =>
      resumedPlayer.once("cardFlipped", (_card, history) => resolve(history)),
    );
    assert.deepEqual(await resumedHost.timeout(2000).emitWithAck("flipCard", roomId), {
      success: true,
    });
    const { grid, sideCard } = await gridUpdate;
    assert.equal(sideCard, "clubs_3");
    assert.deepEqual(await recentDraws, ["clubs_2"]);
    assert.equal(grid[7][0], "clubs_ace");
    await gameStore.update(roomId, (game) => {
      game.deck = ["hearts_3"];
      return { changed: true };
    });
    assert.deepEqual(await resumedHost.timeout(2000).emitWithAck("flipCard", roomId), {
      success: false,
    });
    assert.deepEqual((await gameStore.get(roomId)).deck, ["hearts_3"]);

    await gameStore.update(roomId, (game) => {
      game.phase = "finished";
      game.gameWon = true;
      game.winner = "clubs_ace";
      game.addPlayer("Bea", absentId);
      game.players.at(-1).distributionConfirmed = true;
      return { changed: true };
    });
    const finished = await resumedPlayer
      .timeout(2000)
      .emitWithAck("resumeRoom", roomId);
    assert.equal(finished.state.raceResult.players[0].drinkAllowance, 4);
    assert.deepEqual(
      await resumedPlayer
        .timeout(2000)
        .emitWithAck("submitDistribution", roomId, { [absentId]: 4 }),
      { success: true },
    );
    const postDrinking = await resumedHost
      .timeout(2000)
      .emitWithAck("resumeRoom", roomId);
    assert.equal(postDrinking.state.phase, "postDrinking");
    assert.deepEqual(
      postDrinking.state.postCeremony.players.find(
        (entry) => entry.socketId === absentId,
      ).sources,
      [{ giverId: playerId, username: "Ada", amount: 4, gaveAll: true }],
    );
    assert.deepEqual(
      await resumedHost.timeout(2000).emitWithAck("confirmPostDrink", roomId, playerId),
      { success: true },
    );
    assert.deepEqual(
      await resumedHost.timeout(2000).emitWithAck("confirmPostDrink", roomId, absentId),
      { success: true },
    );
    assert.deepEqual(await resumedHost.timeout(2000).emitWithAck("playAgain", roomId), {
      success: true,
    });
    const replay = await resumedPlayer.timeout(2000).emitWithAck("resumeRoom", roomId);
    assert.equal(replay.state.phase, "betting");
    assert.deepEqual(replay.state.recentDraws, []);
    assert.equal(replay.state.players[0].bet.clubs, 0);
    assert.deepEqual(
      await resumedHost.timeout(2000).emitWithAck("removePlayer", roomId, playerId),
      { success: true },
    );
    assert.deepEqual(
      await resumedHost.timeout(2000).emitWithAck("removePlayer", roomId, absentId),
      { success: true },
    );
    const emptyRoom = await resumedHost.timeout(2000).emitWithAck("resumeRoom", roomId);
    assert.equal(emptyRoom.state.phase, "lobby");
    assert.equal(emptyRoom.state.players.length, 0);
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    await new Promise((resolve) => server.close(resolve));
  }
});

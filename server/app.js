const express = require("express");
const http = require("node:http");
const Redis = require("ioredis");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-streams-adapter");
const Game = require("./game");
const GameStore = require("./gameStore");

if (process.env.VERCEL && !process.env.REDIS_URL) {
  throw new Error("REDIS_URL is required for multiplayer on Vercel");
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  path: "/api/socket.io",
  connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
  cors: {
    origin: process.env.CLIENT_ORIGIN || true,
    methods: ["GET", "POST"],
  },
});
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    })
  : null;
const adapterRedis = redis?.duplicate();
const gameStore = new GameStore(redis);
const ready = redis
  ? Promise.all([redis.connect(), adapterRedis.connect()]).then(() => {
      io.adapter(createAdapter(adapterRedis));
    })
  : Promise.resolve();
ready.catch((error) => console.error("Redis connection failed:", error));

app.get("/api/health", async (_request, response) => {
  try {
    await ready;
    if (redis) await redis.ping();
    response.json({ ok: true });
  } catch (_error) {
    response.status(503).json({ ok: false });
  }
});

io.use(async (socket, next) => {
  try {
    await ready;
    const sessionId = socket.handshake.auth?.sessionId;
    socket.data.playerId =
      typeof sessionId === "string" && /^[a-f0-9-]{36}$/.test(sessionId)
        ? sessionId
        : socket.id;
    next();
  } catch (error) {
    next(error);
  }
});

function on(socket, event, handler) {
  socket.on(event, (...args) => {
    Promise.resolve(handler(...args)).catch((error) => {
      console.error(event + " failed:", error);
      const callback = args.at(-1);
      if (typeof callback === "function") {
        callback({ success: false, message: "The game server is unavailable." });
      }
      socket.emit("serverError", "The game server is unavailable.");
    });
  });
}

function getDrinkAllowance(game, player) {
  const suit = game.winner?.replace("_ace", "");
  return suit ? (player.bet[suit] || 0) * 2 : 0;
}

function getEndGameState(game) {
  const players = game.players.map((player) => ({
    socketId: player.socketId,
    username: player.username,
    bet: player.bet,
    drinkAllowance: getDrinkAllowance(game, player),
    distributions: Object.entries(player.distributions).map(
      ([recipientId, amount]) => ({
        recipientId,
        recipientUsername:
          game.players.find((candidate) => candidate.socketId === recipientId)
            ?.username || "Unknown player",
        amount,
      }),
    ),
    distributionConfirmed: player.distributionConfirmed,
  }));
  return {
    winner: game.winner,
    players,
    allDistributed: players.every((player) => player.distributionConfirmed),
  };
}

function getDrinkingState(game) {
  return {
    players: game.drinkQueue.map((playerId) => {
      const player = game.players.find((entry) => entry.socketId === playerId);
      return {
        socketId: player.socketId,
        username: player.username,
        bet: { ...player.bet },
        total: Object.values(player.bet).reduce((sum, amount) => sum + amount, 0),
      };
    }),
    currentIndex: game.drinkIndex,
  };
}

function getPostDrinkingState(game) {
  return {
    players: game.postDrinkQueue.map((playerId) => {
      const player = game.players.find((entry) => entry.socketId === playerId);
      const sources = game.players
        .map((giver) => ({
          username: giver.username,
          amount: giver.distributions[playerId] || 0,
        }))
        .filter((giver) => giver.amount > 0);
      return {
        socketId: playerId,
        username: player.username,
        total: sources.reduce((sum, giver) => sum + giver.amount, 0),
        sources,
      };
    }),
    currentIndex: game.postDrinkIndex,
  };
}

function advancePostDrinkingIfReady(game) {
  if (!getEndGameState(game).allDistributed || !game.startPostDrinkingCeremony()) {
    return null;
  }
  if (game.postDrinkQueue.length === 0) {
    game.phase = "complete";
    return { name: "postDrinkingComplete" };
  }
  return { name: "postDrinkingCeremony", data: getPostDrinkingState(game) };
}

function snapshot(game) {
  return {
    phase: game.phase,
    players: game.players,
    grid: game.grid,
    positions: game.positions,
    lastCard: game.lastCard,
    ceremony: game.phase === "drinking" ? getDrinkingState(game) : null,
    postCeremony: game.phase === "postDrinking" ? getPostDrinkingState(game) : null,
    raceResult: game.gameWon ? getEndGameState(game) : null,
  };
}

function normalizeDistributions(game, player, requested) {
  const validRecipients = new Set(
    game.players
      .filter((entry) => entry.socketId !== player.socketId)
      .map((entry) => entry.socketId),
  );
  const distributions = {};
  for (const [recipientId, rawAmount] of Object.entries(requested || {})) {
    const amount = Number(rawAmount);
    if (!validRecipients.has(recipientId) || !Number.isInteger(amount) || amount < 0) {
      return null;
    }
    if (amount > 0) distributions[recipientId] = amount;
  }
  return {
    distributions,
    requiredTotal: validRecipients.size > 0 ? getDrinkAllowance(game, player) : 0,
  };
}

async function removeParticipant(roomId, targetId, requesterId, hostAction) {
  const result = await gameStore.update(roomId, (game) => {
    if (
      (hostAction && game.organizerId !== requesterId) ||
      (!hostAction && targetId !== requesterId)
    ) {
      return null;
    }
    const previousPhase = game.phase;
    if (!game.removePlayer(targetId)) return null;
    game.players.forEach((player) => {
      delete player.distributions[targetId];
    });

    if (game.players.length === 0) {
      Object.assign(game, new Game(roomId, game.organizerId));
      return { reset: true, players: [] };
    }
    if (
      previousPhase === "betting" &&
      game.players.every((player) => player.betConfirmed)
    ) {
      game.startDrinkingCeremony();
    }
    const nextEvent =
      game.phase === "drinking"
        ? { name: "drinkingCeremony", data: getDrinkingState(game) }
        : previousPhase === "drinking" && game.phase === "racing"
          ? { name: "startGame", data: { grid: game.grid, positions: game.positions } }
          : game.phase === "postDrinking"
            ? { name: "postDrinkingCeremony", data: getPostDrinkingState(game) }
            : previousPhase === "postDrinking" && game.phase === "complete"
              ? { name: "postDrinkingComplete" }
              : previousPhase === "finished"
                ? advancePostDrinkingIfReady(game)
                : null;
    return {
      players: game.players,
      nextEvent,
      raceResult: game.gameWon ? getEndGameState(game) : null,
    };
  });
  if (!result) return false;
  io.to(roomId).emit("playerRemoved", targetId);
  io.to(roomId).emit("updatePlayers", result.players);
  if (result.raceResult) io.to(roomId).emit("distributionUpdate", result.raceResult);
  if (result.reset) io.to(roomId).emit("roomReset");
  if (result.nextEvent)
    io.to(roomId).emit(result.nextEvent.name, result.nextEvent.data);
  try {
    const sockets = await io.in(roomId).fetchSockets();
    await Promise.all(
      sockets
        .filter((socket) => socket.data.playerId === targetId)
        .map((socket) => socket.leave(roomId)),
    );
  } catch (error) {
    console.error("Could not release a removed player's socket:", error);
  }
  return true;
}

io.on("connection", (socket) => {
  const playerId = socket.data.playerId;

  on(socket, "resumeRoom", async (roomId, callback = () => {}) => {
    const game = await gameStore.get(roomId);
    if (
      !game ||
      (game.organizerId !== playerId &&
        !game.players.some((player) => player.socketId === playerId))
    ) {
      callback({ success: false });
      return;
    }
    await socket.join(roomId);
    callback({
      success: true,
      state: snapshot(game),
      isHost: game.organizerId === playerId,
    });
  });

  on(socket, "createRoom", async (roomId, callback = () => {}) => {
    if (!/^[0-9]{4}$/.test(roomId)) {
      callback({ success: false, message: "Invalid room code." });
      return;
    }
    const created = await gameStore.create(new Game(roomId, playerId));
    if (!created) {
      const existing = await gameStore.get(roomId);
      if (existing?.organizerId !== playerId) {
        callback({ success: false, message: "That code is already in use." });
        return;
      }
    }
    await socket.join(roomId);
    callback({ success: true });
  });

  on(socket, "deleteRoom", async (roomId) => {
    const result = await gameStore.update(roomId, (game) =>
      game.organizerId === playerId ? { delete: true } : null,
    );
    if (result) io.to(roomId).emit("roomDeleted");
  });

  on(socket, "isOrganizer", async (roomId, callback) => {
    const game = await gameStore.get(roomId);
    callback(game?.organizerId === playerId);
  });

  on(socket, "joinRoom", async (username, roomId, callback) => {
    const result = await gameStore.update(roomId, (game) => {
      if (game.isStarted) {
        return { error: "Game has already started. You cannot join now." };
      }
      if (!game.players.some((player) => player.socketId === playerId)) {
        game.addPlayer(username, playerId);
      }
      return { players: game.players };
    });
    if (!result || result.error) {
      callback({
        success: false,
        message: result?.error || "No race was found with that code.",
      });
      return;
    }
    await socket.join(roomId);
    socket.to(roomId).emit("updatePlayers", result.players);
    callback({ success: true });
  });

  on(socket, "quitGame", async (roomId) => {
    await removeParticipant(roomId, playerId, playerId, false);
  });

  on(socket, "removePlayer", async (roomId, targetId, callback = () => {}) => {
    const removed = await removeParticipant(roomId, targetId, playerId, true);
    callback({ success: removed });
  });

  on(socket, "getPlayers", async (roomId, callback) => {
    callback((await gameStore.get(roomId))?.players);
  });

  on(socket, "startBettingPhase", async (roomId) => {
    const result = await gameStore.update(roomId, (game) => {
      if (game.organizerId !== playerId || game.phase !== "lobby") return null;
      game.isStarted = true;
      game.phase = "betting";
      return { changed: true };
    });
    if (result) socket.to(roomId).emit("bettingPhase");
  });

  on(socket, "playerBetChange", async (bet, roomId) => {
    const result = await gameStore.update(roomId, (game) => {
      if (game.phase !== "betting") return null;
      const player = game.players.find((entry) => entry.socketId === playerId);
      if (!player || player.betConfirmed) return null;
      player.bet = bet;
      return { players: game.players };
    });
    if (result) socket.to(roomId).emit("updatePlayers", result.players);
  });

  on(socket, "betsPlaced", async (roomId) => {
    const result = await gameStore.update(roomId, (game) => {
      if (game.phase !== "betting") return null;
      const player = game.players.find((entry) => entry.socketId === playerId);
      if (!player || player.betConfirmed) return null;
      player.betConfirmed = true;
      if (game.players.length && game.players.every((entry) => entry.betConfirmed)) {
        game.startDrinkingCeremony();
      }
      return {
        players: game.players,
        ceremony: game.phase === "drinking" ? getDrinkingState(game) : null,
      };
    });
    if (!result) return;
    io.to(roomId).emit("updatePlayers", result.players);
    if (result.ceremony) io.to(roomId).emit("drinkingCeremony", result.ceremony);
  });

  on(socket, "confirmDrink", async (roomId, nextPlayerId, callback = () => {}) => {
    const result = await gameStore.update(roomId, (game) => {
      if (game.organizerId !== playerId || !game.confirmDrink(nextPlayerId))
        return null;
      return {
        phase: game.phase,
        ceremony: game.phase === "drinking" ? getDrinkingState(game) : null,
        grid: game.grid,
        positions: game.positions,
      };
    });
    if (!result) {
      callback({ success: false, message: "That player is not up next." });
      return;
    }
    if (result.phase === "racing") {
      io.to(roomId).emit("startGame", {
        grid: result.grid,
        positions: result.positions,
      });
    } else io.to(roomId).emit("drinkingCeremony", result.ceremony);
    callback({ success: true });
  });

  on(socket, "confirmPostDrink", async (roomId, nextPlayerId, callback = () => {}) => {
    const result = await gameStore.update(roomId, (game) => {
      if (game.organizerId !== playerId || !game.confirmPostDrink(nextPlayerId))
        return null;
      return {
        phase: game.phase,
        ceremony: game.phase === "postDrinking" ? getPostDrinkingState(game) : null,
      };
    });
    if (!result) {
      callback({ success: false, message: "That player is not up next." });
      return;
    }
    if (result.phase === "complete") io.to(roomId).emit("postDrinkingComplete");
    else io.to(roomId).emit("postDrinkingCeremony", result.ceremony);
    callback({ success: true });
  });

  on(socket, "flipCard", async (roomId) => {
    const result = await gameStore.update(roomId, (game) => {
      if (game.organizerId !== playerId || game.phase !== "racing" || game.gameWon) {
        return null;
      }
      const card = game.flipCard();
      game.lastCard = card;
      if (game.gameWon) {
        game.phase = "finished";
        game.players.forEach((player) => {
          player.distributionConfirmed = getDrinkAllowance(game, player) === 0;
        });
      }
      const raceResult = game.gameWon ? getEndGameState(game) : null;
      const nextEvent = game.gameWon ? advancePostDrinkingIfReady(game) : null;
      return {
        card,
        grid: game.grid,
        positions: game.positions,
        raceResult,
        nextEvent,
      };
    });
    if (!result) return;
    io.to(roomId).emit("cardFlipped", result.card);
    io.to(roomId).emit("updateGrid", result.grid);
    if (result.raceResult) io.to(roomId).emit("gameWon", result.raceResult);
    if (result.nextEvent)
      io.to(roomId).emit(result.nextEvent.name, result.nextEvent.data);
    io.to(roomId).emit("updatePosition", result.positions);
  });

  on(socket, "getPlayerBet", async (roomId, callback) => {
    const game = await gameStore.get(roomId);
    callback(game?.players.find((player) => player.socketId === playerId)?.bet);
  });

  on(socket, "updateDistribution", async (roomId, requested) => {
    const result = await gameStore.update(roomId, (game) => {
      const player = game.players.find((entry) => entry.socketId === playerId);
      if (!game.gameWon || !player || player.distributionConfirmed) return null;
      const normalized = normalizeDistributions(game, player, requested);
      if (!normalized) return null;
      const total = Object.values(normalized.distributions).reduce((a, b) => a + b, 0);
      if (total > getDrinkAllowance(game, player)) return null;
      player.distributions = normalized.distributions;
      return getEndGameState(game);
    });
    if (result) io.to(roomId).emit("distributionUpdate", result);
  });

  on(socket, "submitDistribution", async (roomId, requested, callback = () => {}) => {
    const result = await gameStore.update(roomId, (game) => {
      const player = game.players.find((entry) => entry.socketId === playerId);
      if (!game.gameWon || !player || player.distributionConfirmed) {
        return { error: "This distribution cannot be submitted." };
      }
      const normalized = normalizeDistributions(game, player, requested);
      if (!normalized) return { error: "Invalid amount or player." };
      const total = Object.values(normalized.distributions).reduce((a, b) => a + b, 0);
      if (total !== normalized.requiredTotal) {
        return {
          error:
            "You must distribute exactly " + normalized.requiredTotal + " drink units.",
        };
      }
      player.distributions = normalized.distributions;
      player.distributionConfirmed = true;
      const endGameState = getEndGameState(game);
      const nextEvent = advancePostDrinkingIfReady(game);
      return { endGameState, nextEvent };
    });
    if (!result || result.error) {
      callback({ success: false, message: result?.error || "Race not found." });
      return;
    }
    io.to(roomId).emit("distributionUpdate", result.endGameState);
    if (result.nextEvent)
      io.to(roomId).emit(result.nextEvent.name, result.nextEvent.data);
    callback({ success: true });
  });

  on(socket, "playAgain", async (roomId, callback = () => {}) => {
    const result = await gameStore.update(roomId, (game) => {
      if (game.organizerId !== playerId || game.phase !== "complete") return null;
      const nextGame = new Game(roomId, game.organizerId);
      for (const player of game.players) {
        player.resetBet();
        nextGame.players.push(player);
        nextGame.sockets[player.socketId] = player;
      }
      nextGame.isStarted = true;
      nextGame.phase = "betting";
      Object.assign(game, nextGame);
      return {
        players: game.players,
        grid: game.grid,
        positions: game.positions,
      };
    });
    if (!result) {
      callback({ success: false, message: "Replay is not available yet." });
      return;
    }
    io.to(roomId).emit("newGame", result);
    callback({ success: true });
  });
});

module.exports = { server, ready, gameStore };

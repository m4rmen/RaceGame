const Game = require("./game");

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || true,
    methods: ["GET", "POST"],
  },
});

// Enable CORS for all routes
app.use(cors());

const games = [];

function getGameById(id) {
  return games.find((game) => game.gameId === id);
}

function getWinningSuit(game) {
  return game.winner?.replace("_ace", "");
}

function getDrinkAllowance(game, player) {
  const winningSuit = getWinningSuit(game);
  return winningSuit ? (player.bet[winningSuit] || 0) * 2 : 0;
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
    players: game.drinkQueue.map((socketId) => {
      const player = game.players.find((entry) => entry.socketId === socketId);
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

function broadcastRaceStart(game) {
  io.to(game.gameId).emit("startGame", {
    grid: game.grid,
    positions: game.positions,
  });
  console.log("Game started:", game.gameId);
}

function getPostDrinkingState(game) {
  return {
    players: game.postDrinkQueue.map((socketId) => {
      const player = game.players.find((entry) => entry.socketId === socketId);
      const sources = game.players
        .map((giver) => ({
          username: giver.username,
          amount: giver.distributions[socketId] || 0,
        }))
        .filter((giver) => giver.amount > 0);
      return {
        socketId,
        username: player.username,
        total: sources.reduce((sum, giver) => sum + giver.amount, 0),
        sources,
      };
    }),
    currentIndex: game.postDrinkIndex,
  };
}

function startPostDrinkingIfReady(game) {
  if (getEndGameState(game).allDistributed && game.startPostDrinkingCeremony()) {
    if (game.postDrinkQueue.length === 0) {
      game.phase = "complete";
      io.to(game.gameId).emit("postDrinkingComplete");
    } else {
      io.to(game.gameId).emit("postDrinkingCeremony", getPostDrinkingState(game));
    }
  }
}

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("deleteRoom", (roomId) => {
    const idx = games.findIndex(
      (g) => g.gameId === roomId && g.organizerId === socket.id,
    );
    if (idx !== -1) {
      games.splice(idx, 1);
      console.log(`Game ${roomId} deleted by host.`);
      io.to(roomId).emit("roomDeleted");
    }
  });

  socket.on("createRoom", (data) => {
    const currentGame = new Game(data, socket.id);
    games.push(currentGame);
    socket.join(currentGame.gameId);
    console.log("Game created with ID:", currentGame.gameId);
  });

  socket.on("isOrganizer", (roomId, callback) => {
    const currentGame = getGameById(roomId);
    if (currentGame && currentGame.organizerId === socket.id) {
      callback(true);
    } else {
      callback(false);
    }
  });

  socket.on("joinRoom", (username, roomId, callback) => {
    const currentGame = getGameById(roomId);
    if (!currentGame) {
      callback({ success: false, message: "No race was found with that code." });
      return;
    }
    if (!currentGame.isStarted) {
      currentGame.addPlayer(username, socket.id);
      socket.join(roomId);
      socket.to(roomId).emit("updatePlayers", currentGame.players);
      callback({
        success: true,
      });
    } else {
      callback({
        success: false,
        message: "Game has already started. You cannot join now.",
      });
    }
  });

  socket.on("quitGame", (roomId) => {
    console.log("Player quitting game: ", roomId);
    const currentGame = getGameById(roomId);
    currentGame.removePlayer(socket.id);
    socket.to(roomId).emit("updatePlayers", currentGame.players);
  });

  socket.on("getPlayers", (roomId, callback) => {
    const currentGame = getGameById(roomId);
    callback(currentGame?.players);
  });

  socket.on("startBettingPhase", (roomId) => {
    const currentGame = getGameById(roomId);
    if (
      !currentGame ||
      currentGame.organizerId !== socket.id ||
      currentGame.phase !== "lobby"
    )
      return;
    currentGame.isStarted = true;
    currentGame.phase = "betting";
    socket.to(roomId).emit("bettingPhase");
  });

  socket.on("playerBetChange", (bet, roomId) => {
    const currentGame = getGameById(roomId);
    if (currentGame?.phase !== "betting") return;
    const currentPlayer = currentGame.players.find(
      (player) => player.socketId === socket.id,
    );
    if (!currentPlayer || currentPlayer.betConfirmed) return;
    currentPlayer.bet = bet;
    socket.to(roomId).emit("updatePlayers", currentGame.players);
  });

  socket.on("betsPlaced", (roomId) => {
    const currentGame = getGameById(roomId);
    if (currentGame?.phase !== "betting") return;
    const currentPlayer = currentGame.players.find(
      (player) => player.socketId === socket.id,
    );
    if (!currentPlayer || currentPlayer.betConfirmed) return;
    currentPlayer.betConfirmed = true;

    io.to(roomId).emit("updatePlayers", currentGame.players);

    if (
      currentGame.players.length > 0 &&
      currentGame.players.every((player) => player.betConfirmed)
    ) {
      currentGame.startDrinkingCeremony();
      io.to(roomId).emit("drinkingCeremony", getDrinkingState(currentGame));
    }
  });

  socket.on("confirmDrink", (roomId, playerId, callback = () => {}) => {
    const currentGame = getGameById(roomId);
    if (
      !currentGame ||
      currentGame.organizerId !== socket.id ||
      !currentGame.confirmDrink(playerId)
    ) {
      callback({ success: false, message: "That player is not up next." });
      return;
    }

    if (currentGame.phase === "racing") {
      broadcastRaceStart(currentGame);
    } else {
      io.to(roomId).emit("drinkingCeremony", getDrinkingState(currentGame));
    }
    callback({ success: true });
  });

  socket.on("confirmPostDrink", (roomId, playerId, callback = () => {}) => {
    const currentGame = getGameById(roomId);
    if (
      !currentGame ||
      currentGame.organizerId !== socket.id ||
      !currentGame.confirmPostDrink(playerId)
    ) {
      callback({ success: false, message: "That player is not up next." });
      return;
    }
    if (currentGame.phase === "complete") {
      io.to(roomId).emit("postDrinkingComplete");
    } else {
      io.to(roomId).emit("postDrinkingCeremony", getPostDrinkingState(currentGame));
    }
    callback({ success: true });
  });

  socket.on("flipCard", (roomId) => {
    const currentGame = getGameById(roomId);
    if (
      !currentGame ||
      currentGame.phase !== "racing" ||
      currentGame.organizerId !== socket.id ||
      currentGame.gameWon
    ) {
      return;
    }
    const card = currentGame.flipCard();
    setTimeout(() => {
      io.to(roomId).emit("cardFlipped", card);
      io.to(roomId).emit("updateGrid", currentGame.grid);
      if (currentGame.gameWon) {
        currentGame.phase = "finished";
        currentGame.players.forEach((player) => {
          player.distributionConfirmed = getDrinkAllowance(currentGame, player) === 0;
        });
        io.to(roomId).emit("gameWon", getEndGameState(currentGame));
        startPostDrinkingIfReady(currentGame);
      }
      io.to(roomId).emit("updatePosition", currentGame.positions);
    }, 100);
  });

  socket.on("getPlayerBet", (roomId, callback) => {
    const currentGame = getGameById(roomId);
    const currentPlayer = currentGame.players.find(
      (player) => player.socketId === socket.id,
    );
    callback(currentPlayer.bet);
  });

  socket.on("updateDistribution", (roomId, requestedDistributions) => {
    const currentGame = getGameById(roomId);
    const currentPlayer = currentGame?.players.find(
      (player) => player.socketId === socket.id,
    );
    if (!currentGame?.gameWon || !currentPlayer || currentPlayer.distributionConfirmed)
      return;

    const validRecipients = new Set(
      currentGame.players
        .filter((player) => player.socketId !== socket.id)
        .map((player) => player.socketId),
    );
    const distributions = {};

    for (const [recipientId, rawAmount] of Object.entries(
      requestedDistributions || {},
    )) {
      const amount = Number(rawAmount);
      if (!validRecipients.has(recipientId) || !Number.isInteger(amount) || amount < 0)
        return;
      if (amount > 0) distributions[recipientId] = amount;
    }

    const distributedTotal = Object.values(distributions).reduce(
      (total, amount) => total + amount,
      0,
    );
    if (distributedTotal > getDrinkAllowance(currentGame, currentPlayer)) return;

    currentPlayer.distributions = distributions;
    io.to(roomId).emit("distributionUpdate", getEndGameState(currentGame));
  });

  socket.on(
    "submitDistribution",
    (roomId, requestedDistributions, callback = () => {}) => {
      const currentGame = getGameById(roomId);
      const currentPlayer = currentGame?.players.find(
        (player) => player.socketId === socket.id,
      );

      if (
        !currentGame?.gameWon ||
        !currentPlayer ||
        currentPlayer.distributionConfirmed
      ) {
        callback({ success: false, message: "This distribution cannot be submitted." });
        return;
      }

      const validRecipients = new Set(
        currentGame.players
          .filter((player) => player.socketId !== socket.id)
          .map((player) => player.socketId),
      );
      const distributions = {};

      for (const [recipientId, rawAmount] of Object.entries(
        requestedDistributions || {},
      )) {
        const amount = Number(rawAmount);
        if (
          !validRecipients.has(recipientId) ||
          !Number.isInteger(amount) ||
          amount < 0
        ) {
          callback({
            success: false,
            message: "The distribution contains an invalid amount or player.",
          });
          return;
        }
        if (amount > 0) distributions[recipientId] = amount;
      }

      const allowance = getDrinkAllowance(currentGame, currentPlayer);
      const requiredTotal = validRecipients.size > 0 ? allowance : 0;
      const distributedTotal = Object.values(distributions).reduce(
        (total, amount) => total + amount,
        0,
      );

      if (distributedTotal !== requiredTotal) {
        callback({
          success: false,
          message: `You must distribute exactly ${requiredTotal} drink units.`,
        });
        return;
      }

      currentPlayer.distributions = distributions;
      currentPlayer.distributionConfirmed = true;
      const endGameState = getEndGameState(currentGame);
      io.to(roomId).emit("distributionUpdate", endGameState);
      startPostDrinkingIfReady(currentGame);
      callback({ success: true });
    },
  );

  socket.on("playAgain", (roomId, callback = () => {}) => {
    const oldGame = getGameById(roomId);
    if (!oldGame || oldGame.organizerId !== socket.id || oldGame.phase !== "complete") {
      callback({ success: false, message: "Replay is not available yet." });
      return;
    }

    const players = oldGame.players;
    const newGame = new Game(roomId, oldGame.organizerId);
    for (let player of players) {
      player.resetBet();
      newGame.players.push(player);
      newGame.sockets[player.socketId] = player;
    }
    newGame.isStarted = true;
    newGame.phase = "betting";
    games[games.indexOf(oldGame)] = newGame;
    io.to(roomId).emit("newGame", {
      players: newGame.players,
      grid: newGame.grid,
      positions: newGame.positions,
    });
    callback({ success: true });
  });

  socket.on("disconnect", () => {
    games.map((game) => {
      if (game.organizerId === socket.id) {
        games.splice(games.indexOf(game), 1);
        socket.to(game.gameId).emit("roomDeleted");
      } else {
        const previousPhase = game.phase;
        game.removePlayer(socket.id);
        socket.to(game.gameId).emit("updatePlayers", game.players);
        if (previousPhase === "drinking") {
          if (game.phase === "racing") broadcastRaceStart(game);
          else io.to(game.gameId).emit("drinkingCeremony", getDrinkingState(game));
        } else if (previousPhase === "postDrinking") {
          if (game.phase === "complete")
            io.to(game.gameId).emit("postDrinkingComplete");
          else
            io.to(game.gameId).emit("postDrinkingCeremony", getPostDrinkingState(game));
        } else if (previousPhase === "finished") {
          startPostDrinkingIfReady(game);
        }
        console.log("Player disconnected: ", socket.id);
      }
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

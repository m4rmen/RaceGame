class Player {
  bet = {
    clubs: 0,
    spades: 0,
    hearts: 0,
    diamonds: 0,
  };
  betConfirmed = false;
  distributions = {};
  distributionConfirmed = false;
  constructor(username, socketId) {
    this.username = username;
    this.socketId = socketId;
  }

  resetBet() {
    this.bet = {
      clubs: 0,
      spades: 0,
      hearts: 0,
      diamonds: 0,
    };
    this.betConfirmed = false;
    this.distributions = {};
    this.distributionConfirmed = false;
  }
}

const positions = { First: "1st", Second: "2nd", Third: "3rd", Fourth: "4th" };

class Game {
  static fromJSON(data) {
    const game = Object.assign(Object.create(Game.prototype), data);
    let nextBib = Math.max(
      data.nextBib ?? 1,
      ...data.players.map((player) => (player.bib ?? 0) + 1),
    );
    game.players = data.players.map((player) =>
      Object.assign(Object.create(Player.prototype), player, {
        bib: player.bib ?? nextBib++,
      }),
    );
    game.nextBib = nextBib;
    game.sockets = Object.fromEntries(
      game.players.map((player) => [player.socketId, player]),
    );
    return game;
  }

  cardValues = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "jack", "queen", "king"];
  suits = ["hearts", "diamonds", "spades", "clubs"];
  deck = [];
  crampCards = [];
  grid = [
    ["", "", "", "", ""],
    ["", "", "", "", "back_of_card"],
    ["", "", "", "", "back_of_card"],
    ["", "", "", "", "back_of_card"],
    ["", "", "", "", "back_of_card"],
    ["", "", "", "", "back_of_card"],
    ["", "", "", "", "back_of_card"],
    ["clubs_ace", "diamonds_ace", "hearts_ace", "spades_ace", "back_of_card"],
  ];
  initDone = false;
  isStarted = false;
  phase = "lobby";
  drinkQueue = [];
  drinkIndex = 0;
  postDrinkQueue = [];
  postDrinkIndex = 0;
  gameWon = false;
  winner = null;
  lastCard = null;
  recentDraws = [];
  nextBib = 1;
  roundHistory = [];
  sockets = {};
  positions = {
    clubs_ace: positions.Fourth,
    diamonds_ace: positions.Fourth,
    hearts_ace: positions.Fourth,
    spades_ace: positions.Fourth,
  };
  constructor(gameId, organizerId) {
    this.gameId = gameId;
    this.organizerId = organizerId;
    this.players = [];
    this.initDeck();
  }

  initDeck() {
    this.deck = [];
    this.suits.forEach((suit) => {
      this.cardValues.forEach((cardValue) => {
        this.deck.push(`${suit}_${cardValue}`);
      });
    });
    this.crampCards = [];
    for (let i = 0; i < 7; i++) {
      this.crampCards.push(this.flipCard());
    }
    this.initDone = true;
  }

  toggleStart() {
    this.isStarted = !this.isStarted;
  }

  startDrinkingCeremony() {
    this.phase = "drinking";
    this.drinkQueue = this.players.map((player) => player.socketId);
    this.drinkIndex = 0;
  }

  confirmDrink(playerId) {
    if (this.phase !== "drinking" || this.drinkQueue[this.drinkIndex] !== playerId) {
      return false;
    }
    this.drinkIndex += 1;
    if (this.drinkIndex >= this.drinkQueue.length) {
      this.phase = "racing";
    }
    return true;
  }

  startPostDrinkingCeremony() {
    if (this.phase !== "finished") return false;
    this.phase = "postDrinking";
    this.postDrinkQueue = this.players.map((player) => player.socketId);
    this.postDrinkIndex = 0;
    return true;
  }

  confirmPostDrink(playerId) {
    if (
      this.phase !== "postDrinking" ||
      this.postDrinkQueue[this.postDrinkIndex] !== playerId
    ) {
      return false;
    }
    this.postDrinkIndex += 1;
    if (this.postDrinkIndex >= this.postDrinkQueue.length) this.phase = "complete";
    return true;
  }

  findPositionOfAce(card) {
    let currentRow = null;
    let currentRowIndex = null;
    let columnIndex = null;
    const suit = card.split("_")[0];
    const ace = suit + "_ace";
    switch (suit) {
      case "clubs":
        columnIndex = 0;
        break;
      case "diamonds":
        columnIndex = 1;
        break;
      case "hearts":
        columnIndex = 2;
        break;
      case "spades":
        columnIndex = 3;
        break;
    }
    this.grid.forEach((row, index) => {
      if (row.indexOf(ace) !== -1) {
        currentRow = row;
        currentRowIndex = index;
      }
    });

    return [currentRow, currentRowIndex, columnIndex, ace];
  }

  moveAce(card) {
    let currentRow = null;
    let currentRowIndex = null;
    let columnIndex = null;
    let ace = null;
    [currentRow, currentRowIndex, columnIndex, ace] = this.findPositionOfAce(card);
    const newGrid = [...this.grid];
    if (currentRowIndex > 0) {
      newGrid[currentRowIndex - 1][columnIndex] = ace;
      newGrid[currentRowIndex][columnIndex] = "";
    }
    if (currentRowIndex === 1) {
      this.gameWon = true;
      this.winner = ace;
    }

    if (
      !this.checkIfHorseBelow(currentRowIndex, newGrid) &&
      newGrid[currentRowIndex][4] === "back_of_card"
    ) {
      newGrid[currentRowIndex][4] = this.crampCards[currentRowIndex - 1];
      [currentRow, currentRowIndex, columnIndex, ace] = this.findPositionOfAce(
        this.crampCards[currentRowIndex - 1],
      );
      newGrid[currentRowIndex + 1][columnIndex] = ace;
      newGrid[currentRowIndex][columnIndex] = "";
    }
    this.grid = newGrid;

    this.updatePositions();
  }

  checkIfHorseBelow(rowIndex, grid) {
    for (let i = rowIndex; i <= 7; i++) {
      for (let j = 0; j <= 3; j++) {
        if (grid[i][j] !== "") {
          return true;
        }
      }
    }
    return false;
  }

  updatePositions() {
    let count = 0;
    for (let rowIndex = 0; rowIndex <= 4; rowIndex++) {
      for (let columnIndex = 0; columnIndex <= 3; columnIndex++) {
        if (this.grid[rowIndex][columnIndex] !== "") {
          count += 1;
          this.positions[this.grid[rowIndex][columnIndex]] = positions.Fourth;
          switch (count) {
            case 1:
              this.positions[this.grid[rowIndex][columnIndex]] = positions.First;
              break;
            case 2:
              this.positions[this.grid[rowIndex][columnIndex]] = positions.Second;
              break;
            case 3:
              this.positions[this.grid[rowIndex][columnIndex]] = positions.Third;
              break;
            case 4:
              this.positions[this.grid[rowIndex][columnIndex]] = positions.Fourth;
              break;
          }
        }
      }
    }
  }

  addPlayer(username, socketId) {
    const newPlayer = new Player(username, socketId);
    newPlayer.bib = this.nextBib++;
    this.players.push(newPlayer);
    this.sockets[socketId] = newPlayer;
  }

  removePlayer(socketId) {
    const removedPlayer = this.sockets[socketId];
    if (removedPlayer) {
      delete this.sockets[socketId];
      this.players = this.players.filter((player) => player.socketId !== socketId);
      const queueIndex = this.drinkQueue.indexOf(socketId);
      if (queueIndex !== -1) {
        this.drinkQueue.splice(queueIndex, 1);
        if (queueIndex < this.drinkIndex) this.drinkIndex -= 1;
        if (this.phase === "drinking" && this.drinkIndex >= this.drinkQueue.length) {
          this.phase = "racing";
        }
      }
      const postQueueIndex = this.postDrinkQueue.indexOf(socketId);
      if (postQueueIndex !== -1) {
        this.postDrinkQueue.splice(postQueueIndex, 1);
        if (postQueueIndex < this.postDrinkIndex) this.postDrinkIndex -= 1;
        if (
          this.phase === "postDrinking" &&
          this.postDrinkIndex >= this.postDrinkQueue.length
        ) {
          this.phase = "complete";
        }
      }
    }
    return removedPlayer;
  }

  flipCard() {
    const cardIndex = Math.floor(Math.random() * this.deck.length);
    const card = this.deck[cardIndex];
    this.deck.splice(cardIndex, 1);

    if (this.initDone) {
      this.moveAce(card);
    }

    return card;
  }
}

module.exports = Game;

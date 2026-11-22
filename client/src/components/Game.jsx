import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useSocket } from "../SocketContext";
import ClubHeader from "./ClubHeader";
import RaceTrack from "./RaceTrack";
import "./Game.css";

const suits = [
  { name: "clubs", symbol: "♣" },
  { name: "spades", symbol: "♠" },
  { name: "hearts", symbol: "♥" },
  { name: "diamonds", symbol: "♦" },
];

export default function Game() {
  const { roomId } = useParams();
  const socket = useSocket();
  const [players, setPlayers] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [betConfirmed, setBetConfirmed] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [cardGrid, setCardGrid] = useState([]);
  const [lastCard, setLastCard] = useState(null);
  const [raceResult, setRaceResult] = useState(null);
  const [distribution, setDistribution] = useState({});
  const [distributionError, setDistributionError] = useState("");

  useEffect(() => {
    if (!socket) return;
    socket.emit("getPlayers", roomId, (inRoom) => {
      setPlayers(inRoom || []);
      setCurrentPlayer(inRoom?.find((player) => player.socketId === socket.id) || null);
    });
    const onPlayers = (nextPlayers) => {
      setPlayers(nextPlayers);
      setCurrentPlayer(
        nextPlayers.find((player) => player.socketId === socket.id) || null,
      );
    };
    const onStart = ({ grid }) => {
      setIsGameStarted(true);
      setCardGrid(grid);
    };
    const onWon = (result) => {
      setRaceResult(result);
      setDistribution({});
    };
    const onNewGame = ({ players: nextPlayers, grid }) => {
      onPlayers(nextPlayers);
      setBetConfirmed(false);
      setIsGameStarted(false);
      setCardGrid(grid);
      setLastCard(null);
      setRaceResult(null);
      setDistribution({});
      setDistributionError("");
    };
    socket.on("updatePlayers", onPlayers);
    socket.on("startGame", onStart);
    socket.on("cardFlipped", setLastCard);
    socket.on("updateGrid", setCardGrid);
    socket.on("gameWon", onWon);
    socket.on("distributionUpdate", setRaceResult);
    socket.on("newGame", onNewGame);
    return () => {
      socket.off("updatePlayers", onPlayers);
      socket.off("startGame", onStart);
      socket.off("cardFlipped", setLastCard);
      socket.off("updateGrid", setCardGrid);
      socket.off("gameWon", onWon);
      socket.off("distributionUpdate", setRaceResult);
      socket.off("newGame", onNewGame);
    };
  }, [socket, roomId]);

  const handleBet = (change, suit) => {
    if (!currentPlayer || betConfirmed) return;
    const bet = {
      ...currentPlayer.bet,
      [suit]: Math.max(0, (currentPlayer.bet[suit] || 0) + change),
    };
    setCurrentPlayer({ ...currentPlayer, bet });
    socket.emit("playerBetChange", bet, roomId);
  };
  const resultForCurrentPlayer = raceResult?.players.find(
    (player) => player.socketId === socket?.id,
  );
  const distributedTotal = Object.values(distribution).reduce(
    (total, amount) => total + amount,
    0,
  );
  const remainingDrinks =
    (resultForCurrentPlayer?.drinkAllowance || 0) - distributedTotal;
  const changeDistribution = (recipientId, change) => {
    const currentAmount = distribution[recipientId] || 0;
    if (change > 0 && remainingDrinks <= 0) return;
    const next = {
      ...distribution,
      [recipientId]: Math.max(0, currentAmount + change),
    };
    setDistribution(next);
    socket.emit("updateDistribution", roomId, next);
    setDistributionError("");
  };
  const confirmDistribution = () =>
    socket.emit("submitDistribution", roomId, distribution, (response) => {
      if (!response.success) setDistributionError(response.message);
    });
  const playerName =
    currentPlayer?.username ||
    players.find((player) => player.socketId === socket?.id)?.username;

  return (
    <div className="app-shell player-page">
      <ClubHeader roomId={roomId} label={playerName || "Player view"} />
      <div className="player-page__intro">
        <span className="eyebrow">The Ace Race / Your seat at the track</span>
        <h1 className="page-title">
          {raceResult
            ? "The result is in."
            : isGameStarted
              ? "Eyes on the finish."
              : "Back your horse."}
        </h1>
        <p className="page-intro">
          {raceResult
            ? "The winning wager pays double. Choose who receives your drinks."
            : isGameStarted
              ? "The cards decide the pace. Follow your horse down the course."
              : "Choose your ace and set your wager before the gates open."}
        </p>
      </div>
      {raceResult ? (
        <section className="distribution-panel club-panel">
          <span className="eyebrow">Official race result</span>
          <h2>{raceResult.winner.replace("_ace", "")} wins.</h2>
          {resultForCurrentPlayer &&
            (resultForCurrentPlayer.drinkAllowance === 0 ? (
              <div className="player-notice">
                Your horse did not win this time. Stay tuned for the next race.
              </div>
            ) : resultForCurrentPlayer.distributionConfirmed ? (
              <div className="player-notice">
                Your distribution is confirmed. Waiting for the rest of the field.
              </div>
            ) : (
              <>
                <div className="distribution-panel__total">
                  <span>Available to give</span>
                  <strong>{resultForCurrentPlayer.drinkAllowance}</strong>
                  <span>Remaining: {remainingDrinks}</span>
                </div>
                <h3>Choose your recipients</h3>
                <div className="distribution-list">
                  {raceResult.players
                    .filter((player) => player.socketId !== socket.id)
                    .map((player) => (
                      <div className="distribution-player" key={player.socketId}>
                        <span>{player.username}</span>
                        <div className="stepper">
                          <button
                            aria-label={`Give one less to ${player.username}`}
                            disabled={!distribution[player.socketId]}
                            onClick={() => changeDistribution(player.socketId, -1)}
                          >
                            −
                          </button>
                          <strong>{distribution[player.socketId] || 0}</strong>
                          <button
                            aria-label={`Give one more to ${player.username}`}
                            disabled={remainingDrinks === 0}
                            onClick={() => changeDistribution(player.socketId, 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
                {distributionError && (
                  <p className="distribution-error">{distributionError}</p>
                )}
                <button
                  className="club-button player-page__submit"
                  disabled={remainingDrinks !== 0}
                  onClick={confirmDistribution}
                >
                  Confirm distribution <span aria-hidden="true">→</span>
                </button>
              </>
            ))}
        </section>
      ) : isGameStarted ? (
        <>
          <RaceTrack grid={cardGrid} lastCard={lastCard} />
          <div className="player-race-note club-panel">
            <span className="eyebrow">Your wager</span>
            <strong>
              {currentPlayer
                ? suits
                    .filter(({ name }) => currentPlayer.bet[name] > 0)
                    .map(
                      ({ name, symbol }) =>
                        `${symbol} ${name} × ${currentPlayer.bet[name]}`,
                    )
                    .join("  ·  ") || "No wager"
                : "Loading…"}
            </strong>
          </div>
        </>
      ) : (
        <div className="player-page__betting">
          <div className="player-page__section-title">
            <span className="eyebrow">01 / The betting ring</span>
            <h2>Pick your contenders.</h2>
          </div>
          <div className="betting-card-container">
            {suits.map(({ name, symbol }, index) => (
              <div className={`betting-card betting-card--${name}`} key={name}>
                <span className="betting-card__number">
                  NO. {String(index + 1).padStart(2, "0")}
                </span>
                <img src={`/Images/${name}_ace.png`} alt={`${name} ace`} />
                <div className="betting-card__bottom">
                  <span>
                    <i>{symbol}</i>
                    {name}
                  </span>
                  <div className="stepper">
                    <button
                      aria-label={`Decrease ${name} bet`}
                      disabled={betConfirmed || !currentPlayer?.bet[name]}
                      onClick={() => handleBet(-1, name)}
                    >
                      −
                    </button>
                    <strong>{currentPlayer?.bet[name] || 0}</strong>
                    <button
                      aria-label={`Increase ${name} bet`}
                      disabled={betConfirmed || !currentPlayer}
                      onClick={() => handleBet(1, name)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="betting-footer club-panel">
            <div>
              <span className="eyebrow">Your race ticket</span>
              <strong>
                {currentPlayer
                  ? Object.values(currentPlayer.bet).reduce(
                      (sum, value) => sum + value,
                      0,
                    )
                  : 0}{" "}
                units wagered
              </strong>
              <small>
                {betConfirmed
                  ? "Wager placed. Waiting for the other players."
                  : "Winners distribute twice their wager."}
              </small>
            </div>
            <button
              className="club-button"
              disabled={betConfirmed || !currentPlayer}
              onClick={() => {
                socket.emit("betsPlaced", roomId);
                setBetConfirmed(true);
              }}
            >
              {" "}
              {betConfirmed ? "Wager confirmed" : "Confirm wager"}{" "}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

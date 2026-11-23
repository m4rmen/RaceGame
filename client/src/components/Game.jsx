import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSocket } from "../SocketContext";
import ClubHeader from "./ClubHeader";
import RaceTrack from "./RaceTrack";
import { AnimatedTally, ReplayDeal, ToastSources, TurnSpotlight } from "./RaceExtras";
import { FullAllowanceCallout, wagerDetails, wagerTier } from "./DrinkingCeremony";
import { DistributionMeter, PlayerBib, PlayerScorecard, RaceToolbar } from "./RaceUi";
import "./Game.css";

const suits = [
  { name: "clubs", symbol: "♣" },
  { name: "spades", symbol: "♠" },
  { name: "hearts", symbol: "♥" },
  { name: "diamonds", symbol: "♦" },
];

export default function Game() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const playerId = socket?.auth?.sessionId;
  const [players, setPlayers] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [betConfirmed, setBetConfirmed] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [cardGrid, setCardGrid] = useState([]);
  const [lastCard, setLastCard] = useState(null);
  const [raceResult, setRaceResult] = useState(null);
  const [revealedWinner, setRevealedWinner] = useState(null);
  const [crampCard, setCrampCard] = useState(null);
  const finishCrampCardReveal = useCallback(() => setCrampCard(null), []);
  const finishWinnerReveal = useCallback(() => setRevealedWinner(null), []);
  const [ceremony, setCeremony] = useState(null);
  const [postCeremony, setPostCeremony] = useState(null);
  const [postDrinkingDone, setPostDrinkingDone] = useState(false);
  const [distribution, setDistribution] = useState({});
  const [distributionError, setDistributionError] = useState("");
  const [isReplay, setIsReplay] = useState(false);
  const [chipLaunch, setChipLaunch] = useState(null);
  const [roundHistory, setRoundHistory] = useState([]);

  useEffect(() => {
    if (!socket) return;
    const onPlayers = (nextPlayers) => {
      setPlayers(nextPlayers);
      setCurrentPlayer(
        nextPlayers.find((player) => player.socketId === playerId) || null,
      );
    };
    const applySnapshot = (state) => {
      if (!state) return;
      onPlayers(state.players);
      setBetConfirmed(
        Boolean(
          state.players.find((player) => player.socketId === playerId)?.betConfirmed,
        ),
      );
      setIsGameStarted(
        ["racing", "finished", "postDrinking", "complete"].includes(state.phase),
      );
      setCardGrid(state.grid);
      setCrampCard(null);
      setLastCard(state.lastCard);
      setCeremony(state.ceremony);
      setPostCeremony(state.postCeremony);
      setPostDrinkingDone(state.phase === "complete");
      setRaceResult(state.raceResult);
      setRoundHistory(state.roundHistory ?? []);
      if (!state.raceResult) setRevealedWinner(null);
      const current = state.raceResult?.players.find(
        (player) => player.socketId === playerId,
      );
      setDistribution(
        Object.fromEntries(
          current?.distributions.map((item) => [item.recipientId, item.amount]) || [],
        ),
      );
    };
    const resume = () => {
      socket.emit("resumeRoom", roomId, (response) => {
        if (response.success) applySnapshot(response.state);
        else {
          sessionStorage.removeItem("currentRoomId");
          sessionStorage.removeItem("raceRole");
          navigate("/join");
        }
      });
    };
    socket.on("connect", resume);
    if (socket.connected) resume();
    const onStart = ({ grid }) => {
      setIsGameStarted(true);
      setIsReplay(false);
      setCardGrid(grid);
      setCeremony(null);
      setPostCeremony(null);
      setPostDrinkingDone(false);
    };
    const onWon = (result) => {
      setRevealedWinner(result.winner);
      setRaceResult(result);
      setDistribution({});
    };
    const onNewGame = ({ players: nextPlayers, grid, roundHistory: history = [] }) => {
      setRoundHistory(history);
      setIsReplay(true);
      setChipLaunch(null);
      onPlayers(nextPlayers);
      setBetConfirmed(false);
      setIsGameStarted(false);
      setCardGrid(grid);
      setLastCard(null);
      setCrampCard(null);
      setRaceResult(null);
      setRevealedWinner(null);
      setCeremony(null);
      setPostCeremony(null);
      setPostDrinkingDone(false);
      setDistribution({});
      setDistributionError("");
    };
    socket.on("updatePlayers", onPlayers);
    socket.on("startGame", onStart);
    socket.on("drinkingCeremony", setCeremony);
    socket.on("postDrinkingCeremony", setPostCeremony);
    const onPostComplete = () => {
      setPostCeremony(null);
      setPostDrinkingDone(true);
    };
    socket.on("postDrinkingComplete", onPostComplete);
    socket.on("cardFlipped", setLastCard);
    const onGrid = (grid, revealedCrampCard = null) => {
      setCardGrid(grid);
      setCrampCard(revealedCrampCard);
    };
    socket.on("updateGrid", onGrid);
    socket.on("gameWon", onWon);
    socket.on("distributionUpdate", setRaceResult);
    socket.on("newGame", onNewGame);
    const onRoomDeleted = () => {
      sessionStorage.removeItem("currentRoomId");
      sessionStorage.removeItem("raceRole");
      navigate("/join");
    };
    socket.on("roomDeleted", onRoomDeleted);
    const onPlayerRemoved = (removedId) => {
      if (removedId === playerId) onRoomDeleted();
      else {
        setDistribution((current) => {
          const next = { ...current };
          delete next[removedId];
          return next;
        });
      }
    };
    socket.on("playerRemoved", onPlayerRemoved);
    return () => {
      socket.off("connect", resume);
      socket.off("updatePlayers", onPlayers);
      socket.off("startGame", onStart);
      socket.off("drinkingCeremony", setCeremony);
      socket.off("postDrinkingCeremony", setPostCeremony);
      socket.off("postDrinkingComplete", onPostComplete);
      socket.off("cardFlipped", setLastCard);
      socket.off("updateGrid", onGrid);
      socket.off("gameWon", onWon);
      socket.off("distributionUpdate", setRaceResult);
      socket.off("newGame", onNewGame);
      socket.off("roomDeleted", onRoomDeleted);
      socket.off("playerRemoved", onPlayerRemoved);
    };
  }, [socket, roomId, playerId, navigate]);

  const handleBet = (change, suit) => {
    if (!currentPlayer || betConfirmed) return;
    if (change > 0) {
      setChipLaunch((previous) => ({ suit, sequence: (previous?.sequence ?? 0) + 1 }));
    }
    const bet = {
      ...currentPlayer.bet,
      [suit]: Math.max(0, (currentPlayer.bet[suit] || 0) + change),
    };
    setCurrentPlayer({ ...currentPlayer, bet });
    socket.emit("playerBetChange", bet, roomId);
  };
  const resultForCurrentPlayer = raceResult?.players.find(
    (player) => player.socketId === playerId,
  );
  const distributedTotal = Object.values(distribution).reduce(
    (total, amount) => total + amount,
    0,
  );
  const recipients =
    raceResult?.players.filter((player) => player.socketId !== playerId) ?? [];
  const assignmentTotal = recipients.length
    ? (resultForCurrentPlayer?.drinkAllowance ?? 0)
    : 0;
  const remainingDrinks = assignmentTotal - distributedTotal;
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
    players.find((player) => player.socketId === playerId)?.username;
  const ceremonyPlayer = ceremony?.players[ceremony.currentIndex];
  const myCeremonyEntry = ceremony?.players.find(
    (player) => player.socketId === playerId,
  );
  const isMyTurn = Boolean(playerId && ceremonyPlayer?.socketId === playerId);
  const activePostPlayer = postCeremony?.players[postCeremony.currentIndex];
  const isMyPostTurn = Boolean(playerId && activePostPlayer?.socketId === playerId);
  const myPostEntry = postCeremony?.players.find(
    (player) => player.socketId === playerId,
  );
  const showResults = raceResult && !revealedWinner;
  const wagerTotal = Object.values(currentPlayer?.bet ?? {}).reduce(
    (sum, amount) => sum + amount,
    0,
  );

  return (
    <div className="app-shell player-page">
      <ClubHeader roomId={roomId} label={playerName || "Player view"} />
      <RaceToolbar
        phase={showResults ? 3 : isGameStarted ? 2 : 1}
        rounds={roundHistory}
      />
      <div className="player-page__intro">
        <span className="eyebrow">The Ace Race / Your seat at the track</span>
        <h1 className="page-title">
          {showResults
            ? postCeremony
              ? "The final toast."
              : "The result is in."
            : ceremony
              ? "The wagers are in."
              : isGameStarted
                ? "Eyes on the finish."
                : "Back your horse."}
        </h1>
        <p className="page-intro">
          {showResults
            ? postCeremony
              ? "The host is calling each player for their final tally."
              : "The winning wager pays double. Choose who receives your drinks."
            : ceremony
              ? "The host is calling each player before the race begins."
              : isGameStarted
                ? "The cards decide the pace. Follow your horse down the course."
                : "Choose your ace and set your wager before the gates open."}
        </p>
      </div>
      {!revealedWinner && postCeremony ? (
        <section
          className={`player-ceremony player-ceremony--finale club-panel${isMyPostTurn ? " is-your-turn" : ""}`}
          aria-live="polite"
        >
          {isMyPostTurn && <TurnSpotlight />}
          <span className="eyebrow">
            The winners' circle · Rider {postCeremony.currentIndex + 1} of{" "}
            {postCeremony.players.length}
          </span>
          <div className="player-ceremony__spotlight" key={activePostPlayer?.socketId}>
            <span>
              {isMyPostTurn ? "Your final toast" : "Now in the spotlight"}{" "}
              <PlayerBib number={activePostPlayer?.bib} />
            </span>
            <h2>{activePostPlayer?.username}</h2>
            <p>
              {isMyPostTurn
                ? "Take the drinks given to you, then tell the host you're ready."
                : "The next name is coming up."}
            </p>
            <FullAllowanceCallout recipient={activePostPlayer} />
          </div>
          <div className="player-ceremony__ticket">
            <span className="eyebrow">Your final tally</span>
            <strong>
              <AnimatedTally total={myPostEntry?.total || 0} active={isMyPostTurn} />{" "}
              <small>{myPostEntry?.total === 1 ? "sip" : "sips"}</small>
            </strong>
            <p>
              <ToastSources sources={myPostEntry?.sources} active={isMyPostTurn} />
            </p>
          </div>
        </section>
      ) : ceremony ? (
        <section
          className={`player-ceremony club-panel player-ceremony--${wagerTier(myCeremonyEntry?.total || 0).key}${isMyTurn ? " is-your-turn" : ""}`}
          aria-live="polite"
        >
          {isMyTurn && <TurnSpotlight />}
          <span className="eyebrow">
            Before the off · Rider {ceremony.currentIndex + 1} of{" "}
            {ceremony.players.length}
          </span>
          <div className="player-ceremony__spotlight" key={ceremonyPlayer?.socketId}>
            <span>
              {isMyTurn ? "Your turn in the spotlight" : "Now at the rail"}{" "}
              <PlayerBib number={ceremonyPlayer?.bib} />
            </span>
            <h2>{ceremonyPlayer?.username}</h2>
            <p>
              {isMyTurn
                ? "Take your wager, then tell the host you're ready."
                : "The host will call the next rider shortly."}
            </p>
          </div>
          <div className="player-ceremony__ticket">
            <span className="eyebrow">Your race ticket</span>
            <strong>
              {myCeremonyEntry?.total || 0}{" "}
              <small>{myCeremonyEntry?.total === 1 ? "sip" : "sips"}</small>
            </strong>
            <p>
              {myCeremonyEntry
                ? wagerDetails(myCeremonyEntry.bet)
                : "Waiting for your wager…"}
            </p>
          </div>
        </section>
      ) : showResults ? (
        <section className="distribution-panel club-panel">
          <span className="eyebrow">Official race result</span>
          <h2>{raceResult.winner.replace("_ace", "")} wins.</h2>
          {resultForCurrentPlayer && (
            <PlayerScorecard player={resultForCurrentPlayer} />
          )}
          {resultForCurrentPlayer &&
            (resultForCurrentPlayer.drinkAllowance === 0 ? (
              <div className="player-notice">
                Your horse did not win this time. Stay tuned for the next race.
              </div>
            ) : resultForCurrentPlayer.distributionConfirmed ? (
              <div className="player-notice">
                {postDrinkingDone
                  ? "The celebration is complete. Waiting for the host to start another race."
                  : "Your distribution is confirmed. Waiting for the rest of the field."}
              </div>
            ) : (
              <>
                <DistributionMeter
                  assigned={distributedTotal}
                  total={assignmentTotal}
                />
                {recipients.length ? (
                  <h3>Choose your recipients</h3>
                ) : (
                  <p>No other players to give sips to.</p>
                )}
                <div className="distribution-list">
                  {recipients.map((player) => (
                    <div className="distribution-player" key={player.socketId}>
                      <span>
                        <PlayerBib number={player.bib} /> {player.username}
                      </span>
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
                          disabled={remainingDrinks <= 0}
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
          <RaceTrack
            grid={cardGrid}
            lastCard={lastCard}
            started={isGameStarted}
            picks={suits
              .filter(({ name }) => currentPlayer?.bet[name] > 0)
              .map(({ name }) => name)}
            winner={revealedWinner}
            crampCard={crampCard}
            onCrampCardEnd={finishCrampCardReveal}
            onWinnerRevealEnd={finishWinnerReveal}
          />
        </>
      ) : (
        <div className="player-page__betting replay-stage">
          {isReplay && <ReplayDeal />}
          <div className="player-page__section-title">
            <span className="eyebrow">01 / The betting ring</span>
            <h2>Pick your contenders.</h2>
          </div>
          <div className="betting-card-container">
            {suits.map(({ name, symbol }, index) => {
              const wager = currentPlayer?.bet[name] || 0;
              return (
                <div
                  className={`betting-card betting-card--${name}${wager ? " has-wager" : ""}`}
                  key={name}
                >
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
                        disabled={betConfirmed || !wager}
                        onClick={() => handleBet(-1, name)}
                      >
                        −
                      </button>
                      <strong key={wager} className="betting-card__count">
                        {wager}
                      </strong>
                      <button
                        aria-label={`Increase ${name} bet`}
                        disabled={betConfirmed || !currentPlayer}
                        onClick={() => handleBet(1, name)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  {wager > 0 && (
                    <span
                      className="betting-chip-stack"
                      style={{ "--stack-depth": Math.min(wager, 5) }}
                      aria-hidden="true"
                    />
                  )}
                  {chipLaunch?.suit === name && (
                    <span
                      className="betting-chip"
                      key={chipLaunch.sequence}
                      aria-hidden="true"
                    >
                      {symbol}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="betting-footer club-panel">
            <details className="bet-slip">
              <summary>
                <strong>{wagerTotal}</strong> {wagerTotal === 1 ? "sip" : "sips"}{" "}
                wagered
              </summary>
              <dl className="bet-slip__breakdown">
                {suits.map(({ name, symbol }) => (
                  <div key={name}>
                    <dt>
                      {symbol} {name}
                    </dt>
                    <dd>{currentPlayer?.bet[name] ?? 0}</dd>
                  </div>
                ))}
              </dl>
            </details>
            <button
              className="club-button"
              disabled={betConfirmed || !currentPlayer}
              onClick={() => {
                socket.emit("betsPlaced", roomId);
                setBetConfirmed(true);
              }}
            >
              {" "}
              {betConfirmed ? "Bets confirmed" : "Confirm bets"}{" "}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

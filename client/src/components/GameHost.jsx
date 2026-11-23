import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSocket } from "../SocketContext";
import ClubHeader from "./ClubHeader";
import RaceTrack from "./RaceTrack";
import { ReplayDeal } from "./RaceExtras";
import DrinkingCeremony from "./DrinkingCeremony";
import "./GameHost.css";

const initialGrid = [
  [],
  [],
  [],
  [],
  [],
  [],
  [],
  ["clubs_ace", "diamonds_ace", "hearts_ace", "spades_ace"],
];

export default function GameHost() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const [players, setPlayers] = useState([]);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [lastCard, setLastCard] = useState(null);
  const [recentDraws, setRecentDraws] = useState([]);
  const [isReplay, setIsReplay] = useState(false);
  const [cardGrid, setCardGrid] = useState(initialGrid);
  const [raceResult, setRaceResult] = useState(null);
  const [revealedWinner, setRevealedWinner] = useState(null);
  const [sideCard, setSideCard] = useState(null);
  const finishSideCardReveal = useCallback(() => setSideCard(null), []);
  const finishWinnerReveal = useCallback(() => setRevealedWinner(null), []);
  const [ceremony, setCeremony] = useState(null);
  const [postCeremony, setPostCeremony] = useState(null);
  const [postDrinkingDone, setPostDrinkingDone] = useState(false);
  const [confirmingDrink, setConfirmingDrink] = useState(false);
  const [ceremonyError, setCeremonyError] = useState("");
  const [replayError, setReplayError] = useState("");

  useEffect(() => {
    if (!socket) return;
    const resume = () => {
      socket.emit("resumeRoom", roomId, (response) => {
        if (!response.success || !response.isHost) {
          navigate("/host");
          return;
        }
        const state = response.state;
        setPlayers(state.players);
        setIsGameStarted(
          ["racing", "finished", "postDrinking", "complete"].includes(state.phase),
        );
        setLastCard(state.lastCard);
        setRecentDraws(state.recentDraws ?? (state.lastCard ? [state.lastCard] : []));
        setCardGrid(state.grid);
        setSideCard(null);
        setRaceResult(state.raceResult);
        if (!state.raceResult) setRevealedWinner(null);
        setCeremony(state.ceremony);
        setPostCeremony(state.postCeremony);
        setPostDrinkingDone(state.phase === "complete");
      });
    };
    socket.on("connect", resume);
    if (socket.connected) resume();
    const onStart = ({ grid }) => {
      setIsGameStarted(true);
      setIsReplay(false);
      setCardGrid(grid);
      setCeremony(null);
      setConfirmingDrink(false);
    };
    const onCeremony = (state) => {
      setCeremony(state);
      setConfirmingDrink(false);
      setCeremonyError("");
    };
    const onPostCeremony = (state) => {
      setPostCeremony(state);
      setConfirmingDrink(false);
      setCeremonyError("");
    };
    const onPostComplete = () => {
      setPostCeremony(null);
      setPostDrinkingDone(true);
      setConfirmingDrink(false);
    };
    const onNewGame = ({ players: nextPlayers, grid }) => {
      setPlayers(nextPlayers);
      setIsGameStarted(false);
      setLastCard(null);
      setRecentDraws([]);
      setIsReplay(true);
      setSideCard(null);
      setCardGrid(grid);
      setRaceResult(null);
      setRevealedWinner(null);
      setCeremony(null);
      setPostCeremony(null);
      setPostDrinkingDone(false);
      setReplayError("");
    };
    socket.on("updatePlayers", setPlayers);
    socket.on("startGame", onStart);
    socket.on("drinkingCeremony", onCeremony);
    socket.on("postDrinkingCeremony", onPostCeremony);
    socket.on("postDrinkingComplete", onPostComplete);
    const onDraw = (card, history) => {
      setLastCard(card);
      setRecentDraws((previous) => history ?? [card, ...previous].slice(0, 3));
    };
    socket.on("cardFlipped", onDraw);
    const onGrid = (grid, revealedSideCard = null) => {
      setCardGrid(grid);
      setSideCard(revealedSideCard);
    };
    socket.on("updateGrid", onGrid);
    const onWon = (result) => {
      setRevealedWinner(result.winner);
      setRaceResult(result);
    };
    socket.on("gameWon", onWon);
    socket.on("distributionUpdate", setRaceResult);
    socket.on("newGame", onNewGame);
    const onRoomReset = () => navigate("/host");
    socket.on("roomReset", onRoomReset);
    return () => {
      socket.off("connect", resume);
      socket.off("updatePlayers", setPlayers);
      socket.off("startGame", onStart);
      socket.off("drinkingCeremony", onCeremony);
      socket.off("postDrinkingCeremony", onPostCeremony);
      socket.off("postDrinkingComplete", onPostComplete);
      socket.off("cardFlipped", onDraw);
      socket.off("updateGrid", onGrid);
      socket.off("gameWon", onWon);
      socket.off("distributionUpdate", setRaceResult);
      socket.off("newGame", onNewGame);
      socket.off("roomReset", onRoomReset);
    };
  }, [socket, roomId, navigate]);

  const formatBets = (bet) =>
    Object.entries(bet)
      .filter(([, amount]) => amount > 0)
      .map(([suit, amount]) => `${amount} ${suit}`)
      .join(" · ") || "—";
  const formatDistribution = (items) =>
    items.length
      ? items
          .map(({ recipientUsername, amount }) => `${amount} → ${recipientUsername}`)
          .join(" · ")
      : "—";
  const handleReplay = () =>
    socket.emit("playAgain", roomId, (response) => {
      if (!response.success) setReplayError(response.message);
    });
  const confirmedCount = players.filter((player) => player.betConfirmed).length;
  const confirmDrink = (playerId) => {
    setConfirmingDrink(true);
    socket.emit("confirmDrink", roomId, playerId, (response) => {
      if (!response.success) {
        setCeremonyError(response.message);
        setConfirmingDrink(false);
      }
    });
  };
  const confirmPostDrink = (playerId) => {
    setConfirmingDrink(true);
    socket.emit("confirmPostDrink", roomId, playerId, (response) => {
      if (!response.success) {
        setCeremonyError(response.message);
        setConfirmingDrink(false);
      }
    });
  };

  return (
    <div className="app-shell host-page">
      <ClubHeader roomId={roomId} label="The announcer’s box" />
      <div className="host-page__intro">
        <div>
          <h1 className="page-title">
            {!revealedWinner && postCeremony ? (
              <>
                Now comes the <em>fun part.</em>
              </>
            ) : ceremony ? (
              <>
                Wagers <em>on the line.</em>
              </>
            ) : (
              <>{/* The race is <em>on.</em> */}</>
            )}
          </h1>
          <p className="page-intro">
            {!revealedWinner && postCeremony
              ? "Time to drink the distributed bets"
              : ceremony
                ? "Every rider takes their wager before the gates open."
                : ""}
          </p>
        </div>
        {/* <div className="host-page__badge">
          <span>RACE NO.</span>
          <strong>01</strong>
          <span>THE CLUB COURSE</span>
        </div> */}
      </div>
      {!revealedWinner && postCeremony ? (
        <DrinkingCeremony
          ceremony={postCeremony}
          onConfirm={confirmPostDrink}
          confirming={confirmingDrink}
          error={ceremonyError}
          finale
        />
      ) : ceremony ? (
        <DrinkingCeremony
          ceremony={ceremony}
          onConfirm={confirmDrink}
          confirming={confirmingDrink}
          error={ceremonyError}
        />
      ) : raceResult && !revealedWinner ? (
        <section className="host-results club-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Official race result</span>
              <h2>{raceResult.winner.replace("_ace", "")} takes the crown.</h2>
            </div>
            <span className="winner-suit">
              {
                { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" }[
                  raceResult.winner.replace("_ace", "")
                ]
              }
            </span>
          </div>
          <div className="distribution-legend" aria-label="Distribution status legend">
            <span>
              <i className="legend-color legend-pending" /> Amber · in progress
            </span>
            <span>
              <i className="legend-color legend-complete" /> Green · confirmed
            </span>
          </div>
          <div className="host-results__scroll">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Wager</th>
                  <th>To give</th>
                  <th>Distribution</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {raceResult.players.map((player) => (
                  <tr
                    className={
                      player.distributionConfirmed
                        ? "distribution-complete"
                        : "distribution-pending"
                    }
                    key={player.socketId}
                  >
                    <td>
                      <strong>{player.username}</strong>
                    </td>
                    <td>{formatBets(player.bet)}</td>
                    <td>{player.drinkAllowance}</td>
                    <td>{formatDistribution(player.distributions)}</td>
                    <td>
                      {player.distributionConfirmed ? "Confirmed" : "In progress"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="host-results__footer">
            {postDrinkingDone ? (
              <button className="club-button" onClick={handleReplay}>
                Run another race <span aria-hidden="true">↗</span>
              </button>
            ) : (
              <p>Waiting for the winners to distribute their drinks…</p>
            )}
            {replayError && <p className="distribution-error">{replayError}</p>}
          </div>
        </section>
      ) : (
        <div className="host-page__layout">
          <div className="host-page__rail">
            <div className="host-page__action club-panel">
              <div>
                <span className="eyebrow">
                  {isGameStarted ? "The next turn" : "Before the off"}
                </span>
                <h3>{isGameStarted ? "Draw the next card" : "Waiting at the gates"}</h3>
                <p>
                  {isGameStarted
                    ? "Reveal a card and watch its suit make a move."
                    : "The race begins when every player confirms their wager."}
                </p>
              </div>
              {isGameStarted && (
                <button
                  className="club-button"
                  disabled={Boolean(revealedWinner || sideCard)}
                  onClick={() => socket.emit("flipCard", roomId)}
                >
                  Flip next card <span aria-hidden="true">→</span>
                </button>
              )}
            </div>
            <aside className="host-page__sidebar club-panel">
              <span className="eyebrow">The paddock</span>
              <h2>
                Players <small>{players.length}</small>
              </h2>
              <p className="club-muted">
                {isGameStarted
                  ? "The field is set."
                  : `${confirmedCount} of ${players.length} wagers confirmed`}
              </p>
              <div className="host-player-list">
                {players.length ? (
                  players.map((player, index) => (
                    <div className="host-player" key={player.socketId}>
                      <span className="host-player__number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <strong>{player.username}</strong>
                        <small>
                          {isGameStarted
                            ? formatBets(player.bet)
                            : player.betConfirmed
                              ? "Wager confirmed"
                              : "Placing wager"}
                        </small>
                      </div>
                      <span
                        className={`host-player__dot ${player.betConfirmed ? "is-ready" : ""}`}
                      />
                      <button
                        className="remove-player-button"
                        type="button"
                        aria-label={`Remove ${player.username} from the room`}
                        onClick={() =>
                          socket.emit("removePlayer", roomId, player.socketId)
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="club-muted">Share the room code to invite players.</p>
                )}
              </div>
              <div className="host-page__room">
                ROOM CODE <strong>{roomId}</strong>
              </div>
            </aside>
          </div>
          <div className="host-page__main replay-stage">
            {isReplay && <ReplayDeal />}
            <RaceTrack
              grid={cardGrid}
              lastCard={lastCard}
              recentDraws={recentDraws}
              started={isGameStarted}
              winner={revealedWinner}
              sideCard={sideCard}
              onSideCardEnd={finishSideCardReveal}
              onWinnerRevealEnd={finishWinnerReveal}
            />
          </div>
        </div>
      )}
    </div>
  );
}

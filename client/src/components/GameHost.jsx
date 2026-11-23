import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage, localizeError } from "../LanguageContext";
import { useNavigate, useParams } from "react-router-dom";
import { useSocket } from "../SocketContext";
import ClubHeader from "./ClubHeader";
import RaceTrack from "./RaceTrack";
import { ReplayDeal } from "./RaceExtras";
import DrinkingCeremony from "./DrinkingCeremony";
import { PlayerBib, RaceToolbar } from "./RaceUi";
import "./GameHost.css";

const AUTO_FLIP_INTERVALS_MS = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000];

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
  const { t, language } = useLanguage();
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
  const [crampCard, setCrampCard] = useState(null);
  const finishCrampCardReveal = useCallback(() => setCrampCard(null), []);
  const finishWinnerReveal = useCallback(() => setRevealedWinner(null), []);
  const [ceremony, setCeremony] = useState(null);
  const [postCeremony, setPostCeremony] = useState(null);
  const [postDrinkingDone, setPostDrinkingDone] = useState(false);
  const [confirmingDrink, setConfirmingDrink] = useState(false);
  const [ceremonyError, setCeremonyError] = useState("");
  const [replayError, setReplayError] = useState("");
  const [roundHistory, setRoundHistory] = useState([]);
  const [broadcast, setBroadcast] = useState(false);
  const [showPaddock, setShowPaddock] = useState(true);
  const [autoFlip, setAutoFlip] = useState(false);
  const [autoFlipInterval, setAutoFlipInterval] = useState(AUTO_FLIP_INTERVALS_MS[0]);
  const [autoDrawPending, setAutoDrawPending] = useState(false);
  const [autoFlipError, setAutoFlipError] = useState("");
  const ownsFullscreen = useRef(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (ownsFullscreen.current && !document.fullscreenElement) {
        ownsFullscreen.current = false;
        setBroadcast(false);
        setShowPaddock(true);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (ownsFullscreen.current && document.fullscreenElement) {
        void document.exitFullscreen()?.catch(() => {});
      }
    };
  }, []);

  const toggleBroadcast = async () => {
    setBroadcast(!broadcast);
    setShowPaddock(broadcast);
    if (broadcast) {
      if (ownsFullscreen.current && document.fullscreenElement) {
        await document.exitFullscreen()?.catch(() => {});
      }
      return;
    }
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
        ownsFullscreen.current = true;
      } catch {
        // The expanded layout also works when fullscreen is unavailable.
      }
    }
  };

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
        setCrampCard(null);
        setRaceResult(state.raceResult);
        setRoundHistory(state.roundHistory ?? []);
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
    const onNewGame = ({ players: nextPlayers, grid, roundHistory: history = [] }) => {
      setAutoFlip(false);
      setAutoFlipError("");
      setRoundHistory(history);
      setPlayers(nextPlayers);
      setIsGameStarted(false);
      setLastCard(null);
      setRecentDraws([]);
      setIsReplay(true);
      setCrampCard(null);
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
    const onGrid = (grid, revealedCrampCard = null) => {
      setCardGrid(grid);
      setCrampCard(revealedCrampCard);
    };
    socket.on("updateGrid", onGrid);
    const onWon = (result) => {
      setAutoFlip(false);
      setRevealedWinner(result.winner);
      setRaceResult(result);
    };
    socket.on("gameWon", onWon);
    socket.on("distributionUpdate", setRaceResult);
    socket.on("newGame", onNewGame);
    const onRoomReset = () => navigate("/host");
    socket.on("roomReset", onRoomReset);
    const onDisconnect = () => setAutoFlip(false);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("disconnect", onDisconnect);
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

  const isRacing = isGameStarted && !raceResult && !ceremony && !postCeremony;
  const drawBlocked = Boolean(revealedWinner || crampCard);

  useEffect(() => {
    if (!socket || !autoFlip || !isRacing || drawBlocked || autoDrawPending) return;

    const timer = window.setTimeout(() => {
      if (!socket.connected) {
        setAutoFlip(false);
        setAutoFlipError("Auto flip paused because the server disconnected.");
        return;
      }

      setAutoDrawPending(true);
      socket.timeout(5000).emit("flipCard", roomId, (error, response) => {
        setAutoDrawPending(false);
        if (error || !response?.success) {
          setAutoFlip(false);
          setAutoFlipError("Auto flip paused because the draw could not be confirmed.");
        }
      });
    }, autoFlipInterval);

    return () => window.clearTimeout(timer);
  }, [
    socket,
    roomId,
    autoFlip,
    autoFlipInterval,
    isRacing,
    drawBlocked,
    autoDrawPending,
    lastCard,
  ]);

  const formatBets = (bet) =>
    Object.entries(bet)
      .filter(([, amount]) => amount > 0)
      .map(([suit, amount]) => `${amount} ${t(suit)}`)
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
  const phase = raceResult && !revealedWinner ? 3 : isGameStarted ? 2 : 1;
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
    <div className={`app-shell host-page${broadcast ? " host-page--broadcast" : ""}`}>
      <ClubHeader roomId={roomId} label={t("The announcer’s box")} />
      <RaceToolbar
        phase={phase}
        ready={
          phase === 1
            ? t("{ready} of {total} ready", {
                ready: confirmedCount,
                total: players.length,
              })
            : undefined
        }
        rounds={roundHistory}
      >
        <button
          type="button"
          className="race-toolbar__button"
          onClick={toggleBroadcast}
        >
          {broadcast ? t("Exit broadcast") : t("Broadcast view")}
        </button>
      </RaceToolbar>
      {(!revealedWinner && postCeremony) || ceremony ? (
        <div className="host-page__intro">
          <div>
            <h1 className="page-title">
              {!revealedWinner && postCeremony ? (
                <>
                  {t("Now comes the") + " "}
                  <em>{t("fun part.")}</em>
                </>
              ) : (
                <>
                  {t("Wagers") + " "}
                  <em>{t("on the line.")}</em>
                </>
              )}
            </h1>
            <p className="page-intro">
              {!revealedWinner && postCeremony
                ? t("Time to drink the distributed bets")
                : t("Every rider takes their wager before the gates open.")}
            </p>
          </div>
        </div>
      ) : null}
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
              <span className="eyebrow">{t("Official race result")}</span>
              <h2>
                {t("{suit} takes the crown.", {
                  suit: t(raceResult.winner.replace("_ace", "")),
                })}
              </h2>
            </div>
            <span className="winner-suit">
              {
                { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" }[
                  raceResult.winner.replace("_ace", "")
                ]
              }
            </span>
          </div>
          <div
            className="distribution-legend"
            aria-label={t("Distribution status legend")}
          >
            <span>
              <i className="legend-color legend-pending" />
              {" " + t("Amber · in progress")}
            </span>
            <span>
              <i className="legend-color legend-complete" />
              {" " + t("Green · confirmed")}
            </span>
          </div>
          <div className="host-results__scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("Player")}</th>
                  <th>{t("Wager")}</th>
                  <th>{t("Payout")}</th>
                  <th>{t("Sent")}</th>
                  <th>{t("Received")}</th>
                  <th>{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {raceResult.players.map((player, index) => (
                  <tr
                    className={
                      player.distributionConfirmed
                        ? "distribution-complete"
                        : "distribution-pending"
                    }
                    key={player.socketId}
                  >
                    <td>
                      <PlayerBib number={player.bib ?? index + 1} />{" "}
                      <strong>{player.username}</strong>
                    </td>
                    <td>{formatBets(player.bet)}</td>
                    <td>{player.drinkAllowance}</td>
                    <td>
                      <strong>{player.sent ?? 0}</strong>
                      <small className="scorecard-distribution">
                        {formatDistribution(player.distributions)}
                      </small>
                    </td>
                    <td>{player.received ?? 0}</td>
                    <td>
                      {player.distributionConfirmed ? t("Confirmed") : t("In progress")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="host-results__footer">
            {postDrinkingDone ? (
              <button className="club-button" onClick={handleReplay}>
                {t("Run another race") + " "}
                <span aria-hidden="true">↗</span>
              </button>
            ) : (
              <p>{t("Waiting for the winners to distribute their drinks…")}</p>
            )}
            {replayError && (
              <p className="distribution-error">{localizeError(replayError, t)}</p>
            )}
          </div>
        </section>
      ) : (
        <div className="host-page__layout">
          <div className="host-page__rail">
            <div className="host-page__action club-panel">
              <div>
                <span className="eyebrow">
                  {isGameStarted ? t("The next turn") : t("Before the off")}
                </span>
                <h3>
                  {isGameStarted ? t("Draw the next card") : t("Waiting at the gates")}
                </h3>
                <p>
                  {isGameStarted
                    ? t("Reveal a card and watch its suit make a move.")
                    : t("The race begins when every player confirms their wager.")}
                </p>
              </div>
              {isGameStarted && (
                <div className="host-page__draw-controls">
                  <button
                    className="club-button"
                    disabled={drawBlocked || autoFlip || autoDrawPending}
                    onClick={() => socket.emit("flipCard", roomId)}
                  >
                    {t("Flip next card")}
                  </button>
                  <button
                    type="button"
                    className="club-button club-button--outline auto-flip-toggle"
                    aria-pressed={autoFlip}
                    disabled={!isRacing}
                    onClick={() => {
                      setAutoFlipError("");
                      setAutoFlip((enabled) => !enabled);
                    }}
                  >
                    {t("Auto flip") + " "}
                    <span aria-hidden="true">{autoFlip ? t("on") : t("off")}</span>
                  </button>
                  <label className="host-page__draw-interval">
                    {t("Draw interval")}
                    <select
                      value={autoFlipInterval}
                      onChange={(event) =>
                        setAutoFlipInterval(Number(event.target.value))
                      }
                    >
                      {AUTO_FLIP_INTERVALS_MS.map((interval) => (
                        <option key={interval} value={interval}>
                          {new Intl.NumberFormat(language).format(interval / 1000)}{" "}
                          {interval === 1000 ? t("second") : t("seconds")}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              {autoFlipError && (
                <small className="distribution-error" role="alert">
                  {localizeError(autoFlipError, t)}
                </small>
              )}
              <button
                className="race-toolbar__button"
                type="button"
                aria-expanded={showPaddock}
                aria-controls="host-paddock"
                onClick={() => setShowPaddock((shown) => !shown)}
              >
                {showPaddock ? t("Hide paddock") : t("Show paddock")}
              </button>
            </div>
            <aside
              id="host-paddock"
              className="host-page__sidebar club-panel"
              hidden={!showPaddock}
            >
              <span className="eyebrow">{t("The paddock")}</span>
              <h2>
                {t("Players") + " "}
                <small>{players.length}</small>
              </h2>
              <div className="host-player-list">
                {players.length ? (
                  players.map((player, index) => (
                    <div className="host-player" key={player.socketId}>
                      <PlayerBib number={player.bib ?? index + 1} />
                      <div>
                        <strong>{player.username}</strong>
                        <small>
                          {isGameStarted
                            ? formatBets(player.bet)
                            : player.betConfirmed
                              ? t("Wager confirmed")
                              : t("Placing wager")}
                        </small>
                      </div>
                      <span
                        className={`host-player__dot ${player.betConfirmed ? "is-ready" : ""}`}
                      />
                      <button
                        className="remove-player-button"
                        type="button"
                        aria-label={t("Remove {name} from the room", {
                          name: player.username,
                        })}
                        onClick={() =>
                          socket.emit("removePlayer", roomId, player.socketId)
                        }
                      >
                        {t("Remove")}
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="club-muted">
                    {t("Share the room code to invite players.")}
                  </p>
                )}
              </div>
              <div className="host-page__room">
                {t("ROOM CODE") + " "}
                <strong>{roomId}</strong>
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
              crampCard={crampCard}
              onCrampCardEnd={finishCrampCardReveal}
              onWinnerRevealEnd={finishWinnerReveal}
            />
          </div>
        </div>
      )}
    </div>
  );
}

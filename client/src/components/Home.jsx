import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../SocketContext";
import ClubHeader from "./ClubHeader";

export default function Home() {
  const socket = useSocket();
  const navigate = useNavigate();
  const [rulesOpen, setRulesOpen] = useState(false);
  useEffect(() => {
    const roomId = sessionStorage.getItem("currentRoomId");
    if (roomId && socket) {
      socket.emit(
        sessionStorage.getItem("raceRole") === "host" ? "deleteRoom" : "quitGame",
        roomId,
      );
      sessionStorage.removeItem("currentRoomId");
      sessionStorage.removeItem("raceRole");
    }
  }, [socket]);
  return (
    <div className="app-shell home-page">
      <ClubHeader label="The racing club" />
      <main className="home-hero">
        <div className="home-hero__copy">
          <span className="eyebrow">A card game with a racing heart</span>
          <h1>
            The thrill of
            <br />
            <em>the finish.</em>
          </h1>
          <p>Place your wager. Pick your horse. Watch the aces race for the line.</p>
          <div className="home-hero__actions">
            <button className="club-button" onClick={() => navigate("/join")}>
              Join a race <span aria-hidden="true">→</span>
            </button>
            <button
              className="club-button club-button--outline"
              onClick={() => navigate("/host")}
            >
              Host a race
            </button>
          </div>
        </div>
        <div className="home-hero__art" aria-hidden="true">
          <span className="home-hero__ring">THE ACE RACE · THE ACE RACE ·</span>
          <span className="home-hero__horse">♞</span>
          <div className="home-hero__cards">
            <img src="/Images/spades_ace.png" alt="" />
            <img src="/Images/hearts_ace.png" alt="" />
          </div>
        </div>
      </main>
      <div className="home-footer">
        <span>
          FOUR HORSES <i>✦</i> SEVEN LENGTHS <i>✦</i> ONE WINNER
        </span>
        <button onClick={() => setRulesOpen(true)}>
          How to play <span aria-hidden="true">↗</span>
        </button>
      </div>
      {rulesOpen && (
        <div
          className="rules-overlay"
          role="presentation"
          onClick={() => setRulesOpen(false)}
        >
          <section
            className="rules-dialog club-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rules-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="rules-dialog__close"
              aria-label="Close rules"
              onClick={() => setRulesOpen(false)}
            >
              ×
            </button>
            <span className="eyebrow">The racecard</span>
            <h2 id="rules-title">How to play</h2>
            <ol>
              <li>
                <strong>Place your bets.</strong> Choose one or more of the four ace
                horses and set the number of drink units on each. Drink your wager
                upfront.
              </li>
              <li>
                <strong>Watch the race.</strong> The host draws cards. Each card
                advances the ace of its suit. Side cards may send a horse back.
              </li>
              <li>
                <strong>Share the winnings.</strong> Players who backed the winning
                horse distribute twice their winning wager among the other players.
              </li>
            </ol>
            <button className="club-button" onClick={() => setRulesOpen(false)}>
              Back to the race
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

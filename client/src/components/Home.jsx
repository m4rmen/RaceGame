import React, { useEffect, useState } from "react";
import { LanguageSelect, useLanguage } from "../LanguageContext";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../SocketContext";
import ClubHeader from "./ClubHeader";

export default function Home() {
  const { t } = useLanguage();
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
      <ClubHeader label={t("The racing club")} />
      <main className="home-hero">
        <div className="home-hero__copy">
          <span className="eyebrow">{t("A card game with a racing heart")}</span>
          <h1>
            {t("The thrill of")}
            <br />
            <em>{t("the finish.")}</em>
          </h1>
          <p>
            {t("Place your wager. Pick your horse. Watch the aces race for the line.")}
          </p>
          <div className="home-hero__actions">
            <button className="club-button" onClick={() => navigate("/join")}>
              {t("Join a race") + " "}
              <span aria-hidden="true">→</span>
            </button>
            <button
              className="club-button club-button--outline"
              onClick={() => navigate("/host")}
            >
              {t("Host a race")}
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
          {t("FOUR HORSES") + " "}
          <i>✦</i>
          {" " + t("SEVEN LENGTHS") + " "}
          <i>✦</i>
          {" " + t("ONE WINNER")}
        </span>
        <button onClick={() => setRulesOpen(true)}>
          {t("How to play") + " "}
          <span aria-hidden="true">↗</span>
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
            <LanguageSelect />
            <button
              className="rules-dialog__close"
              aria-label={t("Close rules")}
              onClick={() => setRulesOpen(false)}
            >
              ×
            </button>
            <span className="eyebrow">{t("The racecard")}</span>
            <h2 id="rules-title">{t("How to play")}</h2>
            <ol>
              <li>
                <strong>{t("Place your bets.")}</strong>
                {" " +
                  t(
                    "Choose one or more of the four ace horses and set the number of drink units on each. Drink your wager upfront.",
                  )}
              </li>
              <li>
                <strong>{t("Watch the race.")}</strong>
                {" " +
                  t(
                    "The host draws cards. Each card advances the ace of its suit. Cramp cards send a horse back one length.",
                  )}
              </li>
              <li>
                <strong>{t("Share the winnings.")}</strong>
                {" " +
                  t(
                    "Players who backed the winning horse distribute twice their winning wager among the other players.",
                  )}
              </li>
            </ol>
            <button className="club-button" onClick={() => setRulesOpen(false)}>
              {t("Back to the race")}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

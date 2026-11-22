import React from "react";
import WinnerReveal from "./WinnerReveal";
import "./RaceTrack.css";

const horses = ["clubs", "diamonds", "hearts", "spades"];
const symbols = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };

export default function RaceTrack({ grid = [], lastCard, winner, onWinnerRevealEnd }) {
  const totalSteps = Math.max(grid.length - 1, 1);
  const sideCards = grid
    .slice(1)
    .reverse()
    .map((row) => row[4] || "back_of_card");
  return (
    <section className="race-track" aria-label="Live race positions">
      <div className="race-track__topline">
        <span className="eyebrow">The racecourse · seven furlongs</span>
        <span className="race-track__live">
          <span /> Live track
        </span>
      </div>
      <div className="race-track__heading">
        <div>
          <h2>And they’re off.</h2>
          <p>Every drawn suit advances its horse one length.</p>
        </div>
        {lastCard && (
          <div className="race-track__draw">
            <span>Last draw</span>
            <img
              key={lastCard}
              src={`/Images/${lastCard}.png`}
              alt={lastCard.replace("_", " of ")}
            />
          </div>
        )}
      </div>
      <div className="race-track__course">
        <div className="race-track__scale">
          <span>START</span>
          <span>THE COURSE</span>
          <span>FINISH</span>
        </div>
        {horses.map((suit, column) => {
          const row = grid.findIndex((cells) => cells[column] === `${suit}_ace`);
          const progress = row < 0 ? 0 : totalSteps - row;
          return (
            <div className={`race-lane race-lane--${suit}`} key={suit}>
              <div className="race-lane__name">
                <span className="race-lane__symbol">{symbols[suit]}</span>
                <span>{suit}</span>
              </div>
              <div className="race-lane__rail">
                <div className="race-lane__ticks" aria-hidden="true">
                  {Array.from({ length: totalSteps + 1 }, (_, index) => (
                    <i key={index} />
                  ))}
                </div>
                <div
                  className="race-lane__runner"
                  style={{ left: `${(progress / totalSteps) * 100}%` }}
                >
                  <img src={`/Images/${suit}_ace.png`} alt="" />
                </div>
              </div>
              <span className="race-lane__distance">
                {progress}/{totalSteps}
              </span>
            </div>
          );
        })}
        <div className="race-track__sidecards" aria-label="Track side cards">
          <span className="race-track__side-label">
            SIDE
            <br />
            CARDS
          </span>
          <div className="race-track__side-line">
            {sideCards.map((card, index) => {
              const revealed = card !== "back_of_card";
              return (
                <div className="race-track__side-slot" key={index}>
                  <span className="race-track__link-number">{index + 1}</span>
                  <div
                    className={`race-track__side-card ${revealed ? "is-revealed" : ""}`}
                    aria-label={
                      revealed
                        ? `Link ${index + 1}: ${card.replace("_", " of ")}`
                        : `Link ${index + 1}: face down`
                    }
                  >
                    <div className="race-track__side-card-inner">
                      <img
                        className="race-track__side-back"
                        src="/Images/back_of_card.png"
                        alt=""
                      />
                      <img
                        className="race-track__side-front"
                        src={`/Images/${card}.png`}
                        alt=""
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <span className="race-track__side-end" aria-hidden="true">
            ↗
          </span>
        </div>
      </div>
      <div className="race-track__foot">
        <span>FOUR HORSES</span>
        <span>ONE FINISH LINE</span>
        <span>♠ ♥ ♦ ♣</span>
      </div>
      {winner && (
        <WinnerReveal key={winner} winner={winner} onComplete={onWinnerRevealEnd} />
      )}
    </section>
  );
}

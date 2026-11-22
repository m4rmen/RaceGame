import React from "react";
import "./RaceTrack.css";

const horses = ["clubs", "diamonds", "hearts", "spades"];
const symbols = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };

export default function RaceTrack({ grid = [], lastCard }) {
  const totalSteps = Math.max(grid.length - 1, 1);
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
            <strong>{lastCard.replace("_", " of ")}</strong>
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
      </div>
      <div className="race-track__foot">
        <span>FOUR HORSES</span>
        <span>ONE FINISH LINE</span>
        <span>♠ ♥ ♦ ♣</span>
      </div>
    </section>
  );
}

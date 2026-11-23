import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import WinnerReveal from "./WinnerReveal";
import { DrawFan, RaceCall } from "./RaceExtras";
import "./RaceTrack.css";

const horses = ["clubs", "diamonds", "hearts", "spades"];
const SIDE_REVEAL_MS = 2050;
const SETBACK_MS = 950;
const symbols = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };

function SideCardSpotlight({ card, sourceCards, sourceIndex }) {
  const destination = useRef(null);
  const [suit, rank] = card.split("_");

  useLayoutEffect(() => {
    const target = destination.current;
    const source = sourceCards.current[sourceIndex]?.getBoundingClientRect();
    const center = target.getBoundingClientRect();
    if (!source?.width || !center.width) return;

    target.style.setProperty(
      "--flight-x",
      `${source.left + (source.width - center.width) / 2 - center.left}px`,
    );
    target.style.setProperty(
      "--flight-y",
      `${source.top + (source.height - center.height) / 2 - center.top}px`,
    );
    target.style.setProperty("--flight-scale", source.width / center.width);
  }, [sourceCards, sourceIndex]);

  return createPortal(
    <div
      className="side-reveal"
      role="status"
      style={{ "--side-reveal-duration": `${SIDE_REVEAL_MS}ms` }}
    >
      <span className="eyebrow side-reveal__caption">Side card revealed</span>
      <div className="side-reveal__destination" ref={destination} aria-hidden="true">
        <div className="side-reveal__flight">
          <div className="side-reveal__flip">
            <img src="/Images/back_of_card.png" alt="" />
            <img className="side-reveal__face" src={`/Images/${card}.png`} alt="" />
          </div>
        </div>
      </div>
      <div className="side-reveal__caption">
        <h2>
          {rank} of {suit}
        </h2>
        <p>{suit} drops back one length.</p>
      </div>
    </div>,
    document.body,
  );
}

export default function RaceTrack({
  grid = [],
  lastCard,
  recentDraws,
  started = false,
  picks = [],
  winner,
  sideCard,
  onSideCardEnd,
  onWinnerRevealEnd,
}) {
  const totalSteps = Math.max(grid.length - 1, 1);
  const drawnSuit = lastCard?.split("_")[0];
  const [retreatingCard, setRetreatingCard] = useState(null);
  const sourceCards = useRef([]);
  const setbackSuit = sideCard?.split("_")[0];
  const isRetreating = Boolean(sideCard && retreatingCard === sideCard);
  const showSideCard = Boolean(sideCard && !isRetreating);
  const sideCards = grid
    .slice(1)
    .reverse()
    .map((row) => row[4] || "back_of_card");
  const field = horses.map((suit, column) => {
    const row = grid.findIndex((cells) => cells[column] === `${suit}_ace`);
    return { suit, progress: row < 0 ? 0 : totalSteps - row };
  });
  const lead = Math.max(...field.map(({ progress }) => progress));
  const leaders = lead
    ? field.filter(({ progress }) => progress === lead).map(({ suit }) => suit)
    : [];
  const photoFinish = Boolean(
    winner &&
    lead === totalSteps &&
    totalSteps > 1 &&
    field.some(
      ({ suit, progress }) => `${suit}_ace` !== winner && progress === totalSteps - 1,
    ),
  );
  const showGates = started && !lastCard;

  useEffect(() => {
    if (!sideCard) {
      setRetreatingCard(null);
      return;
    }
    const retreat = window.setTimeout(
      () => setRetreatingCard(sideCard),
      SIDE_REVEAL_MS,
    );
    const finish = window.setTimeout(onSideCardEnd, SIDE_REVEAL_MS + SETBACK_MS);
    return () => {
      window.clearTimeout(retreat);
      window.clearTimeout(finish);
    };
  }, [sideCard, onSideCardEnd]);
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
        {lastCard && recentDraws?.length ? (
          <DrawFan cards={recentDraws} />
        ) : (
          lastCard && (
            <div className="race-track__draw">
              <span>Last draw</span>
              <img
                key={lastCard}
                src={`/Images/${lastCard}.png`}
                alt={lastCard.replace("_", " of ")}
              />
            </div>
          )
        )}
      </div>
      {started && recentDraws && (
        <RaceCall
          leaders={leaders}
          nearFinish={lead === totalSteps - 1}
          winner={winner}
          paused={showSideCard}
        />
      )}
      <div className="race-track__course">
        <div className="race-track__scale">
          <span>START</span>
          <span>THE COURSE</span>
          <span>FINISH</span>
        </div>
        {field.map(({ suit, progress: settledProgress }) => {
          const setback = setbackSuit === suit;
          const progress = settledProgress + (showSideCard && setback ? 1 : 0);
          const fraction = progress / totalSteps;
          return (
            <div className={`race-lane race-lane--${suit}`} key={suit}>
              <div className="race-lane__name">
                <span className="race-lane__symbol">{symbols[suit]}</span>
                <span>{suit}</span>
                {picks.includes(suit) && (
                  <small className="race-lane__pick">Your pick</small>
                )}
              </div>
              <div className="race-lane__rail" style={{ "--race-progress": fraction }}>
                {drawnSuit === suit && (
                  <span
                    className="race-lane__flash"
                    key={lastCard}
                    aria-hidden="true"
                  />
                )}
                <span className="race-lane__progress" aria-hidden="true" />
                <div className="race-lane__ticks" aria-hidden="true">
                  {Array.from({ length: totalSteps + 1 }, (_, index) => (
                    <i key={index} />
                  ))}
                </div>
                <div
                  className={`race-lane__runner${setback && isRetreating ? " is-retreating" : ""}`}
                  style={{ left: `${fraction * 100}%` }}
                >
                  <img src={`/Images/${suit}_ace.png`} alt="" />
                  {setback && isRetreating && (
                    <span
                      className="race-lane__setback"
                      aria-label={`${suit} back one length`}
                    >
                      −1
                    </span>
                  )}
                </div>
                {showGates && (
                  <div className="starting-gate" aria-hidden="true">
                    <i />
                    <i />
                  </div>
                )}
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
              const isFlying = showSideCard && card === sideCard;
              return (
                <div className="race-track__side-slot" key={index}>
                  <span className="race-track__link-number">{index + 1}</span>
                  <div
                    className={`race-track__side-card${revealed ? " is-revealed" : ""}${isFlying ? " is-flying" : ""}`}
                    ref={(node) => {
                      sourceCards.current[index] = node;
                    }}
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
      {showSideCard && (
        <SideCardSpotlight
          key={sideCard}
          card={sideCard}
          sourceCards={sourceCards}
          sourceIndex={sideCards.indexOf(sideCard)}
        />
      )}
      {winner && !sideCard && (
        <WinnerReveal
          key={winner}
          winner={winner}
          photoFinish={photoFinish}
          onComplete={onWinnerRevealEnd}
        />
      )}
    </section>
  );
}

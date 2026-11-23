import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import WinnerReveal from "./WinnerReveal";
import { DrawFan, RaceCall } from "./RaceExtras";
import "./RaceTrack.css";

const horses = ["clubs", "diamonds", "hearts", "spades"];
const CRAMP_REVEAL_MS = 2050;
const SETBACK_MS = 950;
const symbols = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };

function CrampCardSpotlight({ card, sourceCards, sourceIndex }) {
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
      className="cramp-reveal"
      role="status"
      style={{ "--cramp-reveal-duration": `${CRAMP_REVEAL_MS}ms` }}
    >
      <span className="eyebrow cramp-reveal__caption">Cramp card revealed</span>
      <div className="cramp-reveal__destination" ref={destination} aria-hidden="true">
        <div className="cramp-reveal__flight">
          <div className="cramp-reveal__flip">
            <img src="/Images/back_of_card.png" alt="" />
            <img className="cramp-reveal__face" src={`/Images/${card}.png`} alt="" />
          </div>
        </div>
      </div>
      <div className="cramp-reveal__caption">
        <h2>
          {rank} of {suit}
        </h2>
        <p>{suit} catches a cramp and drops back one length.</p>
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
  crampCard,
  onCrampCardEnd,
  onWinnerRevealEnd,
}) {
  const totalSteps = Math.max(grid.length - 1, 1);
  const drawnSuit = lastCard?.split("_")[0];
  const [retreatingCard, setRetreatingCard] = useState(null);
  const sourceCards = useRef([]);
  const aceDialog = useRef(null);
  const [inspectedSuit, setInspectedSuit] = useState(null);
  const setbackSuit = crampCard?.split("_")[0];
  const isRetreating = Boolean(crampCard && retreatingCard === crampCard);
  const showCrampCard = Boolean(crampCard && !isRetreating);
  const crampCards = grid
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

  useLayoutEffect(() => {
    if ((crampCard || winner) && aceDialog.current.open) aceDialog.current.close();
  }, [crampCard, winner]);

  useEffect(() => {
    if (!crampCard) {
      setRetreatingCard(null);
      return;
    }
    const retreat = window.setTimeout(
      () => setRetreatingCard(crampCard),
      CRAMP_REVEAL_MS,
    );
    const finish = window.setTimeout(onCrampCardEnd, CRAMP_REVEAL_MS + SETBACK_MS);
    return () => {
      window.clearTimeout(retreat);
      window.clearTimeout(finish);
    };
  }, [crampCard, onCrampCardEnd]);
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
          paused={showCrampCard}
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
          const progress = settledProgress + (showCrampCard && setback ? 1 : 0);
          const fraction = progress / totalSteps;
          return (
            <div className={`race-lane race-lane--${suit}`} key={suit}>
              <button
                type="button"
                className="race-lane__name race-lane__inspect"
                aria-label={`View Ace of ${suit}`}
                onClick={() => {
                  setInspectedSuit(suit);
                  aceDialog.current.showModal();
                }}
              >
                <span className="race-lane__symbol">{symbols[suit]}</span>
                <span>{suit}</span>
                {picks.includes(suit) && (
                  <small className="race-lane__pick">Your pick</small>
                )}
              </button>
              <div
                className="race-lane__rail"
                style={{
                  "--race-progress": fraction,
                  "--finish-stretch": `${Math.min(2 / totalSteps, 1) * 100}%`,
                }}
              >
                <span className="race-lane__finish-stretch" aria-hidden="true" />
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
        <div className="race-track__crampcards" aria-label="Track cramp cards">
          <span className="race-track__cramp-label">
            CRAMP
            <br />
            CARDS
          </span>
          <div className="race-track__cramp-line">
            {crampCards.map((card, index) => {
              const revealed = card !== "back_of_card";
              const isFlying = showCrampCard && card === crampCard;
              return (
                <div className="race-track__cramp-slot" key={index}>
                  <span className="race-track__link-number">{index + 1}</span>
                  <div
                    className={`race-track__cramp-card${revealed ? " is-revealed" : ""}${isFlying ? " is-flying" : ""}`}
                    ref={(node) => {
                      sourceCards.current[index] = node;
                    }}
                    aria-label={
                      revealed
                        ? `Link ${index + 1}: ${card.replace("_", " of ")}`
                        : `Link ${index + 1}: face down`
                    }
                  >
                    <div className="race-track__cramp-card-inner">
                      <img
                        className="race-track__cramp-back"
                        src="/Images/back_of_card.png"
                        alt=""
                      />
                      <img
                        className="race-track__cramp-front"
                        src={`/Images/${card}.png`}
                        alt=""
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <span className="race-track__cramp-end" aria-hidden="true">
            ↗
          </span>
        </div>
      </div>
      <div className="race-track__foot">
        <span>FOUR HORSES</span>
        <span>ONE FINISH LINE</span>
        <span>♠ ♥ ♦ ♣</span>
      </div>
      <dialog
        className="ace-preview club-panel"
        aria-labelledby="ace-preview-title"
        ref={aceDialog}
      >
        <form method="dialog">
          <button className="race-toolbar__button" type="submit">
            Close
          </button>
        </form>
        {inspectedSuit && (
          <>
            <h2 id="ace-preview-title">Ace of {inspectedSuit}</h2>
            <img
              src={`/Images/${inspectedSuit}_ace.png`}
              alt={`Ace of ${inspectedSuit}`}
            />
          </>
        )}
      </dialog>
      {showCrampCard && (
        <CrampCardSpotlight
          key={crampCard}
          card={crampCard}
          sourceCards={sourceCards}
          sourceIndex={crampCards.indexOf(crampCard)}
        />
      )}
      {winner && !crampCard && (
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

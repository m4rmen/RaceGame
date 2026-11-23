import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./RaceExtras.css";

export function DrawFan({ cards }) {
  return (
    <div className="race-track__draw draw-fan">
      <span>Recent draws</span>
      <div className="draw-fan__cards">
        {cards
          .slice()
          .reverse()
          .map((card, index) => (
            <img
              key={card}
              src={`/Images/${card}.png`}
              alt={card.replace("_", " of ")}
              style={{ "--fan-index": index }}
            />
          ))}
      </div>
    </div>
  );
}

export function RaceCall({ leaders, nearFinish, winner, paused }) {
  const [call, setCall] = useState("");
  const leaderNames = leaders.join(" and ");

  useEffect(() => {
    if (paused) return;
    if (winner) setCall(`${winner.split("_")[0]} crosses the finish line!`);
    else if (!leaderNames) setCall("The field is at the gates.");
    else if (nearFinish) {
      setCall(
        `${leaderNames} ${leaders.length === 1 ? "is" : "are"} one length from the finish!`,
      );
    } else if (leaders.length === 1) setCall(`${leaderNames} takes the lead!`);
    else setCall(`${leaderNames} are neck and neck.`);
  }, [leaderNames, leaders.length, nearFinish, winner, paused]);

  return (
    <div className="race-call" aria-live="polite">
      <span key={call}>{call && call[0].toUpperCase() + call.slice(1)}</span>
    </div>
  );
}

export function ReplayDeal() {
  return (
    <div className="replay-deal" aria-hidden="true">
      {["clubs", "diamonds", "hearts", "spades"].map((suit, index) => (
        <img
          key={suit}
          src={`/Images/${suit}_ace.png`}
          alt=""
          style={{ "--deal-index": index, "--deal-offset": index - 1.5 }}
        />
      ))}
    </div>
  );
}

export function TurnSpotlight() {
  return createPortal(
    <div className="turn-spotlight" aria-hidden="true" />,
    document.body,
  );
}

export function AnimatedTally({ total, active = true }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (
      !active ||
      !total ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    )
      return;
    let firstFrame;
    let frame;
    function tick(now) {
      firstFrame ??= now;
      const progress = Math.min(1, (now - firstFrame) / 650);
      setCount(Math.round(total * (1 - (1 - progress) ** 2)));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    }
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [active, total]);

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  return active && !reduceMotion ? (
    <>
      <span className="tally-accessible">{total}</span>
      <span aria-hidden="true">{count}</span>
    </>
  ) : (
    total
  );
}

export function ToastSources({ sources = [], active = true }) {
  if (!sources.length) return "No drinks assigned";
  return sources.map(({ giverId, username, amount }, index) => (
    <span
      key={giverId || index}
      className={active ? "toast-source is-revealing" : "toast-source"}
      style={{ "--source-delay": `${660 + Math.min(index, 5) * 85}ms` }}
    >
      {index > 0 && " · "}
      {amount} from {username}
    </span>
  ));
}

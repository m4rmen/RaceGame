import React, { useEffect, useState } from "react";
import { useLanguage, cardName } from "../LanguageContext";
import { createPortal } from "react-dom";
import "./RaceExtras.css";

export function DrawFan({ cards }) {
  const { t } = useLanguage();
  return (
    <div className="race-track__draw draw-fan">
      <span>{t("Recent draws")}</span>
      <div className="draw-fan__cards">
        {cards
          .slice()
          .reverse()
          .map((card, index) => (
            <img
              key={card}
              src={`/Images/${card}.png`}
              alt={cardName(card, t)}
              style={{ "--fan-index": index }}
            />
          ))}
      </div>
    </div>
  );
}

export function RaceCall({ leaders, nearFinish, winner, paused }) {
  const { t, language } = useLanguage();
  const [call, setCall] = useState(null);
  const leaderKey = leaders.join(",");

  useEffect(() => {
    if (!paused) setCall({ leaderKey, nearFinish, winner });
  }, [leaderKey, nearFinish, winner, paused]);

  let message = "";
  if (call?.winner) {
    message = t("{suit} crosses the finish line!", {
      suit: t(call.winner.split("_")[0]),
    });
  } else if (call && !call.leaderKey) {
    message = t("The field is at the gates.");
  } else if (call) {
    const suits = call.leaderKey.split(",").map((suit) => t(suit));
    if (suits.length === 1) {
      message = t(
        call.nearFinish
          ? "{suit} is one length from the finish!"
          : "{suit} takes the lead!",
        { suit: suits[0] },
      );
    } else {
      message = t(
        call.nearFinish
          ? "{suits} are one length from the finish!"
          : "{suits} are neck and neck.",
        { suits: new Intl.ListFormat(language, { type: "conjunction" }).format(suits) },
      );
    }
  }

  return (
    <div className="race-call" aria-live="polite">
      <span key={message}>
        {message.charAt(0).toLocaleUpperCase(language) + message.slice(1)}
      </span>
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
  const { t } = useLanguage();
  if (!sources.length) return t("No drinks assigned");
  return sources.map(({ giverId, username, amount }, index) => (
    <span
      key={giverId || index}
      className={active ? "toast-source is-revealing" : "toast-source"}
      style={{ "--source-delay": `${660 + Math.min(index, 5) * 85}ms` }}
    >
      {index > 0 && " · "}
      {t("{amount} from {name}", { amount, name: username })}
    </span>
  ));
}

import React, { useEffect } from "react";
import "./WinnerReveal.css";

export default function WinnerReveal({ winner, onComplete }) {
  const suit = winner.replace("_ace", "");

  useEffect(() => {
    const timer = window.setTimeout(onComplete, 3400);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="winner-reveal" role="status">
      <div className="winner-reveal__card" aria-hidden="true">
        <img className="winner-reveal__back" src="/Images/back_of_card.png" alt="" />
        <img className="winner-reveal__face" src={`/Images/${winner}.png`} alt="" />
      </div>
      <span className="eyebrow">Race winner</span>
      <h2>Ace of {suit}</h2>
    </div>
  );
}

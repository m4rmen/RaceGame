import React, { useEffect } from "react";
import { useLanguage } from "../LanguageContext";
import "./WinnerReveal.css";

export default function WinnerReveal({ winner, photoFinish, onComplete }) {
  const { t } = useLanguage();
  const suit = winner.replace("_ace", "");
  const photoDelay = photoFinish ? 700 : 0;

  useEffect(() => {
    const timer = window.setTimeout(onComplete, 3400 + photoDelay);
    return () => window.clearTimeout(timer);
  }, [onComplete, photoDelay]);

  return (
    <>
      {photoFinish && (
        <div className="photo-finish" role="status">
          <span>{t("Photo finish")}</span>
        </div>
      )}
      <div
        className="winner-reveal"
        role="status"
        style={{ "--photo-delay": `${photoDelay}ms` }}
      >
        <div className="winner-reveal__card" aria-hidden="true">
          <img className="winner-reveal__back" src="/Images/back_of_card.png" alt="" />
          <img className="winner-reveal__face" src={`/Images/${winner}.png`} alt="" />
        </div>
        <span className="eyebrow">{t("Race winner")}</span>
        <h2>{t("Ace of {suit}", { suit: t(suit) })}</h2>
      </div>
    </>
  );
}

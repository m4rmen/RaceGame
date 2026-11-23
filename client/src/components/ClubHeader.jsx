import React from "react";
import { Link } from "react-router-dom";
import { LanguageSelect, useLanguage } from "../LanguageContext";
export default function ClubHeader({ roomId, label }) {
  const { t } = useLanguage();
  return (
    <header className="club-header">
      <Link className="club-brand" to="/">
        <span className="club-brand__mark">♞</span>
        <span>
          <strong>THE ACE RACE</strong>
          <small>{t("THE RACING CLUB")}</small>
        </span>
      </Link>
      <div className="club-header__meta">
        <span>{label}</span>
        {roomId && (
          <strong>
            {t("ROOM")} {roomId}
          </strong>
        )}
        <LanguageSelect />
      </div>
    </header>
  );
}

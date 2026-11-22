import React from "react";
import { Link } from "react-router-dom";
export default function ClubHeader({ roomId, label }) {
  return (
    <header className="club-header">
      <Link className="club-brand" to="/">
        <span className="club-brand__mark">♞</span>
        <span>
          <strong>THE ACE RACE</strong>
          <small>THE RACING CLUB</small>
        </span>
      </Link>
      <div className="club-header__meta">
        <span>{label}</span>
        {roomId && <strong>ROOM {roomId}</strong>}
      </div>
    </header>
  );
}

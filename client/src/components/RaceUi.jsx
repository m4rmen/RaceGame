import React from "react";
import "./RaceUi.css";

const phases = ["Lobby", "Bets", "Race", "Results"];

export function PhaseStrip({ phase, ready }) {
  return (
    <nav className="phase-strip" aria-label="Race phase">
      <ol>
        {phases.map((label, index) => (
          <li
            key={label}
            className={index < phase ? "is-complete" : undefined}
            aria-current={index === phase ? "step" : undefined}
          >
            {label}
          </li>
        ))}
      </ol>
      {ready && <span className="phase-strip__ready">{ready}</span>}
    </nav>
  );
}

export function PlayerBib({ number }) {
  if (!number) return null;
  return (
    <span className="player-bib" aria-label={`Rider ${number}`}>
      {String(number).padStart(2, "0")}
    </span>
  );
}

export function RoundHistory({ rounds = [] }) {
  return (
    <details className="round-history">
      <summary>Round history{rounds.length ? ` (${rounds.length})` : ""}</summary>
      <div className="round-history__drawer club-panel">
        {rounds.length ? (
          <ol>
            {rounds
              .slice()
              .reverse()
              .map(({ number, winner, payouts }) => (
                <li key={number}>
                  <strong>
                    Round {number} · {winner?.split("_")[0]} wins
                  </strong>
                  <p>
                    {payouts.length
                      ? payouts.map(({ username, amount, bib }) => (
                          <span className="round-history__payout" key={bib}>
                            <PlayerBib number={bib} /> {username} · {amount}
                          </span>
                        ))
                      : "No payouts"}
                  </p>
                </li>
              ))}
          </ol>
        ) : (
          <p>Past races will appear here after replay.</p>
        )}
      </div>
    </details>
  );
}

export function RaceToolbar({ phase, ready, rounds, children }) {
  return (
    <div className="race-toolbar">
      <PhaseStrip phase={phase} ready={ready} />
      <div className="race-toolbar__actions">
        {children}
        <RoundHistory rounds={rounds} />
      </div>
    </div>
  );
}

export function PlayerScorecard({ player }) {
  const stats = [
    ["Wager", Object.values(player.bet ?? {}).reduce((sum, amount) => sum + amount, 0)],
    ["Payout", player.drinkAllowance],
    ["Sent", player.sent ?? 0],
    ["Received", player.received ?? 0],
  ];
  return (
    <dl className="player-scorecard" aria-label="Your race scorecard">
      {stats.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DistributionMeter({ assigned, total }) {
  return (
    <div className="distribution-meter">
      <div>
        <strong>
          {assigned} of {total} assigned
        </strong>
        <span>{total - assigned} left</span>
      </div>
      {total > 0 && (
        <div
          className="distribution-meter__track"
          role="progressbar"
          aria-label="Sips assigned"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={assigned}
          style={{
            "--fill": `${(assigned / total) * 100}%`,
            "--segment": `${100 / Math.min(total, 20)}%`,
          }}
        />
      )}
    </div>
  );
}

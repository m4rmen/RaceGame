import React from "react";
import { useLanguage } from "../LanguageContext";
import "./RaceUi.css";

const phases = ["Lobby", "Bets", "Race", "Results"];

export function PhaseStrip({ phase, ready }) {
  const { t } = useLanguage();
  return (
    <nav className="phase-strip" aria-label={t("Race phase")}>
      <ol>
        {phases.map((label, index) => (
          <li
            key={label}
            className={index < phase ? "is-complete" : undefined}
            aria-current={index === phase ? "step" : undefined}
          >
            {t(label)}
          </li>
        ))}
      </ol>
      {ready && <span className="phase-strip__ready">{ready}</span>}
    </nav>
  );
}

export function PlayerBib({ number }) {
  const { t } = useLanguage();
  if (!number) return null;
  return (
    <span className="player-bib" aria-label={t("Rider {number}", { number })}>
      {String(number).padStart(2, "0")}
    </span>
  );
}

export function RoundHistory({ rounds = [] }) {
  const { t } = useLanguage();
  return (
    <details className="round-history">
      <summary>
        {t("Round history")}
        {rounds.length ? ` (${rounds.length})` : ""}
      </summary>
      <div className="round-history__drawer club-panel">
        {rounds.length ? (
          <ol>
            {rounds
              .slice()
              .reverse()
              .map(({ number, winner, payouts }) => (
                <li key={number}>
                  <strong>
                    {t("Round {number} · {winner} wins", {
                      number,
                      winner: winner ? t(winner.split("_")[0]) : "",
                    })}
                  </strong>
                  <p>
                    {payouts.length
                      ? payouts.map(({ username, amount, bib }) => (
                          <span className="round-history__payout" key={bib}>
                            <PlayerBib number={bib} /> {username} · {amount}
                          </span>
                        ))
                      : t("No payouts")}
                  </p>
                </li>
              ))}
          </ol>
        ) : (
          <p>{t("Past races will appear here after replay.")}</p>
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
  const { t } = useLanguage();
  const stats = [
    ["Wager", Object.values(player.bet ?? {}).reduce((sum, amount) => sum + amount, 0)],
    ["Payout", player.drinkAllowance],
    ["Sent", player.sent ?? 0],
    ["Received", player.received ?? 0],
  ];
  return (
    <dl className="player-scorecard" aria-label={t("Your race scorecard")}>
      {stats.map(([label, value]) => (
        <div key={label}>
          <dt>{t(label)}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DistributionMeter({ assigned, total }) {
  const { t } = useLanguage();
  return (
    <div className="distribution-meter">
      <div>
        <strong>{t("{assigned} of {total} assigned", { assigned, total })}</strong>
        <span>{t("{count} left", { count: total - assigned })}</span>
      </div>
      {total > 0 && (
        <div
          className="distribution-meter__track"
          role="progressbar"
          aria-label={t("Sips assigned")}
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

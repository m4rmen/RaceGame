import React from "react";
import "./DrinkingCeremony.css";

const suitSymbols = { clubs: "♣", spades: "♠", hearts: "♥", diamonds: "♦" };

export function wagerDetails(bet) {
  return (
    Object.entries(bet)
      .filter(([, amount]) => amount > 0)
      .map(([suit, amount]) => `${suitSymbols[suit]} ${suit} × ${amount}`)
      .join(" · ") || "No wager"
  );
}

export function wagerTier(total) {
  if (total <= 4) return { key: "warmup", title: "that's cute", cue: "wow" };
  if (total <= 8)
    return {
      key: "gallop",
      title: "We're watching",
      cue: "Ok... ok...",
    };
  if (total <= 12)
    return { key: "surge", title: "'s liver is made of steel", cue: "God Damn" };
  return {
    key: "legend",
    title: "might actually be mentally ill",
    cue: "holy...",
  };
}

function sourceDetails(sources) {
  return sources.length
    ? sources.map(({ username, amount }) => `${amount} from ${username}`).join(" · ")
    : "No drinks assigned";
}

export function FullAllowanceCallout({ recipient }) {
  const givers = recipient?.sources.filter((source) => source.gaveAll) || [];
  if (givers.length === 0) return null;

  return (
    <div className="ceremony-callout">
      {givers.map(({ giverId, username, amount }) => (
        <p key={giverId}>
          {username} gave all {amount} of their sips to {recipient.username}.
        </p>
      ))}
      <strong>This seems personal</strong>
    </div>
  );
}

export default function DrinkingCeremony({
  ceremony,
  onConfirm,
  confirming,
  error,
  finale = false,
}) {
  const active = ceremony.players[ceremony.currentIndex];
  if (!active) return null;
  const tier = wagerTier(active.total);
  const hasSips = active.total > 0;

  return (
    <section
      className={`ceremony-layout ${finale ? "ceremony-layout--finale" : ""}`}
      aria-label={finale ? "Finish line drinks ceremony" : "Pre-race wager ceremony"}
    >
      <div
        className={`ceremony-stage ceremony-stage--${tier.key} ${finale ? "ceremony-stage--finale" : ""}`}
        key={active.socketId}
      >
        <div className="ceremony-stage__top">
          <span className="eyebrow">
            {finale ? "The winners' circle" : "The pre-race ritual"}
          </span>
          <span className="ceremony-stage__turn">
            RIDER {String(ceremony.currentIndex + 1).padStart(2, "0")} /{" "}
            {String(ceremony.players.length).padStart(2, "0")}
          </span>
        </div>
        <div className="ceremony-stage__body">
          <span className="ceremony-stage__ornament" aria-hidden="true">
            {finale ? "✦" : "♞"}
          </span>
          <span className="ceremony-stage__cue">{finale ? "Drink up!" : tier.cue}</span>
          <h2>{active.username}</h2>
          <p className="ceremony-stage__title">
            {finale
              ? {
                  warmup: "Light work",
                  gallop: "Getting tipsy",
                  surge: "Hell yeah!",
                  legend: "Get this person their car keys",
                }[tier.key]
              : tier.title}
          </p>
          <div className="ceremony-stage__amount">
            <strong>{active.total}</strong>
            <span>
              {active.total === 1 ? "SIP" : "SIPS"}
              <small>
                {hasSips
                  ? finale
                    ? "Received at the finish"
                    : "Before the off"
                  : "A free pass"}
              </small>
            </span>
          </div>
          <p className="ceremony-stage__bet">
            {finale ? sourceDetails(active.sources) : wagerDetails(active.bet)}
          </p>
          {finale && <FullAllowanceCallout recipient={active} />}
          <div className="ceremony-stage__tokens" aria-hidden="true">
            {Array.from({ length: Math.min(active.total, 12) }, (_, index) => (
              <span key={index} style={{ animationDelay: `${index * 70}ms` }} />
            ))}
          </div>
        </div>
        <div className="ceremony-stage__bottom">
          <p>
            {finale
              ? "Confirm these drinks before the next name takes the stage."
              : hasSips
                ? "Once the wager is taken, send the next rider forward."
                : "No sips this round. Send the next rider forward."}
          </p>
          <button
            className="club-button"
            onClick={() => onConfirm(active.socketId)}
            disabled={confirming}
          >
            {ceremony.currentIndex === ceremony.players.length - 1
              ? finale
                ? "Finish the celebration"
                : "Start the race"
              : "Confirm & next rider"}{" "}
            <span aria-hidden="true">→</span>
          </button>
        </div>
        {error && (
          <p className="ceremony-stage__error" role="alert">
            {error}
          </p>
        )}
      </div>
      <aside className="ceremony-roster club-panel">
        <span className="eyebrow">{finale ? "The final tally" : "The racecard"}</span>
        <h3>{finale ? "Drinks received" : "All wagers"}</h3>
        <p>
          {finale
            ? "The host calls each player to close out the race."
            : "Each player takes their total sips before the cards are drawn."}
        </p>
        <ol>
          {ceremony.players.map((player, index) => (
            <li
              className={
                index === ceremony.currentIndex
                  ? "is-active"
                  : index < ceremony.currentIndex
                    ? "is-done"
                    : ""
              }
              key={player.socketId}
            >
              <div>
                <small>{String(index + 1).padStart(2, "0")}</small>
                <strong>{player.username}</strong>
                <span>
                  {index < ceremony.currentIndex
                    ? "✓"
                    : `${player.total} ${player.total === 1 ? "sip" : "sips"}`}
                </span>
              </div>
              <p>{finale ? sourceDetails(player.sources) : wagerDetails(player.bet)}</p>
            </li>
          ))}
        </ol>
      </aside>
    </section>
  );
}

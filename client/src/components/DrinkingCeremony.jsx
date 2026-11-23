import React from "react";
import { useLanguage, localizeError } from "../LanguageContext";
import { AnimatedTally, ToastSources } from "./RaceExtras";
import { PlayerBib } from "./RaceUi";
import "./DrinkingCeremony.css";

const suitSymbols = { clubs: "♣", spades: "♠", hearts: "♥", diamonds: "♦" };

export function wagerDetails(bet, t) {
  return (
    Object.entries(bet)
      .filter(([, amount]) => amount > 0)
      .map(([suit, amount]) => `${suitSymbols[suit]} ${t(suit)} × ${amount}`)
      .join(" · ") || t("No wager")
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

function sourceDetails(sources, t) {
  return sources.length
    ? sources
        .map(({ username, amount }) =>
          t("{amount} from {name}", { amount, name: username }),
        )
        .join(" · ")
    : t("No drinks assigned");
}

export function FullAllowanceCallout({ recipient }) {
  const { t } = useLanguage();
  const givers = recipient?.sources.filter((source) => source.gaveAll) || [];
  if (givers.length === 0) return null;

  return (
    <div className="ceremony-callout">
      {givers.map(({ giverId, username, amount }) => (
        <p key={giverId}>
          {t("{giver} gave all {amount} of their sips to {recipient}.", {
            giver: username,
            amount,
            recipient: recipient.username,
          })}
        </p>
      ))}
      <strong>{t("This seems personal")}</strong>
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
  const { t } = useLanguage();
  const active = ceremony.players[ceremony.currentIndex];
  if (!active) return null;
  const tier = wagerTier(active.total);
  const hasSips = active.total > 0;

  return (
    <section
      className={`ceremony-layout ${finale ? "ceremony-layout--finale" : ""}`}
      aria-label={
        finale ? t("Finish line drinks ceremony") : t("Pre-race wager ceremony")
      }
    >
      <div
        className={`ceremony-stage ceremony-stage--${tier.key} ${finale ? "ceremony-stage--finale" : ""}`}
        key={active.socketId}
      >
        <div className="ceremony-stage__top">
          <span className="eyebrow">
            {finale ? t("The winners' circle") : t("The pre-race ritual")}
          </span>
          <span className="ceremony-stage__turn">
            <PlayerBib number={active.bib ?? ceremony.currentIndex + 1} />
            {" " + t("TURN")} {String(ceremony.currentIndex + 1).padStart(2, "0")} /{" "}
            {String(ceremony.players.length).padStart(2, "0")}
          </span>
        </div>
        <div className="ceremony-stage__body">
          <span className="ceremony-stage__ornament" aria-hidden="true">
            {finale ? "✦" : "♞"}
          </span>
          <span className="ceremony-stage__cue">
            {finale ? t("Drink up!") : t(tier.cue)}
          </span>
          <h2>{active.username}</h2>
          <p className="ceremony-stage__title">
            {finale
              ? {
                  warmup: t("Light work"),
                  gallop: t("Getting tipsy"),
                  surge: t("Hell yeah!"),
                  legend: t("Get this person their car keys"),
                }[tier.key]
              : t(tier.title)}
          </p>
          <div className="ceremony-stage__amount">
            <strong>
              {finale ? <AnimatedTally total={active.total} /> : active.total}
            </strong>
            <span>
              {active.total === 1 ? t("SIP") : t("SIPS")}
              <small>
                {hasSips
                  ? finale
                    ? t("Received at the finish")
                    : t("Before the off")
                  : t("A free pass")}
              </small>
            </span>
          </div>
          <p className="ceremony-stage__bet">
            {finale ? (
              <ToastSources sources={active.sources} />
            ) : (
              wagerDetails(active.bet, t)
            )}
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
              ? t("Confirm these drinks before the next name takes the stage.")
              : hasSips
                ? t("Once the wager is taken, send the next rider forward.")
                : t("No sips this round. Send the next rider forward.")}
          </p>
          <button
            className="club-button"
            onClick={() => onConfirm(active.socketId)}
            disabled={confirming}
          >
            {ceremony.currentIndex === ceremony.players.length - 1
              ? finale
                ? t("Finish the celebration")
                : t("Start the race")
              : t("Confirm & next rider")}{" "}
            <span aria-hidden="true">→</span>
          </button>
        </div>
        {error && (
          <p className="ceremony-stage__error" role="alert">
            {localizeError(error, t)}
          </p>
        )}
      </div>
      <aside className="ceremony-roster club-panel">
        <span className="eyebrow">
          {finale ? t("The final tally") : t("The racecard")}
        </span>
        <h3>{finale ? t("Drinks received") : t("All wagers")}</h3>
        <p>
          {finale
            ? t("The host calls each player to close out the race.")
            : t("Each player takes their total sips before the cards are drawn.")}
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
                <PlayerBib number={player.bib ?? index + 1} />
                <strong>{player.username}</strong>
                <span>
                  {index < ceremony.currentIndex
                    ? "✓"
                    : `${player.total} ${player.total === 1 ? t("sip") : t("sips")}`}
                </span>
              </div>
              <p>
                {finale
                  ? sourceDetails(player.sources, t)
                  : wagerDetails(player.bet, t)}
              </p>
            </li>
          ))}
        </ol>
      </aside>
    </section>
  );
}

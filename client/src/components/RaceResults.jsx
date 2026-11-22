import React from "react";
import "./RaceResults.css";

const suitOrder = ["clubs", "spades", "hearts", "diamonds"];

const RaceResults = ({ result }) => {
    if (!result) return null;

    const winningSuit = result.winner.replace("_ace", "");

    return (
        <section className="race-results" aria-live="polite">
            <h2>Race complete!</h2>
            <p className="winning-horse">{winningSuit[0].toUpperCase() + winningSuit.slice(1)} Ace won the race.</p>
            <h3>Bet stats</h3>
            <ul>
                {result.players.map((player) => {
                    const bets = suitOrder
                        .filter((suit) => player.bet[suit] > 0)
                        .map((suit) => `${player.bet[suit]} on ${suit}`);

                    return (
                        <li key={player.username}>
                            <strong>{player.username}:</strong> {bets.length ? bets.join(", ") : "No bet placed"}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};

export default RaceResults;

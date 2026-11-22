import React, {useEffect, useState} from "react";
import { useParams } from 'react-router-dom';
import { useSocket } from "../SocketContext";
import "./GameHost.css"; // Assuming you have a CSS file for styling

const GameHost = () => {
    const { roomId } = useParams();
    const socket = useSocket();
    const [players, setPlayers] = useState([]);
    const [isGameStarted, setIsGameStarted] = useState(false);
    const [lastCard, setLastCard] = useState(null);
    const [positions, setPositions] = useState({});
    const [raceResult, setRaceResult] = useState(null);
    const [replayError, setReplayError] = useState("");
    const [cardGrid, setCardGrid] = useState([
        ['','','','',''],
        ['back_of_card','','','',''],
        ['back_of_card','','','',''],
        ['back_of_card','','','',''],
        ['back_of_card','','','',''],
        ['back_of_card','','','',''],
        ['back_of_card','','','',''],
        ['back_of_card','clubs_ace','diamonds_ace','hearts_ace','spades_ace']
    ]);



    useEffect(() => {
        socket.emit("getPlayers", roomId, (playersInRoom) => {
            setPlayers(playersInRoom);
        });

        socket.on("updatePlayers", (updatedPlayers) => {
            setPlayers(updatedPlayers);
        });

        socket.on("startGame", ({ grid, positions }) => {
            setIsGameStarted(true);
            setCardGrid(grid);
            setPositions(positions);
        });

        socket.on("cardFlipped", setLastCard);
        socket.on("updateGrid", setCardGrid);
        socket.on("updatePosition", setPositions);
        socket.on("gameWon", setRaceResult);
        socket.on("distributionUpdate", setRaceResult);
        socket.on("newGame", ({ players: newPlayers, grid, positions: newPositions }) => {
            setPlayers(newPlayers);
            setIsGameStarted(false);
            setLastCard(null);
            setPositions(newPositions);
            setCardGrid(grid);
            setRaceResult(null);
            setReplayError("");
        });

        return () => {
            socket.off("updatePlayers");
            socket.off("startGame");
            socket.off("cardFlipped");
            socket.off("updateGrid");
            socket.off("updatePosition");
            socket.off("gameWon");
            socket.off("distributionUpdate");
            socket.off("newGame");
        };


    }, [socket, roomId]);

    const formatBets = (bet) => Object.entries(bet)
        .filter(([, amount]) => amount > 0)
        .map(([suit, amount]) => `${amount} ${suit}`)
        .join(", ") || "No bets";

    const formatDistributions = (distributions) => distributions.length
        ? distributions.map(({ recipientUsername, amount }) => `${amount} to ${recipientUsername}`).join(", ")
        : "None";

    const handleReplay = () => {
        socket.emit("playAgain", roomId, (response) => {
            if (!response.success) setReplayError(response.message);
        });
    };

    return (
        <div className="game-host-container">
            <h1>Game Host</h1>
            {!raceResult && ((players.length > 0) ? (
                <div>
                    <h2>Players in Room:</h2>
                    <ul>
                        {players.map((player, index) => (
                            player.socketId !== socket.id && 
                            <div key={index}>
                                <li style={{ color: player.betConfirmed ? "green" : "red" }}>{player.username}</li>
                                {Object.keys(player.bet).map((suit) => (
                                    player.bet[suit] > 0 && <div key={suit}>
                                        <span>{suit}: {player.bet[suit]}</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </ul>
                </div>
            ) : (
                <p>No other players in the room</p>
            ))}
            {!isGameStarted && (<h3>Waiting for players to confirm their bets...</h3>)}
            {isGameStarted && (
                <>
                    {!raceResult && <button onClick={() => socket.emit("flipCard", roomId)}>Flip next card</button>}
                    {lastCard && <p>Last card: {lastCard.replace("_", " of ")}</p>}
                    <p>{Object.entries(positions).map(([horse, place]) => `${horse.replace("_ace", "")}: ${place}`).join(" | ")}</p>
                </>
            )}

            {!raceResult && <div className="card-container">
                {cardGrid.map((row, rowIndex) => (
                    <div key={rowIndex} className="card-row">
                    {row.map((card, colIndex) => (
                        <div key={colIndex} className="card">
                        {card && <img src={`/Images/${card}.png`} alt={card} />}
                        </div>
                    ))}
                    </div>
                ))}
            </div>}

            {raceResult && (
                <section className="host-results">
                    <h2>{raceResult.winner.replace("_ace", "")} won the race</h2>
                    <div className="distribution-legend" aria-label="Distribution status legend">
                        <span><i className="legend-color legend-pending" /> Orange: distributing</span>
                        <span><i className="legend-color legend-complete" /> Green: confirmed</span>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Player</th>
                                <th>Bets</th>
                                <th>Units to give</th>
                                <th>Gives drinks to</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {raceResult.players.map((player) => (
                                <tr
                                    className={player.distributionConfirmed ? "distribution-complete" : "distribution-pending"}
                                    key={player.socketId}
                                >
                                    <td>{player.username}</td>
                                    <td>{formatBets(player.bet)}</td>
                                    <td>{player.drinkAllowance}</td>
                                    <td>{formatDistributions(player.distributions)}</td>
                                    <td>{player.distributionConfirmed ? "Complete" : "Distributing"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {raceResult.allDistributed ? (
                        <button onClick={handleReplay}>Replay</button>
                    ) : (
                        <p>Waiting for players to finish distributing their drinks...</p>
                    )}
                    {replayError && <p className="distribution-error">{replayError}</p>}
                </section>
            )}



        </div>
    );
}

export default GameHost;




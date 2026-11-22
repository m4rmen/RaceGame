import React, {useEffect, useState} from "react";
import { useParams } from 'react-router-dom';
import { useSocket } from "../SocketContext";
import "./Game.css";


const Game = () => {
    const { roomId } = useParams();
    const socket = useSocket();
    const [players, setPlayers] = useState([]);
    const [currentPlayer, setCurrentPlayer] = useState(null);
    const [betConfirmed, setBetConfirmed] = useState(false);
    const [isGameStarted, setIsGameStarted] = useState(false);
    const [cardGrid, setCardGrid] = useState([]);
    const [lastCard, setLastCard] = useState(null);
    const [raceResult, setRaceResult] = useState(null);
    const [distribution, setDistribution] = useState({});
    const [distributionError, setDistributionError] = useState("");

    useEffect(() => {
        socket.emit("getPlayers", roomId, (playersInRoom) => {
            setPlayers(playersInRoom);
            setCurrentPlayer(playersInRoom.find(player => player.socketId === socket.id));
            console.log("Players in room: ", playersInRoom[0].socketId);
            console.log("Socket ID: ", socket.id);
        });

        socket.on("updatePlayers", (updatedPlayers) => {
            setPlayers(updatedPlayers);
            setCurrentPlayer(updatedPlayers.find(player => player.socketId === socket.id));
        });

        socket.on("startGame", ({ grid }) => {
            setIsGameStarted(true);
            setCardGrid(grid);
        });
        socket.on("cardFlipped", setLastCard);
        socket.on("updateGrid", setCardGrid);
        socket.on("gameWon", (result) => {
            setRaceResult(result);
            setDistribution({});
        });
        socket.on("distributionUpdate", setRaceResult);
        socket.on("newGame", ({ players: newPlayers, grid }) => {
            setPlayers(newPlayers);
            setCurrentPlayer(newPlayers.find((player) => player.socketId === socket.id));
            setBetConfirmed(false);
            setIsGameStarted(false);
            setCardGrid(grid);
            setLastCard(null);
            setRaceResult(null);
            setDistribution({});
            setDistributionError("");
        });

        return () => {
            socket.off("updatePlayers");
            socket.off("startGame");
            socket.off("cardFlipped");
            socket.off("updateGrid");
            socket.off("gameWon");
            socket.off("distributionUpdate");
            socket.off("newGame");
        };
    }, [socket, roomId]);


    const handleBet = (add, suit) =>{
        if(add==="+"){
            currentPlayer.bet[suit] += 1;
            setCurrentPlayer({...currentPlayer});
            socket.emit("playerBetChange", currentPlayer.bet, roomId);
        }else{
            if(currentPlayer.bet[suit] > 0){
                currentPlayer.bet[suit] -= 1;
                setCurrentPlayer({...currentPlayer});
                socket.emit("playerBetChange", currentPlayer.bet, roomId);
            }
        }

    }

    const handleConfirmBets = () => {
        socket.emit("betsPlaced", roomId);
        setBetConfirmed(true);
    }

    const resultForCurrentPlayer = raceResult?.players.find((player) => player.socketId === socket.id);
    const distributedTotal = Object.values(distribution).reduce((total, amount) => total + amount, 0);
    const remainingDrinks = (resultForCurrentPlayer?.drinkAllowance || 0) - distributedTotal;

    const changeDistribution = (recipientId, change) => {
        const currentAmount = distribution[recipientId] || 0;
        const currentTotal = Object.values(distribution).reduce((total, amount) => total + amount, 0);
        if (change > 0 && currentTotal >= resultForCurrentPlayer.drinkAllowance) return;

        const updatedDistribution = {
            ...distribution,
            [recipientId]: Math.max(0, currentAmount + change)
        };
        setDistribution(updatedDistribution);
        socket.emit("updateDistribution", roomId, updatedDistribution);
        setDistributionError("");
    };

    const handleConfirmDistribution = () => {
        socket.emit("submitDistribution", roomId, distribution, (response) => {
            if (!response.success) setDistributionError(response.message);
        });
    };

    return (
        <div className="game-container">
            <h1>Game</h1>
            <p>Player: {players.find(player => player.socketId === socket.id)?.username}</p>

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

            {(!isGameStarted && currentPlayer && !betConfirmed) &&
                <div className="betting-container">
                <div className="betting-card-container">
                    <div className="betting-card">
                        <img src="/Images/clubs_ace.png" alt="" />
                        <div>
                            <button onClick={() => handleBet("-", "clubs")}>-</button>
                            <span>{currentPlayer.bet?.clubs || 0}</span>
                            <button onClick={() => handleBet("+", "clubs")}>+</button>
                        </div>
                        
                    </div>
                    <div className="betting-card">
                        <img src="/Images/spades_ace.png" alt="" />
                        <div>
                            <button onClick={() => handleBet("-", "spades")}>-</button>
                            <span>{currentPlayer.bet?.spades || 0}</span>
                            <button onClick={() => handleBet("+", "spades")}>+</button>
                        </div>
                    </div>
                    <div className="betting-card">
                        <img src="/Images/hearts_ace.png" alt="" />
                        <div>
                            <button onClick={() => handleBet("-", "hearts")}>-</button>
                            <span>{currentPlayer.bet?.hearts || 0}</span>
                            <button onClick={() => handleBet("+", "hearts")}>+</button>
                        </div>
                    </div>
                    <div className="betting-card">
                        <img src="/Images/diamonds_ace.png" alt="" />
                        <div>
                            <button onClick={() => handleBet("-", "diamonds")}>-</button>
                            <span>{currentPlayer.bet?.diamonds || 0}</span>
                            <button onClick={() => handleBet("+", "diamonds")}>+</button>
                        </div>
                    </div>
                </div>
                <button onClick={handleConfirmBets}>Confirm Bets</button>
                </div>
            }

            {isGameStarted && !raceResult && (
                <div>
                    <h2>The race is on!</h2>
                    {lastCard && <p>Last card: {lastCard.replace("_", " of ")}</p>}
                    <div className="card-container">
                        {cardGrid.map((row, rowIndex) => (
                            <div key={rowIndex} className="card-row">
                                {row.map((card, colIndex) => (
                                    <div key={colIndex} className="card">
                                        {card && <img src={`/Images/${card}.png`} alt={card} />}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {raceResult && resultForCurrentPlayer && (
                <section className="distribution-panel">
                    <h2>{raceResult.winner.replace("_ace", "")} won the race</h2>
                    {resultForCurrentPlayer.drinkAllowance === 0 ? (
                        <p>You did not bet on the winning horse, so you have no drinks to distribute.</p>
                    ) : resultForCurrentPlayer.distributionConfirmed ? (
                        <p>Your distribution has been submitted. Waiting for the other players.</p>
                    ) : (
                        <>
                            <p>
                                Distribute <strong>{resultForCurrentPlayer.drinkAllowance}</strong> drink units.
                                Remaining: <strong>{remainingDrinks}</strong>
                            </p>
                            <div className="distribution-list">
                                {raceResult.players
                                    .filter((player) => player.socketId !== socket.id)
                                    .map((player) => (
                                        <div className="distribution-player" key={player.socketId}>
                                            <span>{player.username}</span>
                                            <div>
                                                <button onClick={() => changeDistribution(player.socketId, -1)}>-</button>
                                                <span>{distribution[player.socketId] || 0}</span>
                                                <button onClick={() => changeDistribution(player.socketId, 1)}>+</button>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                            {distributionError && <p className="distribution-error">{distributionError}</p>}
                            <button disabled={remainingDrinks !== 0} onClick={handleConfirmDistribution}>
                                Confirm distribution
                            </button>
                        </>
                    )}
                </section>
            )}


        </div>
    );
}

export default Game;

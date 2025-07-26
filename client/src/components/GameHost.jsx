import React, {useEffect, useState} from "react";
import { useParams } from 'react-router-dom';
import { useSocket } from "../SocketContext";
import "./GameHost.css"; // Assuming you have a CSS file for styling

const GameHost = () => {
    const { roomId } = useParams();
    const socket = useSocket();
    const [players, setPlayers] = useState([]);
    const [isGameStarted, setIsGameStarted] = useState(false);
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

        socket.on("startGame", () => {
            setIsGameStarted(true);
        });


    }, [socket, roomId]);

    return (
        <div className="game-host-container">
            <h1>Game Host</h1>
            {(players.length > 0) ? (
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
            )}
            {!isGameStarted && (<h3>Waiting for players to confirm their bets...</h3>)}

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
    );
}

export default GameHost;




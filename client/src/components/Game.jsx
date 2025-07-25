import React, {useEffect, useState} from "react";
import { useParams } from 'react-router-dom';
import { useSocket } from "../SocketContext";
import "./Game.css";


const Game = () => {
    const { roomId } = useParams();
    const socket = useSocket();
    const [isOrganizer, setIsOrganizer] = useState(false);
    const [bettingPhase, setBettingPhase] = useState(true);
    const [players, setPlayers] = useState([]);
    const [currentPlayer, setCurrentPlayer] = useState(null);

    useEffect(() => {
        socket.emit("isOrganizer", roomId, (isOrganizer) => {
            setIsOrganizer(isOrganizer);
        });

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
        socket.emit("playerBetConfirmed", roomId);
    }

    return (
        <div>
            <h1>Game</h1>
            <p>Room ID: {roomId}</p>
            {isOrganizer && <p>You are the organizer of this game.</p>}
            {!isOrganizer && <p>Player: {players.find(player => player.socketId === socket.id)?.username}</p>}
            
            {players.length > 0 ? <h2>Players in Room:</h2> && (
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
            ) : (
                <p>No other players in the room</p>
            )}
            
            {(!isOrganizer && bettingPhase && currentPlayer) &&
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


        </div>
    );
}

export default Game;

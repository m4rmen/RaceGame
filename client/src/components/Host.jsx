import React, {useState,useEffect} from "react";
import { useSocket } from "../SocketContext";
import { useNavigate } from 'react-router-dom';
import "./Host.css";


const Host = () => {
    const socket = useSocket();
    const [code, setCode] = useState(0);
    const [players, setPlayers] = React.useState([]);
    const navigate = useNavigate();
    

    const generateRandomCode = () => {
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        return code;
    };

    const handleStartGame = () => {
        socket.emit("startBettingPhase", code);
        navigate(`/gamehost/${code}`);
    };

    useEffect(() => {
        const code = generateRandomCode();
        setCode(code);
        socket.emit("createRoom", code);

        socket.emit("getPlayers", code, (playersInRoom) => {
            setPlayers(playersInRoom.map(player =>  player.username));
        });

        socket.on("updatePlayers", (updatedPlayers) => {
            setPlayers(updatedPlayers.map(player => player.username));
        });

        sessionStorage.setItem("currentRoomId", code);
    }, [socket]);

    return (
        <div className="host-container">
            <h1>Host</h1>
            <p>Your game code is: {code}</p>
            <h2>Players in Room:</h2>
            {players.length > 0 ? (
                <ul>
                    {players.map((player, index) => (
                        <li key={index}>{player}</li>
                    ))}
                </ul>
            ) : (
                <p>No players in the room</p>
            )}
            <button onClick={handleStartGame}>Start Game</button>
        </div>
    );
}

export default Host;
import React, {useEffect, useState} from "react";
import { useParams } from 'react-router-dom';
import { useSocket } from "../SocketContext";
import { useNavigate } from 'react-router-dom';
import "./WaitingRoom.css";

const WaitingRoom = () => {
    const navigate = useNavigate();
    const { roomId } = useParams();
    const socket = useSocket();
    const [players, setPlayers] = useState([]);

    useEffect(() => {
        socket.emit("getPlayers", roomId, (playersInRoom) => {
            setPlayers(playersInRoom.map(player =>  player.username));
        });

        socket.on("updatePlayers", (updatedPlayers) => {
            setPlayers(updatedPlayers.map(player => player.username));
        });

        socket.on("roomDeleted", () => {
            navigate(`/join`);
        });

        socket.on("bettingPhase", () => {
            navigate(`/game/${roomId}`);
        });

    }, [socket, roomId, navigate]);



    return (
        <div className="waiting-room-container">
            <h1>WaitingRoom</h1>
            <p>Room ID: {roomId}</p>
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
        </div>
    );
}

export default WaitingRoom;
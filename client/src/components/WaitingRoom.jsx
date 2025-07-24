import React, {useEffect} from "react";
import { useParams } from 'react-router-dom';
import { useSocket } from "../SocketContext";

const WaitingRoom = () => {

    const { roomId } = useParams();
    const socket = useSocket();
    const [players, setPlayers] = React.useState([]);

    useEffect(() => {
        socket.emit("getPlayers", roomId, (playersInRoom) => {
            setPlayers(playersInRoom.map(player =>  player.username));
        });
    }, [socket, roomId]);



    return (
        <div>
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
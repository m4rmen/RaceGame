import React, {useEffect, useState} from "react";
import { useParams } from 'react-router-dom';
import { useSocket } from "../SocketContext";


const Game = () => {
    const { roomId } = useParams();
    const socket = useSocket();
    const [isOrganizer, setIsOrganizer] = useState(false);

    useEffect(() => {
        socket.emit("isOrganizer", roomId, (isOrganizer) => {
            setIsOrganizer(isOrganizer);
        });
    }, [socket, roomId]);

    return (
        <div>
            <h1>Game</h1>
            {isOrganizer && <p>You are the organizer of this game.</p>}
            {!isOrganizer && <p>You are not the organizer of this game.</p>}
        
        </div>
    );
}

export default Game;

import React, {useState} from "react";
import { useNavigate } from 'react-router-dom';
import { useSocket } from "../SocketContext";
import "./Join.css";

const Join = () => {
    const navigate = useNavigate();
    const [roomCode, setRoomCode] = useState(0);
    const [userName, setUserName] = useState("");
    const socket = useSocket();

    const handleInputChange = (event) => {
        setRoomCode(event.target.value);
    };

    const handleUserNameChange = (event) => {
        setUserName(event.target.value);
    };

    const handleJoinRoom = () => {
        socket.emit("joinRoom", userName, roomCode, (response) => {
            console.log("Response from server: ", response);
            if (response.success === false) {
                alert(response.message);
            } else {
                sessionStorage.setItem("currentRoomId", roomCode);
                navigate(`/waitingroom/${roomCode}`);
            }
        });
        
    };

    return (
        <div className="join-container">
            <h1>Join</h1>
            <label htmlFor="roomCode">Room Code:</label>
            <input type="number" id="roomCode" onChange={handleInputChange} />
            <br />
            <label htmlFor="userName">User Name:</label>
            <input type="text" id="userName" onChange={handleUserNameChange} />
            <br />
            <button onClick={handleJoinRoom}>Join Room</button>
        </div>
    );
}

export default Join;
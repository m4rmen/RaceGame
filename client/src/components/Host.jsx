import React, {useState,useEffect} from "react";
import { useSocket } from "../SocketContext";


const Host = () => {
    const socket = useSocket();
    const [code, setCode] = useState(0);

    const generateRandomCode = () => {
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        return code;
    };

    useEffect(() => {
        const code = generateRandomCode();
        setCode(code);
        socket.emit("createRoom", code);
        sessionStorage.setItem("currentRoomId", code);
    }, [socket]);

    return (
        <div>
        <h1>Host</h1>
        <p>Your game code is: {code}</p>
        </div>
    );
}

export default Host;
import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext();

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const sessionId =
      sessionStorage.getItem("raceSessionId") || window.crypto.randomUUID();
    sessionStorage.setItem("raceSessionId", sessionId);
    const serverUrl = process.env.REACT_APP_SERVER_URL || window.location.origin;
    const newSocket = io(serverUrl, {
      path: "/api/socket.io",
      auth: { sessionId },
      transports:
        process.env.NODE_ENV === "production"
          ? ["websocket"]
          : ["polling", "websocket"],
    });
    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, []);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};

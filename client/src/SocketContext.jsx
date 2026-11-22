import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext();

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const serverUrl =
      process.env.REACT_APP_SERVER_URL ||
      `${window.location.protocol}//${window.location.hostname}:5000`;
    const newSocket = io(serverUrl, { transports: ["websocket"] });
    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, []);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};

import React from "react";
import Home from "./components/Home";
import Host from "./components/Host";
import Join from "./components/Join";
import WaitingRoom from "./components/WaitingRoom";
import Game from "./components/Game";


import { SocketProvider } from "./SocketContext";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

const App = () => (
    <SocketProvider>
        <Router>
            <Routes>
                <Route exact path="/" element={<Home />} />
                <Route exact path="/host" element={<Host />} />
                <Route exact path="/join" element={<Join />} />
                <Route exact path="/waitingroom/:roomId" element={<WaitingRoom />} />
                <Route exact path="/game/:roomId" element={<Game />} />
            </Routes>
        </Router>
    </SocketProvider>
)

export default App;
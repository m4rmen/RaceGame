import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSocket } from "../SocketContext";
import ClubHeader from "./ClubHeader";
import "./WaitingRoom.css";

export default function WaitingRoom() {
  const { roomId } = useParams();
  const socket = useSocket();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  useEffect(() => {
    if (!socket) return;
    socket.emit("getPlayers", roomId, (inRoom) => setPlayers(inRoom || []));
    const onPlayers = (updated) => setPlayers(updated);
    const onDeleted = () => navigate("/join");
    const onBetting = () => navigate(`/game/${roomId}`);
    socket.on("updatePlayers", onPlayers);
    socket.on("roomDeleted", onDeleted);
    socket.on("bettingPhase", onBetting);
    return () => {
      socket.off("updatePlayers", onPlayers);
      socket.off("roomDeleted", onDeleted);
      socket.off("bettingPhase", onBetting);
    };
  }, [socket, roomId, navigate]);
  return (
    <div className="app-shell staging-page">
      <ClubHeader roomId={roomId} label="The paddock" />
      <main className="staging-layout">
        <div>
          <span className="eyebrow">Before the off</span>
          <h1 className="page-title">
            The field
            <br />
            assembles.
          </h1>
          <p className="page-intro">
            You’re in. The host will open betting when everyone has arrived.
          </p>
          <div className="waiting-signal">
            <span /> Awaiting the starter’s call
          </div>
        </div>
        <div className="staging-roster club-panel">
          <span className="eyebrow">Race entrants</span>
          <h2>
            In the paddock <small>{players.length}</small>
          </h2>
          <div className="staging-roster__list">
            {players.map((player, index) => (
              <div key={player.socketId}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{player.username}</strong>
                <i>READY</i>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

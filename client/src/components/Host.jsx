import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../SocketContext";
import ClubHeader from "./ClubHeader";
import "./Host.css";

export default function Host() {
  const socket = useSocket();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [players, setPlayers] = useState([]);
  useEffect(() => {
    if (!socket) return;
    const roomCode = String(Math.floor(1000 + Math.random() * 9000));
    setCode(roomCode);
    socket.emit("createRoom", roomCode);
    socket.emit("getPlayers", roomCode, (inRoom) => setPlayers(inRoom || []));
    const onPlayers = (updated) => setPlayers(updated);
    socket.on("updatePlayers", onPlayers);
    sessionStorage.setItem("currentRoomId", roomCode);
    return () => socket.off("updatePlayers", onPlayers);
  }, [socket]);
  return (
    <div className="app-shell staging-page">
      <ClubHeader roomId={code} label="Host the event" />
      <main className="staging-layout">
        <div>
          <span className="eyebrow">The announcer’s box</span>
          <h1 className="page-title">
            Gather your
            <br />
            field.
          </h1>
          <p className="page-intro">
            Share the race code with players. Once everyone has joined, open the betting
            ring.
          </p>
          <div className="staging-code club-panel">
            <span className="eyebrow">Your race code</span>
            <strong>{code || "····"}</strong>
            <small>Ask players to enter this code on their phones.</small>
          </div>
        </div>
        <div className="staging-roster club-panel">
          <span className="eyebrow">The paddock</span>
          <h2>
            Players in the field <small>{players.length}</small>
          </h2>
          <div className="staging-roster__list">
            {players.length ? (
              players.map((player, index) => (
                <div key={player.socketId}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{player.username}</strong>
                  <i>READY</i>
                </div>
              ))
            ) : (
              <p>No players yet. Your race is ready when they arrive.</p>
            )}
          </div>
          <button
            className="club-button"
            disabled={!code}
            onClick={() => {
              socket.emit("startBettingPhase", code);
              navigate(`/gamehost/${code}`);
            }}
          >
            Open betting <span aria-hidden="true">→</span>
          </button>
        </div>
      </main>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
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
    const storedCode =
      sessionStorage.getItem("raceRole") === "host"
        ? sessionStorage.getItem("currentRoomId")
        : null;
    const create = (roomCode, attempts = 0) => {
      socket.emit("createRoom", roomCode, (response) => {
        if (!response.success && attempts < 10) {
          create(String(Math.floor(1000 + Math.random() * 9000)), attempts + 1);
          return;
        }
        if (!response.success) return;
        setCode(roomCode);
        sessionStorage.setItem("currentRoomId", roomCode);
        sessionStorage.setItem("raceRole", "host");
        socket.emit("getPlayers", roomCode, (inRoom) => setPlayers(inRoom || []));
      });
    };
    const resume = () => {
      const roomCode = sessionStorage.getItem("currentRoomId");
      if (!roomCode || sessionStorage.getItem("raceRole") !== "host") return;
      socket.emit("resumeRoom", roomCode, (response) => {
        if (response.success) {
          setCode(roomCode);
          setPlayers(response.state.players);
          if (response.state.phase !== "lobby") navigate(`/gamehost/${roomCode}`);
        } else create(roomCode);
      });
    };
    socket.on("connect", resume);
    if (storedCode) {
      if (socket.connected) resume();
    } else create(String(Math.floor(1000 + Math.random() * 9000)));
    const onPlayers = (updated) => setPlayers(updated);
    socket.on("updatePlayers", onPlayers);
    return () => {
      socket.off("connect", resume);
      socket.off("updatePlayers", onPlayers);
    };
  }, [socket, navigate]);
  const inviteUrl = code
    ? new URL(`/waitingroom/${code}`, window.location.origin).href
    : "";

  return (
    <div className="app-shell staging-page">
      <ClubHeader roomId={code} label="Host the event" />
      <main className="staging-layout host-layout">
        <header className="host-layout__intro">
          <span className="eyebrow">The announcer’s box</span>
          <h1 className="page-title">Gather your field.</h1>
          <p className="page-intro">
            Invite players to the race. Once everyone has joined, open the betting ring.
          </p>
        </header>
        <div className="staging-code club-panel">
          <span className="eyebrow">Your race code</span>
          <strong>{code || "····"}</strong>
          {inviteUrl && (
            <div className="host-invite">
              <QRCodeCanvas
                className="host-invite__qr"
                value={inviteUrl}
                size={168}
                style={{ height: "auto" }}
                marginSize={4}
                bgColor="#f5ecd8"
                fgColor="#142720"
                aria-hidden="true"
              />
              <div className="host-invite__details">
                <small>Scan to join with your phone, or enter the race code.</small>
                <a href={inviteUrl} target="_blank" rel="noopener noreferrer">
                  Open invite link
                </a>
              </div>
            </div>
          )}
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
                  <button
                    className="remove-player-button"
                    type="button"
                    aria-label={`Remove ${player.username} from the room`}
                    onClick={() => socket.emit("removePlayer", code, player.socketId)}
                  >
                    Remove
                  </button>
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

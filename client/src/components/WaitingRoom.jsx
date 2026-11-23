import React, { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useSocket } from "../SocketContext";
import ClubHeader from "./ClubHeader";
import { PhaseStrip, PlayerBib } from "./RaceUi";
import "./WaitingRoom.css";

export default function WaitingRoom() {
  const { roomId } = useParams();
  const socket = useSocket();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const isReturningPlayer =
    sessionStorage.getItem("raceRole") === "player" &&
    sessionStorage.getItem("currentRoomId") === roomId;
  const invitePath = /^[0-9]{4}$/.test(roomId) ? `/join/${roomId}` : "/join";
  useEffect(() => {
    if (!socket || !isReturningPlayer) return;
    const resume = () => {
      socket.emit("resumeRoom", roomId, (response) => {
        if (!response.success) {
          sessionStorage.removeItem("currentRoomId");
          sessionStorage.removeItem("raceRole");
          navigate(invitePath, { replace: true });
          return;
        }
        setPlayers(response.state.players);
        if (response.state.phase !== "lobby") navigate(`/game/${roomId}`);
      });
    };
    socket.on("connect", resume);
    if (socket.connected) resume();
    const onPlayers = (updated) => setPlayers(updated);
    const onDeleted = () => {
      sessionStorage.removeItem("currentRoomId");
      sessionStorage.removeItem("raceRole");
      navigate("/join");
    };
    const onBetting = () => navigate(`/game/${roomId}`);
    socket.on("updatePlayers", onPlayers);
    socket.on("roomDeleted", onDeleted);
    const onPlayerRemoved = (removedId) => {
      if (removedId === socket.auth.sessionId) onDeleted();
    };
    socket.on("playerRemoved", onPlayerRemoved);
    socket.on("bettingPhase", onBetting);
    return () => {
      socket.off("connect", resume);
      socket.off("updatePlayers", onPlayers);
      socket.off("roomDeleted", onDeleted);
      socket.off("playerRemoved", onPlayerRemoved);
      socket.off("bettingPhase", onBetting);
    };
  }, [socket, roomId, navigate, isReturningPlayer, invitePath]);
  if (!isReturningPlayer) return <Navigate to={invitePath} replace />;
  return (
    <div className="app-shell staging-page">
      <ClubHeader roomId={roomId} label="The paddock" />
      <PhaseStrip phase={0} />
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
                <PlayerBib number={player.bib ?? index + 1} />
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

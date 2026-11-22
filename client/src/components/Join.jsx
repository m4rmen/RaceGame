import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSocket } from "../SocketContext";
import ClubHeader from "./ClubHeader";
import "./Join.css";

export default function Join() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const invitedRoom = /^[0-9]{4}$/.test(roomId) ? roomId : null;
  const socket = useSocket();
  const [roomCode, setRoomCode] = useState("");
  const [userName, setUserName] = useState("");
  const [error, setError] = useState("");
  const join = (event) => {
    event.preventDefault();
    if (!socket) return;
    const targetRoom = invitedRoom || roomCode.trim();
    const name = userName.trim();
    if (!name) {
      setError("Enter your name to join the race.");
      return;
    }
    setError("");
    socket.emit("joinRoom", name, targetRoom, (response) => {
      if (!response.success) {
        setError(response.message);
        return;
      }
      sessionStorage.setItem("currentRoomId", targetRoom);
      sessionStorage.setItem("raceRole", "player");
      navigate(`/waitingroom/${targetRoom}`, { replace: Boolean(invitedRoom) });
    });
  };
  return (
    <div className="app-shell staging-page">
      <ClubHeader roomId={invitedRoom} label="Join the field" />
      <main className="staging-layout">
        <div>
          <span className="eyebrow">Your place at the track</span>
          <h1 className="page-title">
            Take your
            <br />
            place.
          </h1>
          <p className="page-intro">
            {invitedRoom
              ? "Enter your name to take your place in the paddock."
              : "Enter the code from your host and choose your racing name."}
          </p>
          <div className="join-decoration" aria-hidden="true">
            ♠ <span>♥</span> ♦ ♣
          </div>
        </div>
        <form className="join-form club-panel" onSubmit={join}>
          <span className="eyebrow">Enter the race</span>
          <h2>Join a room</h2>
          {!invitedRoom && (
            <>
              <label className="club-label" htmlFor="roomCode">
                Four-digit race code
              </label>
              <input
                className="club-input"
                id="roomCode"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength="4"
                required
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value)}
                placeholder="0000"
              />
            </>
          )}
          <label className="club-label" htmlFor="userName">
            Your name
          </label>
          <input
            className="club-input"
            id="userName"
            maxLength="30"
            required
            value={userName}
            onChange={(event) => setUserName(event.target.value)}
            placeholder="The name on your racecard"
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="club-button" type="submit" disabled={!socket}>
            Enter the paddock <span aria-hidden="true">→</span>
          </button>
        </form>
      </main>
    </div>
  );
}

# Deploying on Vercel

This repository defines two Vercel Services in the root `vercel.json`:

- `client` builds the Create React App in `client/` and serves the game at `/`.
- `server` runs the Express and Socket.IO app in `server/` at `/api/*`.

Set the Vercel project's **Root Directory** to the repository root and its **Framework Preset** to **Services**. Services mode requires both that project setting and the `services` key in `vercel.json`.

The browser connects to Socket.IO on the same origin at `/api/socket.io`. There is no service binding: the browser is not a server-side service, and the server does not call another service. In local development, `client/src/setupProxy.js` forwards `/api/socket.io` to the server on port 5000. Start both apps as usual, or use `vercel dev --local` from the repository root to run both services together with the Vercel CLI.

## Required Redis connection

Provision a Redis database that accepts standard Redis TCP connections and supports Pub/Sub. Link it to the Vercel project and set the **server runtime** environment variable `REDIS_URL` to its `redis://` or `rediss://` connection string for Preview and Production. Keep the URL secret and out of the React build. The server refuses to start on Vercel without it. This is an external database credential, not a Vercel service binding.

Redis expires each new room one hour after creation. Bets, race progress, and replays use the original deadline. Redis handles expiration even while the app is idle. Socket.IO broadcasts via Redis Pub/Sub without storing event history. Each browser tab keeps a private session ID so it can reload the room snapshot after a WebSocket reconnect or page refresh. Local development works without Redis using an in-memory store.

Existing rooms keep their previous expiry. If this Redis database is dedicated to RaceGame, you can delete the old `socket.io` stream key from the Redis database browser once all deployments using the Streams adapter have stopped. The Pub/Sub adapter does not use that key.

A disconnected player's seat stays reserved for reconnection. The host can remove a player who will not return; if the room becomes empty, it returns to the lobby.

Once the project and Redis integration are linked, run `vercel dev` to test with the project's environment variables, or set `REDIS_URL` locally and use `vercel dev --local`. Then test a Preview Deployment. Verify two players in the same room, a refresh during betting, and a refresh during the race. Browser WebSocket connections can still close at a Vercel Function's maximum duration; the client reconnects and reloads the room snapshot.

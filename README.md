# Chat Room App

A real-time online chat application built with Node.js, Express, React, and Socket.IO.

## Features

- Create a new chat room with a unique room code
- Join an existing room by sharing the code
- Real-time messaging using WebSockets
- Simple user name entry
- Cloud-ready backend and frontend structure

## Tech Stack

- Backend: Node.js + Express + Socket.IO
- Frontend: React + Vite
- Real-time communication: Socket.IO

## Project Structure

- `server/` – Express server and Socket.IO logic
- `client/` – React frontend

## Local Setup

1. Install dependencies:

   ```bash
   npm run install-all
   ```

2. Start the app:

   ```bash
   npm run dev
   ```

3. Open the frontend in the browser:

   ```text
   http://localhost:5173
   ```

4. Backend API runs on:

   ```text
   http://localhost:5000
   ```

## API Endpoints

- `POST /api/create-room` – create a new room and generate a unique room code
- `POST /api/join-room` – verify a room exists
- `GET /api/health` – health check

## Production Deployment

- Frontend: deploy the `client` app to Vercel
- Backend: deploy the `server` app to Render or Railway
- Set the frontend environment variable `VITE_SOCKET_URL` to your deployed backend URL

## Example Room Code

```text
AB12CD
```

## License

MIT

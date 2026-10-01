const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const rooms = new Map();

function generateRoomCode() {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  return rooms.has(code) ? generateRoomCode() : code;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Chat server is running' });
});

app.post('/api/create-room', (req, res) => {
  const roomCode = generateRoomCode();
  rooms.set(roomCode, new Set());

  res.status(201).json({ roomCode });
});

app.post('/api/join-room', (req, res) => {
  const { roomCode } = req.body;

  if (!roomCode || !rooms.has(roomCode)) {
    return res.status(404).json({ error: 'Room not found' });
  }

  return res.status(200).json({ success: true, roomCode });
});

io.on('connection', (socket) => {
  socket.on('join-room', ({ name, roomCode }) => {
    if (!roomCode || !rooms.has(roomCode)) {
      socket.emit('room-error', 'Invalid room code');
      return;
    }

    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.name = name || 'Guest';

    rooms.get(roomCode).add(socket.id);

    io.to(roomCode).emit('system-message', {
      text: `${socket.data.name} joined the room`,
      createdAt: new Date(),
    });

    io.to(roomCode).emit('room-members', {
      count: rooms.get(roomCode).size,
    });
  });

  socket.on('send-message', ({ roomCode, message }) => {
    if (!roomCode || !message || !socket.data.name) {
      return;
    }

    io.to(roomCode).emit('chat-message', {
      sender: socket.data.name,
      text: message,
      createdAt: new Date(),
    });
  });

  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode;

    if (roomCode && rooms.has(roomCode)) {
      rooms.get(roomCode).delete(socket.id);

      if (rooms.get(roomCode).size === 0) {
        rooms.delete(roomCode);
      } else {
        io.to(roomCode).emit('room-members', {
          count: rooms.get(roomCode).size,
        });

        io.to(roomCode).emit('system-message', {
          text: `${socket.data.name || 'A user'} left the room`,
          createdAt: new Date(),
        });
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});

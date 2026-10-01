const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const User = require('./models/User');
const Room = require('./models/Room');
const Message = require('./models/Message');
const { Server } = require('socket.io');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const httpServer = require('http').createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL || '*', methods: ['GET', 'POST'] },
});

app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));

connectDB().catch((error) => {
  console.error('MongoDB connection error:', error.message);
  process.exit(1);
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    socket.user = user;
    next();
  } catch (error) {
    next();
  }
});

io.on('connection', (socket) => {
  socket.on('join-room', async ({ roomId }) => {
    if (!roomId) return;

    socket.join(roomId.toString());
    const room = await Room.findById(roomId).populate('members', 'username');
    if (!room) return;

    const messages = await Message.find({ roomId: room._id }).populate('sender', 'username').sort({ createdAt: 1 }).limit(50);
    socket.emit('room-history', { roomId: room._id, roomName: room.name, roomType: room.roomType, messages });
  });

  socket.on('send-message', async ({ roomId, text }) => {
    if (!socket.user || !roomId || !text || !text.trim()) return;

    const room = await Room.findById(roomId);
    if (!room) return;

    const message = await Message.create({
      roomId: room._id,
      sender: socket.user._id,
      text: text.trim(),
    });

    const populated = await message.populate('sender', 'username email');
    io.to(roomId.toString()).emit('new-message', {
      _id: populated._id,
      roomId: populated.roomId,
      sender: { _id: populated.sender._id, username: populated.sender.username },
      text: populated.text,
      createdAt: populated.createdAt,
    });
  });

  socket.on('disconnect', () => {
    // no-op reserved for future cleanup
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', require('./routes/roomRoutes'));
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

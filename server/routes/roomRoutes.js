const express = require('express');
const authMiddleware = require('../middleware/auth');
const Room = require('../models/Room');
const Message = require('../models/Message');
const User = require('../models/User');
const { generateRoomCode } = require('../utils/generateRoomCode');

const router = express.Router();

router.use(authMiddleware);

router.get('/rooms', async (req, res) => {
  const rooms = await Room.find({ members: req.user.id })
    .populate('members', 'username email')
    .populate('createdBy', 'username')
    .sort({ updatedAt: -1 });

  return res.json({ rooms });
});

router.post('/rooms', async (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Room name is required' });
  }

  const room = await Room.create({
    name: name.trim(),
    code: generateRoomCode(),
    roomType: 'group',
    createdBy: req.user.id,
    members: [req.user.id],
  });

  return res.status(201).json({ room });
});

router.post('/rooms/join', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ message: 'Room code is required' });
  }

  const room = await Room.findOne({ code: code.toUpperCase(), roomType: 'group' });
  if (!room) {
    return res.status(404).json({ message: 'Room not found' });
  }

  if (!room.members.includes(req.user.id)) {
    room.members.push(req.user.id);
    await room.save();
  }

  await room.populate('members', 'username email');
  return res.json({ room });
});

router.post('/direct-chat', async (req, res) => {
  const { targetUserId } = req.body;

  if (!targetUserId) {
    return res.status(400).json({ message: 'Target user is required' });
  }

  if (targetUserId === req.user.id) {
    return res.status(400).json({ message: 'You cannot chat with yourself' });
  }

  const ids = [req.user.id, targetUserId].sort();
  let room = await Room.findOne({
    roomType: 'private',
    participants: { $all: ids },
  });

  if (!room) {
    room = await Room.create({
      name: 'Private chat',
      roomType: 'private',
      createdBy: req.user.id,
      members: ids,
      participants: ids,
    });
  }

  await room.populate('participants', 'username email');
  return res.status(201).json({ room });
});

router.get('/rooms/:roomId/messages', async (req, res) => {
  const room = await Room.findById(req.params.roomId);
  if (!room) {
    return res.status(404).json({ message: 'Room not found' });
  }

  const messages = await Message.find({ roomId: room._id })
    .populate('sender', 'username email')
    .sort({ createdAt: 1 });

  return res.json({ messages });
});

router.get('/users', async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user.id } }).select('-password');
  return res.json({ users });
});

module.exports = router;

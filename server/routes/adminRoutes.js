const express = require('express');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');

const router = express.Router();

router.use(authMiddleware);

router.get('/admin/overview', async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }

  const [userCount, roomCount, messageCount] = await Promise.all([
    User.countDocuments(),
    Room.countDocuments(),
    Message.countDocuments(),
  ]);

  return res.json({ userCount, roomCount, messageCount });
});

router.get('/admin/users', async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }

  const users = await User.find().select('-password');
  return res.json({ users });
});

router.get('/admin/rooms', async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }

  const rooms = await Room.find().populate('members', 'username').populate('createdBy', 'username');
  return res.json({ rooms });
});

module.exports = router;

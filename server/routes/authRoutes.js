const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email, and password are required' });
  }

  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    return res.status(409).json({ message: 'User already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    username,
    email,
    password: hashedPassword,
  });

  const token = jwt.sign({ id: user._id, username: user.username, isAdmin: user.isAdmin }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  return res.status(201).json({
    token,
    user: { id: user._id, username: user.username, email: user.email, isAdmin: user.isAdmin },
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user._id, username: user.username, isAdmin: user.isAdmin }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  return res.json({
    token,
    user: { id: user._id, username: user.username, email: user.email, isAdmin: user.isAdmin },
  });
});

router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ user: { id: user._id, username: user.username, email: user.email, isAdmin: user.isAdmin } });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
});

module.exports = router;

const crypto = require('crypto');

function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

module.exports = { generateRoomCode };

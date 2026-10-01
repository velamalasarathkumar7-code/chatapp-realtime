import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
  transports: ['websocket'],
});

function App() {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [memberCount, setMemberCount] = useState(0);
  const [hasCreatedRoom, setHasCreatedRoom] = useState(false);

  useEffect(() => {
    socket.on('chat-message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('system-message', (msg) => {
      setMessages((prev) => [...prev, { sender: 'System', text: msg.text, createdAt: msg.createdAt }]);
    });

    socket.on('room-error', (message) => {
      setError(message);
    });

    socket.on('room-members', ({ count }) => {
      setMemberCount(count);
    });

    return () => {
      socket.off('chat-message');
      socket.off('system-message');
      socket.off('room-error');
      socket.off('room-members');
    };
  }, []);

  const roomCodeLabel = useMemo(() => {
    return roomCode ? roomCode.toUpperCase() : '...';
  }, [roomCode]);

  async function createRoom() {
    if (!name.trim()) {
      setError('Please enter your name first.');
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/create-room', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Unable to create room');
      }

      const data = await response.json();
      setRoomCode(data.roomCode);
      setError('');
      setMessages([]);
      setHasCreatedRoom(true);
      setJoined(true);
      socket.emit('join-room', { name: name.trim(), roomCode: data.roomCode });
    } catch (err) {
      setError(err.message || 'Something went wrong while creating the room');
    }
  }

  async function joinRoom() {
    if (!name.trim()) {
      setError('Please enter your name first.');
      return;
    }

    const trimmedRoomCode = roomCode.trim().toUpperCase();

    if (!trimmedRoomCode) {
      setError('Please enter a room code.');
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/join-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: trimmedRoomCode }),
      });

      if (!response.ok) {
        throw new Error('Room not found');
      }

      setRoomCode(trimmedRoomCode);
      setError('');
      setMessages([]);
      setHasCreatedRoom(false);
      setJoined(true);
      socket.emit('join-room', { name: name.trim(), roomCode: trimmedRoomCode });
    } catch (err) {
      setError(err.message || 'Could not join room');
    }
  }

  function sendMessage() {
    if (!input.trim() || !roomCode) return;

    socket.emit('send-message', {
      roomCode,
      message: input.trim(),
    });

    setInput('');
  }

  return (
    <div className="app-shell">
      <div className="chat-card">
        {!joined ? (
          <div className="join-panel">
            <h1>Chat Room</h1>
            <p>Enter your name and a room code to continue.</p>

            <label>
              Your name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
              />
            </label>

            <label>
              Room code
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="AB12CD"
              />
            </label>

            {error && <p className="error-message">{error}</p>}

            <div className="button-row">
              <button onClick={joinRoom}>Join room</button>
              <button className="secondary" onClick={createRoom}>Create room</button>
            </div>
          </div>
        ) : (
          <div className="chat-panel">
            <div className="chat-header">
              <div>
                <p className="eyebrow">Room code</p>
                <h2>{roomCodeLabel}</h2>
              </div>

              <div className="member-count">{memberCount} online</div>
            </div>

            <div className="messages">
              {messages.length === 0 ? (
                <div className="empty-state">No messages yet. Start the conversation.</div>
              ) : (
                messages.map((msg, index) => (
                  <div key={`${msg.sender}-${index}-${msg.createdAt || index}`} className="message-bubble">
                    <div className="sender">{msg.sender}</div>
                    <div className="text">{msg.text}</div>
                  </div>
                ))
              )}
            </div>

            <div className="composer">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendMessage();
                }}
              />
              <button onClick={sendMessage}>Send</button>
            </div>

            <div className="footer-row">
              <button className="secondary" onClick={() => setJoined(false)}>
                Leave room
              </button>
              {hasCreatedRoom && <span className="info-pill">Room created</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

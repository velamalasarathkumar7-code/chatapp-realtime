import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [error, setError] = useState('');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!token) return;

    const newSocket = io(API_URL, { auth: { token } });
    setSocket(newSocket);

    newSocket.on('new-message', (message) => {
      setMessages((prev) => {
        const exists = prev.some((item) => item._id === message._id);
        if (exists) return prev;
        return [...prev, message];
      });
    });

    newSocket.on('room-history', (payload) => {
      setMessages(payload.messages || []);
      setSelectedRoom((prev) => ({ ...prev, ...payload }));
    });

    return () => newSocket.disconnect();
  }, [token]);

  useEffect(() => {
    if (!token) return;

    fetchCurrentUser();
    fetchRooms();
    fetchUsers();
  }, [token]);

  async function fetchCurrentUser() {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Auth failed');
      const data = await response.json();
      setCurrentUser(data.user);
    } catch (error) {
      logout();
    }
  }

  async function fetchRooms() {
    try {
      const response = await fetch(`${API_URL}/api/rooms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setRooms(data.rooms || []);
    } catch (error) {
      setError('Could not load rooms');
    }
  }

  async function fetchUsers() {
    try {
      const response = await fetch(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      setError('Could not load users');
    }
  }

  function logout() {
    localStorage.removeItem('token');
    setToken('');
    setCurrentUser(null);
    setRooms([]);
    setUsers([]);
    setMessages([]);
    setSelectedRoom(null);
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setError('');

    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
    const payload = authMode === 'login'
      ? { email: form.email, password: form.password }
      : { username: form.username, email: form.email, password: form.password };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Authentication failed');

      localStorage.setItem('token', data.token);
      setToken(data.token);
      setForm({ username: '', email: '', password: '' });
    } catch (err) {
      setError(err.message);
    }
  }

  async function createRoom() {
    if (!newRoomName.trim()) return;

    try {
      const response = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newRoomName }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not create room');

      setNewRoomName('');
      fetchRooms();
      setSelectedRoom(data.room); 
      if (socket) socket.emit('join-room', { roomId: data.room._id });
    } catch (err) {
      setError(err.message);
    }
  }

  async function joinRoom() {
    if (!roomCodeInput.trim()) return;

    try {
      const response = await fetch(`${API_URL}/api/rooms/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: roomCodeInput }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not join room');

      setRoomCodeInput('');
      fetchRooms();
      setSelectedRoom(data.room);
      if (socket) socket.emit('join-room', { roomId: data.room._id });
    } catch (err) {
      setError(err.message);
    }
  }

  async function openPrivateChat(targetUserId) {
    try {
      const response = await fetch(`${API_URL}/api/direct-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not start chat');

      setSelectedRoom(data.room);
      fetchRooms();
      if (socket) socket.emit('join-room', { roomId: data.room._id });
    } catch (err) {
      setError(err.message);
    }
  }

  async function selectRoom(room) {
    setSelectedRoom(room);
    if (socket) socket.emit('join-room', { roomId: room._id });

    try {
      const response = await fetch(`${API_URL}/api/rooms/${room._id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) setMessages(data.messages || []);
    } catch (err) {
      setError('Failed to load room messages');
    }
  }

  function sendMessage() {
    if (!selectedRoom || !draft.trim() || !socket) return;
    socket.emit('send-message', { roomId: selectedRoom._id, text: draft });
    setDraft('');
  }

  const isAuthenticated = Boolean(token && currentUser);

  return (
    <div className="app-shell">
      {!isAuthenticated ? (
        <div className="auth-card">
          <h1>ChatFlow</h1>
          <div className="toggle-row">
            <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>Login</button>
            <button className={authMode === 'signup' ? 'active' : ''} onClick={() => setAuthMode('signup')}>Sign up</button>
          </div>

          <form onSubmit={handleAuthSubmit} className="auth-form">
            {authMode === 'signup' && (
              <input
                type="text"
                placeholder="Username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />

            {error && <p className="error">{error}</p>}
            <button type="submit">{authMode === 'login' ? 'Login' : 'Create account'}</button>
          </form>
        </div>
      ) : (
        <div className="dashboard">
          <aside className="sidebar">
            <div className="profile-box">
              <h2>{currentUser.username}</h2>
              <p>{currentUser.email}</p>
              <button className="secondary" onClick={logout}>Logout</button>
            </div>

            <div className="panel">
              <h3>Group rooms</h3>
              <div className="input-row">
                <input
                  placeholder="New room name"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                />
                <button onClick={createRoom}>Create</button>
              </div>
              <div className="input-row">
                <input
                  placeholder="Room code"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                />
                <button className="secondary" onClick={joinRoom}>Join</button>
              </div>
            </div>

            <div className="panel">
              <h3>Users</h3>
              <div className="user-list">
                {users.map((user) => (
                  <div key={user._id} className="user-item">
                    <span>{user.username}</span>
                    <button className="small" onClick={() => openPrivateChat(user._id)}>Chat</button>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <main className="chat-panel">
            <div className="chat-header">
              <div>
                <p className="eyebrow">Conversation</p>
                <h2>{selectedRoom ? (selectedRoom.roomType === 'private' ? 'Private chat' : selectedRoom.name || selectedRoom.code) : 'Choose a room'}</h2>
              </div>
              {selectedRoom && selectedRoom.code && <span className="code-pill">Code: {selectedRoom.code}</span>}
            </div>

            <div className="messages-box">
              {!selectedRoom ? (
                <div className="empty-state">Select or create a room to begin chatting.</div>
              ) : (
                messages.map((message) => (
                  <div key={message._id || `${message.sender?._id}-${message.createdAt}`} className="message-item">
                    <strong>{message.sender?.username || 'You'}:</strong> {message.text}
                  </div>
                ))
              )}
            </div>

            <div className="composer">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={selectedRoom ? 'Type a message...' : 'Choose a chat first'}
                disabled={!selectedRoom}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendMessage();
                }}
              />
              <button onClick={sendMessage} disabled={!selectedRoom}>Send</button>
            </div>

            <div className="room-list">
              {rooms.map((room) => (
                <button
                  key={room._id}
                  className={`room-item ${selectedRoom?._id === room._id ? 'selected' : ''}`}
                  onClick={() => selectRoom(room)}
                >
                  {room.roomType === 'group' ? `${room.name} (${room.code})` : room.name}
                </button>
              ))}
            </div>
          </main>
        </div>
      )}
    </div>
  );
}

export default App;

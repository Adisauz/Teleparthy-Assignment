import { useEffect, useMemo, useRef, useState } from 'react';
import type { SessionChatMessage } from 'teleparty-websocket-lib';
import { useTeleparty } from './teleparty/TelepartyContext';
import './App.css';

function App() {
  const {
    connectionStatus,
    roomId,
    messages,
    anyoneTyping,
    lastError,
    createRoom,
    joinRoom,
    sendChatMessage,
    setTypingPresence,
    clearRoom,
  } = useTeleparty();

  const [nickname, setNickname] = useState('');
  const [userIcon, setUserIcon] = useState('');
  const [joinRoomInput, setJoinRoomInput] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);

  const typingTimeoutRef = useRef<number | null>(null);
  const sentTypingRef = useRef(false);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const connected = connectionStatus === 'ready';
  const closed = connectionStatus === 'closed';

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCreateRoom = async () => {
    if (!connected) return;
    if (!nickname.trim()) return;
    setBusy('create');
    try {
      await createRoom(nickname.trim(), userIcon.trim() || undefined);
    } finally {
      setBusy(null);
    }
  };

  const handleJoinRoom = async () => {
    if (!connected) return;
    if (!nickname.trim() || !joinRoomInput.trim()) return;
    setBusy('join');
    try {
      await joinRoom(nickname.trim(), joinRoomInput.trim(), userIcon.trim() || undefined);
    } finally {
      setBusy(null);
    }
  };

  const handleMessageInput = (value: string) => {
    setMessageInput(value);
    if (!connected || !roomId) return;

    if (!sentTypingRef.current) {
      setTypingPresence(true);
      sentTypingRef.current = true;
    }

    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      setTypingPresence(false);
      sentTypingRef.current = false;
      typingTimeoutRef.current = null;
    }, 1500);
  };

  const sendMessage = () => {
    if (!connected || !roomId) return;
    const body = messageInput.trim();
    if (!body) return;
    sendChatMessage(body);
    setMessageInput('');
    setTypingPresence(false);
    sentTypingRef.current = false;
  };

  const renderStatusBanner = () => {
    if (closed) {
      return (
        <div className="banner banner-error">
          Connection closed. Please reload the app to reconnect.
        </div>
      );
    }
    if (!connected) return <div className="banner">Connecting to Teleparty…</div>;
    return null;
  };

  const renderMessages = useMemo(() => {
    if (!messages.length) return <div className="empty-state">No messages yet. Say hello!</div>;

    return messages.map((msg: SessionChatMessage, index: number) => {
      const isSystem = msg.isSystemMessage;
      const isSelf = !isSystem && msg.userNickname === nickname;

      return (
        <div
          key={`${msg.timestamp}-${index}`}
          className={`message ${isSystem ? 'message-system' : isSelf ? 'message-self' : ''}`}
        >
          {!isSystem && (
            <div className="message-meta">
              {msg.userIcon ? (
                <img src={msg.userIcon} alt="User icon" className="avatar" />
              ) : (
                <div className="avatar placeholder">{(msg.userNickname || '?')[0]}</div>
              )}
              <span className="nickname">{msg.userNickname ?? 'Unknown'}</span>
              <span className="timestamp">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}
          <div className="message-body">{msg.body}</div>
        </div>
      );
    });
  }, [messages, nickname]);

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="eyebrow">Teleparty Chat</p>
          <h1>Realtime Chat Playground</h1>
        </div>
        <div className="status">
          <span className={`dot ${connected ? 'dot-on' : 'dot-off'}`} />
          {connected ? 'Connected' : 'Connecting…'}
        </div>
      </header>

      {renderStatusBanner()}
      {lastError ? <div className="banner banner-error">{lastError}</div> : null}

      <section className="panel">
        <div className="field-row">
          <label>Nickname</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Enter your nickname"
            disabled={!connected || Boolean(roomId)}
          />
        </div>
        <div className="field-row">
          <label>User icon (URL, optional)</label>
          <input
            value={userIcon}
            onChange={(e) => setUserIcon(e.target.value)}
            placeholder="https://example.com/avatar.png"
            disabled={!connected || Boolean(roomId)}
          />
        </div>
        <div className="actions">
          <button
            disabled={!connected || Boolean(roomId) || !nickname.trim() || busy !== null}
            onClick={handleCreateRoom}
          >
            {busy === 'create' ? 'Creating…' : 'Create room'}
          </button>
          <div className="join-group">
            <input
              value={joinRoomInput}
              onChange={(e) => setJoinRoomInput(e.target.value)}
              placeholder="Room ID"
              disabled={!connected || Boolean(roomId)}
            />
            <button
              disabled={
                !connected || Boolean(roomId) || !nickname.trim() || !joinRoomInput.trim() || busy !== null
              }
              onClick={handleJoinRoom}
            >
              {busy === 'join' ? 'Joining…' : 'Join room'}
            </button>
          </div>
          {roomId ? (
            <button onClick={clearRoom} disabled={!connected}>
              Leave room
            </button>
          ) : null}
        </div>
        {roomId && (
          <div className="room-pill">
            Joined room: <strong>{roomId}</strong>
          </div>
        )}
      </section>

      <section className="chat">
        <div className="chat-header">
          <div>
            <p className="eyebrow">Room</p>
            <h2>{roomId ?? 'No room joined'}</h2>
          </div>
        </div>
        <div className="messages" aria-live="polite">
          {renderMessages}
          <div ref={messageEndRef} />
        </div>
        {anyoneTyping && <div className="typing-indicator">Someone is typing…</div>}
        <div className="composer">
          <input
            value={messageInput}
            onChange={(e) => handleMessageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendMessage()
            }}
            placeholder={roomId ? 'Type a message' : 'Join or create a room to chat'}
            disabled={!roomId || !connected}
          />
          <button onClick={sendMessage} disabled={!roomId || !connected || !messageInput.trim()}>
            Send
          </button>
        </div>
      </section>
    </div>
  );
}

export default App;

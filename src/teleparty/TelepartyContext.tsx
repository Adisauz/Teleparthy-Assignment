/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  TelepartyClient,
  type MessageList,
  type SessionChatMessage,
  SocketMessageTypes,
  type SocketEventHandler,
} from 'teleparty-websocket-lib';
import type { ConnectionStatus, TypingMessageData } from './types';

type SocketMessage = {
  type: string;
  data: unknown;
  callbackId?: string;
};

type SendMessageFn = (body: string) => void;
type SetTypingFn = (typing: boolean) => void;
type CreateRoomFn = (nickname: string, userIcon?: string) => Promise<string>;
type JoinRoomFn = (nickname: string, roomId: string, userIcon?: string) => Promise<MessageList>;

export interface TelepartyState {
  connectionStatus: ConnectionStatus;
  roomId: string | null;
  messages: SessionChatMessage[];
  anyoneTyping: boolean;
  lastError: string | null;
  isInRoom: boolean;

  createRoom: CreateRoomFn;
  joinRoom: JoinRoomFn;
  sendChatMessage: SendMessageFn;
  setTypingPresence: SetTypingFn;
  clearRoom: () => void;
}

const TelepartyContext = createContext<TelepartyState | null>(null);

function isMessageList(data: unknown): data is MessageList {
  return (
    typeof data === 'object' &&
    data !== null &&
    'messages' in data &&
    Array.isArray((data as { messages: unknown }).messages)
  );
}

function isTypingMessageData(data: unknown): data is TypingMessageData {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as TypingMessageData).anyoneTyping === 'boolean' &&
    Array.isArray((data as TypingMessageData).usersTyping)
  );
}

export function TelepartyProvider(props: { children: React.ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SessionChatMessage[]>([]);
  const [anyoneTyping, setAnyoneTyping] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const clientRef = useRef<TelepartyClient | null>(null);

  useEffect(() => {
    const eventHandler: SocketEventHandler = {
      onConnectionReady: () => setConnectionStatus('ready'),
      onClose: () => setConnectionStatus('closed'),
      onMessage: (message: SocketMessage) => {
        // Server sends non-callback messages here (chat + typing)
        if (message.type === SocketMessageTypes.SEND_MESSAGE) {
          const data = message.data as unknown;
          if (isMessageList(data)) {
            setMessages(data.messages);
          } else {
            setMessages((prev) => [...prev, data as SessionChatMessage]);
          }
          return;
        }

        if (message.type === SocketMessageTypes.SET_TYPING_PRESENCE) {
          const data = message.data as unknown;
          if (isTypingMessageData(data)) setAnyoneTyping(data.anyoneTyping);
        }
      },
    };

    clientRef.current = new TelepartyClient(eventHandler);

    return () => {
      // Library doesn't expose a teardown; rely on page lifecycle.
      clientRef.current = null;
    };
  }, []);

  const createRoom: CreateRoomFn = useCallback(async (nickname, userIcon) => {
    setLastError(null);
    const client = clientRef.current;
    if (!client) throw new Error('Client not initialized');
    if (connectionStatus !== 'ready') throw new Error('Connection not ready');
    const id = await client.createChatRoom(nickname, userIcon);
    setRoomId(id);
    setMessages([]);
    setAnyoneTyping(false);
    return id;
  }, [connectionStatus]);

  const joinRoom: JoinRoomFn = useCallback(async (nickname, id, userIcon) => {
    setLastError(null);
    const client = clientRef.current;
    if (!client) throw new Error('Client not initialized');
    if (connectionStatus !== 'ready') throw new Error('Connection not ready');
    const history = await client.joinChatRoom(nickname, id, userIcon);
    setRoomId(id);
    setMessages(history.messages);
    setAnyoneTyping(false);
    return history;
  }, [connectionStatus]);

  const sendChatMessage: SendMessageFn = useCallback(
    (body) => {
    const client = clientRef.current;
    if (!client) return;
    if (!roomId) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    client.sendMessage(SocketMessageTypes.SEND_MESSAGE, { body: trimmed });
    },
    [roomId],
  );

  const setTypingPresence: SetTypingFn = useCallback(
    (typing) => {
    const client = clientRef.current;
    if (!client) return;
    if (!roomId) return;
    client.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, { typing });
    },
    [roomId],
  );

  const clearRoom = useCallback(() => {
    setRoomId(null);
    setMessages([]);
    setAnyoneTyping(false);
    setLastError(null);
  }, []);

  const value: TelepartyState = useMemo(
    () => ({
      connectionStatus,
      roomId,
      messages,
      anyoneTyping,
      lastError,
      isInRoom: roomId !== null,
      createRoom: async (nickname, userIcon) => {
        try {
          return await createRoom(nickname, userIcon);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Failed to create room';
          setLastError(msg);
          throw e;
        }
      },
      joinRoom: async (nickname, id, userIcon) => {
        try {
          return await joinRoom(nickname, id, userIcon);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Failed to join room';
          setLastError(msg);
          throw e;
        }
      },
      sendChatMessage,
      setTypingPresence,
      clearRoom,
    }),
    [
      anyoneTyping,
      clearRoom,
      connectionStatus,
      createRoom,
      joinRoom,
      lastError,
      messages,
      roomId,
      sendChatMessage,
      setTypingPresence,
    ],
  );

  return <TelepartyContext.Provider value={value}>{props.children}</TelepartyContext.Provider>;
}

export function useTeleparty(): TelepartyState {
  const ctx = useContext(TelepartyContext);
  if (!ctx) throw new Error('useTeleparty must be used within TelepartyProvider');
  return ctx;
}



import type { MessageList, SessionChatMessage } from 'teleparty-websocket-lib';

export type ConnectionStatus = 'connecting' | 'ready' | 'closed';

export type ChatEvent =
  | { type: 'history'; data: MessageList }
  | { type: 'message'; data: SessionChatMessage }
  | { type: 'typing'; data: TypingMessageData };

export interface TypingMessageData {
  anyoneTyping: boolean;
  usersTyping: string[];
}



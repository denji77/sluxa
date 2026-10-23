/** TypeScript mirrors of the FastAPI backend schemas. */

export interface Character {
  id: number;
  name: string;
  description: string;
  avatar_url?: string | null;
  greeting?: string | null;
  lorebook_id?: number | null;
  is_default: boolean;
  created_at: string;
}

export interface CharacterCreate {
  name: string;
  description: string;
  avatar_url?: string | null;
  greeting?: string | null;
  lorebook_id?: number | null;
}

export interface Message {
  id: number;
  chat_id: number;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  /** Set on send-message responses so we can sync the optimistic user bubble. */
  user_message_id?: number | null;
}

export interface ChatSummary {
  id: number;
  title?: string | null;
  character_id: number;
  character_name: string;
  character_avatar?: string | null;
  created_at: string;
  updated_at: string;
  last_message?: string | null;
}

export interface Chat {
  id: number;
  title?: string | null;
  character_id: number;
  user_id: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  character: Character;
  messages: Message[];
}

export interface User {
  id: number;
  clerk_id: string;
  email?: string | null;
  username?: string | null;
  created_at: string;
}

// ── Group chats ──────────────────────────────────────────────────────

export interface Participant {
  id: number;
  character_id: number;
  character_name: string;
  character_avatar?: string | null;
  order: number;
}

export type GroupRole =
  | 'user'
  | 'assistant'
  | 'hesitation'
  | 'reaction'
  | 'left_on_read';

export interface GroupMessage {
  id?: number | null;
  group_chat_id: number;
  character_id?: number | null;
  character_name?: string | null;
  character_avatar?: string | null;
  content: string;
  role: GroupRole;
  created_at?: string | null;
  delay_ms: number;
  responding_to_char_id?: number | null;
  responding_to_char_name?: string | null;
  responding_to_preview?: string | null;
  hesitation_ms: number;
  reacting_to_message_id?: number | null;
  reacting_to_char_name?: string | null;
  interrupt: boolean;
  concurrent: boolean;
  typing_multiplier: number;
  user_message_id?: number | null;
}

export interface GroupChatSummary {
  id: number;
  title?: string | null;
  participants: Participant[];
  last_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupChatDetail {
  id: number;
  title?: string | null;
  user_id: number;
  participants: Participant[];
  messages: GroupMessage[];
  created_at: string;
  updated_at: string;
}

// ── Chub.ai ──────────────────────────────────────────────────────────

export interface ChubSearchResult {
  id: number;
  name: string;
  fullPath: string;
  description: string;
  starCount: number;
  tagline: string;
  avatar_url: string;
  nTokens: number;
  rating: number;
  ratingCount: number;
  nChats: number;
  nMessages: number;
  topics: string[];
  verified: boolean;
  recommended: boolean;
}

export interface ChubCharacterDetail {
  id: number;
  name: string;
  description: string;
  first_mes: string;
  personality: string[];
  scenario: string;
  mes_example: string;
  system_prompt: string;
  creator: string;
  creator_notes: string;
  tags: string[];
}

// ── Lorebooks ────────────────────────────────────────────────────────

export interface LorebookEntry {
  id: number;
  lorebook_id: number;
  keys: string;
  content: string;
  is_enabled: boolean;
  created_at: string;
}

export interface Lorebook {
  id: number;
  user_id: number;
  name: string;
  description?: string | null;
  created_at: string;
  entries: LorebookEntry[];
}

// ── Memories (RAG) ───────────────────────────────────────────────────

export interface MemoryItem {
  message_id: number;
  content_preview: string;
  role: string;
  created_at: string;
}

export interface ChatMemories {
  chat_id: number;
  memories: MemoryItem[];
  count: number;
}

export type ChatMode = 'descriptive' | 'normal';

// ── Friends ──────────────────────────────────────────────────────────

export interface FriendUser {
  id: number;
  email?: string | null;
  username?: string | null;
  display_name: string;
}

export interface FriendRequest {
  id: number;
  status: 'pending' | 'accepted';
  direction: 'incoming' | 'outgoing';
  user: FriendUser;
  created_at: string;
}

export interface FriendRequests {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

export interface FriendMessage {
  id: number;
  friendship_id: number;
  sender_id: number;
  content: string;
  mine: boolean;
  created_at: string;
}

export interface FriendSummary {
  friendship_id: number;
  friend: FriendUser;
  since: string;
  last_message?: FriendMessage | null;
  unread_count: number;
}

export interface FriendConversation {
  friend: FriendUser;
  messages: FriendMessage[];
}

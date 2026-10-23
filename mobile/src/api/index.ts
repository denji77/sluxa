import { api } from './client';
import { getTimeContext } from '../utils/time';
import type {
  Character,
  CharacterCreate,
  Chat,
  ChatMemories,
  ChatMode,
  ChatSummary,
  ChubCharacterDetail,
  ChubSearchResult,
  FriendConversation,
  FriendMessage,
  FriendRequest,
  FriendRequests,
  FriendSummary,
  GroupChatDetail,
  GroupChatSummary,
  GroupMessage,
  Lorebook,
  LorebookEntry,
  Message,
  User,
} from '../types';

// ── Characters ───────────────────────────────────────────────────────
export const getCharacters = () => api.get<Character[]>('/characters');
export const getCharacter = (id: number) => api.get<Character>(`/characters/${id}`);
export const createCharacter = (data: CharacterCreate) =>
  api.post<Character>('/characters', data);
export const updateCharacter = (id: number, data: CharacterCreate) =>
  api.put<Character>(`/characters/${id}`, data);
export const deleteCharacter = (id: number) => api.delete(`/characters/${id}`);

// ── Chats ────────────────────────────────────────────────────────────
export const getChats = () => api.get<ChatSummary[]>('/chats');
export const getChat = (id: number) => api.get<Chat>(`/chats/${id}`);
export const createChat = (character_id: number, title?: string) =>
  api.post<Chat>('/chats', { character_id, title });
export const deleteChat = (id: number) => api.delete(`/chats/${id}`);

export const sendMessage = (chatId: number, content: string, mode: ChatMode) =>
  api.post<Message>(`/chats/${chatId}/messages`, {
    content,
    mode,
    ...getTimeContext(),
  });
export const getMessages = (chatId: number, skip = 0, limit = 50) =>
  api.get<Message[]>(`/chats/${chatId}/messages`, { params: { skip, limit } });

// ── Users ────────────────────────────────────────────────────────────
export const getCurrentUser = () => api.get<User>('/users/me');
export const updateUser = (params: { username?: string }) =>
  api.put<User>('/users/me', null, { params });

// ── Chub.ai ──────────────────────────────────────────────────────────
export const searchChub = (query = '', page = 1, excludeNsfw = true) =>
  api.get<ChubSearchResult[]>('/chub/search', {
    params: { query, page, exclude_nsfw: excludeNsfw },
  });
export const getChubCharacter = (chubId: number) =>
  api.get<ChubCharacterDetail>(`/chub/character/${chubId}`);
export const importChubCharacter = (chubId: number) =>
  api.post<Character>(`/chub/import/${chubId}`);

// ── Group chats ──────────────────────────────────────────────────────
export const getGroupChats = () => api.get<GroupChatSummary[]>('/group-chats');
export const createGroupChat = (character_ids: number[], title?: string) =>
  api.post<GroupChatDetail>('/group-chats', { character_ids, title });
export const getGroupChat = (id: number) =>
  api.get<GroupChatDetail>(`/group-chats/${id}`);
export const deleteGroupChat = (id: number) => api.delete(`/group-chats/${id}`);
export const sendGroupMessage = (id: number, content: string, mode: ChatMode) =>
  api.post<GroupMessage[]>(`/group-chats/${id}/messages`, {
    content,
    mode,
    ...getTimeContext(),
  });
export const getAmbientMessage = (id: number) =>
  api.post<GroupMessage | null>(`/group-chats/${id}/ambient`);

// ── Notifications ────────────────────────────────────────────────────
export const registerDevice = (existing_token: string | null, platform: string) =>
  api.post<{ token: string }>('/notifications/register-device', {
    existing_token,
    platform,
  });

// ── Friends ──────────────────────────────────────────────────────────
export const getFriends = () => api.get<FriendSummary[]>('/friends');
export const unfriend = (friendshipId: number) =>
  api.delete(`/friends/${friendshipId}`);
export const getFriendRequests = () =>
  api.get<FriendRequests>('/friends/requests');
export const sendFriendRequest = (email: string) =>
  api.post<FriendRequest>('/friends/requests', { email });
export const acceptFriendRequest = (requestId: number) =>
  api.post<FriendRequest>(`/friends/requests/${requestId}/accept`);
export const declineFriendRequest = (requestId: number) =>
  api.post(`/friends/requests/${requestId}/decline`);
export const getFriendMessages = (friendshipId: number, afterId = 0) =>
  api.get<FriendConversation>(`/friends/${friendshipId}/messages`, {
    params: { after_id: afterId },
  });
export const sendFriendMessage = (friendshipId: number, content: string) =>
  api.post<FriendMessage>(`/friends/${friendshipId}/messages`, { content });

// ── Memories ─────────────────────────────────────────────────────────
export const getChatMemories = (chatId: number) =>
  api.get<ChatMemories>(`/memories/chat/${chatId}`);
export const deleteMemory = (chatId: number, messageId: number) =>
  api.delete(`/memories/chat/${chatId}/message/${messageId}`);
export const clearChatMemories = (chatId: number) =>
  api.delete(`/memories/chat/${chatId}/all`);

// ── Lorebooks ────────────────────────────────────────────────────────
export const getLorebooks = () => api.get<Lorebook[]>('/lorebooks');
export const getLorebook = (id: number) => api.get<Lorebook>(`/lorebooks/${id}`);
export const createLorebook = (name: string, description?: string) =>
  api.post<Lorebook>('/lorebooks', { name, description });
export const addLorebookEntry = (
  lorebookId: number,
  entry: { keys: string; content: string; is_enabled?: boolean },
) => api.post<LorebookEntry>(`/lorebooks/${lorebookId}/entries`, entry);
export const updateLorebookEntry = (
  entryId: number,
  entry: { keys: string; content: string; is_enabled?: boolean },
) => api.put<LorebookEntry>(`/lorebooks/entries/${entryId}`, entry);
export const deleteLorebookEntry = (entryId: number) =>
  api.delete(`/lorebooks/entries/${entryId}`);

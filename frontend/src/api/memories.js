import { api } from './client'

export const getMemories = (chatId) => api.get(`/memories/chat/${chatId}`)
export const deleteMemory = (chatId, messageId) => api.delete(`/memories/chat/${chatId}/message/${messageId}`)
export const clearChatMemories = (chatId) => api.delete(`/memories/chat/${chatId}/all`)
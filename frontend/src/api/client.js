import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Create axios instance
export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common['Authorization']
  }
}

// API functions

// Characters
export const getCharacters = () => api.get('/characters')
export const getCharacter = (id) => api.get(`/characters/${id}`)
export const createCharacter = (data) => api.post('/characters', data)
export const deleteCharacter = (id) => api.delete(`/characters/${id}`)

// Chats
export const getChats = () => api.get('/chats')
export const getChat = (id) => api.get(`/chats/${id}`)
export const createChat = (data) => api.post('/chats', data)
export const deleteChat = (id) => api.delete(`/chats/${id}`)

// Messages
export const sendMessage = (chatId, content, mode = 'descriptive') => 
  api.post(`/chats/${chatId}/messages`, { content, mode })
export const getMessages = (chatId, skip = 0, limit = 50) => 
  api.get(`/chats/${chatId}/messages`, { params: { skip, limit } })

// Users
export const getCurrentUser = () => api.get('/users/me')
export const updateUser = (data) => api.put('/users/me', null, { params: data })

// Chub.ai
export const searchChubCharacters = (query = '', page = 1, excludeNsfw = true) =>
  api.get('/chub/search', { params: { query, page, exclude_nsfw: excludeNsfw } })
export const getChubCharacter = (chubId) => api.get(`/chub/character/${chubId}`)
export const importChubCharacter = (chubId) => api.post(`/chub/import/${chubId}`)

export default api

import { api } from './client'
import { getTimeContext } from '../utils/timeSync'

// Group Chats
export const getGroupChats = () => api.get('/group-chats')
export const createGroupChat = (data) => api.post('/group-chats', data)
export const getGroupChat = (id) => api.get(`/group-chats/${id}`)
export const deleteGroupChat = (id) => api.delete(`/group-chats/${id}`)
export const sendGroupMessage = (groupChatId, content, mode = 'descriptive') =>
    api.post(`/group-chats/${groupChatId}/messages`, {
        content,
        mode,
        ...getTimeContext(),
    })
export const getAmbientMessage = (groupChatId) =>
    api.post(`/group-chats/${groupChatId}/ambient`)

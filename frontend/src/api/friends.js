import api from './client'

// Friends
export const getFriends = () => api.get('/friends')
export const unfriend = (friendshipId) => api.delete(`/friends/${friendshipId}`)

// Requests
export const getFriendRequests = () => api.get('/friends/requests')
export const sendFriendRequest = (email) => api.post('/friends/requests', { email })
export const acceptFriendRequest = (requestId) => api.post(`/friends/requests/${requestId}/accept`)
export const declineFriendRequest = (requestId) => api.post(`/friends/requests/${requestId}/decline`)

// Direct messages
export const getFriendMessages = (friendshipId, afterId = 0) =>
  api.get(`/friends/${friendshipId}/messages`, { params: { after_id: afterId } })
export const sendFriendMessage = (friendshipId, content) =>
  api.post(`/friends/${friendshipId}/messages`, { content })

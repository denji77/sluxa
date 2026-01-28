import { useState, useEffect, useCallback } from 'react'
import { getChats, createChat, deleteChat as deleteChatApi } from '../api/client'

/**
 * Hook for managing chats
 */
export function useChats() {
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchChats = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getChats()
      setChats(response.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load chats')
      console.error('Error fetching chats:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChats()
  }, [fetchChats])

  const startChat = async (characterId) => {
    try {
      const response = await createChat({ character_id: characterId })
      setChats(prev => [response.data, ...prev])
      return response.data
    } catch (err) {
      throw new Error(err.response?.data?.detail || 'Failed to create chat')
    }
  }

  const deleteChat = async (chatId) => {
    try {
      await deleteChatApi(chatId)
      setChats(prev => prev.filter(c => c.id !== chatId))
    } catch (err) {
      throw new Error(err.response?.data?.detail || 'Failed to delete chat')
    }
  }

  return {
    chats,
    loading,
    error,
    refetch: fetchChats,
    startChat,
    deleteChat
  }
}

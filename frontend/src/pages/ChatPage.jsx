import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { getChat, sendMessage, deleteChat } from '../api/client'
import ChatHeader from '../components/Chat/ChatHeader'
import MessageList from '../components/Chat/MessageList'
import MessageInput from '../components/Chat/MessageInput'

export default function ChatPage() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const [chat, setChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [chatMode, setChatMode] = useState(() => {
    // Load saved mode from localStorage or default to 'descriptive'
    return localStorage.getItem('chatMode') || 'descriptive'
  })

  const handleModeChange = (newMode) => {
    setChatMode(newMode)
    localStorage.setItem('chatMode', newMode)
  }

  const fetchChat = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getChat(chatId)
      setChat(response.data)
      setMessages(response.data.messages || [])
    } catch (err) {
      console.error('Failed to fetch chat:', err)
      setError(err.response?.data?.detail || 'Failed to load chat')
      if (err.response?.status === 404) {
        navigate('/')
      }
    } finally {
      setLoading(false)
    }
  }, [chatId, navigate])

  useEffect(() => {
    fetchChat()
  }, [fetchChat])

  const handleSendMessage = async (content) => {
    if (sending || !content.trim()) return

    // Optimistically add user message
    const tempUserMessage = {
      id: `temp-${Date.now()}`,
      content,
      role: 'user',
      chat_id: parseInt(chatId),
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempUserMessage])
    setSending(true)

    try {
      const response = await sendMessage(chatId, content, chatMode)
      // Replace temp message and add AI response
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempUserMessage.id)
        // Add the actual user message (with real ID) and AI response
        return [...filtered, 
          { ...tempUserMessage, id: response.data.id - 1 }, // User message
          { ...response.data, created_at: tempUserMessage.created_at } // AI response — same timestamp as user
        ]
      })
    } catch (err) {
      console.error('Failed to send message:', err)
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id))
      alert(err.response?.data?.detail || 'Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const handleDeleteChat = async () => {
    if (!window.confirm('Are you sure you want to delete this chat?')) return

    try {
      await deleteChat(chatId)
      navigate('/')
    } catch (err) {
      console.error('Failed to delete chat:', err)
      alert('Failed to delete chat. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="text-primary-600 hover:text-primary-700"
          >
            Go back home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col chat-bg">
      <ChatHeader 
        chat={chat} 
        onDelete={handleDeleteChat} 
        chatMode={chatMode}
        onModeChange={handleModeChange}
      />
      
      <MessageList
        messages={messages}
        isTyping={sending}
        characterName={chat?.character?.name || 'Character'}
        characterAvatar={chat?.character?.avatar_url}
        onSendMessage={handleSendMessage}
      />
      
      <MessageInput
        onSend={handleSendMessage}
        disabled={sending}
        characterName={chat?.character?.name}
        chatMode={chatMode}
        onModeChange={handleModeChange}
      />
    </div>
  )
}

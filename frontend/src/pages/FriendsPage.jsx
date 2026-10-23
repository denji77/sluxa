import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserPlus, Mail, Check, X, Loader2, MessageSquare, Trash2, Clock, Users,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getFriends, getFriendRequests, sendFriendRequest,
  acceptFriendRequest, declineFriendRequest, unfriend,
} from '../api/friends'
import { useToast } from '../components/Toast/ToastProvider'
import ConfirmModal from '../components/Modal/ConfirmModal'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

function initialsOf(user) {
  const name = user.display_name || user.email || '?'
  return name.slice(0, 2).toUpperCase()
}

function FriendAvatar({ user, size = 'w-11 h-11' }) {
  return (
    <div className={`${size} rounded-xl bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-accent)] flex items-center justify-center flex-shrink-0`}>
      <span className="text-white font-bold text-sm">{initialsOf(user)}</span>
    </div>
  )
}

export default function FriendsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [friends, setFriends] = useState([])
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] })
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [confirmUnfriend, setConfirmUnfriend] = useState(null)
  const pollRef = useRef(null)

  const refresh = useCallback(async (initial = false) => {
    try {
      const [friendsRes, requestsRes] = await Promise.all([getFriends(), getFriendRequests()])
      setFriends(friendsRes.data || [])
      setRequests(requestsRes.data || { incoming: [], outgoing: [] })
    } catch (error) {
      if (initial) console.error('Failed to load friends:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh(true)
    pollRef.current = setInterval(refresh, 10000)
    return () => clearInterval(pollRef.current)
  }, [refresh])

  const handleSendRequest = async (e) => {
    e.preventDefault()
    const target = email.trim()
    if (!target || sending) return
    setSending(true)
    try {
      const res = await sendFriendRequest(target)
      if (res.data.status === 'accepted') {
        toast.success(`You and ${res.data.user.display_name} are now friends!`)
      } else {
        toast.success(`Friend request sent to ${target}`)
      }
      setEmail('')
      refresh()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not send friend request.')
    } finally {
      setSending(false)
    }
  }

  const handleAccept = async (request) => {
    try {
      await acceptFriendRequest(request.id)
      toast.success(`You're now friends with ${request.user.display_name}!`)
      refresh()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not accept request.')
    }
  }

  const handleDecline = async (request) => {
    try {
      await declineFriendRequest(request.id)
      refresh()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not remove request.')
    }
  }

  const handleUnfriend = async () => {
    const target = confirmUnfriend
    setConfirmUnfriend(null)
    if (!target) return
    try {
      await unfriend(target.friendship_id)
      toast.success(`Removed ${target.friend.display_name} from friends.`)
      refresh()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not unfriend.')
    }
  }

  return (
    <motion.div
      className="max-w-4xl mx-auto px-4 py-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <h1 className="text-4xl font-bold text-white flex items-center gap-3">
          <div className="relative">
            <Users className="w-10 h-10 text-[var(--theme-primary)]" />
            <div className="absolute inset-0 blur-xl bg-[var(--theme-primary)]/30" />
          </div>
          <span className="gradient-text">Friends</span>
        </h1>
        <p className="text-gray-400 mt-3 text-lg">Add friends by email and chat with them directly</p>
      </motion.div>

      {/* Add friend by email */}
      <motion.form
        variants={itemVariants}
        onSubmit={handleSendRequest}
        className="glass-card rounded-2xl p-4 mb-8 flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[var(--theme-primary)]/50 transition-colors"
          />
        </div>
        <motion.button
          type="submit"
          disabled={sending || !email.trim()}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-accent)] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          Send Request
        </motion.button>
      </motion.form>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-[var(--theme-primary)] animate-spin" />
        </div>
      ) : (
        <>
          {/* Incoming requests */}
          <AnimatePresence>
            {requests.incoming.length > 0 && (
              <motion.section variants={itemVariants} className="mb-8">
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[var(--theme-primary)]" />
                  Friend Requests
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--theme-primary)] text-white">
                    {requests.incoming.length}
                  </span>
                </h2>
                <div className="space-y-2">
                  {requests.incoming.map((req) => (
                    <motion.div
                      key={req.id}
                      layout
                      exit={{ opacity: 0, x: -40 }}
                      className="glass-card rounded-xl p-4 flex items-center gap-4"
                    >
                      <FriendAvatar user={req.user} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{req.user.display_name}</p>
                        <p className="text-gray-500 text-sm truncate">{req.user.email}</p>
                      </div>
                      <motion.button
                        onClick={() => handleAccept(req)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-accent)] text-white text-sm font-medium"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Check className="w-4 h-4" /> Accept
                      </motion.button>
                      <motion.button
                        onClick={() => handleDecline(req)}
                        className="p-2 rounded-xl glass-card text-gray-400 hover:text-red-400 transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title="Decline"
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Outgoing requests */}
          {requests.outgoing.length > 0 && (
            <motion.section variants={itemVariants} className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-400" />
                Sent Requests
              </h2>
              <div className="space-y-2">
                {requests.outgoing.map((req) => (
                  <div key={req.id} className="glass-card rounded-xl p-4 flex items-center gap-4 opacity-80">
                    <FriendAvatar user={req.user} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{req.user.display_name}</p>
                      <p className="text-gray-500 text-sm truncate">{req.user.email} · pending</p>
                    </div>
                    <motion.button
                      onClick={() => handleDecline(req)}
                      className="p-2 rounded-xl glass-card text-gray-400 hover:text-red-400 transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      title="Cancel request"
                    >
                      <X className="w-4 h-4" />
                    </motion.button>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Friends list */}
          <motion.section variants={itemVariants}>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[var(--theme-primary)]" />
              My Friends
              {friends.length > 0 && (
                <span className="text-sm text-gray-500 font-normal">({friends.length})</span>
              )}
            </h2>
            {friends.length === 0 ? (
              <div className="glass-card rounded-2xl p-10 text-center">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No friends yet</p>
                <p className="text-gray-500 text-sm mt-1">
                  Send a request using your friend's email — they'll see it here in the app.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map((f) => (
                  <motion.div
                    key={f.friendship_id}
                    layout
                    onClick={() => navigate(`/friends/${f.friendship_id}`)}
                    className="glass-card rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors group"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <FriendAvatar user={f.friend} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{f.friend.display_name}</p>
                      <p className="text-gray-500 text-sm truncate">
                        {f.last_message
                          ? `${f.last_message.mine ? 'You: ' : ''}${f.last_message.content}`
                          : 'Say hi 👋'}
                      </p>
                    </div>
                    {f.unread_count > 0 && (
                      <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-accent)] text-white text-xs font-bold flex items-center justify-center">
                        {f.unread_count}
                      </span>
                    )}
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmUnfriend(f)
                      }}
                      className="p-2 rounded-xl text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      title="Unfriend"
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.section>
        </>
      )}

      <ConfirmModal
        isOpen={!!confirmUnfriend}
        title={confirmUnfriend ? `Unfriend ${confirmUnfriend.friend.display_name}?` : ''}
        message="This removes your friendship and deletes your chat history with them."
        confirmText="Unfriend"
        onConfirm={handleUnfriend}
        onClose={() => setConfirmUnfriend(null)}
      />
    </motion.div>
  )
}

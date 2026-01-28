import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { motion } from 'framer-motion'
import { ArrowLeft, User, Save, Loader2, Check, Info } from 'lucide-react'
import { getCurrentUser, updateUser } from '../api/client'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user: clerkUser } = useUser()
  const [username, setUsername] = useState('')
  const [originalUsername, setOriginalUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await getCurrentUser()
        const currentUsername = response.data.username || ''
        setUsername(currentUsername)
        setOriginalUsername(currentUsername)
      } catch (err) {
        console.error('Failed to fetch user:', err)
        setError('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [])

  const handleSave = async () => {
    if (!username.trim()) {
      setError('Username cannot be empty')
      return
    }

    if (username === originalUsername) {
      return
    }

    try {
      setSaving(true)
      setError(null)
      await updateUser({ username: username.trim() })
      setOriginalUsername(username.trim())
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Failed to update profile:', err)
      setError(err.response?.data?.detail || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = username !== originalUsername

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <motion.div 
      className="max-w-2xl mx-auto px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <motion.div 
        className="flex items-center gap-4 mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.button
          onClick={() => navigate(-1)}
          className="p-2.5 hover:bg-white/10 rounded-xl transition-colors glass-card"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </motion.button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <div className="relative">
              <User className="w-7 h-7 text-purple-400" />
              <div className="absolute inset-0 blur-lg bg-purple-500/30" />
            </div>
            Profile Settings
          </h1>
          <p className="text-gray-400 mt-1">
            Manage your profile information
          </p>
        </div>
      </motion.div>

      {/* Profile Card */}
      <motion.div
        className="glass-card rounded-2xl p-6 border border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Avatar Section */}
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/10">
          <div className="relative">
            {clerkUser?.imageUrl ? (
              <img 
                src={clerkUser.imageUrl} 
                alt="Profile"
                className="w-20 h-20 rounded-full object-cover ring-4 ring-purple-500/30"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center ring-4 ring-purple-500/30">
                <User className="w-10 h-10 text-white" />
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-xl" />
          </div>
          <div>
            <p className="text-white font-medium text-lg">
              {clerkUser?.primaryEmailAddress?.emailAddress || 'User'}
            </p>
            <p className="text-gray-500 text-sm">
              Manage your display name below
            </p>
          </div>
        </div>

        {/* Username Field */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Display Name (Username)
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your display name"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500
                       focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
            />
          </div>

          {/* Info box */}
          <div className="flex items-start gap-3 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
            <Info className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-300">
              <p className="font-medium text-purple-300 mb-1">Why set a username?</p>
              <p className="text-gray-400">
                Your username will be used when chatting with AI characters. 
                Characters will address you by this name instead of showing "{'{{user}}'}" placeholders.
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <motion.div 
              className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.div>
          )}

          {/* Save Button */}
          <motion.button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium transition-all ${
              hasChanges
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:shadow-purple-500/25'
                : 'bg-white/5 text-gray-500 cursor-not-allowed'
            }`}
            whileHover={hasChanges ? { scale: 1.01 } : {}}
            whileTap={hasChanges ? { scale: 0.99 } : {}}
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>
                <Check className="w-5 h-5 text-green-400" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

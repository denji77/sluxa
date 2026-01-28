import { useEffect, useCallback, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { setAuthToken } from '../api/client'

/**
 * Hook to set up API authentication with Clerk token
 */
export function useApiAuth() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const [isReady, setIsReady] = useState(false)

  const setupAuth = useCallback(async () => {
    if (!isLoaded) return false
    
    if (isSignedIn) {
      try {
        const token = await getToken()
        if (token) {
          setAuthToken(token)
          setIsReady(true)
          return true
        }
      } catch (err) {
        console.error('Failed to get auth token:', err)
      }
    } else {
      setAuthToken(null)
      setIsReady(true)
    }
    return false
  }, [getToken, isSignedIn, isLoaded])

  useEffect(() => {
    setupAuth()
    
    // Refresh token periodically (every 50 seconds since Clerk tokens expire)
    const interval = setInterval(setupAuth, 50000)
    return () => clearInterval(interval)
  }, [setupAuth])

  // Return a function to refresh the token if needed
  return { refreshAuth: setupAuth, isReady: isLoaded && isReady }
}

/**
 * Hook to get auth token for API calls
 */
export function useAuthToken() {
  const { getToken } = useAuth()

  const getAuthToken = useCallback(async () => {
    return await getToken()
  }, [getToken])

  return getAuthToken
}

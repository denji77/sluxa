import { useState, useCallback } from 'react'
import { searchChubCharacters, getChubCharacter, importChubCharacter } from '../api/client'

/**
 * Hook for Chub.ai character search and import
 */
export function useChubCharacters() {
  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [query, setQuery] = useState('')

  const search = useCallback(async (searchQuery, pageNum = 1, excludeNsfw = true) => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await searchChubCharacters(searchQuery, pageNum, excludeNsfw)
      const results = response.data
      
      if (pageNum === 1) {
        setCharacters(results)
      } else {
        setCharacters(prev => [...prev, ...results])
      }
      
      setHasMore(results.length >= 20) // PAGE_SIZE from backend
      setPage(pageNum)
      setQuery(searchQuery)
      
      return results
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to search characters'
      setError(errorMsg)
      console.error('Chub search error:', err)
      throw new Error(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    await search(query, page + 1)
  }, [loading, hasMore, query, page, search])

  const getDetails = useCallback(async (chubId) => {
    try {
      const response = await getChubCharacter(chubId)
      return response.data
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to get character details'
      throw new Error(errorMsg)
    }
  }, [])

  const importCharacter = useCallback(async (chubId) => {
    try {
      const response = await importChubCharacter(chubId)
      return response.data
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to import character'
      throw new Error(errorMsg)
    }
  }, [])

  const reset = useCallback(() => {
    setCharacters([])
    setPage(1)
    setHasMore(true)
    setQuery('')
    setError(null)
  }, [])

  return {
    characters,
    loading,
    error,
    hasMore,
    page,
    query,
    search,
    loadMore,
    getDetails,
    importCharacter,
    reset
  }
}

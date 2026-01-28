import { useState, useEffect, useCallback } from 'react'
import { getCharacters, createCharacter as createCharacterApi } from '../api/client'

/**
 * Hook for managing characters
 */
export function useCharacters() {
  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCharacters = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getCharacters()
      setCharacters(response.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load characters')
      console.error('Error fetching characters:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCharacters()
  }, [fetchCharacters])

  const createCharacter = async (characterData) => {
    try {
      const response = await createCharacterApi(characterData)
      setCharacters(prev => [...prev, response.data])
      return response.data
    } catch (err) {
      throw new Error(err.response?.data?.detail || 'Failed to create character')
    }
  }

  return {
    characters,
    loading,
    error,
    refetch: fetchCharacters,
    createCharacter
  }
}

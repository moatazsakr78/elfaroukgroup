import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase/client'

export interface VoteStats {
  yesVotes: number
  noVotes: number
  totalVotes: number
  yesPercentage: number
  noPercentage: number
  userVote: 'yes' | 'no' | null
}

// Generate a unique user identifier (stored in localStorage)
function getUserIdentifier(): string {
  if (typeof window === 'undefined') return ''

  let identifier = localStorage.getItem('user_vote_id')
  if (!identifier) {
    identifier = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('user_vote_id', identifier)
  }
  return identifier
}

export function useProductVoting(productId: string) {
  const [voteStats, setVoteStats] = useState<VoteStats>({
    yesVotes: 0,
    noVotes: 0,
    totalVotes: 0,
    yesPercentage: 0,
    noPercentage: 0,
    userVote: null
  })
  const [isLoading, setIsLoading] = useState(true)

  // Fetch vote statistics for a product
  const fetchVoteStats = useCallback(async () => {
    try {
      setIsLoading(true)
      const userIdentifier = getUserIdentifier()

      // Get all votes for this product
      const { data: votes, error } = await (supabase as any)
        .from('product_votes')
        .select('vote, user_identifier')
        .eq('product_id', productId)

      if (error) {
        console.error('Error fetching votes:', error)
        return
      }

      // Calculate statistics
      const yesVotes = votes?.filter((v: any) => v.vote === 'yes').length || 0
      const noVotes = votes?.filter((v: any) => v.vote === 'no').length || 0
      const totalVotes = yesVotes + noVotes
      const yesPercentage = totalVotes > 0 ? Math.round((yesVotes / totalVotes) * 100) : 0
      const noPercentage = totalVotes > 0 ? Math.round((noVotes / totalVotes) * 100) : 0

      // Check if user has voted
      const userVoteRecord = votes?.find((v: any) => v.user_identifier === userIdentifier)
      const userVote = userVoteRecord?.vote as 'yes' | 'no' | null || null

      setVoteStats({
        yesVotes,
        noVotes,
        totalVotes,
        yesPercentage,
        noPercentage,
        userVote
      })
    } catch (err) {
      console.error('Error fetching vote stats:', err)
    } finally {
      setIsLoading(false)
    }
  }, [productId])

  // Submit a vote
  const submitVote = useCallback(async (vote: 'yes' | 'no') => {
    try {
      const userIdentifier = getUserIdentifier()

      // Check if user has already voted
      const { data: existingVote } = await (supabase as any)
        .from('product_votes')
        .select('id')
        .eq('product_id', productId)
        .eq('user_identifier', userIdentifier)
        .single()

      if (existingVote) {
        // Update existing vote
        const { error } = await (supabase as any)
          .from('product_votes')
          .update({ vote })
          .eq('id', existingVote.id)

        if (error) throw error
      } else {
        // Insert new vote
        const { error } = await (supabase as any)
          .from('product_votes')
          .insert({
            product_id: productId,
            user_identifier: userIdentifier,
            vote
          })

        if (error) throw error
      }

      // Refresh stats
      await fetchVoteStats()
      return true
    } catch (err) {
      console.error('Error submitting vote:', err)
      return false
    }
  }, [productId, fetchVoteStats])

  // Initial fetch
  useEffect(() => {
    fetchVoteStats()
  }, [fetchVoteStats])

  // Subscribe to vote changes
  useEffect(() => {
    const channel = supabase
      .channel(`product_votes_${productId}`)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'elfaroukgroup',
          table: 'product_votes',
          filter: `product_id=eq.${productId}`
        },
        () => {
          fetchVoteStats()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [productId, fetchVoteStats])

  return {
    voteStats,
    isLoading,
    submitVote,
    refreshStats: fetchVoteStats
  }
}

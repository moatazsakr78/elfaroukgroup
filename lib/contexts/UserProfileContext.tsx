'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/app/lib/supabase/client';
import { useAuth } from '../useAuth';

export interface UserProfile {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  permission_id: string | null; // الصلاحية المعينة للمستخدم
  branch_id: string | null;
  avatar_url: string | null;
  is_active: boolean | null;
  is_admin: boolean;
  email: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface UserProfileContextValue {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  hasProfile: boolean;
  refetch: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextValue | undefined>(undefined);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track the last user ID we fetched to prevent duplicate fetches
  const lastFetchedUserId = useRef<string | null>(null);
  const isFetchingRef = useRef(false);

  const fetchProfile = async (userId: string) => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      // Use API route instead of direct Supabase client
      // This bypasses RLS issues with NextAuth sessions
      const response = await fetch('/api/user/profile');

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Error fetching user profile:', errorData);
        setError(errorData.error || 'Failed to fetch profile');
        setProfile(null);
        lastFetchedUserId.current = null;
        return;
      }

      const { profile } = await response.json();

      if (profile) {
        setProfile(profile as UserProfile);
        lastFetchedUserId.current = userId;
      } else {
        setError('Profile not found');
        setProfile(null);
        lastFetchedUserId.current = null;
      }
    } catch (err) {
      console.error('❌ Error fetching user profile:', err);
      setError('Failed to fetch user profile');
      setProfile(null);
      lastFetchedUserId.current = null;
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    // Clear profile immediately when user logs out
    if (!isAuthenticated || !user) {
      setProfile(null);
      setLoading(false);
      setError(null);
      lastFetchedUserId.current = null;
      return;
    }

    const userId = user.id;

    // Skip if we've already fetched this user
    if (lastFetchedUserId.current === userId) {
      // Data already loaded, set loading to false
      setLoading(false);
      return;
    }

    // Fetch profile when user ID changes
    fetchProfile(userId);
  }, [user?.id, isAuthenticated]);

  const refetch = async () => {
    if (user?.id) {
      lastFetchedUserId.current = null; // Force refetch
      await fetchProfile(user.id);
    }
  };

  const isAdmin = profile ? profile.is_admin === true : false;

  const value: UserProfileContextValue = {
    profile,
    loading,
    error,
    isAdmin,
    hasProfile: !!profile,
    refetch
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
}

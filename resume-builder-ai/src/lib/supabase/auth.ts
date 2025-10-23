/**
 * Supabase Authentication Utilities
 * Provides authentication helpers and user management functions
 */

import { createBrowserClient, createServerClient } from './client'
import { type User } from '@supabase/supabase-js'
import { type Profile, type SubscriptionStatus } from './types'

/**
 * Client-side authentication utilities
 */
export class AuthClient {
  private supabase = createBrowserClient()

  /**
   * Sign up a new user with email and password
   */
  async signUp(email: string, password: string, fullName?: string) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || null
        }
      }
    })

    if (error) {
      throw new Error(`Sign up failed: ${error.message}`)
    }

    return data
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      throw new Error(`Sign in failed: ${error.message}`)
    }

    return data
  }

  /**
   * Sign out the current user
   */
  async signOut() {
    const { error } = await this.supabase.auth.signOut()

    if (error) {
      throw new Error(`Sign out failed: ${error.message}`)
    }
  }

  /**
   * Get the current user
   */
  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await this.supabase.auth.getUser()
    return user
  }

  /**
   * Listen to authentication state changes
   */
  onAuthStateChange(callback: (user: User | null) => void) {
    return this.supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user || null)
    })
  }

  /**
   * Get user profile data
   */
  async getUserProfile(): Promise<Profile | null> {
    const user = await this.getCurrentUser()
    if (!user) return null

    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Error fetching user profile:', error)
      return null
    }

    return data
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<Profile>) {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('No authenticated user')

    const { data, error } = await this.supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id)
      .select()
      .maybeSingle()

    if (error) {
      throw new Error(`Profile update failed: ${error.message}`)
    }

    return data
  }

  /**
   * Get user subscription status
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus | null> {
    const user = await this.getCurrentUser()
    if (!user) return null

    const { data, error } = await this.supabase.rpc('get_user_subscription_status', {
      user_uuid: user.id
    })

    if (error) {
      console.error('Error fetching subscription status:', error)
      return null
    }

    return data as SubscriptionStatus
  }

  /**
   * Check if user can create optimizations
   */
  async canOptimize(): Promise<boolean> {
    const status = await this.getSubscriptionStatus()
    return status?.can_optimize || false
  }
}

/**
 * Server-side authentication utilities
 */
export class AuthServer {
  private supabase = createServerClient()

  /**
   * Get user from server-side request
   */
  async getUserFromRequest(request: Request): Promise<User | null> {
    try {
      const authHeader = request.headers.get('Authorization')
      if (!authHeader) return null

      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await this.supabase.auth.getUser(token)

      return user
    } catch (error) {
      console.error('Error getting user from request:', error)
      return null
    }
  }

  /**
   * Validate user session and get profile
   */
  async validateSession(userId: string): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error validating session:', error)
      return null
    }

    return data
  }

  /**
   * Create user profile (called by database trigger)
   */
  async createProfile(userId: string, userData: Partial<Profile>) {
    const { data, error } = await this.supabase
      .from('profiles')
      .insert({
        user_id: userId,
        ...userData
      })
      .select()
      .maybeSingle()

    if (error) {
      throw new Error(`Profile creation failed: ${error.message}`)
    }

    return data
  }

  /**
   * Upgrade user to premium
   */
  async upgradeToPremium(userId: string): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('upgrade_to_premium', {
      user_uuid: userId
    })

    if (error) {
      throw new Error(`Premium upgrade failed: ${error.message}`)
    }

    return data
  }

  /**
   * Check subscription limits
   */
  async checkSubscriptionLimit(userId: string): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('check_subscription_limit', {
      user_uuid: userId
    })

    if (error) {
      throw new Error(`Subscription check failed: ${error.message}`)
    }

    return data
  }
}

// Export singleton instances
export const authClient = new AuthClient()
export const authServer = new AuthServer()

/**
 * Utility function to require authentication
 * Use in API routes and server actions
 */
export async function requireAuth(request: Request): Promise<User> {
  const user = await authServer.getUserFromRequest(request)

  if (!user) {
    throw new Error('Authentication required')
  }

  return user
}

/**
 * Utility function to require specific subscription tier
 */
export async function requireSubscription(
  userId: string,
  tier: 'free' | 'premium' = 'free'
): Promise<Profile> {
  const profile = await authServer.validateSession(userId)

  if (!profile) {
    throw new Error('Invalid user session')
  }

  if (tier === 'premium' && profile.subscription_tier !== 'premium') {
    throw new Error('Premium subscription required')
  }

  return profile
}
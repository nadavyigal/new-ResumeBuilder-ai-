"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { createClientComponentClient } from "@/lib/supabase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error?: Error | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Create client in useEffect to ensure it only runs in browser
    let supabase: ReturnType<typeof createClientComponentClient>;

    try {
      supabase = createClientComponentClient();
    } catch (err) {
      setError(err as Error);
      setLoading(false);
      console.error('Failed to initialize Supabase client:', err);
      return;
    }

    const getUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        setLoading(false);
      } catch (err) {
        setError(err as Error);
        setLoading(false);
        console.error('Failed to get user session:', err);
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // If there's an error initializing auth, still render children but log the error
  // This prevents the entire app from crashing
  if (error) {
    console.error('Auth initialization error:', error);
  }

  return (
    <AuthContext.Provider value={{ user, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}
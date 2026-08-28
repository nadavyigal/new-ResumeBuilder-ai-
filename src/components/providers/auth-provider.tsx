"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { createClientComponentClient } from "@/lib/supabase";
import { posthog } from "@/lib/posthog";
import { resolveInternalTester } from "@/lib/internal-tester";

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
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
  const supabase = createClientComponentClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user ?? null);
      setLoading(false);

      if (user) {
        posthog.identify(user.id, {
          email: user.email,
          is_internal_tester: resolveInternalTester(user.email),
        });
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const nextUser = session?.user ?? null;
        setUser(nextUser);
        setLoading(false);

        if (nextUser && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
          posthog.identify(nextUser.id, {
            email: nextUser.email,
            is_internal_tester: resolveInternalTester(nextUser.email),
          });
        } else if (event === "SIGNED_OUT") {
          posthog.reset();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
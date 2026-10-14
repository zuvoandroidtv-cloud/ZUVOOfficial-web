import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase/client';

export type RoleName = 'super_admin' | 'admin' | 'sales' | 'inventory' | 'service' | 'support' | 'technician' | 'dealer';
export type UserRole = RoleName;

export interface UserProfile {
  id: string;
  role_id: string | null;
  role_name: RoleName;
  dealer_id: string | null;
  full_name: string | null;
  employee_code: string | null;
  phone: string | null;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: RoleName | null;
  currentRole: RoleName;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any; data?: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAllowed: (allowedRoles: RoleName[]) => boolean;
  // Role matrix simulation override for authenticated users
  testRoleOverride: RoleName | null;
  setTestRoleOverride: (role: RoleName | null) => void;
  bootstrapRootAdmin: (targetEmail: string) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [testRoleOverride, setTestRoleOverride] = useState<RoleName | null>(null);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          role_id,
          dealer_id,
          full_name,
          employee_code,
          phone,
          is_active,
          roles:role_id (
            name
          )
        `)
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.warn('Profile not found or error loading:', error);
        setProfile({
          id: userId,
          role_id: null,
          role_name: 'support',
          dealer_id: null,
          full_name: 'CRM User',
          employee_code: null,
          phone: null,
          is_active: true,
        });
        return;
      }

      const roleName = ((data.roles as any)?.name as RoleName) || 'support';
      setProfile({
        id: data.id,
        role_id: data.role_id,
        role_name: roleName,
        dealer_id: (data as any).dealer_id || null,
        full_name: data.full_name,
        employee_code: data.employee_code,
        phone: data.phone,
        is_active: data.is_active,
      });
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setIsLoading(false));
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await supabase.auth.signInWithPassword({ email, password });
    if (res.data.session) {
      setSession(res.data.session);
      setUser(res.data.user);
      if (res.data.user) await fetchProfile(res.data.user.id);
    }
    return { error: res.error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const res = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    return { error: res.error, data: res.data };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setTestRoleOverride(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const effectiveRole: RoleName | null = useMemo(() => {
    if (!session) return null;
    if (testRoleOverride) return testRoleOverride;
    if (profile?.role_name) return profile.role_name;
    return null;
  }, [testRoleOverride, profile, session]);

  const isAllowed = (allowedRoles: RoleName[]) => {
    if (!effectiveRole) return false;
    if (effectiveRole === 'super_admin') return true;
    return allowedRoles.includes(effectiveRole);
  };

  const bootstrapRootAdmin = async (targetEmail: string) => {
    const { data, error } = await supabase.rpc('bootstrap_super_admin', {
      target_email: targetEmail,
    });
    if (error) throw error;
    await refreshProfile();
    return data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role: effectiveRole,
        currentRole: effectiveRole || 'support',
        isLoading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        isAllowed,
        testRoleOverride,
        setTestRoleOverride,
        bootstrapRootAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

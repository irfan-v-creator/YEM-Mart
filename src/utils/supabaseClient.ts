import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { CustomerUser } from '../types';

let cachedClient: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;

// Helper to defensively ensure valid lowercase 'sb_publishable_' prefix
function normalizeSupabaseKey(key: string): string {
  const trimmed = (key || '').trim();
  if (trimmed.startsWith('Sb_')) {
    return 's' + trimmed.slice(1);
  }
  return trimmed;
}

// Primary source: Vite defines (injected at build/dev from process.env)
const viteUrl = (import.meta.env?.VITE_SUPABASE_URL || '').trim();
const viteAnon = normalizeSupabaseKey(import.meta.env?.VITE_SUPABASE_ANON_KEY || '');

export async function getClientSupabase(): Promise<SupabaseClient | null> {
  if (cachedClient) return cachedClient;

  let url = viteUrl;
  let anonKey = viteAnon;

  // Direct environment fallback in Node/SSR/testing environments
  if ((!url || !anonKey) && typeof process !== 'undefined' && process.env) {
    url = url || (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
    const rawKey = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
    anonKey = anonKey || normalizeSupabaseKey(rawKey);
  }

  // Runtime fallback if Vite defines are empty
  if (!url || !anonKey) {
    if (!initPromise) {
      initPromise = (async () => {
        try {
          const endpoint = typeof window !== 'undefined' ? '/api/customer/config' : 'http://localhost:3000/api/customer/config';
          const res = await fetch(endpoint);
          if (res.ok) {
            const data = await res.json();
            if (data.supabaseUrl && data.supabaseAnonKey) {
              const cleanKey = normalizeSupabaseKey(data.supabaseAnonKey);
              return createClient(data.supabaseUrl, cleanKey, {
                auth: {
                  persistSession: true,
                  autoRefreshToken: true,
                  detectSessionInUrl: true,
                  storageKey: 'yem_customer_auth_token',
                },
              });
            }
          }
        } catch (e) {
          console.warn('Could not fetch Supabase client config from server:', e);
        }
        return null;
      })();
    }
    const client = await initPromise;
    if (client) cachedClient = client;
    return cachedClient;
  }

  cachedClient = createClient(url, normalizeSupabaseKey(anonKey), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'yem_customer_auth_token',
    },
  });

  return cachedClient;
}

// Synchronous getter for quick initial subscription / access
export function getClientSupabaseSync(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  if (viteUrl && viteAnon) {
    cachedClient = createClient(viteUrl, normalizeSupabaseKey(viteAnon), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'yem_customer_auth_token',
      },
    });
    return cachedClient;
  }
  return null;
}

export async function getCustomerAuthToken(): Promise<string | null> {
  const client = await getClientSupabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token || null;
}

export function formatCustomerUser(user: User | null): CustomerUser | null {
  if (!user) return null;
  const meta = user.user_metadata || {};
  return {
    id: user.id,
    email: user.email || '',
    fullName: meta.full_name || meta.name || user.email?.split('@')[0] || 'Customer',
    phone: meta.phone || user.phone || '',
  };
}

export async function getCurrentCustomer(): Promise<CustomerUser | null> {
  const client = await getClientSupabase();
  if (!client) return null;
  const { data: { user } } = await client.auth.getUser();
  return formatCustomerUser(user);
}

export async function signUpCustomer(params: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}): Promise<{ user: CustomerUser | null; session: Session | null; error?: string }> {
  const client = await getClientSupabase();
  if (!client) {
    return { user: null, session: null, error: 'Authentication service is currently unavailable. Please try again.' };
  }

  const { data, error } = await client.auth.signUp({
    email: params.email.trim().toLowerCase(),
    password: params.password,
    options: {
      data: {
        full_name: params.fullName.trim(),
        name: params.fullName.trim(),
        phone: params.phone?.trim() || '',
      },
    },
  });

  if (error) {
    let msg = error.message;
    const lower = msg.toLowerCase();
    if (lower.includes('already registered') || lower.includes('already exists')) {
      msg = 'An account with this email address already exists. Please sign in.';
    } else if (lower.includes('rate limit') || lower.includes('too many requests') || (error as any).status === 429) {
      msg = 'Too many registration requests. Please wait a few moments before trying again.';
    }
    return { user: null, session: null, error: msg };
  }

  return {
    user: formatCustomerUser(data.user),
    session: data.session,
  };
}

export async function signInCustomer(params: {
  email: string;
  password: string;
}): Promise<{ user: CustomerUser | null; session: Session | null; error?: string }> {
  const client = await getClientSupabase();
  if (!client) {
    return { user: null, session: null, error: 'Authentication service is currently unavailable. Please try again.' };
  }

  const { data, error } = await client.auth.signInWithPassword({
    email: params.email.trim().toLowerCase(),
    password: params.password,
  });

  if (error) {
    let msg = error.message;
    const lower = msg.toLowerCase();
    if (lower.includes('invalid login credentials')) {
      msg = 'Invalid email address or password. Please verify your credentials.';
    } else if (lower.includes('email not confirmed')) {
      msg = 'Email address not confirmed. Please verify your email or disable "Confirm email" in Supabase Auth settings to allow direct sign-in.';
    } else if (lower.includes('rate limit') || lower.includes('too many requests') || (error as any).status === 429) {
      msg = 'Too many sign-in attempts. Please wait a few moments before trying again.';
    }
    return { user: null, session: null, error: msg };
  }

  return {
    user: formatCustomerUser(data.user),
    session: data.session,
  };
}

export async function signOutCustomer(): Promise<{ success: boolean; error?: string }> {
  const client = await getClientSupabase();
  if (!client) return { success: true };
  const { error } = await client.auth.signOut();
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function resetCustomerPassword(email: string): Promise<{ success: boolean; error?: string }> {
  const client = await getClientSupabase();
  if (!client) {
    return { success: false, error: 'Authentication service is currently unavailable.' };
  }
  const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : 'https://yemmart.vercel.app/';
  const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: redirectUrl,
  });
  if (error) {
    let msg = error.message;
    const lower = msg.toLowerCase();
    if (lower.includes('rate limit') || lower.includes('too many requests') || (error as any).status === 429) {
      msg = 'Too many password reset requests. Please wait a few moments before trying again.';
    }
    return { success: false, error: msg };
  }
  return { success: true };
}

export async function updateCustomerPassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
  const client = await getClientSupabase();
  if (!client) {
    return { success: false, error: 'Authentication service is currently unavailable.' };
  }
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) {
    let msg = error.message;
    const lower = msg.toLowerCase();
    if (lower.includes('session') || lower.includes('expired') || lower.includes('invalid')) {
      msg = 'Your password recovery link is invalid or has expired. Please request a new reset email.';
    } else if (lower.includes('rate limit') || lower.includes('too many requests') || (error as any).status === 429) {
      msg = 'Too many password update attempts. Please wait a moment before trying again.';
    }
    return { success: false, error: msg };
  }
  return { success: true };
}

export function subscribeToPasswordRecovery(callback: () => void): () => void {
  let isSubscribed = true;
  let unsubscribeFn: (() => void) | null = null;

  const setupListener = (client: SupabaseClient) => {
    if (!isSubscribed) return;
    const { data: sub } = client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        callback();
      }
    });
    unsubscribeFn = () => sub.subscription.unsubscribe();
  };

  const client = getClientSupabaseSync();
  if (client) {
    setupListener(client);
  } else {
    getClientSupabase().then((c) => {
      if (c && isSubscribed) setupListener(c);
    });
  }

  // Check if initial URL hash contains type=recovery
  if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
    setTimeout(() => {
      if (isSubscribed) callback();
    }, 200);
  }

  return () => {
    isSubscribed = false;
    if (unsubscribeFn) unsubscribeFn();
  };
}

export function subscribeToCustomerAuth(callback: (user: CustomerUser | null) => void): () => void {
  const client = getClientSupabaseSync();
  if (!client) {
    // If not ready synchronously, schedule async initialization
    getClientSupabase().then((c) => {
      if (c) {
        c.auth.getUser().then(({ data }) => callback(formatCustomerUser(data.user)));
        const { data: sub } = c.auth.onAuthStateChange((_event, session) => {
          callback(formatCustomerUser(session?.user || null));
        });
        return () => sub.subscription.unsubscribe();
      }
    });
    return () => {};
  }

  // Initial check
  client.auth.getUser().then(({ data }) => callback(formatCustomerUser(data.user)));

  const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
    callback(formatCustomerUser(session?.user || null));
  });

  return () => {
    sub.subscription.unsubscribe();
  };
}


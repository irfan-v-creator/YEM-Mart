import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { CustomerUser } from '../types';

let cachedClient: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;

// Primary source: Vite defines (injected at build/dev from process.env)
const viteUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const viteAnon = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export async function getClientSupabase(): Promise<SupabaseClient | null> {
  if (cachedClient) return cachedClient;

  let url = viteUrl;
  let anonKey = viteAnon;

  // Runtime fallback if Vite defines are empty
  if (!url || !anonKey) {
    if (!initPromise) {
      initPromise = (async () => {
        try {
          const res = await fetch('/api/customer/config');
          if (res.ok) {
            const data = await res.json();
            if (data.supabaseUrl && data.supabaseAnonKey) {
              return createClient(data.supabaseUrl, data.supabaseAnonKey, {
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

  cachedClient = createClient(url, anonKey, {
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
    cachedClient = createClient(viteUrl, viteAnon, {
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
    return { user: null, session: null, error: 'Supabase client is not available.' };
  }

  const { data, error } = await client.auth.signUp({
    email: params.email.trim().toLowerCase(),
    password: params.password,
    options: {
      data: {
        full_name: params.fullName.trim(),
        phone: params.phone?.trim() || '',
      },
    },
  });

  if (error) {
    return { user: null, session: null, error: error.message };
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
    return { user: null, session: null, error: 'Supabase client is not available.' };
  }

  const { data, error } = await client.auth.signInWithPassword({
    email: params.email.trim().toLowerCase(),
    password: params.password,
  });

  if (error) {
    let msg = error.message;
    if (msg.toLowerCase().includes('invalid login credentials')) {
      msg = 'Invalid email or password. Please verify your details.';
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
    return { success: false, error: 'Supabase client is not available.' };
  }
  const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
  const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: redirectUrl,
  });
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
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

import webpush from 'web-push';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare const process: {
  env: Record<string, string | undefined>;
};

export interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
}

export function getServerEnv(name: string): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  return process.env[name];
}

export function getHeaderValue(req: ApiRequest, headerName: string): string | undefined {
  const lower = headerName.toLowerCase();
  for (const [k, v] of Object.entries(req.headers)) {
    if (k.toLowerCase() === lower) {
      return Array.isArray(v) ? v[0] : v;
    }
  }
  return undefined;
}

export function parseJsonBody<T = Record<string, unknown>>(req: ApiRequest): T {
  if (!req.body) return {} as T;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as T;
    } catch {
      return {} as T;
    }
  }
  return req.body as T;
}

export function verifyCronOrApiSecret(req: ApiRequest): boolean {
  const expected = getServerEnv('CRON_SECRET');
  if (!expected) return false;
  const auth = getHeaderValue(req, 'authorization');
  const cronHeader = getHeaderValue(req, 'x-cron-secret');
  return auth === `Bearer ${expected}` || cronHeader === expected;
}

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = getServerEnv('SUPABASE_URL') || getServerEnv('VITE_SUPABASE_URL');
  const serviceKey = getServerEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function configureVapid(): { configured: boolean; publicKey?: string; error?: string } {
  const publicKey = getServerEnv('VAPID_PUBLIC_KEY') || getServerEnv('VITE_VAPID_PUBLIC_KEY');
  const privateKey = getServerEnv('VAPID_PRIVATE_KEY');
  const subject = getServerEnv('VAPID_SUBJECT') || 'mailto:soporte@oliviacafe.pe';

  if (!publicKey || !privateKey) {
    return {
      configured: false,
      error: 'Faltan VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en las variables de entorno del servidor.',
    };
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return { configured: true, publicKey };
}

export { webpush };

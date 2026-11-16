import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Negocio } from '@/src/types/database';
import { AITAMA_DEFAULT_NEGOCIO, getSupabaseClient } from '@/src/shared/lib/supabase';

const NEGOCIO_OVERRIDE_KEY = 'olivia_negocio_override_v1';

interface ThemeContextValue {
  negocio: Negocio;
  loading: boolean;
  error: string | null;
  refreshTheme: (slug?: string) => Promise<void>;
  setNegocioOverride: (updates: Partial<Negocio>) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  negocio: AITAMA_DEFAULT_NEGOCIO,
  loading: false,
  error: null,
  refreshTheme: async () => {},
  setNegocioOverride: () => {},
});

interface ThemeProviderProps {
  negocioSlug?: string;
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  negocioSlug = 'olivia',
  children,
}) => {
  const [negocio, setNegocio] = useState<Negocio>(() => {
    try {
      const saved = localStorage.getItem(NEGOCIO_OVERRIDE_KEY);
      if (saved) {
        return { ...AITAMA_DEFAULT_NEGOCIO, ...(JSON.parse(saved) as Partial<Negocio>) };
      }
    } catch {
      // Ignore storage errors
    }
    return AITAMA_DEFAULT_NEGOCIO;
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const applyCssTokens = (biz: Negocio) => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', biz.color_primario || '#0F4C45');
    root.style.setProperty('--brand-secondary', biz.color_secundario || '#F2B632');
    root.style.setProperty('--brand-tertiary', biz.color_terciario || '#DCE3DE');
    root.style.setProperty('--brand-neutral', biz.color_neutro || '#14201E');
  };

  const setNegocioOverride = (updates: Partial<Negocio>) => {
    setNegocio((prev) => {
      const next = { ...prev, ...updates };
      applyCssTokens(next);
      try {
        localStorage.setItem(NEGOCIO_OVERRIDE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const refreshTheme = async (slugToLoad = negocioSlug) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      applyCssTokens(negocio);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('negocios')
        .select('*')
        .eq('slug', slugToLoad)
        .eq('activo', true)
        .maybeSingle();

      if (queryError) throw queryError;
      if (data) {
        const loaded = data as Negocio;
        setNegocio(loaded);
        applyCssTokens(loaded);
      } else {
        setNegocio(AITAMA_DEFAULT_NEGOCIO);
        applyCssTokens(AITAMA_DEFAULT_NEGOCIO);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la configuración del negocio.');
      applyCssTokens(AITAMA_DEFAULT_NEGOCIO);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    applyCssTokens(negocio);
    void refreshTheme(negocioSlug);
  }, [negocioSlug]);

  return (
    <ThemeContext.Provider value={{ negocio, loading, error, refreshTheme, setNegocioOverride }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  return useContext(ThemeContext);
}

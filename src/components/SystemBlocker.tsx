'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ShieldAlert, Loader2 } from 'lucide-react';

export function SystemBlocker() {
  const pathname = usePathname();
  const [isBlocked, setIsBlocked] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (pathname === '/dashboard/system-override-999') {
      setIsBlocked(false);
      return;
    }
    const checkStatus = async () => {
      const { data, error } = await supabase
        .from('global_settings')
        .select('system_active, block_message')
        .eq('id', 1)
        .single();
      
      if (!error && data) {
        setIsBlocked(!data.system_active);
        setMessage(data.block_message || 'El sistema se encuentra en mantenimiento programado. Por favor, intenta más tarde.');
      } else {
        // If table doesn't exist yet or error, assume active to avoid false blocks
        setIsBlocked(false);
      }
    };

    checkStatus();

    // 2. Realtime subscription for instant kill-switch
    const channel = supabase
      .channel('global-kill-switch')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'global_settings', filter: 'id=eq.1' },
        (payload) => {
          setIsBlocked(!payload.new.system_active);
          if (payload.new.block_message) {
            setMessage(payload.new.block_message);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (isBlocked === null) return null; // Loading state (silent)
  if (!isBlocked) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
      <div className="max-w-md w-full">
        <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
          <ShieldAlert className="w-12 h-12 text-red-500" />
        </div>
        
        <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">
          Servicio Temporalmente Suspendido
        </h1>
        
        <div className="bg-gray-50 border border-gray-100 p-6 rounded-2xl mb-8">
          <p className="text-gray-600 font-medium leading-relaxed">
            {message}
          </p>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm font-bold uppercase tracking-widest">
            <Loader2 className="w-4 h-4 animate-spin" /> Intentando reconectar...
          </div>
          <p className="text-xs text-gray-400 mt-4 italic">
            Clásicos Sushi & Street Food - Plataforma de Gestión
          </p>
        </div>
      </div>
    </div>
  );
}

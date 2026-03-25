'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import { Utensils, CheckCircle2, ChevronRight, Clock } from 'lucide-react';

export function ActiveOrderWidget() {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Ocultar si ya estamos en la página de tracking
  const isTrackingPage = pathname?.includes('/checkout/success');

  useEffect(() => {
    // 1. Revisamos si hay un pedido activo pendiente de entrega
    const savedId = localStorage.getItem('activeOrderId');
    if (!savedId) return;

    setOrderId(savedId);

    // 2. Traer el estado inicial
    const checkStatus = async () => {
      const { data } = await supabase.from('orders').select('status').eq('id', savedId).single();
      if (data) {
        if (data.status === 'delivered' || data.status === 'cancelled') {
           localStorage.removeItem('activeOrderId');
           setOrderId(null);
        } else {
           setOrderStatus(data.status);
        }
      } else {
        localStorage.removeItem('activeOrderId');
      }
    };
    checkStatus();

    // 3. Suscribirse a cambios en tiempo real desde CUALQUIER OTRA VISTA
    const channel = supabase.channel(`widget-${savedId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${savedId}` }, (payload) => {
         const newStatus = payload.new.status;
         if (newStatus === 'delivered' || newStatus === 'cancelled') {
            localStorage.removeItem('activeOrderId');
            setOrderId(null);
         } else {
            setOrderStatus(newStatus);
         }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (!orderId || !orderStatus || isTrackingPage) return null;

  return (
    <div 
      onClick={() => router.push(`/checkout/success?orderId=${orderId}`)}
      className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white rounded-2xl shadow-2xl p-4 pr-3 flex items-center gap-4 cursor-pointer hover:scale-105 transition-all animate-in slide-in-from-bottom-5 border-2 border-gray-800 hover:border-pink-500/50"
    >
      <div className="relative flex-shrink-0">
        <div className="absolute inset-0 bg-pink-500 rounded-full animate-ping opacity-30"></div>
        <div className="bg-pink-500 w-12 h-12 rounded-full flex items-center justify-center relative z-10 shadow-lg">
           {orderStatus === 'ready' ? <CheckCircle2 className="text-white w-6 h-6" /> : orderStatus === 'preparing' ? <Clock className="text-white w-6 h-6" /> : <Utensils className="text-white w-6 h-6" />}
        </div>
      </div>
      <div>
        <p className="font-bold text-[13px] leading-tight text-pink-400 uppercase tracking-widest mb-0.5">
          {orderStatus === 'pending' ? 'Confirmando...' : orderStatus === 'preparing' ? 'Preparando' : '¡Listo!'}
        </p>
        <p className="text-xs font-medium text-gray-300">Tracking de Pedido #{orderId}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-500 ml-1" />
    </div>
  );
}

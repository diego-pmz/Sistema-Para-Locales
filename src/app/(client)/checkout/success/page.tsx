'use client';

import { Suspense, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, Utensils } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [order, setOrder] = useState<any>(null);
  const [targetTime, setTargetTime] = useState<number | null>(null);
  const [remainingMinutes, setRemainingMinutes] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Fetch Initial Order
  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      const { data } = await supabase.from('orders').select('*').eq('id', orderId).single();
      if (data) {
        setOrder(data);
        extractTime(data);
      }
      setLoading(false);
    };
    fetchOrder();

    // 2. Subscribe to Realtime Changes
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => {
          setOrder(payload.new);
          extractTime(payload.new);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  // Extract Time metadata
  const extractTime = (orderData: any) => {
    if (orderData.status === 'preparing' && orderData.items) {
      const meta = orderData.items.find((i: any) => i._isMetadata);
      if (meta && meta.targetTime) {
         setTargetTime(meta.targetTime);
      }
    } else {
      setTargetTime(null);
    }
  };

  // Timer Countdown Logic
  useEffect(() => {
    if (!targetTime) {
      setRemainingMinutes(null);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diffMs = Math.max(0, targetTime - now);
      const mins = Math.ceil(diffMs / 60000);
      setRemainingMinutes(mins);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [targetTime]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 text-pink-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-gray-700">Cargando tu pedido...</h2>
      </div>
    );
  }

  // Fallback genérico si no hay orderId (comportamiento antiguo)
  if (!order || !orderId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 max-w-sm w-full flex flex-col items-center">
           <CheckCircle2 className="w-20 h-20 text-green-500 mb-6" />
           <h1 className="text-2xl font-black text-gray-900 mb-2">¡Pedido Exitoso!</h1>
           <p className="text-gray-500 mb-8 font-medium">Hemos recibido tu pedido. Te contactaremos por WhatsApp.</p>
           <Button onClick={() => router.push('/')} className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold h-14 text-lg rounded-xl">Volver al Menú</Button>
        </div>
      </div>
    );
  }

  const isDelivery = order.items?.find((i:any) => i._isDeliveryMetadata)?.method === 'delivery';
  const isDelayed = order.items?.find((i:any) => i._isMetadata)?.isDelayed;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 max-w-sm w-full relative overflow-hidden">
        
        <div className="text-center mb-6">
           <h1 className="text-2xl font-black text-gray-900 mb-1 tracking-tight">Pedido #{order.id}</h1>
           <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{order.branch_name}</p>
        </div>

        {/* TRACKER STATES */}
        
        {/* 1. PENDING */}
        {order.status === 'pending' && (
          <div className="bg-orange-50 border border-orange-100 p-6 rounded-2xl w-full mb-6 flex flex-col items-center animate-in zoom-in-95 duration-500">
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
            <h3 className="font-black text-orange-950 text-lg mb-1">Cajero Confirmando...</h3>
            <p className="text-sm text-orange-800/80 text-center font-medium leading-snug">
              Estamos revisando tu pedido para asignarle un tiempo exacto en cocina. No cierres esta ventana.
            </p>
          </div>
        )}

        {/* 2. PREPARING */}
        {order.status === 'preparing' && remainingMinutes !== null && (
          <div className="bg-pink-50 border border-pink-100 p-8 rounded-2xl w-full mb-6 flex flex-col items-center animate-in spin-in-1 duration-500 zoom-in-95">
            <div className="relative mb-5 flex justify-center items-center">
              <div className="absolute inset-0 bg-pink-300 rounded-full animate-ping opacity-30 scale-150"></div>
              <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center border-4 border-pink-100 shadow-sm relative z-10">
                <Utensils className="w-8 h-8 text-pink-500" />
              </div>
            </div>
            
            <h3 className="font-black text-pink-950 text-xl mb-1 text-center">¡Manos a la obra!</h3>
            
            {isDelayed ? (
              <p className="text-red-700/90 text-sm font-bold text-center mb-5 bg-red-50 p-3 rounded-lg border border-red-200">
                ¡Mil disculpas! Tuvimos una alta demanda de golpe. Prometemos no extenderlo de nuevo. Estará {isDelivery ? 'llegando a tu puerta' : 'listo para retiro'} en:
              </p>
            ) : (
              <p className="text-pink-800/80 text-sm font-medium text-center mb-5">
                Tu pedido está en cocina. Estará {isDelivery ? 'llegando a tu puerta' : 'listo para retiro'} en exactamente:
              </p>
            )}
            
            <div className="bg-white py-4 px-8 rounded-2xl inline-flex flex-col items-center border-2 border-pink-200 shadow-sm min-w-[140px]">
               <span className="text-[52px] font-black text-pink-600 block leading-none tabular-nums animate-pulse">{remainingMinutes}</span>
               <span className="text-[11px] font-black text-pink-400 uppercase tracking-widest block mt-2">Minutos</span>
            </div>
          </div>
        )}

        {/* 3. READY or DELIVERED */}
        {(order.status === 'ready' || order.status === 'delivered') && (
          <div className="bg-green-50 border border-green-100 p-8 rounded-2xl w-full mb-6 flex flex-col items-center animate-in zoom-in-95 duration-500">
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
            <h3 className="font-black text-green-950 text-xl mb-1 text-center">
              {order.status === 'ready' ? '¡Está listo!' : '¡Entregado!'}
            </h3>
            <p className="text-green-800/80 text-sm font-medium text-center">
               {order.status === 'ready' ? (isDelivery ? 'Tu repartidor ya va en camino.' : 'Tu pedido ya te espera calientito en el local.') : 'Gracias por elegir Clásicos. ¡A disfrutar!'}
            </p>
          </div>
        )}

        {/* CANCELLED */}
        {order.status === 'cancelled' && (
          <div className="bg-red-50 border border-red-100 p-6 rounded-2xl w-full mb-6 flex flex-col items-center">
            <h3 className="font-black text-red-950 text-lg mb-1 text-center">Pedido Rechazado</h3>
            <p className="text-red-800/80 text-sm font-medium text-center">
               Lo sentimos, el local no pudo aceptar tu pedido en este momento. Te contactaremos.
            </p>
          </div>
        )}

        <Button 
          onClick={() => router.push('/')} 
          className="w-full bg-gray-900 hover:bg-black text-white font-bold h-14 text-[16px] rounded-xl transition-all active:scale-95 mt-2"
        >
          {order.status === 'pending' || order.status === 'preparing' ? 'Ver Menú Principal' : 'Hacer Nuevo Pedido'}
        </Button>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-pink-500"/></div>}>
      <SuccessContent />
    </Suspense>
  );
}

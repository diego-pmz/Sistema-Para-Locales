'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Printer, CheckCircle2, XCircle, Clock, Check, RefreshCcw, BellRing, AlertTriangle, Plus, Minus, Truck, Store, Bluetooth } from 'lucide-react';
import { ESCPOSPrinter } from '@/lib/printer';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useAdminStore } from '@/lib/store';

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  productId: string;
}

interface Order {
  id: number;
  created_at: string;
  customer_name: string;
  branch_name: string;
  items: OrderItem[];
  total: number;
  status: string; // 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
  notes?: string;
  payment?: { method: string, isPaidOnline: boolean };
}

// COMPONENTE: Temporizador Visual para Órdenes en Preparación
const OrderTimer = ({ targetTime, onExpire }: { targetTime: number, onExpire: () => void }) => {
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, targetTime - Date.now()));
  const hasExpired = useRef(false);

  useEffect(() => {
    // Reset expiration flag if the target time receives an extension into the future
    if (targetTime - Date.now() > 0) {
      hasExpired.current = false;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, targetTime - Date.now());
      setTimeLeft(remaining);
      
      if (remaining === 0 && !hasExpired.current) {
        hasExpired.current = true;
        onExpire(); // Llamar callback cuando expira (para el Ding y auto-abrir modal)
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [targetTime, onExpire]);

  if (timeLeft === 0) {
    return (
      <span className="text-red-600 font-bold animate-pulse flex items-center gap-1">
        <AlertTriangle size={14} /> TIEMPO CUMPLIDO
      </span>
    );
  }

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  return (
    <span className={`font-bold font-mono ${minutes < 5 ? 'text-orange-500' : 'text-blue-600'} flex items-center gap-1`}>
      <Clock size={14} /> {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')} min
    </span>
  );
};

export default function OrderManagerPage() {
  const { activeBranch } = useAdminStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdatingState, setIsUpdatingState] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  
  const [restaurantOpen, setRestaurantOpen] = useState(true); 
  const restaurantOpenRef = useRef(restaurantOpen);
  const [activeTab, setActiveTab] = useState('pending');

  // ESTADOS NUEVOS: Modal de Ingreso y Audio
  const [activeIncomingOrder, setActiveIncomingOrder] = useState<Order | null>(null);
  const [isIncomingModalOpen, setIsIncomingModalOpen] = useState(false);
  const [selectedPrepTime, setSelectedPrepTime] = useState<number>(30);
  const [audioError, setAudioError] = useState(false);

  // REFERENCIAS DE AUDIO Y ESTADO DE SILENCIO TEMPORAL
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
  const readyAudioRef = useRef<HTMLAudioElement | null>(null);
  const isSilencedRef = useRef(false); // Para preveir re-encendido de alarmas al aceptar pedidos

  // Inicialización de Audios (Se hace en un useEffect para montaje en cliente)
  useEffect(() => {
    // Alarma: Loop continuo para pedidos nuevos
    alarmAudioRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
    alarmAudioRef.current.loop = true;
    
    // Timbre: Ring rápido para cuando algo está listo
    readyAudioRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/dinner_bell_triangle.ogg');
  }, []);

  const playReadySound = () => {
    if (readyAudioRef.current) {
      readyAudioRef.current.currentTime = 0;
      readyAudioRef.current.play().catch(e => console.error("No se pudo reproducir el timbre", e));
    }
  };

  const playAlarm = () => {
    if (isSilencedRef.current) return;
    
    if (alarmAudioRef.current && alarmAudioRef.current.paused) {
      setAudioError(false);
      const playPromise = alarmAudioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.warn('Auto-play blocked by browser. User interaction needed.', e);
          setAudioError(true);
        });
      }
    }
  };

  const stopAlarm = () => {
    isSilencedRef.current = true; // Bloquea futuros encendidos automáticos por si acaso

    if (alarmAudioRef.current) {
      alarmAudioRef.current.pause();
      alarmAudioRef.current.currentTime = 0;
    }

    // Permite que la alarma vuelva a activarse en el futuro
    setTimeout(() => {
      isSilencedRef.current = false;
    }, 2000); 
  };

  // FETCH DE ÓRDENES
  const fetchOrders = async () => {
    if (!activeBranch) return;
    setLoading(true);
    let query = supabase
      .from('orders')
      .select('*')
      .eq('branch_name', activeBranch)
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (!error && data) {
      setOrders(data as Order[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!activeBranch) return;

    fetchOrders();

    const filterOptions = { event: 'INSERT', schema: 'public', table: 'orders', filter: `branch_name=eq.${activeBranch}` };

    const channel = supabase
      .channel(`realtime-orders-${activeBranch}`)
      .on('postgres_changes', filterOptions as any, (payload) => {
        console.log("🔔 Realtime Event Received:", payload);
        
        // INTERCEPCIÓN EN MILISEGUNDO EXACTO para evitar latencia de fetchOrders
        const newOrder = payload.new as Order;
        if (newOrder && newOrder.id) {
          setOrders(current => {
            // Evitar duplicados si por latencia llega primero el fetch
            if (current.some(o => o.id === newOrder.id)) return current;
            return [newOrder, ...current];
          });
          if (restaurantOpenRef.current) {
            playAlarm();
          }
        }
        
        fetchOrders(); // Sincronización robusta silenciosa secundaria
      })
      .subscribe((status) => {
        console.log("Supabase Realtime Status:", status);
      });

    return () => {
      console.log(`Cleaning up Supabase Realtime channel for branch ${activeBranch}...`);
      supabase.removeChannel(channel);
    };
  }, [activeBranch]);

  // DERIVADOS Y EFECTOS DE SISTEMA DE RECEPCIÓN
  const pendingOrders = orders.filter(o => o.status === 'pending');
  
  useEffect(() => {
    if (pendingOrders.length > 0 && restaurantOpen) {
      // 1. Encontrar el pedido nuevo más antiguo
      const oldestPending = [...pendingOrders].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
      
      // 2. Si no hay modal abierto, abrirlo
      if (!isIncomingModalOpen) {
        setActiveIncomingOrder(oldestPending);
        setIsIncomingModalOpen(true);
        
        // Auto-populate based on algorithmic EWT
        const estimatedTimeMeta = oldestPending.items.find((i: any) => (i as any)._isEstimatedTimeMetadata);
        const calculatedTime = estimatedTimeMeta ? Math.round((estimatedTimeMeta as any).time as number) : 30;
        
        setSelectedPrepTime(calculatedTime);
      }
      
      // 3. Encender la alarma
      if (!isSilencedRef.current) {
          playAlarm();
      }
    } else {
      // Si ya no quedan pedidos nuevos o cerramos restaurante, parar alarma
      if (alarmAudioRef.current) {
         alarmAudioRef.current.pause();
         alarmAudioRef.current.currentTime = 0;
      }
      if (isIncomingModalOpen) {
        setIsIncomingModalOpen(false);
        setActiveIncomingOrder(null);
      }
    }
  }, [pendingOrders.length, restaurantOpen, isIncomingModalOpen]); // Dependencias para reaccionar rápido


  const updateOrderStatus = async (id: number, newStatus: string, metadataTargetTime: number | null = null) => {
    setIsUpdatingState(true);
    setErrorToast(null);

    const previousOrders = [...orders];
    const previousSelected = selectedOrder;

    const orderToUpdate = orders.find(o => o.id === id);
    let newItems = orderToUpdate ? [...orderToUpdate.items] : [];

    // Si queremos inyectar el targetTime en el payload de items (como metadata)
    if (metadataTargetTime !== null && orderToUpdate) {
      const metaIndex = newItems.findIndex(i => (i as any)._isMetadata);
      if (metaIndex >= 0) {
        (newItems[metaIndex] as any).targetTime = metadataTargetTime;
      } else {
        newItems.push({ 
          name: '_meta', price: 0, quantity: 0, subtotal: 0, productId: 'meta', 
          _isMetadata: true, targetTime: metadataTargetTime 
        } as any);
      }
    }

    // Actualización Optimista local
    const optimisticItems = metadataTargetTime !== null ? newItems : (orderToUpdate?.items || []);
    setOrders(current => current.map(o => o.id === id ? { ...o, status: newStatus, items: optimisticItems } : o));
    if (selectedOrder && selectedOrder.id === id) {
       setSelectedOrder({ ...selectedOrder, status: newStatus, items: optimisticItems });
    }

    // Petición a Supabase
    const payload: any = { status: newStatus };
    if (metadataTargetTime !== null) payload.items = newItems;
    
    const { error } = await supabase.from('orders').update(payload).eq('id', id);
    
    if (error) {
      setOrders(previousOrders);
      setSelectedOrder(previousSelected);
      setErrorToast(`Error al procesar: ${error.message}`);
      setTimeout(() => setErrorToast(null), 4000);
    } else {
      if(newStatus === 'cancelled' || newStatus === 'delivered' || newStatus === 'ready') {
          setIsModalOpen(false);
      }
    }
    
    setIsUpdatingState(false);
  };

  // ACCIÓN PRINCIPAL: Aceptar Pedido con Reloj
  const handleAcceptOrder = async (orderId: number, prepTimeMins: number) => {
    stopAlarm();
    setIsIncomingModalOpen(false); // Cierra modal rápido para sensación responsiva
    
    const targetTime = Date.now() + (prepTimeMins * 60000);
    
    await updateOrderStatus(orderId, 'preparing', targetTime);
  };

  // ACCION EXTREMA: Cuando el tiempo expira, auto-abrir modal
  const handleOrderExpire = (expiredOrder: Order) => {
    if (expiredOrder.status !== 'preparing') return;
    setActiveTab('preparing');
    setSelectedOrder(expiredOrder);
    setIsModalOpen(true);
    playReadySound();
  };

  // ACCIÓN RETRASO: Añadir X min si hay problemas
  const handleDelayOrder = async (order: Order, extraMins: number) => {
    const targetMetaIndex = order.items.findIndex(i => (i as any)._isMetadata);
    if (targetMetaIndex < 0) return; // Fallback extremo por si acaso

    setIsUpdatingState(true);
    
    // Sumamos los minutos al momento actual para garantizar que el reloj vuelva a estar en positivo
    const newTarget = Date.now() + (extraMins * 60000);
    const newItems = [...order.items];
    
    newItems[targetMetaIndex] = { 
       ...newItems[targetMetaIndex], 
       targetTime: newTarget, 
       isDelayed: true // FLAG PARA NO PERMITIR SEGUNDOS RETRASOS
    } as any;

    const { error } = await supabase.from('orders').update({ items: newItems }).eq('id', order.id);
    
    if (!error) {
      setOrders(current => current.map(o => o.id === order.id ? { ...o, items: newItems } : o));
      setSelectedOrder({ ...order, items: newItems });
      setIsModalOpen(false); // Cerro pestaña para que el cajero vuelva a ver la vista general
    } else {
      setErrorToast("Error al aplicar retraso: " + error.message);
      setTimeout(() => setErrorToast(null), 4000);
    }
    
    setIsUpdatingState(false);
  };

  const isMaxDelayed = (order: Order) => {
    const meta = order.items.find(i => (i as any)._isMetadata) as any;
    return meta?.isDelayed === true;
  };

  // Filtrado correcto por estados reales
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');
  const deliveredOrders = orders.filter(o => o.status === 'delivered');

  // Lógica de pestañas
  const getActiveOrders = () => {
    switch(activeTab) {
      case 'pending': return pendingOrders;
      case 'preparing': return preparingOrders;
      case 'ready': return readyOrders;
      case 'delivered': return deliveredOrders;
      default: return [];
    }
  };

  const tabs = [
    { id: 'pending', label: 'Nuevas', count: pendingOrders.length },
    { id: 'preparing', label: 'En preparación', count: preparingOrders.length },
    { id: 'ready', label: 'A entregar', count: readyOrders.length },
    { id: 'delivered', label: 'Entregado', count: deliveredOrders.length }
  ];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(price);
  };

  const openOrderModal = (order: Order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  // Extractor de Target Time desde Items
  const getTargetTimeFromItems = (items: OrderItem[]) => {
    if (!items) return null;
    const metaItem = items.find(i => (i as any)._isMetadata);
    return metaItem ? (metaItem as any).targetTime : null;
  };

  // Extractor de Metadata de Delivery
  const getDeliveryMetaFromItems = (items: OrderItem[]) => {
    if (!items) return null;
    const metaItem = items.find(i => (i as any)._isDeliveryMetadata);
    return metaItem ? (metaItem as any) : null;
  };

  const PedidosYaOrderCard = ({ order }: { order: Order }) => {
    const targetTime = getTargetTimeFromItems(order.items);
    const deliveryMeta = getDeliveryMetaFromItems(order.items);
    const isDelivery = deliveryMeta?.method === 'delivery';

    // Filtramos los items reales para no mostrar la metadata en el frontend
    const visualItems = order.items.filter(i => !(i as any)._isMetadata && !(i as any)._isDeliveryMetadata);

    return (
      <div 
        onClick={() => openOrderModal(order)}
        className="bg-white border text-left border-[#EFEFEF] shadow-[0_2px_8px_rgba(0,0,0,0.04)] rounded p-5 cursor-pointer hover:shadow-md transition-all flex flex-col group w-full relative overflow-hidden"
      >
        {isDelivery ? (
          <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] uppercase font-bold px-3 py-1 rounded-bl-lg shadow-sm flex items-center gap-1 z-10">
            <Truck size={10} /> Delivery
          </div>
        ) : (
          <div className="absolute top-0 right-0 bg-purple-500 text-white text-[10px] uppercase font-bold px-3 py-1 rounded-bl-lg shadow-sm flex items-center gap-1 z-10">
            <Store size={10} /> Retiro
          </div>
        )}

        <div className="flex justify-between items-start mb-2 mt-2">
          <div>
            <h4 className="font-bold text-[16px] text-gray-900 border-b-2 border-transparent group-hover:border-pink-500 inline-block transition-colors pr-6">
              #{order.id.toString()} - {order.customer_name}
            </h4>
            <span className="text-[13px] text-gray-500 font-medium block mt-1">
              <Clock size={12} className="inline mr-1"/> {format(new Date(order.created_at), "HH:mm")} • {order.branch_name}
            </span>
          </div>
          <div className="text-right">
            <span className="font-black text-[16px] text-gray-900 block">{formatPrice(order.total)}</span>
            {order.payment?.isPaidOnline && (
               <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded uppercase font-bold tracking-wider mt-1 inline-block">Online</span>
            )}
          </div>
        </div>

        {/* Muestra Temporizador si está en preparación y tiene targetTime */}
        {(order.status === 'preparing' && targetTime) && (
          <div className="mt-2 mb-2 p-2 bg-slate-50 border border-slate-100 rounded inline-flex">
             <OrderTimer targetTime={targetTime} onExpire={() => {}} />
          </div>
        )}

        <p className="text-[13px] text-gray-400 mt-2 line-clamp-2">
           {visualItems.map(i => `${i.quantity}x ${i.name}`).join(', ')}
        </p>

        {order.notes && order.notes.length > 0 && (
          <p className="text-[11px] font-bold text-yellow-600 mt-2 bg-yellow-50 p-1.5 rounded line-clamp-1">
            NOTAS: {order.notes}
          </p>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Hidden Timers for Background Expiration Detection (Global) */}
      <div className="hidden">
        {preparingOrders.map(order => {
           const targetTime = getTargetTimeFromItems(order.items);
           if (!targetTime) return null;
           return <OrderTimer key={order.id} targetTime={targetTime} onExpire={() => handleOrderExpire(order)} />
        })}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 80mm; padding: 0; margin: 0; }
          @page { margin: 0; }
        }
      `}} />

      {/* Banner de Error de Audio (Políticas del Navegador) */}
      {audioError && (
        <div className="print:hidden fixed top-0 left-0 w-full bg-red-600 text-white p-3 z-50 flex justify-center items-center gap-4 shadow-xl cursor-pointer hover:bg-red-700" onClick={() => playAlarm()}>
          <BellRing className="animate-bounce" />
          <p className="font-bold text-sm tracking-wide">EL NAVEGADOR HA BLOQUEADO EL SONIDO. ¡HAZ CLIC AQUÍ PARA HABILITAR LAS ALERTAS!</p>
        </div>
      )}

      <div className="print:hidden h-full flex flex-col relative w-full pt-8 px-10 max-w-6xl mx-auto">
        
        {/* Toggle CERRADO / ABIERTO */}
        <div className="absolute top-8 right-10 z-10 flex gap-4 items-center">
          
          <button 
            onClick={() => {
              const newState = !restaurantOpen;
              setRestaurantOpen(newState);
              if (newState && pendingOrders.length > 0) playAlarm();
              if (!newState) stopAlarm();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.05)] text-[12px] font-bold text-gray-800 hover:bg-gray-50 transition-colors"
          >
            <div className={`w-2.5 h-2.5 rounded-full ${restaurantOpen ? 'bg-green-500' : 'bg-pink-500'}`}></div>
            {restaurantOpen ? 'ABIERTO' : 'CERRADO'}
          </button>
        </div>

        {!restaurantOpen ? (
          <div className="flex flex-col items-start pt-10">
              <h2 className="text-[28px] font-bold text-gray-900 leading-tight">Hola.</h2>
              <h2 className="text-[28px] font-bold text-gray-900 leading-tight mb-6">¿Estás listo para<br/>aceptar pedidos?</h2>
              
              <button 
                onClick={() => { setRestaurantOpen(true); }}
                className="bg-green-500 hover:bg-green-600 text-white font-bold text-[14px] py-4 px-6 rounded-[4px] flex items-center justify-between w-64 shadow-sm transition-all"
              >
                Abrir restaurante
                <span className="font-light text-lg">›</span>
              </button>
          </div>
        ) : (
          <div className="w-full">
            <h2 className="text-[24px] font-black text-gray-900 mb-6 tracking-tight">Gestor de Órdenes</h2>
            <div className="flex border-b border-gray-200 overflow-x-auto select-none no-scrollbar mb-6">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-8 py-3.5 font-bold text-[14px] whitespace-nowrap transition-colors flex items-center gap-2 border-b-[3px] ${
                    activeTab === tab.id 
                      ? 'border-pink-500 text-pink-500' 
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* Listado de la Pestaña Activa */}
            <div className="space-y-3 min-h-[50vh]">
              {loading && orders.length === 0 ? (
                <div className="text-[#A0A0A0] text-[13px] font-medium p-4 mt-4">
                   Cargando órdenes...
                </div>
              ) : getActiveOrders().length === 0 ? (
                 <div className="bg-[#F8F9FA] p-4 text-[13px] text-[#A0A0A0] font-medium border border-transparent flex items-center min-h-[56px] mt-4">
                   No hay pedidos en la pestaña {tabs.find(t=>t.id === activeTab)?.label}
                 </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                   {getActiveOrders().map(order => <PedidosYaOrderCard key={order.id} order={order} />)}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* MODAL 1: RECEPCIÓN Y ATENCIÓN AUTOMÁTICA DE NUEVOS PEDIDOS */}
      <Dialog open={isIncomingModalOpen && restaurantOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[700px] bg-white text-gray-900 border-none print:hidden p-0 overflow-hidden shadow-2xl rounded-2xl ring-4 ring-pink-500/20">
          {activeIncomingOrder && (
            <div className="flex flex-col h-[90vh] sm:h-auto max-h-[90vh]">
              {/* Header Animado */}
              <div className="px-8 py-6 bg-pink-50 border-b border-pink-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center animate-pulse shadow-lg shadow-pink-500/30">
                     <BellRing className="text-white" size={24} />
                  </div>
                  <div>
                    <h2 className="text-[24px] font-black text-gray-900 tracking-tight flex items-center gap-2">
                       NUEVO PEDIDO #{activeIncomingOrder.id}
                    </h2>
                    <p className="text-[14px] text-pink-700 font-bold mt-0.5">
                      Ingresado a las {format(new Date(activeIncomingOrder.created_at), "HH:mm:ss")}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[28px] text-gray-900 leading-none">{formatPrice(activeIncomingOrder.total)}</p>
                  <p className="text-[12px] text-gray-500 font-bold uppercase mt-1">
                    {activeIncomingOrder.payment?.isPaidOnline ? '💳 PAGADO ONLINE' : '💵 COBRAR EN LOCAL'}
                  </p>
                </div>
              </div>

              {/* Body */}
              <div className="p-8 overflow-y-auto flex-1 bg-white">
                 <div className="mb-6">
                    <h3 className="text-[12px] text-gray-400 font-bold mb-1 uppercase tracking-widest">Cliente y Destino</h3>
                    <p className="text-[18px] font-bold text-gray-900">{activeIncomingOrder.customer_name}</p>
                    <p className="text-[15px] text-gray-500 mt-1">Sucursal asignada: <span className="font-bold">{activeIncomingOrder.branch_name}</span></p>
                 </div>

                 <div className="space-y-0 border-t border-b border-gray-100 py-4 mb-6">
                  {activeIncomingOrder.items.filter(i => !(i as any)._isMetadata).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-3">
                      <div className="flex items-center gap-4">
                        <span className="text-pink-500 font-black text-[22px]">
                          {item.quantity}x
                        </span>
                        <span className="text-[20px] font-bold text-gray-800">{item.name}</span>
                      </div>
                    </div>
                  ))}
                 </div>

                 {activeIncomingOrder.notes && (
                  <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl text-[15px] mb-6 border border-yellow-200 shadow-sm">
                    <span className="font-black block mb-1 text-yellow-900 tracking-wide">NOTAS IMPORTANTES:</span>
                    {activeIncomingOrder.notes}
                  </div>
                 )}

                 {/* Selector de Tiempo Granular */}
                 <div className="mt-8">
                    <h3 className="text-center font-black text-[16px] mb-4 text-gray-800 uppercase tracking-wide">¿En cuánto tiempo estará listo?</h3>
                    
                    <div className="flex flex-col items-center gap-4">
                      {/* Control Principal */}
                      <div className="flex items-center justify-center gap-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <button 
                          onClick={() => setSelectedPrepTime(prev => Math.max(1, prev - 1))}
                          className="w-14 h-14 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-gray-600 hover:border-pink-500 hover:text-pink-500 hover:bg-pink-50 transition-all active:scale-95"
                        >
                          <Minus size={24} strokeWidth={3} />
                        </button>
                        
                        <div className="w-32 text-center flex flex-col items-center">
                          <span className="text-[42px] font-black text-gray-900 tabular-nums leading-none block">{selectedPrepTime}</span>
                          <span className="text-[14px] font-bold text-gray-400 uppercase tracking-widest block mt-1">Minutos</span>
                          
                          {activeIncomingOrder?.items.find((i: any) => (i as any)._isEstimatedTimeMetadata && Math.round((i as any).time as number) === selectedPrepTime) && (
                            <span className="text-[9px] text-green-600 font-bold uppercase mt-1.5 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full inline-block shadow-sm">
                              Calculado
                            </span>
                          )}
                        </div>

                        <button 
                          onClick={() => setSelectedPrepTime(prev => prev + 1)}
                          className="w-14 h-14 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-gray-600 hover:border-green-500 hover:text-green-500 hover:bg-green-50 transition-all active:scale-95"
                        >
                          <Plus size={24} strokeWidth={3} />
                        </button>
                      </div>

                      {/* Botones de atajo rápido */}
                      <div className="flex gap-2">
                         {[10, 15, 20, 30, 45].map((time) => (
                           <button
                             key={time}
                             onClick={() => setSelectedPrepTime(time)}
                             className={`px-4 py-2 rounded-lg font-bold text-[14px] transition-all border-2 ${
                               selectedPrepTime === time 
                               ? 'border-gray-900 bg-gray-900 text-white' 
                               : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                             }`}
                           >
                             {time}m
                           </button>
                         ))}
                      </div>
                    </div>
                 </div>
              </div>

              {/* Acciones */}
              <div className="p-6 border-t border-gray-100 bg-[#F8F9FA] flex gap-4 shrink-0 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
                 <button 
                    disabled={isUpdatingState}
                    onClick={() => { updateOrderStatus(activeIncomingOrder.id, 'cancelled'); setIsIncomingModalOpen(false); stopAlarm(); }}
                    className="flex-1 py-5 rounded-xl border-2 border-red-200 bg-white text-red-500 hover:bg-red-50 font-bold text-[16px] transition uppercase tracking-wider"
                  >
                     Rechazar
                  </button>
                  <button 
                    disabled={isUpdatingState}
                    onClick={() => handleAcceptOrder(activeIncomingOrder.id, selectedPrepTime)}
                    className="flex-[2] py-5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-black text-[18px] flex justify-center items-center gap-2 shadow-lg shadow-green-500/30 transition-transform active:scale-95 uppercase tracking-wide"
                  >
                    <CheckCircle2 size={24} /> ACEPTAR (Iniciar Reloj)
                  </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 2: GESTIÓN DE PEDIDO REGULAR (Misma UX de antes) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[650px] bg-white text-gray-900 border-none print:hidden p-0 overflow-hidden shadow-2xl rounded-none sm:rounded-lg">
          {selectedOrder && (
            <div className="flex flex-col h-[85vh] sm:h-auto max-h-[85vh]">
              
              <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-[22px] font-black text-gray-900 flex items-center gap-2 tracking-tight">
                    Resumen del pedido #{selectedOrder.id}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {ESCPOSPrinter.isConnected('kitchen') && (
                    <button 
                      onClick={async () => {
                        try { await ESCPOSPrinter.printOrder(selectedOrder, 'kitchen'); } 
                        catch (e) { alert("Error imprimiendo en cocina: " + e); }
                      }}
                      className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 px-3 py-2 rounded font-bold transition-all text-[12px]"
                    >
                      <Bluetooth size={14} /> Cocina
                    </button>
                  )}
                  {ESCPOSPrinter.isConnected('cashier') && (
                    <button 
                      onClick={async () => {
                        try { await ESCPOSPrinter.printOrder(selectedOrder, 'cashier'); } 
                        catch (e) { alert("Error imprimiendo en caja: " + e); }
                      }}
                      className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-3 py-2 rounded font-bold transition-all text-[12px]"
                    >
                      <Bluetooth size={14} /> Cliente
                    </button>
                  )}
                  {(!ESCPOSPrinter.isConnected('kitchen') && !ESCPOSPrinter.isConnected('cashier')) && (
                    <button 
                      onClick={() => window.print()}
                      className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-pink-500 px-4 py-2 rounded font-bold transition-all text-[13px]"
                    >
                      <Printer size={16} />
                      Imprimir (Nav)
                    </button>
                  )}
                </div>
              </div>

              <div className="p-8 overflow-y-auto flex-1 bg-white">
                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-[12px] text-gray-400 font-bold mb-1 uppercase tracking-widest">Cliente</h3>
                    <p className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                       {selectedOrder.customer_name}
                       {getDeliveryMetaFromItems(selectedOrder.items)?.method === 'delivery' && (
                          <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide">Delivery</span>
                       )}
                    </p>
                    <p className="text-[13px] text-gray-500 mt-1">{selectedOrder.branch_name}</p>
                    
                    {getDeliveryMetaFromItems(selectedOrder.items)?.method === 'delivery' && (
                      <div className="mt-2 text-[13px] text-gray-700 bg-blue-50/50 p-2 border border-blue-100 rounded">
                        <span className="font-bold flex items-center gap-1 text-blue-900 border-b border-blue-200 pb-1 mb-1">
                          <Truck size={12}/> Dirección de Entrega
                        </span>
                        {getDeliveryMetaFromItems(selectedOrder.items)?.address}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] text-gray-500 flex items-center justify-end gap-1 font-medium"><Clock size={14}/> {format(new Date(selectedOrder.created_at), "HH:mm")} hrs</p>
                    <p className="text-[13px] font-bold mt-2 inline-block px-3 py-1 rounded bg-gray-50">
                      {selectedOrder.payment?.isPaidOnline ? <span className="text-green-600">Pagado Online</span> : 'Cobrar en Local'}
                    </p>
                  </div>
                </div>

                <div className="space-y-0 border-t border-b border-gray-100 py-4 mb-6">
                  {selectedOrder.items.filter(i => !(i as any)._isMetadata && !(i as any)._isDeliveryMetadata).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start py-3">
                      <div className="flex items-start gap-4">
                        <span className="text-pink-500 font-black text-[16px]">
                          {item.quantity}x
                        </span>
                        <span className="text-[16px] font-bold text-gray-800">{item.name}</span>
                      </div>
                      <span className="text-[16px] font-bold text-gray-900">{formatPrice(item.subtotal)}</span>
                    </div>
                  ))}
                </div>

                {selectedOrder.notes && (
                  <div className="p-4 bg-[#F8F9FA] text-gray-700 rounded text-[14px] mb-6 border border-gray-100">
                    <span className="font-bold block mb-1 text-gray-900 tracking-wide text-xs">NOTAS EXTRA:</span>
                    {selectedOrder.notes}
                  </div>
                )}
                
                <div className="flex justify-between items-center px-2 py-2">
                  <span className="font-bold text-[20px]">Total</span>
                  <span className="font-black text-[28px] text-pink-500">{formatPrice(selectedOrder.total)}</span>
                </div>
              </div>

              {/* Botonera inferior */}
              <div className="p-6 border-t border-gray-100 bg-[#F8F9FA] flex flex-col sm:flex-row justify-end items-center gap-3 shrink-0">
                  {selectedOrder.status === 'preparing' && (
                    <>
                      {/* Botón de Retraso de 7 minutos */}
                      {!isMaxDelayed(selectedOrder) && (
                        <button 
                          disabled={isUpdatingState}
                          onClick={() => handleDelayOrder(selectedOrder, 7)}
                          className="w-full sm:w-auto px-6 py-3 rounded border border-orange-500 text-orange-600 hover:bg-orange-50 font-bold flex items-center justify-center gap-2 shadow-sm transition text-[14px]"
                        >
                          <AlertTriangle size={16} /> Retrasado (+7 min)
                        </button>
                      )}
                      
                      <button 
                        disabled={isUpdatingState}
                        onClick={() => { updateOrderStatus(selectedOrder.id, 'ready'); setActiveTab('ready'); }}
                        className="w-full sm:w-auto px-10 py-3 rounded bg-pink-500 hover:bg-pink-600 text-white font-bold flex items-center justify-center gap-2 shadow transition text-[14px]"
                      >
                        Marcar como Listo
                      </button>
                    </>
                  )}
                  {selectedOrder.status === 'ready' && (
                     <button 
                      disabled={isUpdatingState}
                      onClick={() => { 
                         updateOrderStatus(selectedOrder.id, 'delivered');
                         setActiveTab('delivered');
                      }}
                      className={`w-full sm:w-auto px-10 py-3 rounded font-bold flex items-center justify-center gap-2 shadow-sm transition text-[14px] ${getDeliveryMetaFromItems(selectedOrder.items)?.method === 'delivery' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border border-green-500 text-green-600 hover:bg-green-50'}`}
                    >
                       {getDeliveryMetaFromItems(selectedOrder.items)?.method === 'delivery' ? (
                          <><Truck size={16} /> Marcar como Entregado</>
                       ) : (
                          <><Check size={16} /> Marcar como Entregado</>
                       )}
                    </button>
                  )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* TICKET DE IMPRESIÓN TERMICA (80mm) */}
      {selectedOrder && (
        <div id="print-area" className="hidden print:block w-[80mm] bg-white text-black p-4 text-[13px] font-mono leading-tight">
          <div className="text-center mb-4">
            <h1 className="font-extrabold text-[22px] mb-1">CLÁSICOS PUCÓN</h1>
            <h2 className="text-[14px] font-bold border-b border-black border-dashed pb-2">Comanda de Cocina</h2>
          </div>
          <div className="mb-4">
            <p className="text-[18px] font-bold mb-1">Pedido: #{selectedOrder.id}</p>
            <p><strong>Fecha:</strong> {format(new Date(selectedOrder.created_at), "dd/MM/yy HH:mm")}</p>
            <p><strong>Cliente:</strong> {selectedOrder.customer_name}</p>
            <p><strong>Atención:</strong> {selectedOrder.branch_name}</p>
          </div>
          <div className="border-t-2 border-b-2 border-black border-dashed py-3 my-3">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-black border-dotted">
                  <th className="font-bold pb-1 w-[20px]">Q</th>
                  <th className="font-bold pb-1 text-[14px]">Producto</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder.items.filter(i => !(i as any)._isMetadata && !(i as any)._isDeliveryMetadata).map((item, idx) => (
                  <tr key={idx} className="align-top">
                    <td className="font-extrabold text-[16px] pt-2">{item.quantity}</td>
                    <td className="font-bold text-[15px] pt-2">{item.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedOrder.notes && (
            <div className="border-b-2 border-black border-dashed pb-3 mb-3">
              <strong className="text-[14px] uppercase">* NOTAS:</strong>
              <p className="font-bold text-[14px]">{selectedOrder.notes}</p>
            </div>
          )}
          <div className="text-center mt-6 mb-8">
            <span className="font-extrabold text-[18px]">
              TOTAL: {formatPrice(selectedOrder.total)}
            </span>
            <div className="mt-2 text-[12px] font-bold uppercase">
              {selectedOrder.payment?.isPaidOnline ? '💳 [PAGADO ONLINE]' : '💵 COBRAR EN CAJA'}
            </div>
          </div>
          <div className="text-center text-[10px] mt-8 pt-8">
            - Sistema Pedidos IA -
          </div>
        </div>
      )}

      {/* Toast de Error */}
      {errorToast && (
        <div className="fixed top-8 right-10 bg-red-600 text-white px-6 py-4 rounded shadow-2xl z-50 flex items-center gap-3 print:hidden">
          <XCircle size={24} />
          <span className="font-bold text-[14px]">{errorToast}</span>
        </div>
      )}
    </>
  );
}

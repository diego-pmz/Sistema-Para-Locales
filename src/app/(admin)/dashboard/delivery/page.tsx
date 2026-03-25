'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Truck, MapPin, Phone, User, CheckCircle2, RefreshCcw, Loader2 } from 'lucide-react';
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
  status: string;
  notes?: string;
  payment?: { method: string, isPaidOnline: boolean };
}

export default function DeliveryDashboardPage() {
  const { activeBranch } = useAdminStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdatingState, setIsUpdatingState] = useState(false);

  const fetchDeliveringOrders = async () => {
    if (!activeBranch) return;
    setLoading(true);
    let query = supabase
      .from('orders')
      .select('*')
      .eq('status', 'delivering')
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

    fetchDeliveringOrders();

    const channel = supabase
      .channel(`delivery-orders-${activeBranch}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchDeliveringOrders(); // Refetch robusto en cualquier evento
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBranch]);

  const getDeliveryMetaFromItems = (items: OrderItem[]) => {
    if (!items) return null;
    const metaItem = items.find(i => (i as any)._isDeliveryMetadata);
    return metaItem ? (metaItem as any) : null;
  };

  const markAsDelivered = async (id: number) => {
    setIsUpdatingState(true);
    // Optimistic UI
    setOrders(current => current.filter(o => o.id !== id));
    
    // Supabase Update
    await supabase.from('orders').update({ status: 'delivered' }).eq('id', id);
    setIsUpdatingState(false);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(price);
  };

  if (!activeBranch) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-10 mt-20">
        <Truck className="w-20 h-20 text-gray-200 mb-6" />
        <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">Acceso Bloqueado</h2>
        <p className="text-gray-500 font-medium max-w-md mx-auto text-lg leading-relaxed">
          Para gestionar el delivery, DEBES seleccionar la sucursal en la que estás operando físicamente.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative w-full pt-8 px-10 max-w-6xl mx-auto pb-20">
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-[28px] font-black text-gray-900 tracking-tight flex items-center gap-3">
            <Truck className="text-blue-500 w-8 h-8" strokeWidth={2.5}/>
            Panel de Delivery
          </h2>
          <p className="text-gray-500 font-medium mt-1">Pedidos actualmente en camino hacia el cliente.</p>
        </div>
        <button 
          onClick={fetchDeliveringOrders} 
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white shadow-sm border border-gray-200 rounded font-bold text-gray-700 hover:bg-gray-50 transition"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Sincronizar
        </button>
      </div>

      <div className="bg-white border text-left border-[#EFEFEF] shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-2xl min-h-[60vh] p-6">
        
        {loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
             <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
             <p className="font-bold">Buscando repartos activos...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Pista despejada</h3>
            <p className="text-gray-500">No hay ningún pedido en estado "Delivery" actualmente.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {orders.map(order => {
              const deliveryData = getDeliveryMetaFromItems(order.items);
              const itemsCount = order.items.filter(i => !(i as any)._isMetadata && !(i as any)._isDeliveryMetadata).reduce((acc, curr) => acc + curr.quantity, 0);

              return (
                <div key={order.id} className="border-2 border-blue-100 bg-blue-50/20 rounded-xl p-5 relative overflow-hidden flex flex-col">
                  
                  {/* Decorative line */}
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>

                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-black text-xl text-gray-900">
                        #{order.id} - {formatPrice(order.total)}
                      </h4>
                      <p className="text-sm font-bold text-gray-500 mt-0.5 flex items-center gap-1.5">
                        <User size={14}/> {order.customer_name} 
                      </p>
                    </div>
                    <div className="text-right">
                       <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded uppercase tracking-widest block">
                         {order.payment?.isPaidOnline ? 'Pagado' : 'Por Cobrar'}
                       </span>
                       <span className="text-xs text-gray-400 font-bold block mt-1.5">{itemsCount} Productos</span>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6 flex-1">
                    <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm flex items-start gap-3">
                      <div className="mt-0.5 bg-blue-100 p-1.5 rounded-full text-blue-600">
                        <MapPin size={16} />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block mb-0.5">Dirección Destino</span>
                        <p className="font-bold text-gray-900 leading-snug">{deliveryData?.address || 'No provista (Error)'}</p>
                      </div>
                    </div>

                    {/* Falso campo de teléfono para visualización */}
                    <div className="flex items-center gap-2 text-sm text-gray-600 font-medium px-1">
                      <Phone size={14} className="text-gray-400" />
                      Llamar al cliente: <span className="text-blue-600 select-all cursor-pointer hover:underline">+56 9 XXXXXXXX</span>
                    </div>
                  </div>

                  <button 
                    disabled={isUpdatingState}
                    onClick={() => markAsDelivered(order.id)}
                    className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-lg font-black tracking-wide flex justify-center items-center gap-2 shadow-lg transition-transform active:scale-95 disabled:opacity-50"
                  >
                    <CheckCircle2 size={20} /> Entregado Exitosamente
                  </button>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

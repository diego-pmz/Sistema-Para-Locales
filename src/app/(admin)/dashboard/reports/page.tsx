'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Order, OrderItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Printer, Calendar, Banknote, CreditCard, Receipt, Hash } from 'lucide-react';
import { useAdminStore } from '@/lib/store';

export default function ReportsPage() {
  const { activeBranch } = useAdminStore();
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDailyOrders();
  }, [selectedDate, activeBranch]);

  const fetchDailyOrders = async () => {
    if (!activeBranch) return;
    setLoading(true);
    
    // Convert YYYY-MM-DD local to UTC boundaries for Supabase created_at
    const dateObj = new Date(selectedDate + 'T12:00:00'); // Safe middle-of-day block to avoid tz shifts
    const start = startOfDay(dateObj).toISOString();
    const end = endOfDay(dateObj).toISOString();

    let query = supabase
      .from('orders')
      .select('*')
      .gte('created_at', start)
      .lte('created_at', end)
      .eq('status', 'delivered') // Only count successfully delivered/completed orders
      .eq('branch_name', activeBranch)
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (!error && data) {
      setOrders(data as Order[]);
    }
    setLoading(false);
  };

  // Aggregations
  let totalRevenue = 0;
  let totalItemsSold = 0;

  orders.forEach(order => {
    const total = order.total || 0;
    totalRevenue += total;

    // Count physical items
    const productItems = order.items.filter((i: OrderItem) => !i._isDeliveryMetadata && !i._isPaymentMetadata);
    totalItemsSold += productItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  });

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!activeBranch) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-10 mt-20">
        <Receipt className="w-20 h-20 text-gray-200 mb-6" />
        <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">Acceso Bloqueado</h2>
        <p className="text-gray-500 font-medium max-w-md mx-auto text-lg leading-relaxed">
          Para revisar el cierre de caja, DEBES seleccionar la sucursal de manera explícita en el menú lateral.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-24 h-full overflow-y-auto">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 print:mb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Receipt className="text-pink-500" /> Cierre de Caja Diario
          </h1>
          <p className="text-gray-500 mt-1">Resumen de ventas procesadas y finalizadas.</p>
        </div>

        <div className="flex gap-3 print:hidden w-full sm:w-auto">
          <div className="relative">
            <Input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-10 h-11 w-[180px] bg-white border-2 border-gray-100 rounded-xl font-bold text-gray-700"
            />
            <Calendar className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
          </div>
          <Button 
            onClick={handlePrint}
            variant="outline"
            className="h-11 border-2 border-gray-200 text-gray-700 hover:text-gray-900 hover:border-gray-300 rounded-xl"
          >
            <Printer className="mr-2" size={16} /> Imprimir
          </Button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <Card className="border-none shadow-sm bg-pink-50/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-pink-500 uppercase tracking-widest">Total Vendido</CardTitle>
            <Receipt className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-gray-900">{formatPrice(totalRevenue)}</div>
            <p className="text-xs text-pink-600/70 font-bold mt-1">Ingreso neto del día (Tarjetas/Web)</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-gray-500 uppercase tracking-widest">Productos</CardTitle>
            <Hash className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-gray-900">{totalItemsSold}</div>
            <p className="text-xs text-gray-400 font-bold mt-1">Unidades físicas despachadas</p>
          </CardContent>
        </Card>
      </div>

      {/* ORDERS TABLE */}
      <Card className="border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50/80 border-b border-gray-100 font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Hora</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Detalle</th>
                <th className="px-6 py-4 text-right">Total (Web)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                    Calculando ventas...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                    No hay ventas registradas en esta fecha.
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  // Product string
                  const productNames = order.items
                    .filter((i: OrderItem) => !i._isDeliveryMetadata && !i._isPaymentMetadata)
                    .map((i: OrderItem) => `${i.quantity}x ${i.name || 'Prod'}`)
                    .join(', ');

                  return (
                    <tr key={order.id} className="bg-white border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-6 py-4 font-mono font-medium text-gray-900">
                        {format(parseISO(order.created_at!), 'HH:mm', { locale: es })}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {order.customer_name}
                      </td>
                      <td className="px-6 py-4 text-gray-500 max-w-[300px] truncate">
                        {productNames}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-gray-900">
                        {formatPrice(order.total || 0)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
      
      {/* PRINTER BRANDING / SIGNATURE */}
      <div className="hidden print:block mt-8 text-center text-gray-400 text-sm">
        <p className="font-bold">Clásicos Sushi & Street Food</p>
        <p>Reporte Diario: {format(parseISO(selectedDate), "dd 'de' MMMM, yyyy", { locale: es })}</p>
      </div>

    </div>
  );
}

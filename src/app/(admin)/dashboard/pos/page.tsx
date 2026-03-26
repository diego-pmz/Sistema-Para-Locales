'use client';

import { useState, useCallback } from 'react';
import { categories, products } from '@/lib/mock-db';
import { Product } from '@/types';
import { supabase } from '@/lib/supabase';
import { useAdminStore } from '@/lib/store';
import { ESCPOSPrinter } from '@/lib/printer';
import { 
  ShoppingCart, Trash2, Plus, Minus, X, Banknote, CreditCard, 
  Printer, CheckCircle2, ReceiptText, AlertTriangle 
} from 'lucide-react';

interface POSCartItem {
  product: Product;
  quantity: number;
}

export default function POSPage() {
  const { activeBranch } = useAdminStore();
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.id || '');
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [lastSaleTotal, setLastSaleTotal] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');

  // Filter products by selected category (only available ones)
  const filteredProducts = products.filter(
    (p) => p.categoryId === selectedCategory && p.isAvailable
  );

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(price);

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // --- CART OPERATIONS ---
  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCustomerName('');
  }, []);

  // --- PAYMENT ---
  const handlePayment = async (method: 'cash' | 'card') => {
    if (cart.length === 0 || !activeBranch) return;
    setProcessing(true);

    try {
      // Build order items (same format as online orders for compatibility)
      const orderItems = cart.map((item) => ({
        id: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        imageUrl: item.product.imageUrl,
      }));

      // Add payment metadata
      orderItems.push({
        id: '_payment',
        name: '_payment',
        price: 0,
        quantity: 1,
        imageUrl: '',
        _isPaymentMetadata: true,
        method: method === 'card' ? 'online' : 'presencial',
        isPaidOnline: method === 'card',
      } as any);

      // Calculate max prepTime
      const maxPrepTime = Math.max(...cart.map((i) => i.product.prepTime || 0), 5);

      const orderPayload = {
        customer_name: customerName.trim() || 'Venta Presencial',
        branch_name: activeBranch,
        items: orderItems,
        total: cartTotal,
        status: 'delivered', // POS sales = delivered instantly
        notes: `[POS] Pago: ${method === 'cash' ? 'Efectivo' : 'Tarjeta'}`,
        estimated_wait_time: maxPrepTime,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.from('orders').insert(orderPayload).select().single();

      if (error) throw error;

      // Try to print if printers are connected
      if (data) {
        try {
          if (ESCPOSPrinter.isConnected('kitchen')) {
            await ESCPOSPrinter.printOrder(data, 'kitchen');
          }
        } catch (e) { console.warn('Kitchen print failed:', e); }

        try {
          if (ESCPOSPrinter.isConnected('cashier')) {
            await ESCPOSPrinter.printOrder(data, 'cashier');
          }
        } catch (e) { console.warn('Cashier print failed:', e); }
      }

      // Success
      setLastSaleTotal(cartTotal);
      clearCart();

      // Clear success message after 3s
      setTimeout(() => setLastSaleTotal(null), 3000);
    } catch (err: any) {
      alert('Error al procesar la venta: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // --- BLOCKED STATE ---
  if (!activeBranch) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-10">
        <ReceiptText className="w-20 h-20 text-gray-200 mb-6" />
        <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">Terminal POS</h2>
        <p className="text-gray-500 font-medium max-w-md mx-auto text-lg leading-relaxed">
          Selecciona una sucursal en el menú lateral para comenzar a vender.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-gray-100">
      {/* ============================================ */}
      {/* LEFT: CATEGORIES + PRODUCTS */}
      {/* ============================================ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* CATEGORY TABS */}
        <div className="bg-white border-b border-gray-200 px-3 py-2 flex gap-2 overflow-x-auto shrink-0 shadow-sm">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all active:scale-95 ${
                selectedCategory === cat.id
                  ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* PRODUCT GRID */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.map((product) => {
              const inCart = cart.find((i) => i.product.id === product.id);
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className={`relative flex flex-col bg-white rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.97] shadow-sm hover:shadow-md ${
                    inCart
                      ? 'border-pink-400 ring-2 ring-pink-100'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  {/* Badge if in cart */}
                  {inCart && (
                    <span className="absolute -top-2 -right-2 w-7 h-7 bg-pink-500 text-white rounded-full flex items-center justify-center text-xs font-black shadow-lg">
                      {inCart.quantity}
                    </span>
                  )}

                  <h3 className="font-bold text-gray-900 text-[13px] leading-tight mb-2 line-clamp-2 min-h-[36px]">
                    {product.name}
                  </h3>
                  <span className="font-black text-pink-600 text-lg mt-auto">
                    {formatPrice(product.price)}
                  </span>
                </button>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="col-span-full text-center py-16 text-gray-400">
                <p className="font-bold text-lg">No hay productos en esta categoría</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* RIGHT: TICKET / CART SIDEBAR */}
      {/* ============================================ */}
      <div className="w-[340px] lg:w-[380px] bg-white border-l border-gray-200 flex flex-col shrink-0 shadow-lg">
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="text-pink-500" size={20} />
            <h2 className="font-black text-gray-900 text-lg tracking-tight">Ticket</h2>
            {cartItemCount > 0 && (
              <span className="bg-pink-100 text-pink-600 text-xs font-black px-2.5 py-0.5 rounded-full">
                {cartItemCount}
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-gray-400 hover:text-red-500 transition-colors p-1"
              title="Limpiar todo"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>

        {/* CUSTOMER NAME */}
        <div className="px-5 py-2 border-b border-gray-50 shrink-0">
          <input
            type="text"
            placeholder="Nombre del cliente (opcional)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>

        {/* CART ITEMS */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
              <ReceiptText className="w-16 h-16 text-gray-200 mb-4" />
              <p className="font-bold">Ticket vacío</p>
              <p className="text-sm mt-1">Toca un producto para agregarlo</p>
            </div>
          ) : (
            <div className="space-y-1">
              {cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center gap-2 py-2.5 px-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  {/* QTY CONTROLS */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-500 active:scale-90 transition-all"
                    >
                      <Minus size={14} strokeWidth={3} />
                    </button>
                    <span className="w-7 text-center font-black text-sm">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="w-7 h-7 rounded-lg bg-pink-50 flex items-center justify-center text-pink-600 hover:bg-pink-500 hover:text-white active:scale-90 transition-all"
                    >
                      <Plus size={14} strokeWidth={3} />
                    </button>
                  </div>

                  {/* NAME */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 text-[13px] truncate">{item.product.name}</p>
                  </div>

                  {/* SUBTOTAL */}
                  <span className="font-black text-gray-900 text-sm shrink-0">
                    {formatPrice(item.product.price * item.quantity)}
                  </span>

                  {/* DELETE */}
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all ml-1"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SUCCESS MESSAGE */}
        {lastSaleTotal !== null && (
          <div className="mx-4 mb-2 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 animate-in slide-in-from-bottom duration-300">
            <CheckCircle2 className="text-green-500 shrink-0" size={20} />
            <div>
              <p className="text-green-800 font-black text-sm">¡Venta Registrada!</p>
              <p className="text-green-600 text-xs font-bold">{formatPrice(lastSaleTotal)}</p>
            </div>
          </div>
        )}

        {/* PRINTER STATUS */}
        {(ESCPOSPrinter.isConnected('kitchen') || ESCPOSPrinter.isConnected('cashier')) && (
          <div className="mx-4 mb-2 flex items-center gap-2 text-xs text-gray-400 font-bold">
            <Printer size={12} />
            <span>
              {ESCPOSPrinter.isConnected('kitchen') && ESCPOSPrinter.isConnected('cashier')
                ? 'Cocina + Cajero conectados'
                : ESCPOSPrinter.isConnected('kitchen')
                ? 'Cocina conectada'
                : 'Cajero conectado'}
            </span>
          </div>
        )}

        {/* TOTAL + PAYMENT BUTTONS */}
        <div className="border-t border-gray-100 p-4 space-y-3 shrink-0 bg-gray-50/50">
          {/* TOTAL */}
          <div className="flex items-center justify-between px-1">
            <span className="text-gray-500 font-bold text-sm uppercase tracking-widest">Total</span>
            <span className="text-3xl font-black text-gray-900">{formatPrice(cartTotal)}</span>
          </div>

          {/* PAYMENT BUTTONS */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handlePayment('cash')}
              disabled={cart.length === 0 || processing}
              className="flex flex-col items-center justify-center gap-1 py-4 rounded-2xl bg-green-500 hover:bg-green-600 active:scale-95 text-white font-black text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-green-500/30"
            >
              <Banknote size={24} />
              <span>EFECTIVO</span>
            </button>
            <button
              onClick={() => handlePayment('card')}
              disabled={cart.length === 0 || processing}
              className="flex flex-col items-center justify-center gap-1 py-4 rounded-2xl bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-black text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
            >
              <CreditCard size={24} />
              <span>TARJETA</span>
            </button>
          </div>

          {processing && (
            <p className="text-center text-pink-500 font-bold text-sm animate-pulse">
              Procesando venta...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

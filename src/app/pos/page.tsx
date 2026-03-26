'use client';

import { useState, useCallback } from 'react';
import { categories, products } from '@/lib/mock-db';
import { Product } from '@/types';
import { supabase } from '@/lib/supabase';
import { ESCPOSPrinter } from '@/lib/printer';
import Link from 'next/link';
import { 
  ShoppingCart, Trash2, Plus, Minus, X, Banknote, CreditCard, 
  Printer, CheckCircle2, ReceiptText, ArrowLeft, ChevronDown, Store
} from 'lucide-react';

interface POSCartItem {
  product: Product;
  quantity: number;
}

const BRANCHES = ['Pucón', 'Villarrica', 'Temuco', 'Panguipulli'];

export default function StandalonePOSPage() {
  const [activeBranch, setActiveBranch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [lastSaleTotal, setLastSaleTotal] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [showBranchMenu, setShowBranchMenu] = useState(false);

  const filteredProducts = selectedCategory
    ? products.filter((p) => p.categoryId === selectedCategory && p.isAvailable)
    : [];

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(price);

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Get product count per category for badges
  const getProductCount = (catId: string) => products.filter((p) => p.categoryId === catId && p.isAvailable).length;

  // Category emoji map
  const catEmoji: Record<string, string> = {
    'c1': '🍱', 'c2': '🍟', 'c3': '🍣', 'c4': '🔥', 
    'c5': '👑', 'c6': '🥢', 'c7': '🏆', 'c8': '🥤',
  };

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
      const orderItems = cart.map((item) => ({
        id: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        imageUrl: item.product.imageUrl,
      }));

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

      const maxPrepTime = Math.max(...cart.map((i) => i.product.prepTime || 0), 5);

      const orderPayload = {
        customer_name: customerName.trim() || 'Venta Presencial',
        branch_name: activeBranch,
        items: orderItems,
        total: cartTotal,
        status: 'delivered',
        notes: `[POS] Pago: ${method === 'cash' ? 'Efectivo' : 'Tarjeta'}`,
        estimated_wait_time: maxPrepTime,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.from('orders').insert(orderPayload).select().single();
      if (error) throw error;

      // Auto-print
      if (data) {
        try {
          if (ESCPOSPrinter.isConnected('kitchen')) await ESCPOSPrinter.printOrder(data, 'kitchen');
        } catch (e) { console.warn('Kitchen print failed:', e); }
        try {
          if (ESCPOSPrinter.isConnected('cashier')) await ESCPOSPrinter.printOrder(data, 'cashier');
        } catch (e) { console.warn('Cashier print failed:', e); }
      }

      setLastSaleTotal(cartTotal);
      clearCart();
      setTimeout(() => setLastSaleTotal(null), 3000);
    } catch (err: any) {
      alert('Error al procesar la venta: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // --- BRANCH SELECTION SCREEN ---
  if (!activeBranch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-pink-500 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl shadow-pink-500/40">
            <span className="text-white font-black text-5xl italic">C</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Terminal POS</h1>
          <p className="text-gray-400 font-medium mb-10">Clásicos Sushi & Street Food</p>
          
          <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mb-4">Selecciona tu sucursal</p>
          <div className="grid grid-cols-2 gap-3">
            {BRANCHES.map((branch) => (
              <button
                key={branch}
                onClick={() => setActiveBranch(branch)}
                className="py-5 px-6 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-pink-500/50 rounded-2xl text-white font-bold text-lg transition-all active:scale-95 hover:shadow-lg hover:shadow-pink-500/10"
              >
                {branch}
              </button>
            ))}
          </div>

          <Link href="/dashboard" className="inline-flex items-center gap-2 mt-10 text-gray-500 hover:text-gray-300 font-medium transition-colors text-sm">
            <ArrowLeft size={16} /> Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* ============================================ */}
      {/* LEFT: CATEGORIES + PRODUCTS (FULL WIDTH) */}
      {/* ============================================ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOP BAR */}
        <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 shrink-0 shadow-sm">
          {/* Branch Selector */}
          <div className="relative">
            <button
              onClick={() => setShowBranchMenu(!showBranchMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl font-bold text-sm"
            >
              <Store size={16} />
              {activeBranch}
              <ChevronDown size={14} />
            </button>
            {showBranchMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden min-w-[160px]">
                {BRANCHES.map((b) => (
                  <button
                    key={b}
                    onClick={() => { setActiveBranch(b); setShowBranchMenu(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-bold transition-colors ${
                      b === activeBranch ? 'bg-pink-50 text-pink-600' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Breadcrumb / Title */}
          <div className="flex-1 flex items-center gap-2">
            {selectedCategory ? (
              <>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="flex items-center gap-1.5 text-gray-400 hover:text-pink-500 font-bold text-sm transition-colors"
                >
                  <ArrowLeft size={16} />
                  Categorías
                </button>
                <span className="text-gray-300">/</span>
                <span className="font-black text-gray-900 text-sm">
                  {categories.find((c) => c.id === selectedCategory)?.name}
                </span>
              </>
            ) : (
              <span className="font-black text-gray-900 text-sm">Selecciona una categoría</span>
            )}
          </div>

          {/* Printer indicator */}
          {(ESCPOSPrinter.isConnected('kitchen') || ESCPOSPrinter.isConnected('cashier')) && (
            <div className="flex items-center gap-1.5 text-xs text-green-600 font-bold bg-green-50 px-3 py-1.5 rounded-full shrink-0">
              <Printer size={12} /> Impresora
            </div>
          )}

          {/* Back to Dashboard */}
          <Link
            href="/dashboard"
            className="text-gray-400 hover:text-gray-600 transition-colors shrink-0 p-2"
            title="Volver al Dashboard"
          >
            <ArrowLeft size={18} />
          </Link>
        </div>

        {/* ============================================ */}
        {/* MAIN CONTENT: CATEGORIES or PRODUCTS */}
        {/* ============================================ */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedCategory ? (
            /* ---- CATEGORY GRID ---- */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {categories.map((cat) => {
                const count = getProductCount(cat.id);
                const emoji = catEmoji[cat.id] || '📦';
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className="flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-gray-100 hover:border-pink-300 p-6 md:p-8 text-center transition-all active:scale-[0.95] shadow-sm hover:shadow-xl hover:shadow-pink-500/10 group"
                  >
                    <span className="text-5xl md:text-6xl mb-3 group-hover:scale-110 transition-transform">{emoji}</span>
                    <h3 className="font-black text-gray-900 text-base md:text-lg leading-tight mb-1">
                      {cat.name}
                    </h3>
                    <span className="text-xs font-bold text-gray-400">
                      {count} {count === 1 ? 'producto' : 'productos'}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            /* ---- PRODUCT GRID ---- */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
              {filteredProducts.map((product) => {
                const inCart = cart.find((i) => i.product.id === product.id);
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`relative flex flex-col bg-white rounded-2xl border-2 p-3.5 text-left transition-all active:scale-[0.96] shadow-sm hover:shadow-md ${
                      inCart
                        ? 'border-pink-400 ring-2 ring-pink-100'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    {inCart && (
                      <span className="absolute -top-2 -right-2 w-7 h-7 bg-pink-500 text-white rounded-full flex items-center justify-center text-xs font-black shadow-lg z-10">
                        {inCart.quantity}
                      </span>
                    )}
                    <h3 className="font-bold text-gray-900 text-[12px] leading-tight mb-2 line-clamp-2 min-h-[32px]">
                      {product.name}
                    </h3>
                    <span className="font-black text-pink-600 text-base mt-auto">
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
          )}
        </div>
      </div>


      {/* ============================================ */}
      {/* RIGHT: TICKET / CART SIDEBAR */}
      {/* ============================================ */}
      <div className="w-[320px] lg:w-[360px] bg-white border-l border-gray-200 flex flex-col shrink-0 shadow-xl">
        {/* HEADER */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-900 text-white">
          <div className="flex items-center gap-2">
            <ReceiptText size={18} />
            <h2 className="font-black text-base tracking-tight">TICKET</h2>
            {cartItemCount > 0 && (
              <span className="bg-pink-500 text-white text-xs font-black px-2 py-0.5 rounded-full">
                {cartItemCount}
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-gray-400 hover:text-red-400 transition-colors p-1">
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {/* CUSTOMER NAME */}
        <div className="px-4 py-2 border-b border-gray-50 shrink-0">
          <input
            type="text"
            placeholder="Nombre del cliente (opcional)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>

        {/* CART ITEMS */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
              <ShoppingCart className="w-14 h-14 text-gray-200 mb-3" />
              <p className="font-bold text-sm">Ticket vacío</p>
              <p className="text-xs mt-1">Toca un producto para agregarlo</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {cart.map((item, idx) => (
                <div
                  key={item.product.id}
                  className="flex items-center gap-2 py-2 px-2 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <span className="text-gray-300 text-xs font-mono w-4 shrink-0">{idx + 1}</span>
                  
                  {/* QTY CONTROLS */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-500 active:scale-90 transition-all"
                    >
                      <Minus size={12} strokeWidth={3} />
                    </button>
                    <span className="w-6 text-center font-black text-xs">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="w-6 h-6 rounded-md bg-pink-50 flex items-center justify-center text-pink-600 hover:bg-pink-500 hover:text-white active:scale-90 transition-all"
                    >
                      <Plus size={12} strokeWidth={3} />
                    </button>
                  </div>

                  <p className="flex-1 font-bold text-gray-800 text-[12px] truncate min-w-0">{item.product.name}</p>

                  <span className="font-black text-gray-900 text-xs shrink-0">
                    {formatPrice(item.product.price * item.quantity)}
                  </span>

                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SUCCESS MESSAGE */}
        {lastSaleTotal !== null && (
          <div className="mx-3 mb-2 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 animate-in slide-in-from-bottom duration-300">
            <CheckCircle2 className="text-green-500 shrink-0" size={18} />
            <div>
              <p className="text-green-800 font-black text-sm">¡Venta Registrada!</p>
              <p className="text-green-600 text-xs font-bold">{formatPrice(lastSaleTotal)}</p>
            </div>
          </div>
        )}

        {/* TOTAL + PAYMENT BUTTONS */}
        <div className="border-t-2 border-gray-900 p-4 space-y-3 shrink-0 bg-gray-50/80">
          <div className="flex items-center justify-between px-1">
            <span className="text-gray-500 font-bold text-sm uppercase tracking-widest">Total</span>
            <span className="text-3xl font-black text-gray-900">{formatPrice(cartTotal)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handlePayment('cash')}
              disabled={cart.length === 0 || processing}
              className="flex flex-col items-center justify-center gap-1 py-4 rounded-2xl bg-green-500 hover:bg-green-600 active:scale-95 text-white font-black text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-green-500/30"
            >
              <Banknote size={22} />
              <span>EFECTIVO</span>
            </button>
            <button
              onClick={() => handlePayment('card')}
              disabled={cart.length === 0 || processing}
              className="flex flex-col items-center justify-center gap-1 py-4 rounded-2xl bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-black text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
            >
              <CreditCard size={22} />
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

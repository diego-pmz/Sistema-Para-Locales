'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { categories, products } from '@/lib/mock-db';
import { Product } from '@/types';
import { supabase } from '@/lib/supabase';
import { ESCPOSPrinter } from '@/lib/printer';
import Link from 'next/link';
import {
  ShoppingCart, Trash2, Plus, Minus, X, Banknote, CreditCard,
  Printer, CheckCircle2, ReceiptText, ArrowLeft, ChevronDown, Store,
  Menu, XCircle, TrendingUp, Package, Settings, FileText,
  Bookmark, ChevronRight, Clock, DollarSign, Bluetooth, ChefHat,
  UserCircle, AlertTriangle, RefreshCcw, Save, FolderOpen,
  Pencil, Eye, EyeOff, GripVertical
} from 'lucide-react';

// ─── TYPES ─────────────────────────────────────────────
interface POSCartItem {
  product: Product;
  quantity: number;
}

interface ParkedTicket {
  id: string;
  items: POSCartItem[];
  customerName: string;
  comment: string;
  parkedAt: string;
  total: number;
}

interface PrinterState {
  isConnected: boolean;
  isConnecting: boolean;
  errorDetails: string | null;
}

type POSView = 'sales' | 'shift' | 'products' | 'settings' | 'receipts';
type PrinterRole = 'kitchen' | 'cashier';

const BRANCHES = ['Pucón', 'Villarrica', 'Temuco', 'Panguipulli'];

const catEmoji: Record<string, string> = {
  'c1': '🍱', 'c2': '🍟', 'c3': '🍣', 'c4': '🔥',
  'c5': '👑', 'c6': '🥢', 'c7': '🏆', 'c8': '🥤',
};

// ─── MAIN COMPONENT ────────────────────────────────────
export default function StandalonePOSPage() {
  // Core state
  const [activeBranch, setActiveBranch] = useState('');
  const [activeView, setActiveView] = useState<POSView>('sales');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sales view
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [editMode, setEditMode] = useState(false);
  const dragItem = useRef<string | null>(null);
  const dragOverItem = useRef<string | null>(null);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);

  // POS Layout customization (stored in localStorage)
  const [hiddenProducts, setHiddenProducts] = useState<Set<string>>(new Set());
  const [productOrder, setProductOrder] = useState<Record<string, string[]>>({});
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);

  // Payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastSaleTotal, setLastSaleTotal] = useState<number | null>(null);

  // Multi-ticket system
  const [parkedTickets, setParkedTickets] = useState<ParkedTicket[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [parkModalOpen, setParkModalOpen] = useState(false);
  const [parkName, setParkName] = useState('');
  const [parkComment, setParkComment] = useState('');

  // Shift / Receipts data
  const [shiftData, setShiftData] = useState<any>(null);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Printer state
  const [kitchenPrinter, setKitchenPrinter] = useState<PrinterState>({ isConnected: false, isConnecting: false, errorDetails: null });
  const [cashierPrinter, setCashierPrinter] = useState<PrinterState>({ isConnected: false, isConnecting: false, errorDetails: null });

  // Branch menu
  const [showBranchMenu, setShowBranchMenu] = useState(false);

  // Load parked tickets + POS layout from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pos-parked-tickets');
    if (saved) setParkedTickets(JSON.parse(saved));
    const layout = localStorage.getItem('pos-layout');
    if (layout) {
      const parsed = JSON.parse(layout);
      setHiddenProducts(new Set(parsed.hidden || []));
      setProductOrder(parsed.order || {});
      setHiddenCategories(new Set(parsed.hiddenCats || []));
      setCategoryOrder(parsed.catOrder || []);
    }
  }, []);

  // Save parked tickets to localStorage
  const saveParkedToStorage = (tickets: ParkedTicket[]) => {
    setParkedTickets(tickets);
    localStorage.setItem('pos-parked-tickets', JSON.stringify(tickets));
  };

  // ─── HELPERS ───────────────────────────────────────────
  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(price);

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const getProductCount = (catId: string) => getOrderedProducts(catId).filter((p) => !hiddenProducts.has(p.id)).length;

  // Get products for a category, respecting custom order
  const getOrderedProducts = (catId: string) => {
    const catProducts = products.filter((p) => p.categoryId === catId && p.isAvailable);
    const order = productOrder[catId];
    if (!order) return catProducts;
    const ordered: Product[] = [];
    for (const id of order) {
      const p = catProducts.find((x) => x.id === id);
      if (p) ordered.push(p);
    }
    // Add any products not in the custom order (new products)
    for (const p of catProducts) {
      if (!order.includes(p.id)) ordered.push(p);
    }
    return ordered;
  };

  const filteredProducts = selectedCategory
    ? getOrderedProducts(selectedCategory).filter((p) => !hiddenProducts.has(p.id))
    : [];

  // Save POS layout to localStorage
  const savePOSLayout = (hidden: Set<string>, order: Record<string, string[]>, hidCats?: Set<string>, catOrd?: string[]) => {
    const h = hidCats ?? hiddenCategories;
    const co = catOrd ?? categoryOrder;
    setHiddenProducts(hidden);
    setProductOrder(order);
    setHiddenCategories(h);
    setCategoryOrder(co);
    localStorage.setItem('pos-layout', JSON.stringify({
      hidden: Array.from(hidden), order,
      hiddenCats: Array.from(h), catOrder: co,
    }));
  };

  const toggleProductVisibility = (productId: string) => {
    const newHidden = new Set(hiddenProducts);
    if (newHidden.has(productId)) newHidden.delete(productId);
    else newHidden.add(productId);
    savePOSLayout(newHidden, productOrder);
  };

  const moveProduct = (catId: string, fromId: string, toId: string) => {
    if (fromId === toId) return;
    const catProducts = products.filter((p) => p.categoryId === catId && p.isAvailable);
    const currentOrder = productOrder[catId] || catProducts.map((p) => p.id);
    const fromIdx = currentOrder.indexOf(fromId);
    const toIdx = currentOrder.indexOf(toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const newOrder = [...currentOrder];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, fromId);
    savePOSLayout(hiddenProducts, { ...productOrder, [catId]: newOrder });
  };

  const toggleCategoryVisibility = (catId: string) => {
    const newHidden = new Set(hiddenCategories);
    if (newHidden.has(catId)) newHidden.delete(catId);
    else newHidden.add(catId);
    savePOSLayout(hiddenProducts, productOrder, newHidden);
  };

  const moveCategory = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const currentOrder = categoryOrder.length > 0 ? [...categoryOrder] : categories.map((c) => c.id);
    const fromIdx = currentOrder.indexOf(fromId);
    const toIdx = currentOrder.indexOf(toId);
    if (fromIdx === -1 || toIdx === -1) return;
    currentOrder.splice(fromIdx, 1);
    currentOrder.splice(toIdx, 0, fromId);
    savePOSLayout(hiddenProducts, productOrder, undefined, currentOrder);
  };

  // Get ordered categories
  const getOrderedCategories = () => {
    if (categoryOrder.length === 0) return categories;
    const ordered: typeof categories = [];
    for (const id of categoryOrder) {
      const c = categories.find((x) => x.id === id);
      if (c) ordered.push(c);
    }
    for (const c of categories) {
      if (!categoryOrder.includes(c.id)) ordered.push(c);
    }
    return ordered;
  };

  // ─── CART OPERATIONS ───────────────────────────────────
  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => item.product.id === productId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item)
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

  // ─── MULTI-TICKET SYSTEM ──────────────────────────────
  // Auto-save cart changes back to the active ticket
  const autoSaveActiveTicket = useCallback((newCart: POSCartItem[], newName?: string) => {
    if (!activeTicketId) return;
    setParkedTickets((prev) => {
      const updated = prev.map((t) =>
        t.id === activeTicketId
          ? { ...t, items: newCart, total: newCart.reduce((s, i) => s + i.product.price * i.quantity, 0), customerName: newName ?? t.customerName }
          : t
      );
      localStorage.setItem('pos-parked-tickets', JSON.stringify(updated));
      return updated;
    });
  }, [activeTicketId]);

  // Override addToCart to also auto-save
  useEffect(() => {
    if (activeTicketId && cart.length >= 0) {
      autoSaveActiveTicket(cart);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, activeTicketId]);

  // Save name changes to active ticket
  useEffect(() => {
    if (activeTicketId && customerName !== undefined) {
      autoSaveActiveTicket(cart, customerName || 'Sin nombre');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerName]);

  // Open the park modal for NEW tickets only
  const openParkModal = () => {
    if (cart.length === 0) return;
    setParkName(customerName);
    setParkComment('');
    setParkModalOpen(true);
  };

  // Confirm saving a NEW ticket
  const confirmParkTicket = () => {
    const ticket: ParkedTicket = {
      id: Date.now().toString(),
      items: [...cart],
      customerName: parkName.trim() || 'Sin nombre',
      comment: parkComment.trim(),
      parkedAt: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      total: cartTotal,
    };
    saveParkedToStorage([...parkedTickets, ticket]);
    setActiveTicketId(ticket.id);
    setCustomerName(ticket.customerName === 'Sin nombre' ? '' : ticket.customerName);
    setParkModalOpen(false);
    setParkName('');
    setParkComment('');
  };

  // Open (expand) a saved ticket
  const openTicket = (ticketId: string) => {
    if (activeTicketId === ticketId) {
      // Minimize: deselect, clear cart to "new ticket" state
      setActiveTicketId(null);
      setCart([]);
      setCustomerName('');
      return;
    }
    const ticket = parkedTickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    setActiveTicketId(ticketId);
    setCart(ticket.items);
    setCustomerName(ticket.customerName === 'Sin nombre' ? '' : ticket.customerName);
  };

  // Start a new empty ticket (deselect active)
  const startNewTicket = () => {
    setActiveTicketId(null);
    setCart([]);
    setCustomerName('');
  };

  const deleteParkedTicket = (ticketId: string) => {
    if (activeTicketId === ticketId) {
      setActiveTicketId(null);
      setCart([]);
      setCustomerName('');
    }
    saveParkedToStorage(parkedTickets.filter((t) => t.id !== ticketId));
  };

  // ─── PAYMENT ─────────────────────────────────────────
  const handlePayment = async (method: 'cash' | 'card' | 'other') => {
    if (cart.length === 0 || !activeBranch) return;
    setProcessing(true);

    try {
      const orderItems = cart.map((item) => ({
        id: item.product.id, name: item.product.name,
        price: item.product.price, quantity: item.quantity, imageUrl: item.product.imageUrl,
      }));

      const methodLabel = method === 'cash' ? 'Efectivo' : method === 'card' ? 'Tarjeta' : 'Otro';

      orderItems.push({
        id: '_payment', name: '_payment', price: 0, quantity: 1, imageUrl: '',
        _isPaymentMetadata: true,
        method: method === 'card' ? 'online' : 'presencial',
        isPaidOnline: method === 'card',
      } as any);

      const orderPayload = {
        customer_name: (customerName.trim() || 'Venta Presencial') + ` [POS-${methodLabel}]`,
        branch_name: activeBranch,
        items: orderItems,
        total: cartTotal,
        status: 'delivered',
      };

      const { data, error } = await supabase.from('orders').insert(orderPayload).select().single();
      if (error) throw error;

      // Auto-print
      if (data) {
        try { if (ESCPOSPrinter.isConnected('kitchen')) await ESCPOSPrinter.printOrder(data, 'kitchen'); } catch {}
        try { if (ESCPOSPrinter.isConnected('cashier')) await ESCPOSPrinter.printOrder(data, 'cashier'); } catch {}
      }

      setLastSaleTotal(cartTotal);
      setPaymentModalOpen(false);

      // Remove the ticket from parked list if it was a saved ticket
      if (activeTicketId) {
        saveParkedToStorage(parkedTickets.filter((t) => t.id !== activeTicketId));
        setActiveTicketId(null);
      }
      clearCart();
      setTimeout(() => setLastSaleTotal(null), 3000);
    } catch (err: any) {
      alert('Error al procesar la venta: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // ─── DATA LOADERS ──────────────────────────────────
  const loadShiftData = async () => {
    if (!activeBranch) return;
    setLoadingData(true);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('branch_name', activeBranch)
      .gte('created_at', todayStart.toISOString())
      .ilike('customer_name', '%[POS-%')
      .order('created_at', { ascending: false });

    if (data) {
      const cashSales = data.filter((o: any) => o.customer_name?.includes('[POS-Efectivo]'));
      const cardSales = data.filter((o: any) => o.customer_name?.includes('[POS-Tarjeta]'));
      const otherSales = data.filter((o: any) => o.customer_name?.includes('[POS-Otro]'));
      setShiftData({
        total: data.reduce((s: number, o: any) => s + (o.total || 0), 0),
        count: data.length,
        cash: { count: cashSales.length, total: cashSales.reduce((s: number, o: any) => s + (o.total || 0), 0) },
        card: { count: cardSales.length, total: cardSales.reduce((s: number, o: any) => s + (o.total || 0), 0) },
        other: { count: otherSales.length, total: otherSales.reduce((s: number, o: any) => s + (o.total || 0), 0) },
      });
    }
    setLoadingData(false);
  };

  const loadReceipts = async () => {
    if (!activeBranch) return;
    setLoadingData(true);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('branch_name', activeBranch)
      .gte('created_at', todayStart.toISOString())
      .ilike('customer_name', '%[POS-%')
      .order('created_at', { ascending: false });

    if (data) setReceipts(data);
    setLoadingData(false);
  };

  // Load data when switching views
  useEffect(() => {
    if (activeView === 'shift') loadShiftData();
    if (activeView === 'receipts') loadReceipts();
  }, [activeView, activeBranch]);

  // ─── PRINTER HANDLERS ──────────────────────────────
  const handlePrinterConnect = async (role: PrinterRole) => {
    const setState = role === 'kitchen' ? setKitchenPrinter : setCashierPrinter;
    setState((prev) => ({ ...prev, isConnecting: true, errorDetails: null }));
    try {
      await ESCPOSPrinter.connect(role);
      setState((prev) => ({ ...prev, isConnected: true }));
    } catch (error: any) {
      setState((prev) => ({ ...prev, errorDetails: error.message || 'Error', isConnected: false }));
    } finally {
      setState((prev) => ({ ...prev, isConnecting: false }));
    }
  };

  const handlePrinterDisconnect = (role: PrinterRole) => {
    ESCPOSPrinter.disconnect(role);
    const setState = role === 'kitchen' ? setKitchenPrinter : setCashierPrinter;
    setState((prev) => ({ ...prev, isConnected: false }));
  };

  const handleTestPrint = async (role: PrinterRole) => {
    try {
      await ESCPOSPrinter.testPrint(role);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  // ─── SIDEBAR NAV ITEMS ─────────────────────────────
  const navItems: { id: POSView; label: string; icon: any; emoji: string }[] = [
    { id: 'sales', label: 'Ventas', icon: ShoppingCart, emoji: '🛒' },
    { id: 'shift', label: 'Turno', icon: TrendingUp, emoji: '📊' },
    { id: 'products', label: 'Productos', icon: Package, emoji: '📦' },
    { id: 'settings', label: 'Configuración', icon: Settings, emoji: '⚙️' },
    { id: 'receipts', label: 'Recibos', icon: FileText, emoji: '🧾' },
  ];

  // ─── BRANCH SELECTION SCREEN ─────────────────────────
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
              <button key={branch} onClick={() => setActiveBranch(branch)}
                className="py-5 px-6 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-pink-500/50 rounded-2xl text-white font-bold text-lg transition-all active:scale-95 hover:shadow-lg hover:shadow-pink-500/10">
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

  // ════════════════════════════════════════════════════════
  //  RENDER VIEWS
  // ════════════════════════════════════════════════════════

  const renderSalesView = () => {
    // In edit mode, show ALL products (including hidden) so they can be toggled back on
    const editProducts = selectedCategory
      ? getOrderedProducts(selectedCategory)
      : [];
    const displayProducts = editMode ? editProducts : filteredProducts;

    return (
      <div className="flex-1 overflow-y-auto p-4">
        {!selectedCategory ? (
          <>
            {/* EDIT MODE TOGGLE for categories */}
            <div className="flex items-center justify-end mb-3 gap-2">
              <button
                onClick={() => setEditMode(!editMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                  editMode
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Pencil size={14} />
                {editMode ? 'Listo' : 'Editar'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {(() => {
                const orderedCats = getOrderedCategories();
                const displayCats = editMode ? orderedCats : orderedCats.filter((c) => !hiddenCategories.has(c.id));
                return displayCats.map((cat, idx) => {
                  const count = getProductCount(cat.id);
                  const emoji = catEmoji[cat.id] || '📦';
                  const isHidden = hiddenCategories.has(cat.id);

                  if (editMode) {
                    return (
                      <div key={cat.id}
                        draggable
                        onDragStart={() => { dragItem.current = cat.id; setDragActiveId(cat.id); }}
                        onDragEnter={() => { dragOverItem.current = cat.id; }}
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnd={() => { if (dragItem.current && dragOverItem.current) moveCategory(dragItem.current, dragOverItem.current); dragItem.current = null; dragOverItem.current = null; setDragActiveId(null); }}
                        className={`flex flex-col items-center justify-center bg-white rounded-3xl border-2 p-6 md:p-8 text-center transition-all shadow-sm cursor-grab active:cursor-grabbing select-none ${
                          isHidden ? 'opacity-40 border-gray-200 bg-gray-50' : dragActiveId === cat.id ? 'border-amber-400 ring-2 ring-amber-200 scale-105 shadow-xl z-10' : 'border-gray-100 hover:border-amber-300'
                        }`}>
                        {/* Controls row */}
                        <div className="flex items-center gap-2 mb-3 w-full justify-between">
                          <GripVertical size={16} className="text-gray-300" />
                          <button onClick={(e) => { e.stopPropagation(); toggleCategoryVisibility(cat.id); }}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-90 ${
                              isHidden ? 'bg-red-50 text-red-400 hover:bg-red-100' : 'bg-green-50 text-green-500 hover:bg-green-100'
                            }`}>
                            {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                        <span className="text-4xl md:text-5xl mb-2 pointer-events-none">{emoji}</span>
                        <h3 className="font-black text-gray-900 text-sm md:text-base leading-tight mb-1 pointer-events-none">{cat.name}</h3>
                        <span className="text-xs font-bold text-gray-400 pointer-events-none">{count} productos</span>
                      </div>
                    );
                  }

                  return (
                    <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                      className="flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-gray-100 hover:border-pink-300 p-6 md:p-8 text-center transition-all active:scale-[0.95] shadow-sm hover:shadow-xl hover:shadow-pink-500/10 group">
                      <span className="text-5xl md:text-6xl mb-3 group-hover:scale-110 transition-transform">{emoji}</span>
                      <h3 className="font-black text-gray-900 text-base md:text-lg leading-tight mb-1">{cat.name}</h3>
                      <span className="text-xs font-bold text-gray-400">{count} productos</span>
                    </button>
                  );
                });
              })()}
            </div>
          </>
        ) : (
          <>
            {/* EDIT MODE TOGGLE */}
            <div className="flex items-center justify-end mb-3 gap-2">
              <button
                onClick={() => setEditMode(!editMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                  editMode
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Pencil size={14} />
                {editMode ? 'Listo' : 'Editar'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
              {displayProducts.map((product, idx) => {
                const inCart = cart.find((i) => i.product.id === product.id);
                const isHidden = hiddenProducts.has(product.id);

                if (editMode) {
                  return (
                    <div key={product.id}
                      draggable
                      onDragStart={() => { dragItem.current = product.id; setDragActiveId(product.id); }}
                      onDragEnter={() => { dragOverItem.current = product.id; }}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnd={() => { if (dragItem.current && dragOverItem.current && selectedCategory) moveProduct(selectedCategory, dragItem.current, dragOverItem.current); dragItem.current = null; dragOverItem.current = null; setDragActiveId(null); }}
                      className={`relative flex flex-col bg-white rounded-2xl border-2 p-3 text-left transition-all shadow-sm cursor-grab active:cursor-grabbing select-none ${
                        isHidden ? 'opacity-40 border-gray-200 bg-gray-50' : dragActiveId === product.id ? 'border-amber-400 ring-2 ring-amber-200 scale-105 shadow-xl z-10' : 'border-gray-100 hover:border-amber-300'
                      }`}>
                      {/* Drag handle + toggle */}
                      <div className="flex justify-between items-center mb-2">
                        <GripVertical size={16} className="text-gray-300" />
                        <button onClick={(e) => { e.stopPropagation(); toggleProductVisibility(product.id); }}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-90 ${
                            isHidden ? 'bg-red-50 text-red-400 hover:bg-red-100' : 'bg-green-50 text-green-500 hover:bg-green-100'
                          }`}>
                          {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      <h3 className="font-bold text-gray-900 text-[12px] leading-tight mb-2 line-clamp-2 min-h-[32px] pointer-events-none">{product.name}</h3>
                      <span className="font-black text-pink-600 text-sm mt-auto pointer-events-none">{formatPrice(product.price)}</span>
                    </div>
                  );
                }

                // Normal mode
                return (
                  <button key={product.id} onClick={() => addToCart(product)}
                    className={`relative flex flex-col bg-white rounded-2xl border-2 p-3.5 text-left transition-all active:scale-[0.96] shadow-sm hover:shadow-md ${inCart ? 'border-pink-400 ring-2 ring-pink-100' : 'border-gray-100 hover:border-gray-200'}`}>
                    {inCart && (
                      <span className="absolute -top-2 -right-2 w-7 h-7 bg-pink-500 text-white rounded-full flex items-center justify-center text-xs font-black shadow-lg z-10">{inCart.quantity}</span>
                    )}
                    <h3 className="font-bold text-gray-900 text-[12px] leading-tight mb-2 line-clamp-2 min-h-[32px]">{product.name}</h3>
                    <span className="font-black text-pink-600 text-base mt-auto">{formatPrice(product.price)}</span>
                  </button>
                );
              })}
              {displayProducts.length === 0 && (
                <div className="col-span-full text-center py-16 text-gray-400"><p className="font-bold text-lg">No hay productos</p></div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderShiftView = () => (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-gray-900">📊 Turno del Día</h2>
          <button onClick={loadShiftData} className="text-sm font-bold text-pink-500 hover:text-pink-600 flex items-center gap-1">
            <RefreshCcw size={14} /> Actualizar
          </button>
        </div>

        {loadingData ? (
          <div className="text-center py-20 text-gray-400"><RefreshCcw className="w-8 h-8 animate-spin mx-auto mb-2" /><p className="font-bold">Cargando...</p></div>
        ) : !shiftData ? (
          <div className="text-center py-20 text-gray-400"><TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-200" /><p className="font-bold">No hay datos del turno</p></div>
        ) : (
          <div className="space-y-4">
            {/* Total */}
            <div className="bg-gray-900 text-white rounded-2xl p-6 text-center">
              <p className="text-gray-400 font-bold text-sm uppercase tracking-widest mb-1">Venta Total del Día</p>
              <p className="text-4xl font-black">{formatPrice(shiftData.total)}</p>
              <p className="text-gray-400 text-sm mt-1">{shiftData.count} {shiftData.count === 1 ? 'venta' : 'ventas'}</p>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                <Banknote className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-green-700 uppercase tracking-widest">Efectivo</p>
                <p className="text-xl font-black text-green-800 mt-1">{formatPrice(shiftData.cash.total)}</p>
                <p className="text-xs text-green-600">{shiftData.cash.count} ventas</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
                <CreditCard className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">Tarjeta</p>
                <p className="text-xl font-black text-blue-800 mt-1">{formatPrice(shiftData.card.total)}</p>
                <p className="text-xs text-blue-600">{shiftData.card.count} ventas</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-center">
                <DollarSign className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-purple-700 uppercase tracking-widest">Otros</p>
                <p className="text-xl font-black text-purple-800 mt-1">{formatPrice(shiftData.other.total)}</p>
                <p className="text-xs text-purple-600">{shiftData.other.count} ventas</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderProductsView = () => {
    const resetLayout = () => {
      savePOSLayout(new Set(), {}, new Set(), []);
    };

    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-black text-gray-900">📦 Gestión de Productos</h2>
            <button onClick={resetLayout} className="text-xs font-bold text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
              Resetear Layout
            </button>
          </div>
          <p className="text-gray-500 text-sm mb-6">Arrastra para reorganizar y usa los toggles para mostrar/ocultar. Los cambios se guardan automáticamente.</p>

          {categories.map((cat) => {
            const orderedProducts = getOrderedProducts(cat.id);
            const visibleCount = orderedProducts.filter((p) => !hiddenProducts.has(p.id)).length;
            return (
              <div key={cat.id} className="mb-6">
                <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest mb-2 flex items-center gap-2">
                  <span>{catEmoji[cat.id] || '📦'}</span> {cat.name}
                  <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{visibleCount}/{orderedProducts.length}</span>
                </h3>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm divide-y divide-gray-50">
                  {orderedProducts.map((p) => {
                    const isHidden = hiddenProducts.has(p.id);
                    return (
                      <div key={p.id}
                        draggable
                        onDragStart={() => { dragItem.current = p.id; setDragActiveId(p.id); }}
                        onDragEnter={() => { dragOverItem.current = p.id; }}
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnd={() => { if (dragItem.current && dragOverItem.current) moveProduct(cat.id, dragItem.current, dragOverItem.current); dragItem.current = null; dragOverItem.current = null; setDragActiveId(null); }}
                        className={`flex items-center gap-3 px-4 py-3 transition-colors cursor-grab active:cursor-grabbing select-none ${isHidden ? 'opacity-40 bg-gray-50' : ''} ${dragActiveId === p.id ? 'bg-amber-50 border-l-4 border-l-amber-400' : ''}`}>
                        {/* Drag handle */}
                        <GripVertical size={16} className="text-gray-300 shrink-0" />

                        {/* Product info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800 text-sm truncate">{p.name}</p>
                          <p className="text-xs text-gray-400">{formatPrice(p.price)}</p>
                        </div>

                        {/* Toggle switch */}
                        <button onClick={(e) => { e.stopPropagation(); toggleProductVisibility(p.id); }}
                          className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${isHidden ? 'bg-gray-300' : 'bg-green-500'}`}>
                          <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all ${isHidden ? 'left-0.5' : 'left-[22px]'}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSettingsView = () => {
    const renderPrinterCard = (role: PrinterRole, title: string, Icon: any, state: PrinterState) => (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${state.isConnected ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
            {state.isConnected ? <CheckCircle2 size={20} /> : <Icon size={20} />}
          </div>
          <div>
            <h4 className="font-black text-gray-900">{title}</h4>
            <p className="text-xs text-gray-400">{state.isConnected ? 'Conectada y lista' : 'No conectada'}</p>
          </div>
        </div>

        {!state.isConnected ? (
          <button onClick={() => handlePrinterConnect(role)} disabled={state.isConnecting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50">
            {state.isConnecting ? <RefreshCcw className="animate-spin w-4 h-4" /> : <Bluetooth size={16} />}
            {state.isConnecting ? 'Vinculando...' : 'Buscar Impresora'}
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => handleTestPrint(role)} className="flex-1 px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors">
              Ticket Prueba
            </button>
            <button onClick={() => handlePrinterDisconnect(role)} className="px-4 py-2.5 border-2 border-red-200 text-red-600 hover:bg-red-50 font-bold rounded-xl text-sm transition-colors">
              Desvincular
            </button>
          </div>
        )}

        {state.errorDetails && (
          <p className="text-red-500 text-xs font-bold bg-red-50 p-2 rounded-lg mt-3 flex items-center gap-1">
            <AlertTriangle size={12} /> {state.errorDetails}
          </p>
        )}
      </div>
    );

    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg mx-auto">
          <h2 className="text-2xl font-black text-gray-900 mb-2">⚙️ Configuración</h2>
          <p className="text-gray-500 text-sm mb-6">Conecta tus impresoras térmicas Bluetooth.</p>
          {renderPrinterCard('kitchen', 'Impresora de Cocina', ChefHat, kitchenPrinter)}
          {renderPrinterCard('cashier', 'Impresora de Caja', UserCircle, cashierPrinter)}
        </div>
      </div>
    );
  };

  const renderReceiptsView = () => (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-gray-900">🧾 Recibos del Día</h2>
          <button onClick={loadReceipts} className="text-sm font-bold text-pink-500 hover:text-pink-600 flex items-center gap-1">
            <RefreshCcw size={14} /> Actualizar
          </button>
        </div>

        {loadingData ? (
          <div className="text-center py-20 text-gray-400"><RefreshCcw className="w-8 h-8 animate-spin mx-auto mb-2" /><p className="font-bold">Cargando...</p></div>
        ) : receipts.length === 0 ? (
          <div className="text-center py-20 text-gray-400"><ReceiptText className="w-16 h-16 mx-auto mb-4 text-gray-200" /><p className="font-bold">No hay recibos hoy</p></div>
        ) : (
          <div className="space-y-3">
            {receipts.map((order: any) => {
              const items = (order.items || []).filter((i: any) => i.id !== '_payment');
              const payMethod = order.customer_name?.includes('[POS-Efectivo]') ? '💵 Efectivo' : order.customer_name?.includes('[POS-Tarjeta]') ? '💳 Tarjeta' : '💰 Otro';
              const time = new Date(order.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

              return (
                <details key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group">
                  <summary className="flex items-center gap-3 px-5 py-4 cursor-pointer list-none hover:bg-gray-50 transition-colors">
                    <Clock size={14} className="text-gray-400 shrink-0" />
                    <span className="font-mono text-sm text-gray-500">{time}</span>
                    <span className="font-bold text-gray-800 flex-1 truncate">{order.customer_name}</span>
                    <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{payMethod}</span>
                    <span className="font-black text-gray-900">{formatPrice(order.total)}</span>
                    <ChevronRight size={16} className="text-gray-400 group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="border-t border-gray-50 px-5 py-3 bg-gray-50/50 space-y-1">
                    {items.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                          <span className="font-bold text-gray-400 mr-2">{item.quantity}x</span>
                          {item.name}
                        </span>
                        <span className="font-bold text-gray-700">{formatPrice(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════
  //  MAIN RENDER
  // ════════════════════════════════════════════════════════
  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 relative">

      {/* ── HAMBURGER SIDEBAR OVERLAY ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-72 bg-gray-900 text-white flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            {/* Header */}
            <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-500 rounded-xl flex items-center justify-center">
                  <span className="text-white font-black text-xl italic">C</span>
                </div>
                <div>
                  <h2 className="font-black text-base tracking-tight">Terminal POS</h2>
                  <p className="text-xs text-gray-400">{activeBranch}</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            {/* Nav Items */}
            <nav className="flex-1 py-4 space-y-1 px-3">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActiveView(item.id); setSidebarOpen(false); if (item.id === 'sales') setSelectedCategory(null); }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold text-sm transition-all ${
                    activeView === item.id
                      ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30'
                      : 'text-gray-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="text-lg">{item.emoji}</span>
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/10">
              <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-gray-200 font-medium text-sm transition-colors">
                <ArrowLeft size={16} /> Volver al Dashboard
              </Link>
            </div>
          </div>

          {/* Backdrop */}
          <div className="flex-1 bg-black/50" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* ── LEFT: MAIN CONTENT AREA ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOP BAR */}
        <div className="bg-white border-b border-gray-200 px-3 py-2.5 flex items-center gap-3 shrink-0 shadow-sm">
          {/* Hamburger */}
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <Menu size={22} className="text-gray-700" />
          </button>

          {/* Branch Selector */}
          <div className="relative">
            <button onClick={() => setShowBranchMenu(!showBranchMenu)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-xl font-bold text-sm">
              <Store size={14} /> {activeBranch} <ChevronDown size={12} />
            </button>
            {showBranchMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden min-w-[160px]">
                {BRANCHES.map((b) => (
                  <button key={b} onClick={() => { setActiveBranch(b); setShowBranchMenu(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-bold transition-colors ${b === activeBranch ? 'bg-pink-50 text-pink-600' : 'text-gray-700 hover:bg-gray-50'}`}>
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Breadcrumb */}
          <div className="flex-1 flex items-center gap-2">
            {activeView === 'sales' && selectedCategory ? (
              <>
                <button onClick={() => setSelectedCategory(null)} className="flex items-center gap-1.5 text-gray-400 hover:text-pink-500 font-bold text-sm transition-colors">
                  <ArrowLeft size={16} /> Categorías
                </button>
                <span className="text-gray-300">/</span>
                <span className="font-black text-gray-900 text-sm">{categories.find((c) => c.id === selectedCategory)?.name}</span>
              </>
            ) : (
              <span className="font-black text-gray-900 text-sm">
                {navItems.find((n) => n.id === activeView)?.emoji} {navItems.find((n) => n.id === activeView)?.label}
              </span>
            )}
          </div>

          {/* Printer */}
          {(ESCPOSPrinter.isConnected('kitchen') || ESCPOSPrinter.isConnected('cashier')) && (
            <div className="flex items-center gap-1.5 text-xs text-green-600 font-bold bg-green-50 px-3 py-1.5 rounded-full shrink-0">
              <Printer size={12} /> 🖨
            </div>
          )}
        </div>

        {/* VIEW CONTENT */}
        {activeView === 'sales' && renderSalesView()}
        {activeView === 'shift' && renderShiftView()}
        {activeView === 'products' && renderProductsView()}
        {activeView === 'settings' && renderSettingsView()}
        {activeView === 'receipts' && renderReceiptsView()}
      </div>

      {/* ── RIGHT: TICKET SIDEBAR ── */}
      <div className="w-[320px] lg:w-[360px] bg-white border-l border-gray-200 flex flex-col shrink-0 shadow-xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-900 text-white">
          <div className="flex items-center gap-2">
            <ReceiptText size={18} />
            <h2 className="font-black text-base tracking-tight">
              {activeTicketId ? (parkedTickets.find(t => t.id === activeTicketId)?.customerName || 'TICKET') : 'NUEVO TICKET'}
            </h2>
            {cartItemCount > 0 && <span className="bg-pink-500 text-white text-xs font-black px-2 py-0.5 rounded-full">{cartItemCount}</span>}
          </div>
          {cart.length > 0 && (
            <button onClick={() => { if (activeTicketId) { deleteParkedTicket(activeTicketId); } else { clearCart(); } }} className="text-gray-400 hover:text-red-400 transition-colors p-1" title={activeTicketId ? 'Eliminar ticket' : 'Vaciar carrito'}><Trash2 size={16} /></button>
          )}
        </div>

        {/* TICKET TABS STRIP */}
        {parkedTickets.length > 0 && (
          <div className="px-2 py-2 border-b border-gray-100 shrink-0 overflow-x-auto">
            <div className="flex gap-1.5 items-center">
              {/* New ticket tab */}
              <button onClick={startNewTicket}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all active:scale-95 shrink-0 ${
                  !activeTicketId ? 'bg-pink-500 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                <Plus size={12} /> Nuevo
              </button>

              {/* Saved ticket tabs */}
              {parkedTickets.map((t) => (
                <button key={t.id} onClick={() => openTicket(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all active:scale-95 shrink-0 group ${
                    activeTicketId === t.id
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-700'
                  }`}>
                  <span className="truncate max-w-[80px]">{t.customerName}</span>
                  <span className={`text-[10px] font-black ${activeTicketId === t.id ? 'text-amber-100' : 'text-gray-400'}`}>{formatPrice(t.total)}</span>
                  <button onClick={(e) => { e.stopPropagation(); deleteParkedTicket(t.id); }}
                    className={`ml-0.5 rounded-full w-4 h-4 flex items-center justify-center transition-colors ${
                      activeTicketId === t.id ? 'text-amber-200 hover:text-white hover:bg-amber-600' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                    }`}>
                    <X size={10} />
                  </button>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Customer Name */}
        <div className="px-4 py-2 border-b border-gray-50 shrink-0">
          <input type="text" placeholder="Nombre del cliente (opcional)" value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent" />
          {/* Show comment for active ticket */}
          {activeTicketId && (() => {
            const t = parkedTickets.find(x => x.id === activeTicketId);
            return t?.comment ? <p className="text-xs text-amber-600 italic mt-1 px-1">💬 {t.comment}</p> : null;
          })()}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
              <ShoppingCart className="w-14 h-14 text-gray-200 mb-3" />
              <p className="font-bold text-sm">Ticket vacío</p>
              <p className="text-xs mt-1">Toca un producto para agregarlo</p>
              {parkedTickets.length > 0 && !activeTicketId && (
                <p className="text-xs mt-3 text-amber-600 font-bold">Tienes {parkedTickets.length} ticket{parkedTickets.length > 1 ? 's' : ''} guardado{parkedTickets.length > 1 ? 's' : ''} ↑</p>
              )}
            </div>
          ) : (
            <div className="space-y-0.5">
              {cart.map((item, idx) => (
                <div key={item.product.id} className="flex items-center gap-2 py-2 px-2 rounded-xl hover:bg-gray-50 transition-colors group">
                  <span className="text-gray-300 text-xs font-mono w-4 shrink-0">{idx + 1}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => updateQuantity(item.product.id, -1)} className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-500 active:scale-90 transition-all">
                      <Minus size={12} strokeWidth={3} />
                    </button>
                    <span className="w-6 text-center font-black text-xs">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product.id, 1)} className="w-6 h-6 rounded-md bg-pink-50 flex items-center justify-center text-pink-600 hover:bg-pink-500 hover:text-white active:scale-90 transition-all">
                      <Plus size={12} strokeWidth={3} />
                    </button>
                  </div>
                  <p className="flex-1 font-bold text-gray-800 text-[12px] truncate min-w-0">{item.product.name}</p>
                  <span className="font-black text-gray-900 text-xs shrink-0">{formatPrice(item.product.price * item.quantity)}</span>
                  <button onClick={() => removeFromCart(item.product.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Success Message */}
        {lastSaleTotal !== null && (
          <div className="mx-3 mb-2 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
            <CheckCircle2 className="text-green-500 shrink-0" size={18} />
            <div>
              <p className="text-green-800 font-black text-sm">¡Venta Registrada!</p>
              <p className="text-green-600 text-xs font-bold">{formatPrice(lastSaleTotal)}</p>
            </div>
          </div>
        )}

        {/* TOTAL + ACTION BUTTONS */}
        <div className="border-t-2 border-gray-900 p-3 space-y-2 shrink-0 bg-gray-50/80">
          <div className="flex items-center justify-between px-1">
            <span className="text-gray-500 font-bold text-sm uppercase tracking-widest">Total</span>
            <span className="text-3xl font-black text-gray-900">{formatPrice(cartTotal)}</span>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {/* GUARDAR BUTTON - only for NEW tickets (no activeTicketId) */}
            <button
              onClick={() => {
                if (cart.length > 0 && !activeTicketId) { openParkModal(); }
                else if (activeTicketId) { startNewTicket(); }
              }}
              disabled={cart.length === 0 && !activeTicketId}
              className={`col-span-2 flex flex-col items-center justify-center gap-0.5 py-3 rounded-2xl font-black text-xs transition-all active:scale-95 ${
                activeTicketId
                  ? 'bg-gray-700 hover:bg-gray-800 text-white'
                  : cart.length > 0
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/30'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {activeTicketId ? <Plus size={18} /> : <Save size={18} />}
              {activeTicketId ? 'NUEVO' : 'GUARDAR'}
            </button>

            {/* COBRAR BUTTON */}
            <button
              onClick={() => setPaymentModalOpen(true)}
              disabled={cart.length === 0}
              className="col-span-3 flex flex-col items-center justify-center gap-0.5 py-3 rounded-2xl bg-pink-500 hover:bg-pink-600 active:scale-95 text-white font-black text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-pink-500/30"
            >
              <DollarSign size={20} />
              COBRAR
            </button>
          </div>
        </div>
      </div>

      {/* ── PAYMENT MODAL ── */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gray-900 text-white px-6 py-5 text-center">
              <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-1">Total a Cobrar</p>
              <p className="text-5xl font-black">{formatPrice(cartTotal)}</p>
              <p className="text-gray-400 text-sm mt-2">{cartItemCount} {cartItemCount === 1 ? 'artículo' : 'artículos'} · {customerName || 'Sin nombre'}</p>
            </div>

            {/* Payment Options */}
            <div className="p-6 space-y-3">
              <button onClick={() => handlePayment('cash')} disabled={processing}
                className="w-full flex items-center gap-4 px-6 py-5 rounded-2xl bg-green-500 hover:bg-green-600 active:scale-[0.98] text-white font-black text-lg transition-all disabled:opacity-50 shadow-lg shadow-green-500/20">
                <Banknote size={28} /> EFECTIVO
              </button>
              <button onClick={() => handlePayment('card')} disabled={processing}
                className="w-full flex items-center gap-4 px-6 py-5 rounded-2xl bg-blue-500 hover:bg-blue-600 active:scale-[0.98] text-white font-black text-lg transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20">
                <CreditCard size={28} /> TARJETA
              </button>
              <button onClick={() => handlePayment('other')} disabled={processing}
                className="w-full flex items-center gap-4 px-6 py-5 rounded-2xl bg-purple-500 hover:bg-purple-600 active:scale-[0.98] text-white font-black text-lg transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20">
                <DollarSign size={28} /> OTRO MEDIO
              </button>
            </div>

            {processing && <p className="text-center text-pink-500 font-bold text-sm animate-pulse pb-4">Procesando...</p>}

            {/* Cancel */}
            <div className="px-6 pb-6">
              <button onClick={() => setPaymentModalOpen(false)} disabled={processing}
                className="w-full py-3 text-gray-500 hover:text-gray-700 font-bold text-sm transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PARK TICKET MODAL ── */}
      {parkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-amber-500 text-white px-6 py-5 text-center">
              <Save className="w-10 h-10 mx-auto mb-2" />
              <h3 className="text-xl font-black">Guardar Ticket</h3>
              <p className="text-amber-100 text-sm mt-1">{cartItemCount} artículos · {formatPrice(cartTotal)}</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-black uppercase text-gray-500 tracking-widest mb-1.5 block">Nombre del cliente</label>
                <input type="text" placeholder="Ej: Mesa 3, Juan..." value={parkName}
                  onChange={(e) => setParkName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
              </div>
              <div>
                <label className="text-xs font-black uppercase text-gray-500 tracking-widest mb-1.5 block">Comentario (opcional)</label>
                <textarea placeholder="Ej: Esperando acompañante, pagar con transfer..." value={parkComment}
                  onChange={(e) => setParkComment(e.target.value)} rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none" />
              </div>

              <button onClick={confirmParkTicket}
                className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-black text-base transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2">
                <Save size={18} /> GUARDAR TICKET
              </button>
              <button onClick={() => setParkModalOpen(false)}
                className="w-full py-2 text-gray-500 hover:text-gray-700 font-bold text-sm transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { products } from '@/lib/mock-db';
import { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, GripVertical, Save, Loader2, Package, Search } from 'lucide-react';

interface UpsellRow {
  id: string;
  product_id: string;
  category_name: string;
  display_order: number;
  is_active: boolean;
}

export default function UpsellsPage() {
  const [upsells, setUpsells] = useState<UpsellRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

  // Fetch existing upsell configuration
  useEffect(() => {
    fetchUpsells();
  }, []);

  const fetchUpsells = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('upsells')
      .select('*')
      .order('display_order', { ascending: true });

    if (!error && data) {
      setUpsells(data);
    }
    setLoading(false);
  };

  // Get all products that are NOT already in upsells
  const availableProducts = products.filter(
    (p) => !upsells.some((u) => u.product_id === p.id)
  );

  // Filter available products by search
  const filteredProducts = availableProducts.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group existing upsells by category_name
  const categories = [...new Set(upsells.map((u) => u.category_name))];

  const getProductById = (productId: string): Product | undefined => {
    return products.find((p) => p.id === productId);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(price);
  };

  const handleAddProduct = async (product: Product) => {
    const categoryName = newCategoryName.trim() || selectedCategory || 'Sin Categoría';
    const maxOrder = upsells.filter(u => u.category_name === categoryName).reduce((max, u) => Math.max(max, u.display_order), -1);

    const { data, error } = await supabase
      .from('upsells')
      .insert({
        product_id: product.id,
        category_name: categoryName,
        display_order: maxOrder + 1,
        is_active: true,
      })
      .select()
      .single();

    if (!error && data) {
      setUpsells((prev) => [...prev, data]);
      setNewCategoryName('');
    }
  };

  const handleRemoveUpsell = async (id: string) => {
    const { error } = await supabase.from('upsells').delete().eq('id', id);
    if (!error) {
      setUpsells((prev) => prev.filter((u) => u.id !== id));
    }
  };

  const handleToggleActive = async (id: string) => {
    const target = upsells.find((u) => u.id === id);
    if (!target) return;

    const { error } = await supabase
      .from('upsells')
      .update({ is_active: !target.is_active })
      .eq('id', id);

    if (!error) {
      setUpsells((prev) =>
        prev.map((u) => (u.id === id ? { ...u, is_active: !u.is_active } : u))
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto pb-24 h-full overflow-y-auto">
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2">
          <Package className="text-pink-500" /> Gestión de Extras (Upsells)
        </h1>
        <p className="text-gray-500 mt-1">
          Configura qué productos se ofrecen como acompañamiento al momento de agregar al carrito.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT: CONFIGURED UPSELLS */}
        <div>
          <h2 className="text-sm font-black uppercase text-gray-400 tracking-widest mb-4">
            Extras Configurados ({upsells.length})
          </h2>

          {categories.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <Package className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400 font-bold">No hay extras configurados aún.</p>
              <p className="text-gray-400 text-sm mt-1">Usa el panel derecho para agregar productos.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {categories.map((cat) => {
                const items = upsells.filter((u) => u.category_name === cat);
                return (
                  <div key={cat} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
                      <h3 className="font-black text-gray-700 text-sm uppercase tracking-widest">{cat}</h3>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {items.map((upsell) => {
                        const product = getProductById(upsell.product_id);
                        if (!product) return null;
                        return (
                          <div
                            key={upsell.id}
                            className={`flex items-center gap-3 px-5 py-3 transition-all ${!upsell.is_active ? 'opacity-40' : ''}`}
                          >
                            <GripVertical className="text-gray-300 w-4 h-4 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-800 text-sm truncate">{product.name}</p>
                              <p className="text-xs text-gray-400 font-medium">{formatPrice(product.price)}</p>
                            </div>
                            <button
                              onClick={() => handleToggleActive(upsell.id)}
                              className={`px-3 py-1 rounded-full text-xs font-black transition-colors ${
                                upsell.is_active
                                  ? 'bg-green-50 text-green-600 hover:bg-green-100'
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                              }`}
                            >
                              {upsell.is_active ? 'Activo' : 'Inactivo'}
                            </button>
                            <button
                              onClick={() => handleRemoveUpsell(upsell.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: ADD NEW UPSELLS */}
        <div>
          <h2 className="text-sm font-black uppercase text-gray-400 tracking-widest mb-4">
            Agregar Productos
          </h2>

          {/* Category selector */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-4 space-y-3">
            <label className="text-xs font-black uppercase text-gray-500 tracking-widest">
              Categoría de destino
            </label>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setSelectedCategory(cat); setNewCategoryName(''); }}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                      selectedCategory === cat && !newCategoryName
                        ? 'bg-pink-500 text-white border-pink-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-pink-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
            <Input
              placeholder="O escribe una nueva categoría..."
              value={newCategoryName}
              onChange={(e) => { setNewCategoryName(e.target.value); setSelectedCategory(''); }}
              className="h-10 bg-gray-50 border-gray-200"
            />
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-3 text-gray-400" size={16} />
            <Input
              placeholder="Buscar producto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 bg-white border-gray-200"
            />
          </div>

          {/* Product List */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm max-h-[500px] overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm font-medium">
                {searchQuery ? 'No se encontraron productos.' : 'Todos los productos ya están agregados.'}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-sm truncate">{product.name}</p>
                      <p className="text-xs text-gray-400 font-medium">
                        {formatPrice(product.price)} · ID: {product.id}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAddProduct(product)}
                      disabled={!selectedCategory && !newCategoryName.trim()}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                    >
                      <Plus size={14} /> Agregar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Product } from "@/types";
import { products } from "@/lib/mock-db";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Plus, Minus, ShoppingBag } from "lucide-react";

interface AddonState {
  product: Product;
  quantity: number;
}

interface UpsellModalProps {
  product: Product | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (mainProduct: Product, addons: { product: Product; quantity: number }[]) => void;
}

export function UpsellModal({ product, isOpen, onOpenChange, onConfirm }: UpsellModalProps) {
  const [addons, setAddons] = useState<AddonState[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Load specific grouped products by ID from DB
      const arrolladoJQ = products.find(p => p.id === 'p2_1');
      const arrolladoP = products.find(p => p.id === 'p2_2');
      const fries = products.find(p => p.id === 'p2_3'); 
      
      const aguaSG = products.find(p => p.id === 'p8_3_sg');
      const aguaCG = products.find(p => p.id === 'p8_3_cg');

      const drink220Coca = products.find(p => p.id === 'p8_2_coca');
      const drink220Zero = products.find(p => p.id === 'p8_2_zero');
      const drink220Fanta = products.find(p => p.id === 'p8_2_fanta');
      const drink220Sprite = products.find(p => p.id === 'p8_2_sprite');

      const drink350Coca = products.find(p => p.id === 'p8_4_coca');
      const drink350Zero = products.find(p => p.id === 'p8_4_zero');
      const drink350Fanta = products.find(p => p.id === 'p8_4_fanta');
      const drink350Sprite = products.find(p => p.id === 'p8_4_sprite');
      const drink350Inka = products.find(p => p.id === 'p8_4_inka');

      const soy = products.find(p => p.id === 'p9_1');   
      const teriyaki = products.find(p => p.id === 'p9_2'); 
      const lactonesa = products.find(p => p.id === 'p9_3'); 
      const bbq = products.find(p => p.id === 'p9_4');       

      const availableProducts = [
        arrolladoJQ, arrolladoP, fries, 
        aguaSG, aguaCG,
        drink220Coca, drink220Zero, drink220Fanta, drink220Sprite,
        drink350Coca, drink350Zero, drink350Fanta, drink350Sprite, drink350Inka, 
        soy, teriyaki, lactonesa, bbq
      ].filter(Boolean) as Product[];

      setAddons(availableProducts.map(p => ({ product: p, quantity: 0 })));
    }
  }, [isOpen]);

  if (!product) return null;

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setAddons(current => current.map(addon => {
      if (addon.product.id === productId) {
        return { ...addon, quantity: Math.max(0, addon.quantity + delta) };
      }
      return addon;
    }));
  };

  const handleConfirm = () => {
    onConfirm(product, addons.filter(a => a.quantity > 0));
    onOpenChange(false);
  };

  const addonsTotal = addons.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const grandTotal = product.price + addonsTotal;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(price);
  };

  const addonAccompaniments = addons.filter(a => a.product.id.startsWith('p2_'));
  const addonAguas = addons.filter(a => a.product.id.startsWith('p8_3_'));
  const addonDrinks220 = addons.filter(a => a.product.id.startsWith('p8_2_'));
  const addonDrinks350 = addons.filter(a => a.product.id.startsWith('p8_4_'));
  const addonSauces = addons.filter(a => a.product.id.startsWith('p9_'));

  const renderAddonGroup = (title: string, items: AddonState[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-4 sm:mb-6 bg-gray-50/50 rounded-2xl border border-gray-100 p-4">
        <h3 className="text-[12px] font-black uppercase text-pink-500 mb-3 tracking-widest">{title}</h3>
        <div className="space-y-1">
          {items.map((addon) => (
            <div key={addon.product.id} className="flex flex-wrap sm:flex-nowrap items-center justify-between py-2 border-b border-gray-100 last:border-0 last:pb-0 gap-2">
              <div className="pr-2 flex-1 min-w-[120px]">
                <h4 className="font-bold text-[14px] text-gray-800 leading-tight">{addon.product.name}</h4>
                <span className="text-gray-500 font-bold text-[13px] block mt-0.5">+{formatPrice(addon.product.price)}</span>
              </div>
              <div className="flex items-center gap-3 bg-white p-1 rounded-full border border-gray-200 shrink-0 shadow-sm">
                <button 
                  onClick={() => handleUpdateQuantity(addon.product.id, -1)}
                  disabled={addon.quantity === 0}
                  className="w-7 h-7 rounded-full bg-gray-50 border border-transparent flex items-center justify-center text-gray-600 hover:text-pink-500 hover:border-pink-200 transition-colors disabled:opacity-40"
                >
                  <Minus size={14} strokeWidth={3} />
                </button>
                <span className="w-5 text-center font-black text-[15px]">{addon.quantity}</span>
                <button 
                  onClick={() => handleUpdateQuantity(addon.product.id, 1)}
                  className="w-7 h-7 rounded-full bg-pink-50 border border-pink-100 flex items-center justify-center text-pink-600 hover:bg-pink-500 hover:text-white transition-colors"
                >
                  <Plus size={14} strokeWidth={3} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl w-[95vw] bg-white text-gray-900 border border-gray-100 p-0 overflow-hidden shadow-2xl rounded-3xl mx-auto">
        <div className="bg-pink-50/80 px-5 sm:px-6 py-4 border-b border-pink-100/50 flex flex-col items-center text-center shrink-0">
          <span className="text-3xl mb-1">🍤</span>
          <h2 className="text-[20px] sm:text-[22px] font-black text-gray-900 tracking-tight">
            ¡Acompaña tu pedido!
          </h2>
          <p className="text-[13px] text-pink-600 font-bold mt-0.5 leading-tight">
            Añadiendo: {product.name}
          </p>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto max-h-[80vh] md:max-h-[70vh] bg-white custom-scrollbar w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 items-start">
            <div className="flex flex-col">
              {renderAddonGroup('Para Acompañar', addonAccompaniments)}
              {renderAddonGroup('Bebidas Mini (220cc)', addonDrinks220)}
            </div>
            <div className="flex flex-col">
              {renderAddonGroup('Bebidas Normales (350cc)', addonDrinks350)}
              {renderAddonGroup('Aguas', addonAguas)}
              {renderAddonGroup('Salsas Extras', addonSauces)}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 border-t border-gray-100 bg-white flex flex-col sm:flex-row sm:justify-between items-center gap-4 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] z-10 shrink-0">
          <div className="flex justify-between w-full sm:w-auto items-center sm:flex-col sm:items-start px-2 sm:px-0">
            <span className="font-bold text-gray-500 text-[14px]">Subtotal a sumar:</span>
            <span className="font-black text-[22px] text-gray-900">{formatPrice(grandTotal)}</span>
          </div>
          <button 
            onClick={handleConfirm}
            className="w-full sm:w-auto sm:px-10 py-3.5 sm:py-4 rounded-2xl bg-pink-500 hover:bg-pink-600 active:bg-pink-700 text-white font-black text-[15px] sm:text-[16px] flex justify-center items-center gap-2 shadow-lg shadow-pink-500/30 transition-all uppercase tracking-wide"
          >
            <ShoppingBag size={18} strokeWidth={2.5}/> AGREGAR AL CARRITO
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

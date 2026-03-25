'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/lib/store';
import { categories, products } from '@/lib/mock-db';
import { CategorySlider } from '@/components/client/CategorySlider';
import { ProductCard } from '@/components/client/ProductCard';
import { FloatingCart } from '@/components/client/FloatingCart';
import { HeroSlider } from '@/components/client/HeroSlider';
import { UpsellModal } from '@/components/client/UpsellModal';
import { Product } from '@/types';
import { MapPin, Bike, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ClientMenuPage() {
  const [activeCategory, setActiveCategory] = useState<string>(categories[0].id);
  const { items, addItem, getItemCount, getTotal } = useCart();
  const [mounted, setMounted] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isUpsellOpen, setIsUpsellOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSelectCategory = (categoryId: string) => {
    setActiveCategory(categoryId);
  };

  const filteredProducts = products.filter(
    (product) => product.categoryId === activeCategory
  );

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] pb-24 font-sans flex flex-col">
      {/* Hero Section */}
      <section className="relative w-full h-[65vh] min-h-[550px] bg-[#1A1A1A]">
        <HeroSlider />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] via-black/40 to-transparent flex flex-col justify-end lg:justify-center p-6 sm:p-12 lg:pl-24">
          
          <div className="mb-8 max-w-2xl">
            <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black text-[#FF007F] tracking-tight drop-shadow-[0_0_20px_rgba(255,0,127,0.4)]">
              CLÁSICOS
            </h1>
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bebas text-white tracking-widest mt-1 drop-shadow-lg">
              SUSHI & STREET FOOD
            </h2>
            <p className="text-5xl sm:text-6xl text-[#FF007F] mt-4 font-caveat -rotate-2 drop-shadow-[0_0_15px_rgba(255,0,127,0.5)]">
              Sabor que Une
            </p>
          </div>
          
        </div>
      </section>

      {/* Categorías */}
      <div className="w-full bg-white shadow-sm border-b sticky top-[64px] z-40">
        <div className="max-w-screen-xl mx-auto">
          <CategorySlider
            categories={categories}
            activeCategory={activeCategory}
            onSelectCategory={handleSelectCategory}
          />
        </div>
      </div>

      {/* Productos */}
      <main id="productos" className="flex-1 w-full bg-[#FDFDFD] scroll-mt-[180px]">
        <div className="p-4 sm:p-6 lg:max-w-screen-xl mx-auto mt-8">
          <h2 className="text-3xl sm:text-5xl font-black text-gray-900 mb-8 pb-4">
            {categories.find((c) => c.id === activeCategory)?.name || 'Todos los Productos'}
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={(p) => {
                  setSelectedProduct(p);
                  setIsUpsellOpen(true);
                }}
              />
            ))}
          </div>
        </div>

        {/* Sección Promocional Modular */}
        <section id="familia" className="w-full bg-[#1A1A1A] text-white mt-16 py-16 sm:py-24 border-t-8 border-[#FF007F] scroll-mt-[64px]">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center gap-12">
            <div className="w-full md:w-1/2">
              <div className="relative h-64 sm:h-80 md:h-[400px] w-full rounded-[2rem] overflow-hidden shadow-[0_0_40px_rgba(255,0,127,0.25)]">
                <img 
                src="/images/promos/historia.jpg" 
                alt="Sushi Preparation" 
                className="w-full h-full object-cover rounded-[32px] shadow-2xl transition-transform duration-700 hover:scale-105"
              />
                <div className="absolute inset-0 bg-gradient-to-t from-[#FF007F]/40 to-transparent mix-blend-multiply"></div>
              </div>
            </div>
            <div className="w-full md:w-1/2 space-y-6">
              <div className="flex flex-wrap items-center gap-4 text-[#FFC107] font-bebas text-3xl tracking-widest">
                <span className="flex items-center gap-2"><CheckCircle2 className="w-6 h-6"/> RÁPIDO</span>
                <span className="text-[#FF007F]">•</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="w-6 h-6"/> FRESCO</span>
                <span className="text-[#FF007F]">•</span>
                <span className="flex items-center gap-2 text-[#FF007F]"><CheckCircle2 className="w-6 h-6"/> ICÓNICO</span>
              </div>
              
              <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-none mt-2">La Verdadera Experiencia</h2>
              <p className="text-lg text-gray-300 leading-relaxed font-medium">
                Sumergite en nuestra atmósfera de neón. Opciones de Sushi premium y Street Food elaboradas con ingredientes frescos y un ritmo pensado para que disfrutes cada segundo.
              </p>
              
              <Dialog>
                <DialogTrigger asChild>
                  <button className="bg-[#FF007F] text-white font-extrabold py-4 px-8 rounded-full hover:bg-pink-600 transition-colors shadow-[0_0_15px_rgba(255,0,127,0.5)] text-lg inline-block mt-4">
                    Descubre Nuestra Historia
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-white border-none text-black">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black text-[#FF007F]">Sabor que Une</DialogTitle>
                    <DialogDescription className="text-gray-600">
                      En Clásicos fusionamos lo mejor del sushi tradicional con la energía del street food urbano. Cada bocado está diseñado para ser rápido, fresco y completamente icónico.
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </section>

        {/* Locales */}
        <section id="locales" className="w-full bg-white text-gray-900 py-16 scroll-mt-[64px]">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6">
            <h2 className="text-4xl sm:text-5xl font-black text-center mb-12 text-[#FF007F] font-bebas tracking-widest">NUESTROS LOCALES</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              
              {/* Sucursal Pucón */}
              <div className="bg-gray-50 border border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                 <div className="flex items-start gap-3 mb-4">
                   <MapPin className="w-6 h-6 text-[#FFC107] flex-shrink-0" />
                   <h3 className="font-black text-xl text-[#FF007F]">Clásicos Pucón</h3>
                 </div>
                 <div className="space-y-3 text-sm text-gray-600 font-medium">
                   <p>📍 Sucursal Pucón</p>
                   <p>🕒 Lunes a Viernes de 11:00 a 02:00 hrs | Sábados y Domingos 24/7</p>
                   <p className="font-bold text-gray-900 mt-2">📱 WhatsApp: +56 9 3002 6561</p>
                 </div>
              </div>

              {/* Sucursal Temuco */}
              <div className="bg-gray-50 border border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                 <div className="flex items-start gap-3 mb-4">
                   <MapPin className="w-6 h-6 text-[#FFC107] flex-shrink-0" />
                   <h3 className="font-black text-xl text-[#FF007F]">Clásicos Temuco</h3>
                 </div>
                 <div className="space-y-3 text-sm text-gray-600 font-medium">
                   <p>📍 Sucursal Temuco</p>
                   <p>🕒 Lunes a Sábado de 18:30 a 02:00 hrs</p>
                   <p className="font-bold text-gray-900 mt-2">📱 WhatsApp: +56 9 4232 1148</p>
                 </div>
              </div>

              {/* Sucursal Villarrica */}
              <div className="bg-gray-50 border border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                 <div className="flex items-start gap-3 mb-4">
                   <MapPin className="w-6 h-6 text-[#FFC107] flex-shrink-0" />
                   <h3 className="font-black text-xl text-[#FF007F]">Clásicos Villarrica</h3>
                 </div>
                 <div className="space-y-3 text-sm text-gray-600 font-medium">
                   <p>📍 Anfión Muñoz #745 (Terminal de Buses Vipuray, 2° Piso)</p>
                   <p>🕒 Lunes a Domingo de 16:00 a 00:00 hrs</p>
                   <p className="font-bold text-gray-900 mt-2">📱 WhatsApp: +56 9 7760 2701</p>
                 </div>
              </div>

              {/* Sucursal Panguipulli */}
              <div className="bg-gray-50 border border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                 <div className="flex items-start gap-3 mb-4">
                   <MapPin className="w-6 h-6 text-[#FFC107] flex-shrink-0" />
                   <h3 className="font-black text-xl text-[#FF007F]">Clásicos Panguipulli</h3>
                 </div>
                 <div className="space-y-3 text-sm text-gray-600 font-medium">
                   <p>📍 Sucursal Panguipulli</p>
                   <p>🕒 Lunes a Domingo de 11:00 a 02:00 hrs</p>
                   <p className="font-bold text-gray-900 mt-2">📱 WhatsApp: +56 9 3889 6083</p>
                 </div>
              </div>

            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer id="comunidad" className="w-full bg-black text-white py-16 mt-auto scroll-mt-[64px] border-t border-[#FF007F]/20">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 bg-[#FF007F] rounded-xl flex items-center justify-center text-white font-black text-4xl shadow-[0_0_20px_rgba(255,0,127,0.5)]">
            C
          </div>
          <h3 className="font-bebas text-3xl tracking-widest text-[#FFC107]">SUSHI & STREET FOOD</h3>
          <div className="flex space-x-6 text-sm font-bold text-gray-400">
            <Dialog>
              <DialogTrigger asChild><button className="hover:text-[#FF007F] transition-colors">Privacidad</button></DialogTrigger>
              <DialogContent className="bg-white"><DialogHeader><DialogTitle>Privacidad</DialogTitle><DialogDescription>Políticas de privacidad publicadas próximamente.</DialogDescription></DialogHeader></DialogContent>
            </Dialog>
            <Dialog>
              <DialogTrigger asChild><button className="hover:text-[#FF007F] transition-colors">Términos</button></DialogTrigger>
              <DialogContent className="bg-white"><DialogHeader><DialogTitle>Términos y Condiciones</DialogTitle><DialogDescription>Términos de servicio publicados próximamente.</DialogDescription></DialogHeader></DialogContent>
            </Dialog>
            <Dialog>
              <DialogTrigger asChild><button className="hover:text-[#FF007F] transition-colors">Contacto</button></DialogTrigger>
              <DialogContent className="bg-white"><DialogHeader><DialogTitle>Contacto</DialogTitle><DialogDescription>Villarrica/Pucón | RRSS: @clasicossushi</DialogDescription></DialogHeader></DialogContent>
            </Dialog>
          </div>
          <p className="text-gray-500 text-sm font-medium">© 2026 Clásicos Sushi & Street Food. Todos los derechos reservados.</p>
        </div>
      </footer>

      {/* Carrito Flotante */}
      <FloatingCart itemCount={getItemCount()} total={getTotal()} />

      <UpsellModal 
        product={selectedProduct}
        isOpen={isUpsellOpen}
        onOpenChange={setIsUpsellOpen}
        onConfirm={(mainProduct, addons) => {
          addItem(mainProduct);
          addons.forEach(addon => {
            for (let i = 0; i < addon.quantity; i++) {
              addItem(addon.product);
            }
          });
        }}
      />
    </div>
  );
}

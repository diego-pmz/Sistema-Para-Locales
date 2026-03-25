'use client';

import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface FloatingCartProps {
  itemCount: number;
  total: number;
}

export function FloatingCart({ itemCount, total }: FloatingCartProps) {
  const router = useRouter();

  if (itemCount === 0) return null;

  const formattedTotal = new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
  }).format(total);

  return (
    <div className="fixed bottom-6 left-0 right-0 px-4 z-50 flex justify-center pointer-events-none">
      <div className="w-full max-w-md pointer-events-auto animate-in slide-in-from-bottom-5 fade-in duration-300">
        <Button 
          onClick={() => router.push('/checkout')}
          className="w-full rounded-2xl h-14 bg-primary text-white shadow-xl hover:bg-primary/95 flex items-center justify-between px-6 border-2 border-white/20"
        >
          <div className="flex items-center space-x-3">
            <div className="relative">
              <ShoppingCart className="w-6 h-6" />
              <span className="absolute -top-2 -right-3 bg-secondary text-secondary-foreground text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                {itemCount}
              </span>
            </div>
            <span className="font-medium text-lg hidden sm:inline-block">Ver Pedido</span>
          </div>
          
          <div className="flex items-center">
            <span className="font-bold text-lg">{formattedTotal}</span>
            <span className="ml-2 text-primary-foreground/80 text-sm font-medium">→</span>
          </div>
        </Button>
      </div>
    </div>
  );
}

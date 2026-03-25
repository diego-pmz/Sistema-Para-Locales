'use client';

import { Category } from '@/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface CategorySliderProps {
  categories: Category[];
  activeCategory: string;
  onSelectCategory: (id: string) => void;
}

export function CategorySlider({ categories, activeCategory, onSelectCategory }: CategorySliderProps) {
  return (
    <div className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b">
      <ScrollArea className="w-full whitespace-nowrap pb-2">
        <div className="flex w-max space-x-6 px-4 py-4">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => onSelectCategory(category.id)}
              className="flex flex-col items-center gap-2 group min-w-[72px]"
            >
              <div 
                className={`w-[72px] h-[72px] sm:w-[84px] sm:h-[84px] rounded-full overflow-hidden flex-shrink-0 border-[3px] transition-all duration-300 ${
                  activeCategory === category.id 
                    ? 'border-[#FF007F] shadow-[0_0_12px_rgba(255,0,127,0.4)] scale-110' 
                    : 'border-transparent shadow-md grayscale-[20%] group-hover:grayscale-0 group-hover:scale-105 group-hover:shadow-lg'
                }`}
              >
                {category.imageUrl ? (
                  <img src={category.imageUrl} alt={category.name} className="w-full h-full object-cover bg-gray-100" />
                ) : (
                  <div className="w-full h-full bg-gray-200" />
                )}
              </div>
              <span 
                className={`text-xs sm:text-sm font-bold transition-colors line-clamp-2 leading-tight text-center max-w-[80px] whitespace-normal ${
                  activeCategory === category.id ? 'text-[#FF007F]' : 'text-gray-600 group-hover:text-gray-900'
                }`}
              >
                {category.name}
              </span>
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>
    </div>
  );
}

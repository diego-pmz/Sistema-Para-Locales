import { Product } from '@/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const formattedPrice = new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
  }).format(product.price);

  return (
    <Card className="overflow-hidden border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 bg-white group flex flex-col h-full">
      <div className="relative h-48 w-full overflow-hidden bg-gray-50">
        {/* Placeholder if domain not configured for next/image, using standard img tag for robust MVP */}
        <img
          src={product.imageUrl}
          alt={product.name}
          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
        />
        {product.isPopular && (
          <Badge className="absolute top-3 left-3 bg-secondary text-secondary-foreground font-semibold px-2 py-1 shadow-sm border-none">
            ⭐ Popular
          </Badge>
        )}
      </div>
      
      <CardContent className="p-4 flex-grow flex flex-col">
        <h3 className="font-bold text-lg text-gray-900 leading-tight mb-1">{product.name}</h3>
        <p className="text-sm text-gray-500 line-clamp-2 flex-grow">{product.description}</p>
        <div className="mt-3 font-semibold text-secondary text-lg flex items-center">
           {formattedPrice}
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-0">
        <Button 
          onClick={() => onAddToCart(product)}
          disabled={!product.isAvailable}
          className="w-full font-semibold shadow-sm rounded-xl"
        >
          {product.isAvailable ? 'Agregar' : 'Agotado'}
        </Button>
      </CardFooter>
    </Card>
  );
}

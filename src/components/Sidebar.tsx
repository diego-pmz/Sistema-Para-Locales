'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdminStore } from '@/lib/store';

export default function Sidebar() {
  const pathname = usePathname();
  const { activeBranch, setActiveBranch } = useAdminStore();

  const mainNav = [
    { href: '/dashboard', label: 'Resumen del pedido' },
    { href: '/pos', label: '🖥️ Terminal POS' },
    { href: '/dashboard/delivery', label: 'Pedidos Delivery' },
    { href: '/dashboard/reports', label: 'Cierre de Ventas' },
    { href: '/dashboard/hours', label: 'Horarios de Atención' }
  ];

  const bottomNav = [
    { href: '/dashboard/upsells', label: 'Extras / Upsells' },
    { href: '/dashboard/zones', label: 'Zonas de Delivery' },
    { href: '/dashboard/settings', label: 'Impresoras' },
    { href: '/tutorial', label: 'Tutorial' },
  ];

  const getLinkClasses = (href: string) => {
    // Para rutas exactas o subrutas (ej: /dashboard vs /dashboard/delivery)
    // Hay que tener cuidado porque /dashboard es prefijo de /dashboard/delivery.
    const isActive = href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname?.startsWith(href);

    return `flex items-center justify-between pr-6 py-2.5 pl-6 border-l-[3px] font-medium text-[14px] transition-colors ${isActive
        ? 'border-pink-500 bg-white text-gray-900 font-bold'
        : 'border-transparent text-[#5B5B5B] hover:text-gray-900'
      }`;
  };

  return (
    <aside className="hidden md:flex flex-col w-[260px] bg-white border-r border-[#EFEFEF] print:hidden z-20 shrink-0">
      <div className="pt-6 px-8 pb-4">
        <div className="w-12 h-12 bg-pink-500 rounded-2xl mb-4 flex items-center justify-center shadow-sm">
          <span className="text-white font-black text-3xl italic mr-1">C</span>
        </div>
        <h1 className="text-[20px] font-bold tracking-tight text-gray-900 mt-0 mb-4">
          Clásicos
        </h1>

        <Select value={activeBranch || undefined} onValueChange={(val) => setActiveBranch(val as string)}>
          <SelectTrigger className="w-full bg-gray-50 border-gray-200 text-gray-700 font-bold focus:ring-pink-500 focus:ring-offset-0 ring-offset-transparent">
            <SelectValue placeholder="Elegir Sucursal..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Pucón">Pucón</SelectItem>
            <SelectItem value="Villarrica">Villarrica</SelectItem>
            <SelectItem value="Temuco">Temuco</SelectItem>
            <SelectItem value="Panguipulli">Panguipulli</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <nav className="flex-1 overflow-y-auto mt-6 space-y-1">
        {mainNav.map((item) => (
          <Link key={item.href} href={item.href} className={getLinkClasses(item.href)}>
            <span>{item.label}</span>
          </Link>
        ))}

        <div className="mt-8 pt-2">
          {bottomNav.map((item) => (
            <Link key={item.href} href={item.href} className={getLinkClasses(item.href)}>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

    </aside>
  );
}

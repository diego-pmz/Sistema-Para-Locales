import { ReactNode } from 'react';
import { ClientNavbar } from '@/components/client/ClientNavbar';
import { ActiveOrderWidget } from '@/components/client/ActiveOrderWidget';

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white min-h-screen text-gray-900 font-sans selection:bg-pink-100 selection:text-pink-900 antialiased flex flex-col relative">
      <ClientNavbar />
      <div className="flex-1">
        {children}
      </div>
      <ActiveOrderWidget />
    </div>
  );
}

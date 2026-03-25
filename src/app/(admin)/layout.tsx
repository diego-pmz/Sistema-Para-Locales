import { ReactNode } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-white text-[#333333] font-sans selection:bg-[#FA0050]/20 print:bg-white print:text-black overflow-hidden relative">
      
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden print:overflow-visible relative bg-[#FBFCFD]">
        <div className="flex-1 overflow-y-auto print:overflow-visible relative">
           {children}
        </div>
      </main>

    </div>
  );
}

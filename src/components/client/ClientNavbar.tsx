'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, User, X } from 'lucide-react';
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

export function ClientNavbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      <nav className="sticky top-0 z-50 w-full bg-[#1A1A1A]/95 backdrop-blur-sm border-b border-gray-800 shadow-md">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Left: Mobile Menu & Logo */}
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 -ml-2 rounded-md hover:bg-gray-800 transition-colors md:hidden"
              >
                <Menu className="w-6 h-6 text-white" />
              </button>
              <Link href="/" className="flex items-center">
                {/* Logo Clásicos */}
                <div className="w-10 h-10 bg-[#FF007F] rounded flex items-center justify-center text-white font-black text-2xl shadow-[0_0_15px_rgba(255,0,127,0.5)]">
                  C
                </div>
              </Link>
            </div>

            {/* Center: Desktop Navigation */}
            <div className="hidden md:flex items-center justify-center flex-1 px-8 space-x-6">
              <a href="#productos" className="text-gray-100 font-bold hover:text-[#FF007F] transition-colors">
                Menú
              </a>
              <a href="#familia" className="text-gray-100 font-bold hover:text-[#FF007F] transition-colors">
                Compartir
              </a>
              <a href="#locales" className="text-gray-100 font-bold hover:text-[#FF007F] transition-colors">
                Locales
              </a>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center space-x-4">
              <Dialog>
                <DialogTrigger asChild>
                  <button className="hidden sm:flex items-center space-x-2 px-6 py-2 bg-[#FFC107] hover:bg-yellow-400 text-black font-extrabold rounded-lg transition-colors shadow-sm">
                    <User className="w-4 h-4" />
                    <span>Entrar</span>
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-white text-gray-900 border-none">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black text-[#FF007F]">Inicia Sesión</DialogTitle>
                    <DialogDescription className="text-gray-600 font-medium">
                      Ingresa tus datos para acceder a tu cuenta y guardar tus direcciones de entrega.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="font-bold text-sm">Correo Electrónico</Label>
                      <Input id="email" type="email" placeholder="correo@ejemplo.com" className="bg-gray-50 border-gray-200" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="font-bold text-sm">Contraseña</Label>
                      <Input id="password" type="password" className="bg-gray-50 border-gray-200" />
                    </div>
                    <button onClick={() => alert("Sesión Iniciada (Simulación)")} className="w-full bg-[#FF007F] text-white font-extrabold py-3 pt-3 rounded-lg hover:bg-pink-600 transition-colors mt-4 shadow-lg">
                      Entrar a mi cuenta
                    </button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-[#1A1A1A] text-white flex flex-col animate-in slide-in-from-left max-w-sm shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div className="w-10 h-10 bg-[#FF007F] rounded flex items-center justify-center text-white font-black text-2xl shadow-[0_0_15px_rgba(255,0,127,0.5)]">
              C
            </div>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-md hover:bg-gray-800 transition-colors"
            >
              <X className="w-6 h-6 text-gray-300" />
            </button>
          </div>
          <div className="flex flex-col p-4 space-y-4">
            <a href="#productos" onClick={() => setIsMobileMenuOpen(false)} className="text-xl font-bold text-white py-2 border-b border-gray-800 hover:text-[#FF007F]">Menú</a>
            <a href="#familia" onClick={() => setIsMobileMenuOpen(false)} className="text-xl font-bold text-white py-2 border-b border-gray-800 hover:text-[#FF007F]">Experiencia</a>
            <a href="#comunidad" onClick={() => setIsMobileMenuOpen(false)} className="text-xl font-bold text-white py-2 border-b border-gray-800 hover:text-[#FF007F]">Conócenos</a>
            
            <Dialog>
              <DialogTrigger asChild>
                <button className="flex items-center justify-center space-x-2 w-full mt-4 py-3 bg-[#FFC107] text-black font-extrabold rounded-lg transition-colors shadow-sm">
                  <User className="w-5 h-5" />
                  <span>Entrar o Registrarse</span>
                </button>
              </DialogTrigger>
              <DialogContent className="w-[90vw] max-w-md bg-white border-none">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black text-[#FF007F]">Inicia Sesión</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-mobile" className="font-bold">Correo</Label>
                    <Input id="email-mobile" type="email" placeholder="correo@ejemplo.com" className="bg-gray-50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pass-mobile" className="font-bold">Contraseña</Label>
                    <Input id="pass-mobile" type="password" className="bg-gray-50" />
                  </div>
                  <button onClick={() => alert("Sesión Iniciada (Simulación)")} className="w-full bg-[#FF007F] text-white font-extrabold py-3 rounded-lg hover:bg-pink-600 transition-colors shadow-lg">
                    Entrar
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}
    </>
  );
}

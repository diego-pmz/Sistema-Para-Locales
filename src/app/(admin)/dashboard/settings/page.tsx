'use client';

import { useState, useEffect } from 'react';
import { Bluetooth, Printer as PrinterIcon, CheckCircle2, AlertTriangle, RefreshCcw, ChefHat, UserCircle } from 'lucide-react';
import { ESCPOSPrinter } from '@/lib/printer';

type PrinterRole = 'kitchen' | 'cashier';

interface PrinterState {
  isConnected: boolean;
  isConnecting: boolean;
  errorDetails: string | null;
}

export default function SettingsPage() {
  const [isSupported, setIsSupported] = useState(true);
  
  const [kitchenState, setKitchenState] = useState<PrinterState>({
    isConnected: false,
    isConnecting: false,
    errorDetails: null,
  });

  const [cashierState, setCashierState] = useState<PrinterState>({
    isConnected: false,
    isConnecting: false,
    errorDetails: null,
  });

  useEffect(() => {
    // Check if Web Bluetooth API is supported
    if (!navigator.bluetooth) {
      setIsSupported(false);
    }
  }, []);

  const handleConnect = async (role: PrinterRole) => {
    const setState = role === 'kitchen' ? setKitchenState : setCashierState;
    setState(prev => ({ ...prev, isConnecting: true, errorDetails: null }));
    
    try {
      await ESCPOSPrinter.connect(role);
      setState(prev => ({ ...prev, isConnected: true }));
    } catch (error: any) {
      setState(prev => ({ ...prev, errorDetails: error.message || 'Error desconocido al conectar', isConnected: false }));
    } finally {
      setState(prev => ({ ...prev, isConnecting: false }));
    }
  };

  const handleDisconnect = (role: PrinterRole) => {
    ESCPOSPrinter.disconnect(role);
    const setState = role === 'kitchen' ? setKitchenState : setCashierState;
    setState(prev => ({ ...prev, isConnected: false }));
  };

  const handleTestPrint = async (role: PrinterRole) => {
    try {
      await ESCPOSPrinter.testPrint(role);
      alert(`Impresión de prueba enviada con éxito a ${role === 'kitchen' ? 'Cocina' : 'Cajero'}`);
    } catch (error: any) {
      alert(`Error en impresión de prueba (${role}): ${error.message}`);
    }
  };

  const renderPrinterCard = (role: PrinterRole, title: string, description: string, Icon: any, state: PrinterState) => {
    return (
      <div className="mb-6">
        <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Icon className="text-gray-500" size={20} />
          {title}
        </h4>
        <div className={`p-5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${state.isConnected ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${state.isConnected ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {state.isConnected ? <CheckCircle2 size={24} /> : <Bluetooth size={24} />}
            </div>
            <div>
              <h4 className={`font-bold text-[18px] ${state.isConnected ? 'text-green-800' : 'text-gray-700'}`}>
                {state.isConnected ? 'Impresora Conectada' : 'No hay impresora enlazada'}
              </h4>
              <p className={`text-[13px] font-medium mt-0.5 ${state.isConnected ? 'text-green-600' : 'text-gray-500'}`}>
                {state.isConnected ? description : 'Haz clic en "Buscar Impresora" para enlazar el hardware.'}
              </p>
            </div>
          </div>

          <div>
            {!state.isConnected ? (
              <button 
                onClick={() => handleConnect(role)}
                disabled={state.isConnecting}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                {state.isConnecting ? <RefreshCcw className="animate-spin w-5 h-5" /> : <Bluetooth className="w-5 h-5" />}
                {state.isConnecting ? 'Vinculando...' : 'Buscar Impresora'}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                 <button 
                    onClick={() => handleTestPrint(role)}
                    className="px-4 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-lg transition-colors text-[13px]"
                  >
                    Ticket Prueba
                 </button>
                 <button 
                  onClick={() => handleDisconnect(role)}
                  className="flex items-center gap-2 px-6 py-3 border-2 border-red-200 bg-white text-red-600 hover:bg-red-50 font-bold rounded-lg transition-colors"
                >
                  Desvincular
                </button>
              </div>
            )}
          </div>
        </div>

        {state.errorDetails && (
            <p className="text-red-500 text-sm font-bold bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-2 mt-3">
              <AlertTriangle size={16} /> Error detectado: {state.errorDetails}
            </p>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col relative w-full pt-8 px-10 max-w-4xl mx-auto pb-20">
      <div className="mb-8">
        <h2 className="text-[28px] font-black text-gray-900 tracking-tight flex items-center gap-3">
          Ajustes del Sistema
        </h2>
        <p className="text-gray-500 font-medium mt-1">Configuración de impresión directa vía Web Bluetooth API.</p>
      </div>

      <div className="bg-white border border-[#EFEFEF] shadow-sm rounded-2xl p-8">
        <h3 className="text-xl font-bold flex items-center gap-2 mb-6 text-gray-900 pb-4 border-b">
          <PrinterIcon className="text-pink-500" />
          Hardware de Impresión
        </h3>

        {!isSupported ? (
          <div className="bg-red-50 border border-red-200 text-red-800 p-5 rounded-xl flex items-start gap-4">
            <AlertTriangle className="text-red-500 w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-lg mb-1">Tecnología no soportada</h4>
              <p className="text-sm">
                Tu navegador no soporta la tecnología <strong>Web Bluetooth API</strong>. 
                Para imprimir directo a una tickeadora térmica sin popup, necesitas usar <strong>Google Chrome</strong> en Windows, Mac o Android.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            
            {renderPrinterCard('kitchen', 'Impresora de Cocina', 'Las comandas de cocina usarán este destino.', ChefHat, kitchenState)}
            
            <hr className="my-6 border-gray-100" />

            {renderPrinterCard('cashier', 'Impresora de Caja (Cliente)', 'Los tickets para el cliente usarán este destino.', UserCircle, cashierState)}

          </div>
        )}

      </div>
    </div>
  );
}

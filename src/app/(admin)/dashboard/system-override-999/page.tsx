'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldAlert, Power, Lock, Info, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SystemOverridePage() {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [blockMessage, setBlockMessage] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // EL PIN SECRETO (Hardcoded para máxima simplicidad en este caso de control)
  const SECRET_PIN = '2026'; 

  useEffect(() => {
    if (isAuthenticated) {
      fetchStatus();
    }
  }, [isAuthenticated]);

  const fetchStatus = async () => {
    setLoading(true);
    const { data } = await supabase.from('global_settings').select('*').eq('id', 1).single();
    if (data) {
      setIsActive(data.system_active);
      setBlockMessage(data.block_message || '');
    }
    setLoading(false);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === SECRET_PIN) {
      setIsAuthenticated(true);
    } else {
      alert('PIN Incorrecto');
      setPin('');
    }
  };

  const handleToggleSystem = async () => {
    if (isActive === null) return;
    if (!window.confirm(`¿Estás seguro de que deseas ${isActive ? 'BLOQUEAR' : 'REACTIVAR'} el sistema completo?`)) return;

    setSaveStatus('saving');
    const { error } = await supabase
      .from('global_settings')
      .update({ 
        system_active: !isActive,
        block_message: blockMessage,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);

    if (!error) {
      setIsActive(!isActive);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } else {
      setSaveStatus('error');
      alert('Error updating status: ' + error.message);
    }
  };

  const handleUpdateMessage = async () => {
      setSaveStatus('saving');
      const { error } = await supabase
        .from('global_settings')
        .update({ block_message: blockMessage })
        .eq('id', 1);
      
      if (!error) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-gray-800 rounded-3xl p-8 border border-gray-700 shadow-2xl text-center">
          <div className="w-16 h-16 bg-pink-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="text-pink-500" size={32} />
          </div>
          <h1 className="text-white text-xl font-black mb-2 tracking-tight uppercase">Control de Pánico</h1>
          <p className="text-gray-400 text-sm mb-8 font-medium">Acceso restringido al núcleo del sistema</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <Input 
              type="password" 
              placeholder="Ingresa PIN Maestro" 
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white text-center text-2xl tracking-[1em] h-14"
              autoFocus
            />
            <Button type="submit" className="w-full bg-pink-500 hover:bg-pink-600 font-bold h-12">
              DESBLOQUEAR CONTROL
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-8 max-w-2xl mx-auto flex flex-col items-center">
      
      <div className="w-full mb-12 flex justify-between items-start">
        <div>
           <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
             <ShieldAlert className="text-red-500" /> SYSTEM OVERRIDE
           </h1>
           <p className="text-gray-500 font-medium">Control Maestro de Disponibilidad Global</p>
        </div>
        <div className="bg-gray-100 px-4 py-2 rounded-full text-xs font-black text-gray-400 tracking-widest uppercase">
          MODO: DESARROLLADOR
        </div>
      </div>

      {loading ? (
        <Loader2 className="animate-spin text-pink-500 w-10 h-10 mt-20" />
      ) : (
        <div className="w-full space-y-8 animate-in fade-in duration-500">
          
          {/* CARD DE ESTADO */}
          <div className={`p-8 rounded-[32px] border-4 flex flex-col items-center text-center transition-all ${isActive ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
             <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-sm ${isActive ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                <Power size={40} />
             </div>
             
             <h2 className="text-3xl font-black text-gray-900 mb-2">
               SISTEMA {isActive ? 'ONLINE' : 'OFFLINE'}
             </h2>
             <p className={`font-bold mb-8 uppercase tracking-widest text-sm ${isActive ? 'text-green-600' : 'text-red-600'}`}>
               {isActive ? 'Todos los módulos operativos' : 'Servicio suspendido globalmente'}
             </p>

             <button 
               onClick={handleToggleSystem}
               className={`px-12 py-5 rounded-2xl font-black text-lg transition-all active:scale-95 shadow-xl ${isActive ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/30' : 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/30'}`}
             >
               {isActive ? 'APAGAR TODO EL SISTEMA' : 'REACTIVAR SISTEMA AHORA'}
             </button>
          </div>

          {/* CONFIGURACIÓN DEL MENSAJE */}
          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-4">
             <div className="flex items-center gap-2 font-black text-gray-900 text-sm uppercase tracking-widest pb-2 border-b">
                <Info size={16} className="text-gray-400" /> Mensaje de Bloqueo
             </div>
             <p className="text-xs text-gray-500 font-medium">Este texto aparecerá a los clientes y administradores cuando el sistema esté suspendido.</p>
             <textarea 
               value={blockMessage}
               onChange={(e) => setBlockMessage(e.target.value)}
               className="w-full p-4 rounded-xl border border-gray-200 text-gray-700 font-medium h-24 focus:ring-2 focus:ring-pink-500 outline-none"
               placeholder="Escribe el motivo del cierre..."
             />
             <Button 
               disabled={saveStatus === 'saving'}
               onClick={handleUpdateMessage}
               className="w-full bg-gray-900 hover:bg-black text-white font-bold h-12 rounded-xl"
             >
               {saveStatus === 'saving' ? 'Guardando...' : 'Actualizar Mensaje Visual'}
             </Button>
          </div>

          {/* ADVERTENCIA FINAL */}
          <div className="flex items-start gap-4 p-5 bg-orange-50 rounded-2xl border border-orange-100">
             <AlertTriangle className="text-orange-500 shrink-0" />
             <p className="text-[13px] text-orange-900 font-medium leading-relaxed">
               <strong>ATENCIÓN:</strong> El botón de apagado desconecta instantáneamente la API de Pedidos, el Dashboard y el Landing Page. Los clientes no podrán procesar pagos ni ver productos hasta que reactives manualmente.
             </p>
          </div>

          <div className="pt-10 flex justify-center">
             {saveStatus === 'success' && (
               <div className="flex items-center gap-2 text-green-600 font-bold animate-in bounce-in">
                 <CheckCircle2 size={18} /> Cambios aplicados con éxito
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminStore } from '@/lib/store';
import { Clock, ShieldAlert, CheckCircle2, Save, Loader2, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DaySchedule {
  open: string;
  close: string;
  active: boolean;
}

interface WeeklySchedule {
  [dayIndex: string]: DaySchedule; // '1' = Lunes, '0' = Domingo
}

const DAY_NAMES: Record<string, string> = {
  '1': 'Lunes',
  '2': 'Martes',
  '3': 'Miércoles',
  '4': 'Jueves',
  '5': 'Viernes',
  '6': 'Sábado',
  '0': 'Domingo',
};

export default function HoursSettingsPage() {
  const { activeBranch } = useAdminStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isManuallyClosed, setIsManuallyClosed] = useState(false);
  const [schedule, setSchedule] = useState<WeeklySchedule>({});
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const getDbBranchName = (id: string) => {
    const map: Record<string, string> = { pucon: 'Pucón', panguipulli: 'Panguipulli', villarrica: 'Villarrica', temuco: 'Temuco' };
    return map[id] || id;
  };

  const fetchSchedule = useCallback(async () => {
    if (!activeBranch) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('branch_settings')
      .select('*')
      .eq('branch_name', getDbBranchName(activeBranch))
      .single();
        
      if (data) {
        setSchedule(data.weekly_schedule);
        setIsManuallyClosed(data.is_manually_closed);
        setLastUpdated(data.updated_at);
      }
      setLoading(false);
  }, [activeBranch]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleSave = async () => {
    if (!activeBranch) return;
    setSaving(true);
    
    const { error } = await supabase
      .from('branch_settings')
      .update({
        weekly_schedule: schedule,
        is_manually_closed: isManuallyClosed,
        updated_at: new Date().toISOString()
      })
      .eq('branch_name', getDbBranchName(activeBranch));
      
    setSaving(false);
    if (!error) {
      alert('¡Horarios actualizados exitosamente para ' + activeBranch + '!');
      setLastUpdated(new Date().toISOString());
    } else {
      alert('Error al guardar: ' + error.message);
    }
  };

  const handleDayToggle = (day: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], active: !prev[day].active }
    }));
  };

  const handleTimeChange = (day: string, type: 'open' | 'close', value: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [type]: value }
    }));
  };

  if (!activeBranch) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center col-span-full">
         <ShieldAlert className="w-16 h-16 text-red-500/20 mb-4" />
         <h1 className="text-2xl font-black text-gray-900 mb-2">Acceso Bloqueado</h1>
         <p className="text-gray-500 font-medium">Selecciona tu sucursal en el menú lateral para ver tu itinerario.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative w-full pt-8 px-10 max-w-4xl mx-auto pb-20">
      
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-[28px] font-black text-gray-900 tracking-tight flex items-center gap-3">
             <CalendarClock className="text-pink-500 w-8 h-8" strokeWidth={2.5} /> Control de Horarios
          </h2>
          <p className="text-gray-500 font-medium mt-1">
             Configuración operativa aislada para: <strong className="text-gray-900 uppercase tracking-widest bg-yellow-100 px-2 py-0.5 rounded ml-1">{activeBranch}</strong>
          </p>
        </div>
        
        <Button 
          onClick={handleSave} 
          disabled={loading || saving}
          className="bg-gray-900 hover:bg-black text-white h-12 px-8 rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          Guardar Cambios
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* MASTER SWITCH = EMERGENCY CLOSE */}
          <div className={`p-6 rounded-2xl border-2 transition-colors flex items-start gap-4 ${isManuallyClosed ? 'bg-red-50 border-red-500' : 'bg-white border-gray-200'}`}>
            <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${isManuallyClosed ? 'bg-red-500' : 'bg-gray-100'}`}>
               <ShieldAlert className={`w-6 h-6 ${isManuallyClosed ? 'text-white' : 'text-gray-400'}`} />
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-black tracking-tight ${isManuallyClosed ? 'text-red-900' : 'text-gray-900'}`}>
                 Cierre Maestro de Emergencia
              </h3>
              <p className={`text-sm font-medium mt-1 ${isManuallyClosed ? 'text-red-800/80' : 'text-gray-500'}`}>
                 Activa esto si el local sufre un corte de luz o colapso severo. **Ignorará tu horario e impedirá cualquier compra inmediatamente.**
              </p>
            </div>
            
            <label className="relative inline-flex items-center cursor-pointer mt-2 shrink-0">
               <input type="checkbox" checked={isManuallyClosed} onChange={(e) => setIsManuallyClosed(e.target.checked)} className="sr-only peer" />
               <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-500"></div>
            </label>
          </div>

          {/* 7-DAY SCHEDULE */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
             <div className="p-5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                   <Clock className="w-5 h-5 text-gray-400" /> Itinerario Semanal
                </h3>
             </div>
             
             <div className="divide-y divide-gray-100">
               {['1', '2', '3', '4', '5', '6', '0'].map((dayKey) => {
                 const dayData = schedule[dayKey];
                 if (!dayData) return null;
                 
                 return (
                   <div key={dayKey} className={`p-5 flex items-center justify-between transition-colors ${dayData.active ? 'bg-white' : 'bg-gray-50/50 opacity-60'}`}>
                      <div className="flex items-center gap-4 w-40 shrink-0">
                         <label className="relative inline-flex items-center cursor-pointer">
                           <input type="checkbox" checked={dayData.active} onChange={() => handleDayToggle(dayKey)} className="sr-only peer" />
                           <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                         </label>
                         <span className={`font-bold ${dayData.active ? 'text-gray-900' : 'text-gray-500'}`}>
                           {DAY_NAMES[dayKey]}
                         </span>
                      </div>
                      
                      {dayData.active ? (
                        <div className="flex items-center gap-3">
                           <div className="flex flex-col">
                             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Apertura</span>
                             <input 
                               type="time" 
                               value={dayData.open} 
                               onChange={(e) => handleTimeChange(dayKey, 'open', e.target.value)}
                               className="border border-gray-300 rounded-lg px-3 py-2 font-bold text-gray-700 bg-white focus:ring-2 focus:ring-pink-500 focus:outline-none w-32"
                             />
                           </div>
                           <span className="text-gray-300 font-black mt-5">-</span>
                           <div className="flex flex-col">
                             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Cierre</span>
                             <input 
                               type="time" 
                               value={dayData.close} 
                               onChange={(e) => handleTimeChange(dayKey, 'close', e.target.value)}
                               className="border border-gray-300 rounded-lg px-3 py-2 font-bold text-gray-700 bg-white focus:ring-2 focus:ring-pink-500 focus:outline-none w-32"
                             />
                           </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex justify-end pr-8">
                           <span className="text-sm font-bold text-gray-400 uppercase tracking-widest bg-gray-200 px-3 py-1 rounded-full">
                             Cerrado todo el día
                           </span>
                        </div>
                      )}
                   </div>
                 );
               })}
             </div>
          </div>
          
        </div>
      )}
    </div>
  );
}

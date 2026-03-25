'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminStore } from '@/lib/store';
import { MapPin, Plus, Trash2, Save, Loader2, DollarSign, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DeliveryZone {
  id: string;
  name: string;
  price: number;
}

export default function DeliveryZonesPage() {
  const { activeBranch } = useAdminStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZonePrice, setNewZonePrice] = useState('');

  const getDbBranchName = (id: string) => {
    const map: Record<string, string> = { pucon: 'Pucón', panguipulli: 'Panguipulli', villarrica: 'Villarrica', temuco: 'Temuco' };
    return map[id] || id;
  };

  useEffect(() => {
    if (!activeBranch) return;

    const fetchZones = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('branch_settings')
        .select('delivery_zones')
        .eq('branch_name', getDbBranchName(activeBranch))
        .single();
        
      if (data && data.delivery_zones) {
        setZones(data.delivery_zones);
      } else {
        setZones([]);
      }
      setLoading(false);
    };

    fetchZones();
  }, [activeBranch]);

  const handleSave = async (updatedZones: DeliveryZone[]) => {
    if (!activeBranch) return;
    setSaving(true);
    
    const { error } = await supabase
      .from('branch_settings')
      .update({
        delivery_zones: updatedZones,
        updated_at: new Date().toISOString()
      })
      .eq('branch_name', getDbBranchName(activeBranch));
      
    setSaving(false);
    if (!error) {
      setZones(updatedZones);
    } else {
      alert('Error al guardar: ' + error.message);
    }
  };

  const addZone = () => {
    if (!newZoneName.trim() || !newZonePrice) return;
    
    const priceNum = parseInt(newZonePrice.replace(/\D/g, ''), 10);
    if (isNaN(priceNum)) {
      alert("El precio debe ser un número válido.");
      return;
    }

    const newZone: DeliveryZone = {
      id: crypto.randomUUID(),
      name: newZoneName.trim(),
      price: priceNum
    };

    const updatedZones = [...zones, newZone];
    handleSave(updatedZones);
    setNewZoneName('');
    setNewZonePrice('');
  };

  const deleteZone = (id: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta zona de reparto?")) return;
    const updatedZones = zones.filter(z => z.id !== id);
    handleSave(updatedZones);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(price);
  };

  if (!activeBranch) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
         <ShieldAlert className="w-16 h-16 text-red-500/20 mb-4" />
         <h1 className="text-2xl font-black text-gray-900 mb-2">Acceso Bloqueado</h1>
         <p className="text-gray-500 font-medium">Selecciona tu sucursal en el menú lateral para ver tu itinerario de zonas.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative w-full pt-8 px-10 max-w-4xl mx-auto pb-20">
      
      <div className="mb-8">
        <h2 className="text-[28px] font-black text-gray-900 tracking-tight flex items-center gap-3">
           <MapPin className="text-pink-500 w-8 h-8" strokeWidth={2.5} /> Zonas de Delivery
        </h2>
        <p className="text-gray-500 font-medium mt-1">
           Configura los sectores y precios de despacho exclusivos para la sucursal: <strong className="text-gray-900 uppercase tracking-widest bg-yellow-100 px-2 py-0.5 rounded ml-1">{activeBranch}</strong>
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Formulario para agregar nueva zona */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-3">
              <Plus size={20} className="text-pink-500" /> Agregar Nuevo Sector
            </h3>
            
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2 w-full">
                <Label htmlFor="zoneName" className="font-bold text-gray-700">Nombre del Sector</Label>
                <Input 
                  id="zoneName" 
                  placeholder="Ej: Pucón Centro, Península, Camino al Volcán..." 
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  className="bg-gray-50 border-gray-200 h-12"
                />
              </div>
              
              <div className="w-full md:w-48 space-y-2">
                <Label htmlFor="zonePrice" className="font-bold text-gray-700">Costo Adicional</Label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-gray-500 font-bold">$</span>
                  <Input 
                    id="zonePrice" 
                    type="number" 
                    placeholder="1500" 
                    value={newZonePrice}
                    onChange={(e) => setNewZonePrice(e.target.value)}
                    className="bg-gray-50 border-gray-200 pl-8 h-12 font-bold text-gray-900"
                  />
                </div>
              </div>
              
              <Button 
                onClick={addZone} 
                disabled={saving || !newZoneName.trim() || !newZonePrice}
                className="w-full md:w-auto h-12 px-8 bg-gray-900 hover:bg-black text-white font-bold rounded-xl"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Guardar Sector'}
              </Button>
            </div>
            <p className="text-xs text-gray-400 font-medium mt-3">Al guardar, este sector se mostrará instantáneamente en la pantalla de cobro de los clientes.</p>
          </div>

          {/* Lista de zonas actuales */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
             <div className="p-5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                   <MapPin className="w-5 h-5 text-gray-400" /> Sectores Activos ({zones.length})
                </h3>
             </div>
             
             {zones.length === 0 ? (
               <div className="p-10 text-center text-gray-400 bg-white">
                 <MapPin className="w-12 h-12 mx-auto mb-3 opacity-20" />
                 <p className="font-medium text-[15px]">No has configurado ninguna zona de delivery aún.</p>
                 <p className="text-sm mt-1">Tus clientes de {activeBranch} no podrán seleccionar delivery.</p>
               </div>
             ) : (
               <div className="divide-y divide-gray-100">
                 {zones.map((zone) => (
                   <div key={zone.id} className="p-5 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600">
                            <MapPin size={18} />
                         </div>
                         <div>
                           <h4 className="font-bold text-gray-900 text-[16px]">{zone.name}</h4>
                           <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest mt-0.5 block">ID: {zone.id.split('-')[0]}</span>
                         </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <span className="text-[12px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Recargo</span>
                          <span className="font-black text-[20px] text-pink-500 tabular-nums leading-none block">
                            {formatPrice(zone.price)}
                          </span>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteZone(zone.id)}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 h-10 w-10 shrink-0"
                          title="Eliminar Sector"
                        >
                          <Trash2 size={20} />
                        </Button>
                      </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
          
        </div>
      )}
    </div>
  );
}

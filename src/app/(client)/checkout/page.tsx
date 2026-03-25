'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { Trash2, ArrowLeft, Send, CreditCard, Loader2, Clock, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { products } from '@/lib/mock-db';

const BRANCHES = {
  pucon: { name: 'Pucón', phone: '56930026561' },
  panguipulli: { name: 'Panguipulli', phone: '56938896083' },
  villarrica: { name: 'Villarrica', phone: '56977602701' },
  temuco: { name: 'Temuco', phone: '56942321148' },
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, removeItem, updateQuantity, getTotal, clearCart } = useCart();
  const [mounted, setMounted] = useState(false);

  const [formData, setFormData] = useState({
    branch: '',
    deliveryMethod: 'pickup', // pickup | delivery
    deliveryZoneId: '', // For delivery pricing
    name: '',
    phone: '',
    address: '',
    paymentMethod: 'online', // presencial | online
    notes: '',
  });

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [cartPrepTime, setCartPrepTime] = useState(0);
  const [backlogTime, setBacklogTime] = useState(0);
  const [isCalculatingTime, setIsCalculatingTime] = useState(false);
  const [isBranchClosed, setIsBranchClosed] = useState(false);
  const [branchClosedMessage, setBranchClosedMessage] = useState('');
  
  // Zonas de Delivery Dinámicas
  const [deliveryZones, setDeliveryZones] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<any>(null);

  const estimatedWaitTime = Math.max(15, cartPrepTime + backlogTime);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync Cart Prep Time
  useEffect(() => {
    const time = items.reduce((sum, item) => sum + ((item.product.prepTime || 4) * item.quantity), 0);
    setCartPrepTime(time);
  }, [items]);

  // Live Backlog Query based on active branch queue
  useEffect(() => {
    if (!formData.branch) {
      setBacklogTime(0);
      return;
    }
    
    const fetchBacklog = async () => {
      setIsCalculatingTime(true);
      const branchInfo = BRANCHES[formData.branch as keyof typeof BRANCHES];
      if (!branchInfo) {
        setIsCalculatingTime(false);
        setIsBranchClosed(false);
        return;
      }

      // CHECK HOURS FIRST!
      const { data: settingsData } = await supabase
        .from('branch_settings')
        .select('*')
        .eq('branch_name', branchInfo.name)
        .single();
        
      if (settingsData) {
         setDeliveryZones(settingsData.delivery_zones || []);

         if (settingsData.is_manually_closed) {
            setIsBranchClosed(true);
            setBranchClosedMessage('Esta sucursal se encuentra cerrada temporalmente por emergencia.');
            setIsCalculatingTime(false);
            return;
         }
         
         const chileTime = new Date().toLocaleString("en-US", { timeZone: "America/Santiago" });
         const currentDay = new Date(chileTime).getDay().toString();
         const dayData = settingsData.weekly_schedule[currentDay];
         
         if (!dayData || !dayData.active) {
            setIsBranchClosed(true);
            setBranchClosedMessage('Esta sucursal está cerrada el día de hoy.');
            setIsCalculatingTime(false);
            return;
         }
         
         const hourMinute = new Date(chileTime).getHours() * 60 + new Date(chileTime).getMinutes();
         const [openH, openM] = dayData.open.split(':').map(Number);
         const [closeH, closeM] = dayData.close.split(':').map(Number);
         const openMinutes = openH * 60 + openM;
         let closeMinutes = closeH * 60 + closeM;
         
         let isOpen = false;
         if (closeMinutes < openMinutes) {
            if (hourMinute >= openMinutes || hourMinute <= closeMinutes) isOpen = true;
         } else {
            if (hourMinute >= openMinutes && hourMinute <= closeMinutes) isOpen = true;
         }
         
         if (!isOpen) {
            setIsBranchClosed(true);
            setBranchClosedMessage(`Horario de atención: ${dayData.open} a ${dayData.close} hrs.`);
            setIsCalculatingTime(false);
            return;
         }
         
         // Si llega aca esta abierto
         setIsBranchClosed(false);
      }
      
      const { data, error } = await supabase
        .from('orders')
        .select('items')
        .in('status', ['pending', 'preparing'])
        .eq('branch_name', branchInfo.name);

      if (error || !data) {
        setIsCalculatingTime(false);
        return;
      }

      let totalBacklog = 0;
      data.forEach(order => {
        order.items.forEach((item: any) => {
          if (!item._isDeliveryMetadata && !item._isPaymentMetadata && !item._isEstimatedTimeMetadata) {
            const productDef = products.find(p => p.id === item.productId);
            // Divides backlog impact slightly because kitchen does multiple at once (e.g. 0.5 impact for previous orders)
            // or we keep it linear (1x). Linear is safer to avoid overwhelming.
            totalBacklog += Math.round((productDef?.prepTime || 4) * (item.quantity || 1) * 0.7); 
          }
        });
      });
      
      // Añadimos un pequeño retraso visual para que el usuario SIEMPRE perciba que el sistema re-calculó al cambiar sucursal
      setTimeout(() => {
        setBacklogTime(totalBacklog);
        setIsCalculatingTime(false);
      }, 500);
    };

    fetchBacklog();
  }, [formData.branch]);

  if (!mounted) return null;

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    updateQuantity(productId, newQuantity);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(price);
  };

  const handleOnlinePaymentAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsProcessingPayment(true);

    // Simular llamada a API de MercadoPago / Webpay
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    await submitOrder(true);
  };

  const handlePresentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsProcessingPayment(true);
    await submitOrder(false);
  };

  const validateForm = () => {
    if (!formData.branch || !formData.name || !formData.phone) {
      alert('Por favor completa todos los campos obligatorios (Sucursal, Nombre, Teléfono).');
      return false;
    }
    if (formData.deliveryMethod === 'delivery') {
      if (!formData.deliveryZoneId) {
        alert('Por favor selecciona tu zona de reparto.');
        return false;
      }
      if (!formData.address) {
        alert('Por favor ingresa tu dirección exacta.');
        return false;
      }
    }
    return true;
  }

  const submitOrder = async (isPaidOnline: boolean) => {
    try {
      const branchInfo = BRANCHES[formData.branch as keyof typeof BRANCHES];
      
      const orderPayload = {
        branch: branchInfo,
        customer: {
          name: formData.name,
          phone: formData.phone,
          deliveryMethod: formData.deliveryMethod,
          address: formData.address,
        },
        payment: {
          method: formData.paymentMethod,
          isPaidOnline,
        },
        items: [
          ...items.map(item => ({
            productId: item.product.id,
            name: item.product.name,
            quantity: item.quantity,
            price: item.product.price,
            subtotal: item.quantity * item.product.price
          })),
          {
            name: '_deliveryInfo',
            price: (formData.deliveryMethod === 'delivery' && selectedZone) ? selectedZone.price : 0,
            quantity: formData.deliveryMethod === 'delivery' ? 1 : 0,
            subtotal: (formData.deliveryMethod === 'delivery' && selectedZone) ? selectedZone.price : 0,
            productId: 'delivery_meta',
            _isDeliveryMetadata: true,
            method: formData.deliveryMethod,
            address: formData.deliveryMethod === 'delivery' ? formData.address : null,
            zoneName: selectedZone?.name || null,
            zoneId: formData.deliveryZoneId || null
          },
          {
            name: '_paymentInfo',
            price: 0,
            quantity: 0,
            subtotal: 0,
            productId: 'payment_meta',
            _isPaymentMetadata: true,
            method: formData.paymentMethod, // 'online' | 'presencial'
            isPaidOnline
          },
          {
            name: '_estimatedTime',
            price: 0,
            quantity: 0,
            subtotal: 0,
            productId: 'time_meta',
            _isEstimatedTimeMetadata: true,
            time: estimatedWaitTime
          }
        ],
        notes: formData.notes,
        total: getTotal() + ((formData.deliveryMethod === 'delivery' && selectedZone) ? selectedZone.price : 0),
        timestamp: new Date().toISOString()
      };

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderPayload),
      });

      if (!response.ok) {
        throw new Error('Error al enviar el pedido');
      }

      const responseData = await response.json();

      clearCart();
      
      if (responseData.orderId) {
        if (typeof window !== 'undefined') {
           localStorage.setItem('activeOrderId', responseData.orderId);
           // Disparamos un evento custom para que el Widget escuche el cambio al instante
           window.dispatchEvent(new Event('storage')); 
        }
        router.push(`/checkout/success?orderId=${responseData.orderId}`);
      } else {
        router.push('/checkout/success');
      }

    } catch (error) {
      console.error('Error procesando pedido:', error);
      alert('Hubo un problema al procesar tu pedido. Por favor intenta nuevamente.');
      setIsProcessingPayment(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Tu carrito está vacío</h2>
        <Button onClick={() => router.push('/')} className="bg-primary text-white">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Menú
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b sticky top-0 z-40 px-4 py-4 flex items-center">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="mr-2">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-gray-900">Finalizar Pedido</h1>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6 mt-4">
        
        {/* Resumen del Carrito */}
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="pb-3 border-b border-gray-100">
            <CardTitle className="text-lg">Resumen de tu pedido</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {items.map((item) => (
              <div key={item.product.id} className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{item.product.name}</h4>
                  <p className="text-sm text-gray-500">{formatPrice(item.product.price)} c/u</p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md bg-white shadow-sm font-medium" onClick={() => handleQuantityChange(item.product.id, item.quantity - 1)}>-</Button>
                    <span className="w-4 text-center text-sm font-medium">{item.quantity}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md bg-white shadow-sm font-medium" onClick={() => handleQuantityChange(item.product.id, item.quantity + 1)}>+</Button>
                  </div>
                  <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeItem(item.product.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {formData.deliveryMethod === 'delivery' && selectedZone && (
              <div className="flex items-center justify-between text-gray-500 pt-2 border-t border-gray-50">
                <span>Costo de Envío ({selectedZone.name})</span>
                <span>{formatPrice(selectedZone.price)}</span>
              </div>
            )}
            <div className="pt-4 border-t flex justify-between items-center text-lg font-bold">
              <span>Total</span>
              <span className="text-secondary">{formatPrice(getTotal() + ((formData.deliveryMethod === 'delivery' && selectedZone) ? selectedZone.price : 0))}</span>
            </div>
          </CardContent>
        </Card>

        {/* Formulario de Checkout */}
        <form 
          onSubmit={(e) => {
            if (formData.paymentMethod === 'online') {
              handleOnlinePaymentAndSubmit(e);
            } else {
              handlePresentialSubmit(e);
            }
          }} 
          className="space-y-6"
        >
          <Card className="shadow-sm border-gray-100">
            <CardHeader>
              <CardTitle className="text-lg">Detalles del Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="space-y-2">
                <Label htmlFor="branch" className="text-secondary font-bold text-base">1. Selecciona Sucursal *</Label>
                <Select required onValueChange={(value: string | null) => { if (value) handleInputChange('branch', value); }}>
                  <SelectTrigger id="branch" className="bg-white border-2 border-primary/20 focus:ring-primary focus:border-primary">
                    <SelectValue placeholder="¿A qué local vas a pedir?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pucon">📍 Pucón</SelectItem>
                    <SelectItem value="panguipulli">📍 Panguipulli</SelectItem>
                    <SelectItem value="villarrica">📍 Villarrica</SelectItem>
                    <SelectItem value="temuco">📍 Temuco</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <hr className="border-gray-100"/>

              <div className="space-y-3">
                <Label className="font-bold text-gray-900 text-base">2. Método de Entrega *</Label>
                <RadioGroup 
                  defaultValue="pickup" 
                  onValueChange={(value: string) => handleInputChange('deliveryMethod', value)}
                  className="flex flex-col sm:flex-row gap-3"
                >
                  <div className="flex items-center space-x-2 border-2 p-3 rounded-xl bg-white flex-1 cursor-pointer hover:border-primary/30 transition-colors [&:has([data-state=checked])]:border-primary/50">
                    <RadioGroupItem value="pickup" id="pickup" />
                    <Label htmlFor="pickup" className="cursor-pointer font-medium">🏪 Retiro en Local</Label>
                  </div>
                  <div className="flex items-center space-x-2 border-2 p-3 rounded-xl bg-white flex-1 cursor-pointer hover:border-primary/30 transition-colors [&:has([data-state=checked])]:border-primary/50">
                    <RadioGroupItem value="delivery" id="delivery" />
                    <Label htmlFor="delivery" className="cursor-pointer font-medium">🛵 Delivery</Label>
                  </div>
                </RadioGroup>
              </div>

              <hr className="border-gray-100"/>
              
              <div className="space-y-4">
                <Label className="font-bold text-gray-900 text-base block mb-2">3. Tus Datos</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre Completo *</Label>
                    <Input id="name" required placeholder="Ej: Juan Pérez" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono / WhatsApp *</Label>
                    <Input id="phone" type="tel" required placeholder="Ej: +56912345678" value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} />
                  </div>
                </div>
              </div>

              {formData.deliveryMethod === 'delivery' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  
                  {deliveryZones.length > 0 ? (
                    <div className="space-y-2">
                      <Label htmlFor="zone" className="text-secondary font-bold text-[15px]">Selecciona tu zona de reparto *</Label>
                      <Select required onValueChange={(value: string | null) => {
                        if (value) {
                          handleInputChange('deliveryZoneId', value);
                          const zone = deliveryZones.find(z => z.id === value);
                          setSelectedZone(zone || null);
                        }
                      }}>
                        <SelectTrigger id="zone" className="bg-white border-2 border-primary/20">
                          <SelectValue placeholder="Busca tu sector..." />
                        </SelectTrigger>
                        <SelectContent>
                          {deliveryZones.map(zone => (
                            <SelectItem key={zone.id} value={zone.id}>
                              {zone.name} (+{formatPrice(zone.price)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[12px] text-red-500 font-bold mt-1 leading-tight">
                        ⚠️ Tu dirección será verificada. Seleccionar un sector erróneo resultará en el cobro de la diferencia en efectivo al momento de la entrega.
                      </p>
                    </div>
                  ) : (
                     <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-200 font-medium">
                       Esta sucursal aún no tiene zonas de reparto configuradas, o no despacha al domicilio temporalmente.
                     </p>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="address">Dirección de Envío Exacta *</Label>
                    <Input id="address" required placeholder="Calle, número, depto, indicaciones..." value={formData.address} onChange={(e) => handleInputChange('address', e.target.value)} />
                  </div>
                </div>
              )}

              <hr className="border-gray-100"/>
              
              <div className="space-y-3">
                <Label className="font-bold text-gray-900 text-base">4. Método de Pago *</Label>
                <RadioGroup 
                  defaultValue="online" 
                  onValueChange={(value: string) => handleInputChange('paymentMethod', value)}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-start space-x-3 border-2 p-4 rounded-xl bg-white cursor-pointer hover:border-primary/30 transition-colors border-primary/50 bg-primary/5">
                    <RadioGroupItem value="online" id="online" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="online" className="cursor-pointer font-bold text-base block mb-1 flex items-center gap-2">
                        💳 Tarjeta Débito / Crédito 
                      </Label>
                      <p className="text-sm text-gray-500">Paga seguro online vía Webpay o MercadoPago.</p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <hr className="border-gray-100"/>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas adicionales (Opcional)</Label>
                <Textarea id="notes" placeholder="Con o sin palillos, alergias, etc." value={formData.notes} onChange={(e) => handleInputChange('notes', e.target.value)} className="resize-none h-20" />
              </div>

              <hr className="border-gray-100"/>

              <div className="bg-orange-50 border border-orange-100 p-5 rounded-2xl flex items-start sm:items-center gap-4 animate-in fade-in">
                <div className="bg-orange-100 p-2.5 rounded-full flex-shrink-0">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-bold text-orange-950 text-[15px] mb-0.5">Tiempo Estimado de Preparación</h4>
                  {formData.branch ? (
                    isCalculatingTime ? (
                       <p className="text-orange-800/80 text-sm font-bold leading-snug flex items-center gap-2 mt-1">
                         <Loader2 className="w-3.5 h-3.5 animate-spin"/> Calculando demanda en sucursal {BRANCHES[formData.branch as keyof typeof BRANCHES]?.name}...
                       </p>
                    ) : (
                      <p className="text-orange-800/80 text-sm font-medium leading-snug">
                        Basado en tu pedido actual y la cola en cocina, aproximamos <strong>{estimatedWaitTime} a {estimatedWaitTime + 10} minutos</strong>.
                      </p>
                    )
                  ) : (
                    <p className="text-orange-800/80 text-sm font-medium leading-snug">Selecciona tu local para calcular el nivel de demanda actual de nuestros Sushingueros.</p>
                  )}
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Botón Flotante Fijo (Mobile friendly) */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t z-50 shadow-[0_-4px_10px_-1px_rgb(0,0,0,0.1)]">
            <div className="max-w-3xl mx-auto">
              {isBranchClosed ? (
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-center shadow-inner animate-in slide-in-from-bottom-2">
                   <p className="font-black text-red-900 text-lg mb-0.5 tracking-tight flex items-center justify-center gap-2">
                     <ShieldAlert size={18} /> Fuera de Horario
                   </p>
                   <p className="text-[13px] text-red-600/90 font-bold uppercase tracking-widest">{branchClosedMessage}</p>
                </div>
              ) : (
                <Button 
                  type="submit" 
                  size="lg" 
                  disabled={isProcessingPayment || isCalculatingTime}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-lg h-14 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Procesando pedido...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Finalizar Pedido
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const webhookUrl = process.env.MAKE_WEBHOOK_URL;
    const branchName = payload.branch?.name;

    if (!branchName) {
      return NextResponse.json({ success: false, error: 'Sucursal no especificada' }, { status: 400 });
    }

    // 0. VERIFICAR HORARIOS DE SUCURSAL
    const { data: branchSettings, error: settingsError } = await supabase
      .from('branch_settings')
      .select('*')
      .eq('branch_name', branchName)
      .single();

    if (branchSettings) {
      if (branchSettings.is_manually_closed) {
        return NextResponse.json({ success: false, error: 'Esta sucursal se encuentra cerrada temporalmente.' }, { status: 400 });
      }

      const chileTime = new Date().toLocaleString("en-US", { timeZone: "America/Santiago" });
      const currentDay = new Date(chileTime).getDay().toString();
      const dayData = branchSettings.weekly_schedule[currentDay];

      if (!dayData || !dayData.active) {
        return NextResponse.json({ success: false, error: 'Esta sucursal está cerrada el día de hoy.' }, { status: 400 });
      }

      const hourMinute = new Date(chileTime).getHours() * 60 + new Date(chileTime).getMinutes();
      const [openH, openM] = dayData.open.split(':').map(Number);
      const [closeH, closeM] = dayData.close.split(':').map(Number);
      const openMinutes = openH * 60 + openM;
      let closeMinutes = closeH * 60 + closeM;

      let isOpen = false;
      if (closeMinutes < openMinutes) {
        // Horario nocturno que cruza la medianoche
        if (hourMinute >= openMinutes || hourMinute <= closeMinutes) isOpen = true;
      } else {
        // Horario diurno normal
        if (hourMinute >= openMinutes && hourMinute <= closeMinutes) isOpen = true;
      }

      if (!isOpen) {
        return NextResponse.json({ success: false, error: 'Esta sucursal se encuentra fuera de horario de atención en este momento.' }, { status: 400 });
      }

      // 0.5. VERIFICAR SEGURIDAD DEL PRECIO DE DELIVERY
      const deliveryMeta = payload.items.find((item: any) => item._isDeliveryMetadata);
      if (deliveryMeta && deliveryMeta.method === 'delivery') {
        const zoneId = deliveryMeta.zoneId;
        if (!zoneId) {
          return NextResponse.json({ success: false, error: 'Zona de delivery inválida o no seleccionada en el checkout.' }, { status: 400 });
        }

        const deliveryZones = branchSettings.delivery_zones || [];
        const dbZone = deliveryZones.find((z: any) => z.id === zoneId);

        if (!dbZone) {
          return NextResponse.json({ success: false, error: 'Zona de delivery inexistente para esta sucursal.' }, { status: 400 });
        }

        // Validación estricta anti-fraude
        if (deliveryMeta.price !== dbZone.price) {
           console.error(`Intento de fraude detectado en Delivery. Zona: ${dbZone.name}. Enviado: ${deliveryMeta.price}, Real: ${dbZone.price}`);
           return NextResponse.json({ success: false, error: 'Inconsistencia de precios detectada. Refresca la página.' }, { status: 400 });
        }
      }
    }

    // 1. Guardar en Supabase
    // Columnas: id, created_at, customer_name, branch_name, items (jsonb), total (int8), status (text)
    const { data: orderData, error: dbError } = await supabase
      .from('orders')
      .insert([
        {
          customer_name: payload.customer.name,
          branch_name: payload.branch.name,
          items: payload.items,
          total: payload.total,
          status: 'pending' // Estado inicial del pedido
        }
      ])
      .select()
      .single();

    if (dbError) {
      console.error('Error inserting into Supabase:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    // 2. Enviar a Webhook (Make/Zapier)
    if (!webhookUrl) {
      console.log('Webhook URL not set. Payload received:', JSON.stringify(payload, null, 2));
      // Simular latencia de red
      await new Promise(resolve => setTimeout(resolve, 1500));
      return NextResponse.json({ success: true, message: 'Simulated webhook delivery', orderId: orderData.id });
    }

    // Forward the payload to Make/Zapier Webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Webhook error: ${response.statusText}`);
    }

    return NextResponse.json({ success: true, orderId: orderData.id });
  } catch (error) {
    console.error('Error in checkout API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

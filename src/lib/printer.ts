export class ESCPOSPrinter {
  private static kitchenDevice: BluetoothDevice | null = null;
  private static kitchenCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  
  private static cashierDevice: BluetoothDevice | null = null;
  private static cashierCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

  // UUIDs estandar para impresoras térmicas ESC/POS genéricas Bluetooth Low Energy (BLE)
  private static readonly SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
  private static readonly SERVICE_UUID_ALT = 'e7810a71-73ae-499d-8c15-faa9aef0c3f2';
  private static readonly CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';
  private static readonly CHARACTERISTIC_UUID_ALT = 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f';

  static async connect(role: 'kitchen' | 'cashier'): Promise<boolean> {
    try {
      if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth API no está soportada en este navegador.');
      }

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [this.SERVICE_UUID, this.SERVICE_UUID_ALT]
      });

      if (!device || !device.gatt) {
        throw new Error('Dispositivo no seleccionado o GATT no disponible.');
      }

      const server = await device.gatt.connect();

      // Intenta usar el servicio estándar primero, luego el alternativo si falla
      let service;
      try {
        service = await server.getPrimaryService(this.SERVICE_UUID);
      } catch (e) {
        service = await server.getPrimaryService(this.SERVICE_UUID_ALT);
      }
      
      let characteristic;
      try {
         characteristic = await service.getCharacteristic(this.CHARACTERISTIC_UUID);
      } catch (e) {
         characteristic = await service.getCharacteristic(this.CHARACTERISTIC_UUID_ALT);
      }

      const disconnectedHandler = () => this.onDisconnected(role);
      device.addEventListener('gattserverdisconnected', disconnectedHandler);

      if (role === 'kitchen') {
         this.kitchenDevice = device;
         this.kitchenCharacteristic = characteristic;
      } else {
         this.cashierDevice = device;
         this.cashierCharacteristic = characteristic;
      }

      return true;
    } catch (error) {
      console.error(`Error de conexión Bluetooth (${role}):`, error);
      this.disconnect(role);
      throw error;
    }
  }

  static onDisconnected(role: 'kitchen' | 'cashier') {
    console.log(`Impresora ${role} desconectada`);
    if (role === 'kitchen') {
       ESCPOSPrinter.kitchenDevice = null;
       ESCPOSPrinter.kitchenCharacteristic = null;
    } else {
       ESCPOSPrinter.cashierDevice = null;
       ESCPOSPrinter.cashierCharacteristic = null;
    }
  }

  static disconnect(role: 'kitchen' | 'cashier') {
    if (role === 'kitchen') {
       if (this.kitchenDevice && this.kitchenDevice.gatt) this.kitchenDevice.gatt.disconnect();
       this.kitchenDevice = null;
       this.kitchenCharacteristic = null;
    } else {
       if (this.cashierDevice && this.cashierDevice.gatt) this.cashierDevice.gatt.disconnect();
       this.cashierDevice = null;
       this.cashierCharacteristic = null;
    }
  }

  static isConnected(role: 'kitchen' | 'cashier'): boolean {
    if (role === 'kitchen') {
       return this.kitchenCharacteristic !== null && this.kitchenDevice !== null && this.kitchenDevice.gatt?.connected === true;
    }
    return this.cashierCharacteristic !== null && this.cashierDevice !== null && this.cashierDevice.gatt?.connected === true;
  }

  // Genera el Array de Bytes ESC/POS (80mm)
  static generateReceiptBytes(order: any, role: 'kitchen' | 'cashier'): Uint8Array {
    let bytes: number[] = [];

    // Comandos base ESC/POS
    const INIT = [0x1B, 0x40]; 
    const ALIGN_CENTER = [0x1B, 0x61, 0x01];
    const ALIGN_LEFT = [0x1B, 0x61, 0x00];
    const ALIGN_RIGHT = [0x1B, 0x61, 0x02];
    const BOLD_ON = [0x1B, 0x45, 0x01];
    const BOLD_OFF = [0x1B, 0x45, 0x00];
    const DOUBLE_HEIGHT_WIDTH = [0x1D, 0x21, 0x11];
    const DOUBLE_HEIGHT = [0x1D, 0x21, 0x01];
    const NORMAL_SIZE = [0x1D, 0x21, 0x00];
    const LF = [0x0A]; 
    const CUT = [0x1D, 0x56, 0x41, 0x10]; 

    const textToBytes = (text: string) => {
      const clean = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const arr = [];
      for (let i = 0; i < clean.length; i++) arr.push(clean.charCodeAt(i));
      return arr;
    };

    const addLines = (lines: string[]) => {
      lines.forEach(l => {
        bytes.push(...textToBytes(l));
        bytes.push(...LF);
      });
    };

    const formatPrice = (price: number) => `$${price.toLocaleString('es-CL')}`;

    const padRight = (str: string, length: number) => {
      return str.length >= length ? str.substring(0, length) : str.padEnd(length, ' ');
    };

    const alignLeftRight = (left: string, right: string, width = 48) => {
      const spaces = width - left.length - right.length;
      if (spaces <= 0) return left + " " + right;
      return left + " ".repeat(spaces) + right;
    };

    // --- CONSTRUCCIÓN DEL TICKET ---
    bytes.push(...INIT);
    
    // --- 1. HEADER (Centrado) ---
    bytes.push(...ALIGN_CENTER);
    bytes.push(...DOUBLE_HEIGHT_WIDTH);
    bytes.push(...BOLD_ON);
    addLines(["CLASICOS"]);
    bytes.push(...NORMAL_SIZE);
    addLines(["SUSHI & STREET FOOD"]);
    bytes.push(...BOLD_OFF);
    addLines([""]);
    
    // Tipo de Ticket
    bytes.push(...DOUBLE_HEIGHT);
    bytes.push(...BOLD_ON);
    addLines([role === 'kitchen' ? "COMANDA DE COCINA" : "TICKET DE VENTA"]);
    bytes.push(...NORMAL_SIZE);
    bytes.push(...BOLD_OFF);
    
    addLines([
      "------------------------------------------------" // 48 chars
    ]);

    // --- 2. METADATA DEL PEDIDO ---
    bytes.push(...ALIGN_LEFT);
    bytes.push(...BOLD_ON);
    addLines([`ORDEN Nro: #${order.id}`]);
    bytes.push(...BOLD_OFF);

    const d = new Date(order.created_at);
    const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    
    addLines([
      alignLeftRight(`Fecha: ${dateStr}`, `Hora: ${timeStr}`),
      `Cliente: ${order.customer_name}`,
      `Sucursal: ${order.branch_name}`
    ]);

    // Método de Entrega
    const deliveryMeta = order.items.find((i:any) => i._isDeliveryMetadata);
    bytes.push(...ALIGN_CENTER);
    bytes.push(...LF);
    bytes.push(...DOUBLE_HEIGHT);
    bytes.push(...BOLD_ON);
    if (deliveryMeta && deliveryMeta.method === 'delivery') {
      addLines([`*** DELIVERY ***`]);
      bytes.push(...NORMAL_SIZE);
      bytes.push(...ALIGN_LEFT);
      addLines([`Direccion: ${deliveryMeta.address}`]);
    } else {
      addLines([`*** RETIRO EN LOCAL ***`]);
      bytes.push(...NORMAL_SIZE);
      bytes.push(...ALIGN_LEFT);
    }
    bytes.push(...BOLD_OFF);

    addLines(["================================================"]); // 48 chars gruesos

    // --- 3. ITEMS DEL PEDIDO ---
    const validItems = order.items.filter((i:any) => !i._isDeliveryMetadata && !i._isPaymentMetadata);

    if (role === 'kitchen') {
      // Formato Cocina: Cantidad gigante, nombre claro, sin precios
      bytes.push(...ALIGN_LEFT);
      validItems.forEach((item: any) => {
         bytes.push(...DOUBLE_HEIGHT_WIDTH);
         bytes.push(...BOLD_ON);
         // max 24 chars per line in double width
         addLines([`${item.quantity}x ${item.name.substring(0, 20)}`]); 
         if (item.name.length > 20) {
             addLines([`   ${item.name.substring(20, 40)}`]); 
         }
         bytes.push(...NORMAL_SIZE);
         bytes.push(...BOLD_OFF);
         addLines(["------------------------------------------------"]);
      });
    } else {
      // Formato Cajero: Tabla con cantidades, descripcion y subtotal
      // Columnas: QTY (4) | DESCRIPCION (30) | TOTAL (12) = 46 chars
      bytes.push(...ALIGN_LEFT);
      bytes.push(...BOLD_ON);
      addLines(["CANT DETALLE                            SUBTOTAL"]);
      bytes.push(...BOLD_OFF);
      addLines(["------------------------------------------------"]);
      
      validItems.forEach((item: any) => {
         const qtyStr = padRight(`${item.quantity}x`, 4);
         const nameLines = [];
         let remainingName = item.name;
         while (remainingName.length > 0) {
            nameLines.push(remainingName.substring(0, 30));
            remainingName = remainingName.substring(30);
         }
         
         const priceStr = formatPrice(item.price * item.quantity).padStart(12, ' ');
         
         // Primera linea tiene Qty, Name y Precio
         addLines([`${qtyStr} ${padRight(nameLines[0], 30)} ${priceStr}`]);
         // Lineas adicionales del nombre si es largo
         for (let i = 1; i < nameLines.length; i++) {
             addLines([`     ${nameLines[i]}`]);
         }
      });
      addLines(["------------------------------------------------"]);
    }

    // --- 4. EXTRAS / NOTAS ---
    if (order.notes && order.notes.trim().length > 0) {
        bytes.push(...ALIGN_CENTER);
        bytes.push(...DOUBLE_HEIGHT);
        bytes.push(...BOLD_ON);
        addLines(["*** NOTAS DEL CLIENTE ***"]);
        bytes.push(...NORMAL_SIZE);
        bytes.push(...ALIGN_LEFT);
        addLines([order.notes]);
        bytes.push(...BOLD_OFF);
        addLines(["================================================"]);
    }

    // --- 5. TOTALES (Solo para Cajero) ---
    if (role === 'cashier') {
        const paymentMeta = order.items.find((i:any) => i._isPaymentMetadata);
        const methodStr = paymentMeta?.method === 'online' || paymentMeta?.isPaidOnline ? 'ONLINE/TARJETA' : 'PRESENCIAL';

        addLines([alignLeftRight("METODO PAGO:", methodStr, 48)]);
        
        bytes.push(...DOUBLE_HEIGHT);
        bytes.push(...BOLD_ON);
        addLines([alignLeftRight("TOTAL:", formatPrice(order.total), 48)]);
        bytes.push(...NORMAL_SIZE);
        bytes.push(...BOLD_OFF);
        bytes.push(...LF);
    }

    // --- 6. FOOTER ---
    bytes.push(...ALIGN_CENTER);
    bytes.push(...BOLD_ON);
    if (role === 'cashier') {
        addLines(["!GRACIAS POR TU COMPRA!"]);
        bytes.push(...BOLD_OFF);
        addLines(["Siguenos en Instagram @clasicos.cl"]);
    } else {
        addLines(["--- FIN DE COMANDA ---"]);
        bytes.push(...BOLD_OFF);
    }
    
    // Avanzar papel y cortar
    bytes.push(...LF, ...LF, ...LF); 
    bytes.push(...CUT);

    return new Uint8Array(bytes);
  }

  // Segmenta y encia los bytes progresivamente debido a límites BLE
  static async printOrder(order: any, role: 'kitchen' | 'cashier'): Promise<void> {
    const char = role === 'kitchen' ? this.kitchenCharacteristic : this.cashierCharacteristic;

    if (!this.isConnected(role) || !char) {
      throw new Error(`Impresora de ${role} no está conectada o característica BLE perdida.`);
    }

    const payload = this.generateReceiptBytes(order, role);
    const CHUNK_SIZE = 512; // MTU máximo seguro estandar BLE
    
    for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
      const chunk = payload.slice(i, i + CHUNK_SIZE);
      await char.writeValue(chunk);
      // Breve pausa para no saturar impresoras chinas lentas
      await new Promise(r => setTimeout(r, 50)); 
    }
  }

  static async testPrint(role: 'kitchen' | 'cashier'): Promise<void> {
    const char = role === 'kitchen' ? this.kitchenCharacteristic : this.cashierCharacteristic;
    if (!this.isConnected(role) || !char) throw new Error('No conectada');

    let bytes: number[] = [];
    const INIT = [0x1B, 0x40];
    const ALIGN_CENTER = [0x1B, 0x61, 0x01];
    const LF = [0x0A];
    const CUT = [0x1D, 0x56, 0x41, 0x10];

    bytes.push(...INIT, ...ALIGN_CENTER);
    const text = `Prueba de Impresion Bluetooth Exitosa\nCLASICOS PUCON\nRol: ${role.toUpperCase()}`;
    for(let i=0; i<text.length; i++) bytes.push(text.charCodeAt(i));
    bytes.push(...LF, ...LF, ...LF, ...CUT);

    await char.writeValue(new Uint8Array(bytes));
  }
}

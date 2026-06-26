import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || url.searchParams.get('topic');
    const dataId = url.searchParams.get('data.id') || url.searchParams.get('id');

    // MercadoPago envía confirmaciones de pago
    if (type === 'payment' && dataId) {
      // Necesitaríamos obtener el pago de MP para saber el external_reference
      // Dado que no tenemos el token del club en el webhook directamente,
      // la forma más segura es que el external_reference nos de el ID.
      // Aquí haremos un pequeño "hack" temporal para MVP o bien actualizaremos 
      // asumiendo que el external_reference viene en el body si se procesa completo, 
      // pero MP envía una URL que debes fetchear.
      
      const body = await req.json();
      console.log('Webhook MP recibido:', body);
      
      // Si recibimos el external_reference directo (a veces en el body dependieno de la config)
      // MP Checkout Pro notification body format:
      // Si usamos notification_url, suele enviar:
      // { action: "payment.created", type: "payment", data: { id: "123456" } }

      // Para un sistema multi-tenant, como no sabemos de qué club es el pago sin hacer fetch a MP,
      // lo ideal sería guardar el `payment_id` si lo podemos mapear, o usar la API de MP iterando tokens.
      // Por simplicidad del MVP, si el estado viene en una query con `external_reference`, o si
      // la redirección de "success" marca como aprobado, usaremos este webhook de forma básica.
      
      // NOTA: Para un entorno real de producción hay que hacer fetch(api.mercadopago.com/v1/payments/{data.id})
      // usando el access_token correcto.

      return NextResponse.json({ success: true, message: 'Webhook received' });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error en webhook MP:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

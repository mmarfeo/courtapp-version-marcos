'use client';

import { Trophy, Users, Building2, CreditCard, BarChart2 } from 'lucide-react';
import ChatPageContent, { type QuickAction } from '@/components/ChatPageContent';

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Inscriptos en torneos', icon: Users, msg: '¿Cuántos inscriptos tiene el torneo actual?' },
  { label: 'Partidos pendientes', icon: Trophy, msg: 'Mostrarme los partidos pendientes de asignar cancha y horario' },
  { label: 'Canchas disponibles', icon: Building2, msg: '¿Qué canchas están disponibles hoy?' },
  { label: 'Pagos pendientes', icon: CreditCard, msg: 'Ver los pagos pendientes de aprobación' },
  { label: 'Deudas profesores', icon: BarChart2, msg: '¿Cuánto le deben los profesores al club?' },
];

export default function OrganizadorChatPage() {
  return <ChatPageContent quickActions={QUICK_ACTIONS} />;
}

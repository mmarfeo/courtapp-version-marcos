'use client';

import { BarChart2, DollarSign, Building2, Users, Trophy } from 'lucide-react';
import ChatPageContent, { type QuickAction } from '@/components/ChatPageContent';

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Estadísticas del sistema', icon: BarChart2, msg: 'Dame un resumen de las estadísticas generales del sistema' },
  { label: 'Deudas de profesores', icon: DollarSign, msg: '¿Qué profesores tienen deuda pendiente?' },
  { label: 'Clubs registrados', icon: Building2, msg: 'Mostrarme todos los clubs registrados en la plataforma' },
  { label: 'Staff del club', icon: Users, msg: 'Ver el staff del club principal' },
  { label: 'Torneos activos', icon: Trophy, msg: 'Listar los torneos activos con cantidad de inscriptos' },
];

export default function AdminChatPage() {
  return <ChatPageContent quickActions={QUICK_ACTIONS} />;
}

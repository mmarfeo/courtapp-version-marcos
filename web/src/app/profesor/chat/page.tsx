'use client';

import { DollarSign, Calendar, Users, BookOpen, Building2 } from 'lucide-react';
import ChatPageContent, { type QuickAction } from '@/components/ChatPageContent';

const QUICK_ACTIONS: QuickAction[] = [
  { label: '¿Cuánto gané este mes?', icon: DollarSign, msg: '¿Cuánto gané este mes entre clases y alquileres?' },
  { label: 'Crear clase', icon: BookOpen, msg: 'Quiero crear una clase para mañana' },
  { label: 'Ver mis clases', icon: Calendar, msg: 'Mostrarme mis clases de esta semana' },
  { label: 'Alumnos inscriptos', icon: Users, msg: '¿Cuántos alumnos tengo en mis clases?' },
  { label: 'Reservar cancha', icon: Building2, msg: 'Quiero reservar una cancha para mañana a las 9hs' },
];

export default function ProfesorChatPage() {
  return <ChatPageContent quickActions={QUICK_ACTIONS} />;
}

/**
 * stores/ticketStore.ts — ticket queue state.
 */
import { create } from 'zustand';
import type { Ticket, TicketId } from '@/domain';

interface TicketState {
  tickets: Ticket[];
  selectedId: TicketId | null;
  setTickets(tickets: Ticket[]): void;
  select(id: TicketId | null): void;
  refresh(): void;   // placeholder — services push directly
}

export const ticketStore = create<TicketState>()((set) => ({
  tickets: [],
  selectedId: null,
  setTickets(tickets) { set({ tickets }); },
  select(id) { set({ selectedId: id }); },
  refresh() { /* placeholder; overwritten by conductor wiring */ },
}));

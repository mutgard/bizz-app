// Status keys are pack-defined; the vocabulary lives in the active pack.
export type ClientStatus = string;

export interface Fabric {
  id: number;
  name: string;
  use: string;
  qty: string;
  price: string;
  to_buy: boolean;
  supplier: string;
}

export interface Appointment {
  id: number;
  label: string;
  value: string;
}

export interface Payment {
  id: number;
  label: string;
  value: string;
}

export interface Client {
  id: number;
  name: string;
  wedding_date: string;
  wedding_date_iso?: string;
  days_until: number;
  status: ClientStatus;
  garment: string;
  garment_style: string;
  measurements_date: string;
  phone: string;
  email: string;
  notes: string;
  custom?: Record<string, string>;
  fabrics: Fabric[];
  appointments: Appointment[];
  payments: Payment[];
}

export interface ClientCreate {
  name: string;
  wedding_date?: string;
  days_until?: number;
  status: ClientStatus;
  wedding_date_iso?: string;
  garment?: string;
  garment_style?: string;
  measurements_date?: string;
  phone?: string;
  email?: string;
  notes?: string;
  custom?: Record<string, string>;
}

export interface ShoppingItem extends Fabric {
  client_id: number;
  client_name: string;
}

export interface IntakeBrief {
  wedding_date: string;
  venue: string;
  garment: string;
  style: string;
  budget_tier: string;
  fabric_notes: string;
  extra_notes: string;
}

export interface IntakeDocument {
  label: string;
  type: string;
  url: string | null;
}

export interface WhatsAppMessage {
  role: 'client' | 'julia';
  text: string;
  time: string;
}

export interface WhatsAppIntake {
  source: 'whatsapp';
  token?: string;
  thread: WhatsAppMessage[];
  brief: IntakeBrief;
  documents: IntakeDocument[];
}

export interface WebFormIntake {
  source: 'web_form';
  token?: string;
  submitted_at: string;
  form_data: Record<string, string>;
  brief: IntakeBrief;
  documents: IntakeDocument[];
}

export interface LeadIntake {
  source: 'lead';
  channel: string;
  received_at: string;
  message: string;
  fields: Record<string, string>;
  brief: null;
  documents: [];
}

export type IntakeData = WhatsAppIntake | WebFormIntake | LeadIntake;

export interface ClientBrief {
  client_name: string;
  wedding_date: string;
  venue: string;
  garment: string;
  style: string;
  fabric_notes: string;
}

export type EventType = 'appointment' | 'delivery' | 'wedding';

export interface AtelierEvent {
  id: number;
  type: EventType;
  date: string;                  // YYYY-MM-DD
  title: string;
  client_id: number | null;
  client_name: string | null;
  order_id?: string | null;
  supplier?: string | null;
  received?: boolean | null;
  time?: string | null;          // "HH:MM" 24h
  duration_min?: number | null;
  outcome?: string | null;       // ''/undefined = pending · 'done' · 'no_show'
  source?: string | null;
  context?: Record<string, unknown> | null;
}

export interface AppointmentCreate {
  client_id: number | null;
  title: string;
  date: string;
  order_id?: string | null;
  time?: string | null;
  duration_min?: number | null;
  source?: string | null;
  external_ref?: string | null;
  context?: Record<string, unknown>;
}

export interface DeliveryCreate {
  client_id: number | null;
  supplier: string;
  description: string;
  expected_date: string;
  received?: boolean;
}

export interface PaymentCreate {
  client_id: number;
  label: string;
  value: string;
}

export interface Lead {
  id: number;
  channel: 'phone' | 'walkin' | 'whatsapp' | 'email' | 'booking';
  name: string;
  phone: string;
  email: string;
  notes: string;
  fields: Record<string, string>;
  status: 'open' | 'converted' | 'dismissed';
  created_at: string;
  converted_client_id: number | null;
}

export interface LeadCreate {
  channel: Lead['channel'];
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
  fields?: Record<string, string>;
}

export interface LeadConvert {
  client: ClientCreate;
  appointment?: { title: string; date: string };
}

export interface LeadMatch {
  id: number;
  name: string;
}

/** Free-text interaction log entry (call, WhatsApp, email, in-person) for a client. */
export interface Note {
  id: number;
  client_id: number;
  ts: string;
  text: string;
}

export interface NoteCreate {
  client_id: number;
  text: string;
}

/** Derived "Per fer" work queue entry — see backend/routes/todos.py. */
export interface Todo {
  type: 'schedule_fitting' | 'collect_deposit' | 'review_lead';
  client_id: number | null;
  client_name: string;
  detail: string;
  days_until: number | null;
}

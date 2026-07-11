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
  fabrics: Fabric[];
  appointments: Appointment[];
  payments: Payment[];
}

export interface ClientCreate {
  name: string;
  wedding_date: string;
  days_until: number;
  status: ClientStatus;
  wedding_date_iso?: string;
  garment?: string;
  garment_style?: string;
  measurements_date?: string;
  phone?: string;
  email?: string;
  notes?: string;
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

export type IntakeData = WhatsAppIntake | WebFormIntake;

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
}

export interface AppointmentCreate {
  client_id: number | null;
  title: string;
  date: string;
  order_id?: string | null;
}

export interface DeliveryCreate {
  client_id: number | null;
  supplier: string;
  description: string;
  expected_date: string;
  received?: boolean;
}

export interface DemoScenarioSummary {
  id: string;
  label: string;
}

export interface DemoClientDefaults {
  name: string;
  wedding_date: string;
  wedding_date_iso: string;
  days_until: number;
  status: ClientStatus;
  garment: string;
  garment_style: string;
  phone: string;
  email: string;
  notes: string;
}

export interface DemoScenarioWhatsApp {
  id: string;
  label: string;
  source: 'whatsapp';
  thread: WhatsAppMessage[];
  brief: IntakeBrief;
  client_defaults: DemoClientDefaults;
}

export interface DemoScenarioWebForm {
  id: string;
  label: string;
  source: 'web_form';
  submitted_at: string;
  form_data: Record<string, string>;
  brief: IntakeBrief;
  client_defaults: DemoClientDefaults;
}

export type DemoScenario = DemoScenarioWhatsApp | DemoScenarioWebForm;

export interface PaymentCreate {
  client_id: number;
  label: string;
  value: string;
}

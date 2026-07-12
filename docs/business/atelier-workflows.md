# Workflows & SOPs

Standard operating procedures for every process in the atelier.

---

## 1. New Lead / Inquiry

**Trigger:** Call, WhatsApp, email, or web form received.

1. Create comms log in `clients/{slug}/comms/YYYY-MM-DD-{channel}.md`
2. If client is new, create `clients/{slug}/profile.md` from template
3. Add client to `clients/_index.md` under **Leads**
4. Schedule initial consultation if requested
5. Send confirmation message to client

---

## 2. Initial Consultation

**Trigger:** Client arrives for first in-person meeting.

1. Create appointment file `appointments/YYYY-MM-DD-{slug}.md`
2. Discuss vision, style, budget, timeline
3. Take measurements → create `clients/{slug}/measurements.md`
4. If proceeding: create order file from template
5. Generate invoice, request deposit
6. Update `clients/_index.md` → move to **Active Clients**
7. Update `orders/_index.md` with new order
8. Send summary and next steps to client (WhatsApp or email)

---

## 3. Order Lifecycle

Stages (update order file and `orders/_index.md` at each step):

| Stage | Description |
|-------|-------------|
| `consultation` | Initial meeting done, spec being confirmed |
| `design` | Finalising drawings and fabric selection |
| `toile` | Mock-up being constructed |
| `toile-fitting` | Client fitting of toile, adjustments noted |
| `construction` | Main dress being built |
| `first-fitting` | First fitting with real dress |
| `alterations-1` | Post first-fitting adjustments |
| `second-fitting` | Second fitting |
| `alterations-2` | Final adjustments |
| `final-fitting` | Sign-off fitting |
| `ready` | Dress complete, awaiting pickup |
| `delivered` | Handed to client |

---

## 4. Fitting Appointment

1. Create/update appointment file
2. Add to `appointments/_index.md`
3. Prepare: review measurements + previous fitting notes
4. During fitting: log all adjustments and client feedback in appointment file
5. Confirm next appointment and log it
6. After fitting: update order stage

---

## 5. Invoicing & Payments

- Invoice ID format: `INV-YYYY-NNN`
- Deposit: typically 50% at order confirmation
- Balance: due at final fitting or pickup
- On payment received: update invoice file + `finances/_index.md`
- Send receipt confirmation to client

---

## 6. Delivery / Pickup

1. Final fitting signed off
2. Balance confirmed received
3. Log delivery in order file → stage = `delivered`
4. Move client to **Completed** in `clients/_index.md`
5. Move order to **Completed** in `orders/_index.md`
6. Send thank-you message to client
7. Request review / referral (optional)

---

## 7. Communication Logging

Every client interaction (regardless of channel) gets a comms log:

- File: `clients/{slug}/comms/YYYY-MM-DD-{channel}.md`
- Channels: `call`, `whatsapp`, `email`, `web-form`, `in-person`
- Log summary, decisions made, and action items

---

## 8. Naming Conventions

| Item | Format | Example |
|------|--------|---------|
| Client slug | `firstname-lastname` | `maria-garcia` |
| Order ID | `ORD-YYYY-NNN` | `ORD-2026-001` |
| Invoice ID | `INV-YYYY-NNN` | `INV-2026-001` |
| Appointment file | `YYYY-MM-DD-{slug}.md` | `2026-06-15-maria-garcia.md` |
| Comms log | `YYYY-MM-DD-{channel}.md` | `2026-04-03-whatsapp.md` |

---
*Last updated: —*

"""Run once: python3 seed.py — inserts prototype sample data.
The seed set is chosen by the active pack (ACTIVE_PACK)."""
from database import create_db, engine
from models import Client, Fabric, Appointment, Payment, Delivery, Lead
from config import active_pack_id
from sqlmodel import Session

ATELIER_SEED = [
    {
        "client": Client(
            name="Aina Puig", wedding_date="17 Mai 2026",
            wedding_date_iso="2026-05-17", days_until=25,
            status="clienta", garment="Vestit a mida",
            garment_style="Princesa modern", measurements_date="12 Mar 2026",
            phone="+34 639 42 18 05", email="aina.puig@mail.cat",
            notes="Vol escot en V profund. Ha de poder ballar."),
        "fabrics": [
            Fabric(name="Mikado seda marfil", use="Cos",   qty="3.2 m", price="€48/m", to_buy=True,  supplier="Gratacós"),
            Fabric(name="Tul francès",        use="Vel",   qty="2.5 m", price="€22/m", to_buy=True,  supplier="Ribes & Casals"),
            Fabric(name="Crepe georgette",    use="Folre", qty="4.0 m", price="€18/m", to_buy=False, supplier="Gratacós"),
            Fabric(name="Puntilla Chantilly", use="Vora",  qty="1.2 m", price="€95/m", to_buy=False, supplier="Gratacós"),
        ],
        "appointments": [
            Appointment(label="Prova 1", value="22 Mar — feta",      date="2026-03-22", title="Primera prova"),
            Appointment(label="Prova 2", value="18 Abr — programada",date="2026-04-18", title="Segona prova"),
            Appointment(label="Entrega", value="15 Mai",              date="2026-05-15", title="Entrega vestit"),
        ],
        "payments": [
            Payment(label="Paga i senyal", value="€500 · rebut"),
            Payment(label="Saldo",         value="€1.800 pendent"),
        ],
        "deliveries": [
            Delivery(supplier="Gratacós",       description="Mikado seda marfil 3.2m", expected_date="2026-04-25", received=False),
            Delivery(supplier="Ribes & Casals", description="Tul francès 2.5m",        expected_date="2026-04-28", received=False),
        ],
    },
    {
        "client": Client(
            name="Berta Soler", wedding_date="31 Mai 2026",
            wedding_date_iso="2026-05-31", days_until=39,
            status="sense-paga", garment="Vestit + vel",
            garment_style="Romàntic clàssic", measurements_date="Pendent",
            phone="+34 612 88 31 04", email="berta.soler@gmail.com", notes=""),
        "fabrics": [],
        "appointments": [
            Appointment(label="Consulta", value="10 Abr — feta", date="2026-04-10", title="Consulta inicial"),
        ],
        "payments": [Payment(label="Paga i senyal", value="Pendent")],
        "deliveries": [],
    },
    {
        "client": Client(
            name="Clara Ferrer", wedding_date="14 Jun 2026",
            wedding_date_iso="2026-06-14", days_until=53,
            status="clienta", garment="Vestit princesa",
            garment_style="Royal / estructura", measurements_date="05 Feb 2026",
            phone="+34 651 20 47 89", email="clara.ferrer@mail.com", notes=""),
        "fabrics": [
            Fabric(name="Mikado seda marfil", use="Faldilla",  qty="5.5 m", price="€48/m", to_buy=False, supplier="Gratacós"),
            Fabric(name="Organza de seda",    use="Volants",   qty="8.0 m", price="€32/m", to_buy=False, supplier="Gratacós"),
            Fabric(name="Tul de cotó",        use="Enagua",    qty="6.0 m", price="€12/m", to_buy=False, supplier="Ribes & Casals"),
            Fabric(name="Puntilla Chantilly", use="Escot",     qty="0.8 m", price="€95/m", to_buy=False, supplier="Gratacós"),
            Fabric(name="Crepe georgette",    use="Folre cos", qty="3.0 m", price="€18/m", to_buy=False, supplier="Gratacós"),
            Fabric(name="Entretela fusible",  use="Estructura",qty="2.5 m", price="€8/m",  to_buy=False, supplier="Habilitació Marín"),
        ],
        "appointments": [
            Appointment(label="Prova 1", value="14 Mar — feta",      date="2026-03-14", title="Primera prova"),
            Appointment(label="Prova 2", value="25 Abr — programada",date="2026-04-25", title="Segona prova"),
        ],
        "payments": [
            Payment(label="Paga i senyal", value="€800 · rebut"),
            Payment(label="Saldo",         value="€2.200 pendent"),
        ],
        "deliveries": [],
    },
    {
        "client": Client(
            name="Dolors Vidal", wedding_date="28 Jun 2026",
            wedding_date_iso="2026-06-28", days_until=67,
            status="prospect", garment="Consulta inicial",
            garment_style="Per decidir", measurements_date="No preses",
            phone="+34 608 55 12 37", email="dolors.vidal@outlook.com",
            notes="Porta imatges de Pinterest. No vol cotilla."),
        "fabrics": [],
        "appointments": [
            Appointment(label="Consulta", value="22 Abr — pendent", date="2026-04-22", title="Consulta inicial"),
        ],
        "payments": [],
        "deliveries": [],
    },
    {
        "client": Client(
            name="Elena Roca", wedding_date="05 Jul 2026",
            wedding_date_iso="2026-07-05", days_until=74,
            status="clienta", garment="Vestit bohemi",
            garment_style="Fluix / natural", measurements_date="18 Mar 2026",
            phone="+34 699 14 88 62", email="elena.roca@gmail.com", notes=""),
        "fabrics": [
            Fabric(name="Gasa de cotó",      use="Cos",     qty="3.8 m", price="€14/m", to_buy=False, supplier="Ribes & Casals"),
            Fabric(name="Puntilla italiana", use="Màniga",  qty="0.8 m", price="€78/m", to_buy=True,  supplier="Gratacós"),
            Fabric(name="Setí de seda",      use="Cinturó", qty="0.5 m", price="€36/m", to_buy=False, supplier="Gratacós"),
        ],
        "appointments": [
            Appointment(label="Prova 1", value="02 Mai — programada", date="2026-05-02", title="Primera prova"),
        ],
        "payments": [
            Payment(label="Paga i senyal", value="€400 · rebut"),
            Payment(label="Saldo",         value="€1.100 pendent"),
        ],
        "deliveries": [
            Delivery(supplier="Gratacós", description="Puntilla italiana 0.8m", expected_date="2026-05-05", received=False),
        ],
    },
    {
        "client": Client(
            name="Fina Batlle", wedding_date="12 Set 2025",
            wedding_date_iso="2025-09-12", days_until=-220,
            status="entregada", garment="Vestit sirena",
            garment_style="Glamour / escot obert", measurements_date="10 Oct 2024",
            phone="+34 634 77 23 91", email="fina.batlle@yahoo.es",
            notes="Bottons de perla a l'esquena. Clienta molt satisfeta."),
        "fabrics": [
            Fabric(name="Crepe de seda", use="Cos",   qty="4.5 m", price="€55/m", to_buy=False, supplier="Gratacós"),
            Fabric(name="Tul elàstic",   use="Folre", qty="3.0 m", price="€16/m", to_buy=False, supplier="Ribes & Casals"),
        ],
        "appointments": [
            Appointment(label="Prova 1", value="15 Nov 2024", date="2024-11-15", title="Primera prova"),
            Appointment(label="Prova 2", value="14 Des 2024", date="2024-12-14", title="Segona prova"),
            Appointment(label="Entrega", value="28 Ago 2025 — feta", date="2025-08-28", title="Entrega vestit"),
        ],
        "payments": [
            Payment(label="Paga i senyal", value="€600 · rebut"),
            Payment(label="Saldo",         value="€2.200 · rebut"),
        ],
        "deliveries": [],
    },
]

PHYSIO_SEED = [
    {
        "client": Client(
            name="Marta Vidal", status="active",
            phone="+34 630 11 22 33", email="marta.vidal@mail.com",
            notes="Referred after lumbar strain. Twice-weekly sessions.",
            custom={"treatment": "Lower-back rehab", "first_visit_date": "2026-06-10", "referring_doctor": "Dr. Serra"}),
        "fabrics": [], "deliveries": [],
        "appointments": [
            Appointment(label="Session 3", value="12 Jul — done",       date="2026-07-12", title="Rehab session 3"),
            Appointment(label="Session 4", value="16 Jul — scheduled",  date="2026-07-16", title="Rehab session 4"),
        ],
        "payments": [
            Payment(label="Session pack (10)", value="€300 · paid"),
            Payment(label="Extension",         value="€120 outstanding"),
        ],
    },
    {
        "client": Client(
            name="Jordi Camps", status="new",
            phone="+34 645 88 12 90", email="jordi.camps@gmail.com",
            notes="Post-surgery, cleared by surgeon for physio.",
            custom={"treatment": "Post-op knee", "first_visit_date": "2026-07-08", "referring_doctor": "Dr. Bosch"}),
        "fabrics": [], "deliveries": [],
        "appointments": [
            Appointment(label="Assessment", value="08 Jul — done", date="2026-07-08", title="Initial assessment"),
        ],
        "payments": [Payment(label="Assessment", value="€60 · paid")],
    },
    {
        "client": Client(
            name="Laia Font", status="discharged",
            phone="+34 622 45 76 18", email="laia.font@outlook.com",
            notes="Full recovery. Discharged with home exercise plan.",
            custom={"treatment": "Sports massage", "first_visit_date": "2026-03-02", "referring_doctor": ""}),
        "fabrics": [], "deliveries": [],
        "appointments": [
            Appointment(label="Session 6", value="20 May — completed", date="2026-05-20", title="Final session"),
        ],
        "payments": [
            Payment(label="Session pack (6)", value="€180 · paid"),
        ],
    },
]

SEEDS = {"atelier": ATELIER_SEED, "physio": PHYSIO_SEED}

# Leads: open inbound contacts not yet converted to clients. Atelier leads are
# condensed from the retired demo-scenario threads (boho/classic/destination).
ATELIER_LEAD_SEEDS = [
    Lead(
        channel="whatsapp", name="Núria Bosch", phone="", email="",
        notes=("Busca vestit boho fluid per a cerimònia exterior en un mas "
               "(80 convidats), el novembre. Mànigues llargues de gasa, escot "
               "paraula d'honor i cola catedralícia. Pressupost al voltant de 2.000€."),
        fields={"wedding_date_iso": "2026-11-14", "garment": "Vestit a mida",
                "garment_style": "Boho fluido"},
        status="open", created_at="2026-07-10T18:12:00",
    ),
    Lead(
        channel="whatsapp", name="Carmen Iglesias", phone="", email="",
        notes=("Busca vestido clásico sirena con encaje para boda de junio "
               "(iglesia + finca). Escote en V con encaje, sin mangas, cola "
               "semilarga. Presupuesto entre 3.000 y 3.500€."),
        fields={"wedding_date_iso": "2026-06-20", "garment": "Vestit a mida",
                "garment_style": "Sirena clàssic"},
        status="open", created_at="2026-07-11T09:30:00",
    ),
    Lead(
        channel="email", name="Sophie Laurent",
        phone="+33 6 12 34 56 78", email="sophie.laurent@mail.fr",
        notes=("Destination wedding a la Costa Brava (platja exterior) el 12 "
               "de setembre. Busca un vestit columna minimalista, sense vol ni "
               "encaix. Pressupost 2.500–3.000€, ens ha conegut per Instagram."),
        fields={"wedding_date_iso": "2026-09-12", "garment": "Vestit a mida",
                "garment_style": "Columna minimalista"},
        status="open", created_at="2026-07-09T14:05:00",
    ),
]

PHYSIO_LEAD_SEEDS = [
    Lead(
        channel="phone", name="Pere Soler", phone="+34 611 22 33 44", email="",
        notes="Knee pain after running, wants an assessment",
        fields={"treatment": "Post-op knee"},
        status="open", created_at="2026-07-10T10:00:00",
    ),
    Lead(
        channel="walkin", name="Anna Riu", phone="", email="",
        notes="Walked in asking about back pain sessions",
        fields={"treatment": "Lower-back rehab"},
        status="open", created_at="2026-07-11T11:20:00",
    ),
]

LEAD_SEEDS = {"atelier": ATELIER_LEAD_SEEDS, "physio": PHYSIO_LEAD_SEEDS}

def run_seed(s: Session):
    for entry in SEEDS.get(active_pack_id(), ATELIER_SEED):
        c = entry["client"]
        s.add(c); s.commit(); s.refresh(c)
        for f in entry["fabrics"]:
            f.client_id = c.id; s.add(f)
        for a in entry["appointments"]:
            a.client_id = c.id; s.add(a)
        for p in entry["payments"]:
            p.client_id = c.id; s.add(p)
        for d in entry["deliveries"]:
            d.client_id = c.id; s.add(d)
        s.commit()
    for lead in LEAD_SEEDS.get(active_pack_id(), ATELIER_LEAD_SEEDS):
        s.add(lead)
    s.commit()

if __name__ == "__main__":
    create_db()
    with Session(engine) as s:
        run_seed(s)
    print("Seeded OK")

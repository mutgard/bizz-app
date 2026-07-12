"""Run once: python3 seed.py — inserts prototype sample data.
The seed set is chosen by the active pack (ACTIVE_PACK).

Atelier dates are RELATIVE to today so the demo is evergreen: weddings land in
the coming weeks/months, appointments populate today + the next two weeks, and
the intake inbox always has fresh leads to convert. Offsets (not absolutes)
are the source of truth here."""
import datetime
from database import create_db, engine
from models import Client, Fabric, Appointment, Payment, Delivery, Lead, Note
from config import active_pack_id
from sqlmodel import Session

TODAY = datetime.date.today()
CAT_MONTHS = ["Gen", "Feb", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Des"]

def _d(offset: int) -> datetime.date:
    return TODAY + datetime.timedelta(days=offset)

def _iso(offset: int) -> str:
    return _d(offset).isoformat()

def _disp(offset: int) -> str:
    d = _d(offset)
    return f"{d.day:02d} {CAT_MONTHS[d.month - 1]} {d.year}"

def _short(offset: int) -> str:
    d = _d(offset)
    return f"{d.day:02d} {CAT_MONTHS[d.month - 1]}"

def _ts(days_ago: int, hhmm: str) -> str:
    return f"{_iso(-days_ago)}T{hhmm}:00"

ATELIER_SEED = [
    {
        # Urgent: wedding in 25 days, last fitting upcoming, saldo pendent.
        "client": Client(
            name="Aina Puig", wedding_date=_disp(25),
            wedding_date_iso=_iso(25), days_until=25,
            status="clienta", garment="Vestit a mida",
            garment_style="Princesa modern", measurements_date=_disp(-60),
            phone="+34 639 42 18 05", email="aina.puig@mail.cat",
            notes="Vol escot en V profund. Ha de poder ballar."),
        "fabrics": [
            Fabric(name="Mikado seda marfil", use="Cos",   qty="3.2 m", price="€48/m", to_buy=True,  supplier="Gratacós"),
            Fabric(name="Tul francès",        use="Vel",   qty="2.5 m", price="€22/m", to_buy=True,  supplier="Ribes & Casals"),
            Fabric(name="Crepe georgette",    use="Folre", qty="4.0 m", price="€18/m", to_buy=False, supplier="Gratacós"),
            Fabric(name="Puntilla Chantilly", use="Vora",  qty="1.2 m", price="€95/m", to_buy=False, supplier="Gratacós"),
        ],
        "appointments": [
            Appointment(label="Prova 1", value=f"{_short(-40)} — feta", date=_iso(-40), title="Primera prova", time="10:00", outcome="done"),
            Appointment(label="Prova 2", value=f"{_short(-12)} — feta", date=_iso(-12), title="Segona prova",  time="11:30", outcome="done"),
            Appointment(label="Última prova", value=f"{_short(2)} — programada", date=_iso(2), title="Última prova", time="10:00", duration_min=60),
            Appointment(label="Entrega", value=_short(23), date=_iso(23), title="Entrega vestit", time="09:00", duration_min=30),
        ],
        "payments": [
            Payment(label="Paga i senyal", value="€500 · rebut"),
            Payment(label="Saldo",         value="€1.800 pendent"),
        ],
        "deliveries": [
            Delivery(supplier="Gratacós",       description="Mikado seda marfil 3.2m", expected_date=_iso(5), received=False),
            Delivery(supplier="Ribes & Casals", description="Tul francès 2.5m",        expected_date=_iso(8), received=False),
        ],
        "notes_log": [
            Note(ts=_ts(12, "11:45"), text="Prova 2 feta: ajust cintura −2 cm, allargar cola 5 cm. Molt contenta amb el cos."),
            Note(ts=_ts(8, "17:20"),  text="WhatsApp: pregunta si pot venir la mare a l'última prova. Confirmat que sí."),
            Note(ts=_ts(3, "10:05"),  text="Trucada: recordat el saldo pendent abans de l'entrega. Farà bizum aquesta setmana."),
            Note(ts=_ts(1, "16:40"),  text="WhatsApp: envia foto de les sabates definitives (taló 7 cm) — ajustar baix del vestit."),
        ],
    },
    {
        # Sense paga i senyal + cap cita futura → apareix DUES vegades a "Per fer"
        # (schedule_fitting + collect_deposit) — el cas de treball de recepció.
        "client": Client(
            name="Berta Soler", wedding_date=_disp(39),
            wedding_date_iso=_iso(39), days_until=39,
            status="sense-paga", garment="Vestit + vel",
            garment_style="Romàntic clàssic", measurements_date="Pendent",
            phone="+34 612 88 31 04", email="berta.soler@gmail.com", notes=""),
        "fabrics": [],
        "appointments": [],
        "payments": [Payment(label="Pressupost", value="€2.400 pendent")],
        "deliveries": [],
        "notes_log": [
            Note(ts=_ts(9, "15:30"), text="Consulta inicial feta: vol vestit + vel curt, línia romàntica. Ensenyades 3 teles."),
            Note(ts=_ts(6, "12:10"), text="Pressupost enviat per email: €2.400 (vestit + vel). Pendent de resposta."),
            Note(ts=_ts(2, "18:55"), text="WhatsApp: diu que ho està pensant, ho comenta amb la família aquest cap de setmana."),
        ],
    },
    {
        "client": Client(
            name="Clara Ferrer", wedding_date=_disp(53),
            wedding_date_iso=_iso(53), days_until=53,
            status="clienta", garment="Vestit princesa",
            garment_style="Royal / estructura", measurements_date=_disp(-75),
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
            Appointment(label="Prova 1", value=f"{_short(-30)} — feta", date=_iso(-30), title="Primera prova", time="10:30", outcome="done"),
            Appointment(label="Prova 2", value="avui — programada", date=_iso(0), title="Segona prova", time="16:00", duration_min=60),
            Appointment(label="Prova 3", value=f"{_short(14)} — programada", date=_iso(14), title="Tercera prova", time="12:00", duration_min=60),
        ],
        "payments": [
            Payment(label="Paga i senyal", value="€800 · rebut"),
            Payment(label="Saldo",         value="€2.200 pendent"),
        ],
        "deliveries": [],
        "notes_log": [
            Note(ts=_ts(30, "11:40"), text="Prova 1: estructura del cos perfecta. Decidit afegir volant d'organza a la faldilla."),
            Note(ts=_ts(15, "09:25"), text="Trucada: confirma prova 2. Demana si el vestit tindrà butxaques — sí, laterals amagades."),
        ],
    },
    {
        # Prospect amb consulta demà — per provar l'avanç d'estat complet.
        "client": Client(
            name="Dolors Vidal", wedding_date=_disp(67),
            wedding_date_iso=_iso(67), days_until=67,
            status="prospect", garment="Consulta inicial",
            garment_style="Per decidir", measurements_date="No preses",
            phone="+34 608 55 12 37", email="dolors.vidal@outlook.com",
            notes="Porta imatges de Pinterest. No vol cotilla."),
        "fabrics": [],
        "appointments": [
            Appointment(label="Consulta", value=f"{_short(1)} — programada", date=_iso(1), title="Consulta inicial", time="17:00", duration_min=45),
        ],
        "payments": [],
        "deliveries": [],
        "notes_log": [
            Note(ts=_ts(3, "13:15"), text="Trucada inicial: boda en un celler del Penedès. Estil pendent de definir, porta moodboard."),
        ],
    },
    {
        "client": Client(
            name="Elena Roca", wedding_date=_disp(74),
            wedding_date_iso=_iso(74), days_until=74,
            status="clienta", garment="Vestit bohemi",
            garment_style="Fluix / natural", measurements_date=_disp(-20),
            phone="+34 699 14 88 62", email="elena.roca@gmail.com", notes=""),
        "fabrics": [
            Fabric(name="Gasa de cotó",      use="Cos",     qty="3.8 m", price="€14/m", to_buy=False, supplier="Ribes & Casals"),
            Fabric(name="Puntilla italiana", use="Màniga",  qty="0.8 m", price="€78/m", to_buy=True,  supplier="Gratacós"),
            Fabric(name="Setí de seda",      use="Cinturó", qty="0.5 m", price="€36/m", to_buy=False, supplier="Gratacós"),
        ],
        "appointments": [
            Appointment(label="Prova 1", value=f"{_short(6)} — programada", date=_iso(6), title="Primera prova", time="09:30", duration_min=60),
        ],
        "payments": [
            Payment(label="Paga i senyal", value="€400 · rebut"),
            Payment(label="Saldo",         value="€1.100 pendent"),
        ],
        "deliveries": [
            Delivery(supplier="Gratacós", description="Puntilla italiana 0.8m", expected_date=_iso(4), received=False),
        ],
        "notes_log": [
            Note(ts=_ts(20, "10:50"), text="Mides preses. Vol màniga llarga de puntilla i esquena descoberta."),
            Note(ts=_ts(5, "19:05"),  text="WhatsApp: envia referència de corona de flors — coordinar el vel amb la floristeria."),
        ],
    },
    {
        # Entregada fa mesos — cas tancat per a l'arxiu.
        "client": Client(
            name="Fina Batlle", wedding_date=_disp(-220),
            wedding_date_iso=_iso(-220), days_until=-220,
            status="entregada", garment="Vestit sirena",
            garment_style="Glamour / escot obert", measurements_date=_disp(-400),
            phone="+34 634 77 23 91", email="fina.batlle@yahoo.es",
            notes="Bottons de perla a l'esquena. Clienta molt satisfeta."),
        "fabrics": [
            Fabric(name="Crepe de seda", use="Cos",   qty="4.5 m", price="€55/m", to_buy=False, supplier="Gratacós"),
            Fabric(name="Tul elàstic",   use="Folre", qty="3.0 m", price="€16/m", to_buy=False, supplier="Ribes & Casals"),
        ],
        "appointments": [
            Appointment(label="Prova 1", value=_short(-300), date=_iso(-300), title="Primera prova", time="10:00", outcome="done"),
            Appointment(label="Prova 2", value=_short(-260), date=_iso(-260), title="Segona prova",  time="11:00", outcome="done"),
            Appointment(label="Entrega", value=f"{_short(-235)} — feta", date=_iso(-235), title="Entrega vestit", time="09:00", outcome="done"),
        ],
        "payments": [
            Payment(label="Paga i senyal", value="€600 · rebut"),
            Payment(label="Saldo",         value="€2.200 · rebut"),
        ],
        "deliveries": [],
        "notes_log": [
            Note(ts=_ts(200, "12:30"), text="Ens envia fotos de la boda — el vestit, espectacular. Autoritza publicar-les a Instagram."),
        ],
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
            Appointment(label="Session 3", value="12 Jul — done",       date="2026-07-12", title="Rehab session 3", time="09:00"),
            Appointment(label="Session 4", value="16 Jul — scheduled",  date="2026-07-16", title="Rehab session 4", time="09:00"),
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
            Appointment(label="Assessment", value="08 Jul — done", date="2026-07-08", title="Initial assessment", time="14:00"),
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
            Appointment(label="Session 6", value="20 May — completed", date="2026-05-20", title="Final session", time="10:00"),
        ],
        "payments": [
            Payment(label="Session pack (6)", value="€180 · paid"),
        ],
    },
]

SEEDS = {"atelier": ATELIER_SEED, "physio": PHYSIO_SEED}

# Leads: the intake inbox. Deliberately varied so the conversion flow can be
# exercised end-to-end: rich vs sparse extraction, every channel, urgent vs
# far-out dates, and non-standard cases (contact≠client, double order,
# alteration of an heirloom dress).
ATELIER_LEAD_SEEDS = [
    Lead(
        channel="whatsapp", name="Núria Bosch", phone="+34 655 90 21 47", email="",
        notes=("Busca vestit boho fluid per a cerimònia exterior en un mas "
               "(80 convidats), el novembre. Mànigues llargues de gasa, escot "
               "paraula d'honor i cola catedralícia. Pressupost al voltant de 2.000€."),
        fields={"wedding_date_iso": _iso(125), "garment": "Vestit a mida",
                "garment_style": "Boho fluid"},
        status="open", created_at=_ts(0, "09:12"),
    ),
    Lead(
        channel="whatsapp", name="Mireia Puigdevall", phone="+34 617 33 40 82", email="",
        notes=("URGENT: la boda és d'aquí a dos mesos i la botiga on tenia el vestit "
               "ha tancat. Busca vestit vintage anys 70, gasa i crochet, talla 40. "
               "Pot venir qualsevol tarda aquesta setmana. Pressupost màx 1.800€."),
        fields={"wedding_date_iso": _iso(60), "garment": "Vestit a mida",
                "garment_style": "Vintage anys 70"},
        status="open", created_at=_ts(0, "11:47"),
    ),
    Lead(
        channel="whatsapp", name="Carmen Iglesias", phone="+34 688 12 75 30", email="",
        notes=("Busca vestido clásico sirena con encaje para boda de junio "
               "(iglesia + finca). Escote en V con encaje, sin mangas, cola "
               "semilarga. Presupuesto entre 3.000 y 3.500€."),
        fields={"wedding_date_iso": _iso(330), "garment": "Vestit a mida",
                "garment_style": "Sirena clàssic"},
        status="open", created_at=_ts(1, "09:30"),
    ),
    Lead(
        # Sparse on purpose: no extracted fields — tests the incomplete-intake path.
        channel="whatsapp", name="Alba Torrent", phone="+34 699 02 88 14", email="",
        notes="Hola! Voldria saber preus orientatius i si teniu disponibilitat per una boda al juny 😊",
        fields=None,
        status="open", created_at=_ts(1, "20:15"),
    ),
    Lead(
        channel="email", name="Sophie Laurent",
        phone="+33 6 12 34 56 78", email="sophie.laurent@mail.fr",
        notes=("Destination wedding a la Costa Brava (platja exterior) el setembre. "
               "Busca un vestit columna minimalista, sense vol ni encaix. "
               "Pressupost 2.500–3.000€, ens ha conegut per Instagram."),
        fields={"wedding_date_iso": _iso(62), "garment": "Vestit a mida",
                "garment_style": "Columna minimalista"},
        status="open", created_at=_ts(3, "14:05"),
    ),
    Lead(
        # Contact ≠ client: la mare truca per la filla.
        channel="phone", name="Rosa Peix", phone="+34 972 20 41 55", email="",
        notes=("Truca la MARE de la núvia (la filla es diu Laura, viu a Brussel·les i "
               "torna al desembre). Boda a la primavera. Volen una primera consulta "
               "presencial durant les festes de Nadal. Deixa el seu telèfon de contacte."),
        fields={"wedding_date_iso": _iso(280)},
        status="open", created_at=_ts(2, "12:40"),
    ),
    Lead(
        channel="walkin", name="Judit Serra", phone="+34 626 74 19 03", email="",
        notes=("Ha entrat a la botiga sense cita. Té les mides preses d'una altra "
               "modista però no ha quedat contenta amb la proposta — vol segona "
               "opinió. Estil minimalista, crepe llis, res de brillants. Molt decidida."),
        fields={"wedding_date_iso": _iso(140), "garment": "Vestit a mida",
                "garment_style": "Minimalista crepe"},
        status="open", created_at=_ts(1, "17:35"),
    ),
    Lead(
        channel="booking", name="Emma Johansson",
        phone="+46 70 123 45 67", email="emma.johansson@mail.se",
        notes=("Online booking from the web widget. Destination wedding at an "
               "Empordà vineyard in three months. Wants a bias-cut slip dress in "
               "silk satin, minimal, open back. English-speaking. Budget ~2.800€."),
        fields={"wedding_date_iso": _iso(92), "garment": "Vestit a mida",
                "garment_style": "Slip dress seda"},
        status="open", created_at=_ts(0, "08:03"),
    ),
    Lead(
        # Encàrrec doble: dues núvies, dos vestits coordinats.
        channel="whatsapp", name="Paula Grau i Marta Vives", phone="+34 633 58 27 90", email="",
        notes=("Parella de núvies — volen DOS vestits coordinats però gens iguals: "
               "una estil sastre (pantaló + blazer) i l'altra vestit fluid. Boda "
               "civil al febrer. Demanen si fem assessorament conjunt. Pressupost total ~4.000€."),
        fields={"wedding_date_iso": _iso(210), "garment": "Dos vestits coordinats"},
        status="open", created_at=_ts(4, "19:22"),
    ),
    Lead(
        # No és un vestit nou: transformació d'un vestit familiar.
        channel="email", name="Griselda Mas",
        phone="+34 654 11 38 76", email="griselda.mas@gmail.com",
        notes=("Vol TRANSFORMAR el vestit de núvia de la seva mare (any 1994, "
               "màniga de farol, setí gruixut) en un vestit actual per la seva boda "
               "d'aquí a mes i mig. Adjunta fotos. Sap que és un encàrrec especial."),
        fields={"wedding_date_iso": _iso(45), "garment": "Transformació vestit familiar"},
        status="open", created_at=_ts(2, "10:58"),
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

_TODAY_TITLES = {
    # pack id → (done title, pending/booking title, booking event_type, booking note)
    "atelier": ("Cita d'avui", "Cita reservada online", "Primera visita", "Reservat des del web"),
    "physio": ("Today's session", "Online booking", "Initial assessment", "Booked via website"),
}

def _today_appointments() -> list[Appointment]:
    """Two appointments dated today so a future day-plan dashboard always has
    something to demo: one already resolved, one still pending. The pending
    one carries scheduling-app (booking) provenance. Titles follow the active
    pack's language."""
    today = datetime.date.today().isoformat()
    done_title, booked_title, event_type, note = _TODAY_TITLES.get(
        active_pack_id(), _TODAY_TITLES["atelier"])
    return [
        Appointment(
            label=done_title, value=f"{today} — done", date=today,
            title=done_title, time="09:30", duration_min=30,
            outcome="done", source="manual",
        ),
        Appointment(
            label=booked_title, value=f"{today} — booked", date=today,
            title=booked_title, time="16:00", duration_min=45,
            outcome="", source="booking", external_ref="cal-2b7f9e1a",
            context={"answers": {"event_type": event_type, "note": note}},
        ),
    ]

def run_seed(s: Session):
    first_client_id = None
    for entry in SEEDS.get(active_pack_id(), ATELIER_SEED):
        c = entry["client"]
        s.add(c); s.commit(); s.refresh(c)
        if first_client_id is None:
            first_client_id = c.id
        for f in entry["fabrics"]:
            f.client_id = c.id; s.add(f)
        for a in entry["appointments"]:
            a.client_id = c.id; s.add(a)
        for p in entry["payments"]:
            p.client_id = c.id; s.add(p)
        for d in entry["deliveries"]:
            d.client_id = c.id; s.add(d)
        for n in entry.get("notes_log", []):
            n.client_id = c.id; s.add(n)
        s.commit()
    if first_client_id is not None:
        for a in _today_appointments():
            a.client_id = first_client_id; s.add(a)
        s.commit()
    for lead in LEAD_SEEDS.get(active_pack_id(), ATELIER_LEAD_SEEDS):
        s.add(lead)
    s.commit()

if __name__ == "__main__":
    create_db()
    with Session(engine) as s:
        run_seed(s)
    print("Seeded OK")

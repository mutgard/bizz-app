# syntax=docker/dockerfile:1

# ── Build frontend ──────────────────────────────────────────
FROM node:20-alpine AS fe-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Pack selection ──────────────────────────────────────────
# Only the active pack (+ its "extends" base, for demo packs) reaches the
# final image. This stage is not shipped, so no other pack — and for tenant
# packs, no seed.json — exists in any layer of the published image.
FROM python:3.12-slim AS pack-select
ARG ACTIVE_PACK=atelier-demo
COPY packs/ /all-packs/
RUN python3 <<'PY'
import json, os, shutil
pid = os.environ["ACTIVE_PACK"]
shutil.copytree(f"/all-packs/{pid}", f"/pack/{pid}")
with open(f"/all-packs/{pid}/pack.json", encoding="utf-8") as f:
    base = json.load(f).get("extends")
if base:
    shutil.copytree(f"/all-packs/{base}", f"/pack/{base}")
PY

# ── Backend + serve static ──────────────────────────────────
FROM python:3.12-slim
ARG ACTIVE_PACK=atelier-demo
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=pack-select /pack ./packs
COPY --from=fe-build /app/frontend/dist ./static
ENV ACTIVE_PACK=${ACTIVE_PACK}

EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]

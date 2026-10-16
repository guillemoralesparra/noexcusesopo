# Opo Infermeria ICS — app

Plataforma d'estudi per a l'oposició d'infermeria de l'ICS (grup reduït, accés per invitació).

## Posada en marxa (local)

```bash
pnpm install
pnpm db:seed        # crea la BD (PGlite a .data/), carrega temari + exàmens oficials i imprimeix un codi d'administració
pnpm dev            # http://localhost:3000 → /registre amb el codi
```

Sense `DATABASE_URL` s'usa PGlite (Postgres embegut, no cal Docker). No executis `db:seed` amb el servidor
en marxa: PGlite només admet un procés alhora.

## Producció

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Postgres gestionat (Supabase, Neon…) — `postgres://…` |
| `SESSION_SECRET` | cadena aleatòria de ≥32 caràcters |
| `ADMIN_INVITE` | opcional: codi d'administració inicial |

`pnpm db:seed` aplica les migracions i actualitza el contingut sense tocar usuàries ni intents.

## Estructura

```
src/db/          esquema Drizzle i connexió (postgres-js o PGlite)
src/lib/         auth (sessió JWT en cookie), practice (sessions), scoring, progress
src/app/(auth)   entrar / registre
src/app/(app)    inici "Què fem ara?", practicar, sessió, resultat, progrés, admin
scripts/         migrate, seed (llegeix ../content-pipeline/data)
```

## Decisions

- Les respostes correctes no arriben mai al navegador abans de respondre (pràctica) o de lliurar (simulacre).
- En pràctica la primera resposta queda fixada; en simulacre es pot canviar fins a lliurar.
- Cada resposta pot portar la seguretat ("Ho sé / Dubto / A l'atzar") per al calibratge.
- La narració dels supòsits es mostra per fases, com a l'examen imprès.
- Puntuació com el tribunal: anul·lades fora, nota escalada a 50 sobre les vàlides, penalització configurable.

## Tests

```bash
pnpm test           # unitats (puntuació)
```

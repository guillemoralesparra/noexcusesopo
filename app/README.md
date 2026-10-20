# Opo Infermeria ICS — app

Plataforma d'estudi per a l'oposició d'infermeria de l'ICS (grup reduït, accés per invitació).

## Posada en marxa (local)

```bash
pnpm install
pnpm db:seed        # crea la BD (PGlite a .data/), carrega temari, contingut, preguntes i cerca, i imprimeix un codi d'administració
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

`pnpm db:seed` aplica les migracions i actualitza el contingut sense tocar usuàries ni intents. Esborra i
reconstrueix el que depèn del temari (epígrafs que ja no existeixen, fitxes, contingut i índex de cerca).

El contingut literal del temari surt de `../content-pipeline/data/fuden/temari/blocs.json`, que no és al
repositori: el seed de producció s'ha de fer des de la màquina que té la còpia local del material
(`vercel env pull` a un fitxer temporal fora del repo i `DATABASE_URL=<DATABASE_URL_UNPOOLED> pnpm db:seed`).
Sense aquest fitxer el seed manté el contingut que ja hi ha a la base de dades.

## Estructura

```
src/db/          esquema Drizzle i connexió (postgres-js o PGlite)
src/lib/         auth (sessió JWT en cookie), practice (sessions), scoring, progress, temari (contingut), search
src/app/(auth)   entrar / registre
src/app/(app)    inici "Què fem ara?", temari i lector d'epígraf, cerca, practicar, simulacres, progrés, admin
scripts/         migrate, seed (llegeix ../content-pipeline/data)
```

## Decisions

- Temari v2 (20/10/2026): cada epígraf mostra el text literal del material del curs i la normativa, per parts
  (temari, resums, suport, diapositives, normativa, bibliografia), i la cerca prioritza el temari sobre les
  preguntes. Tot és visible per a tots els comptes. Detall a `../docs/temari-v2.md`.
- Les respostes correctes no arriben mai al navegador abans de respondre (pràctica) o de lliurar (simulacre).
- En pràctica la primera resposta queda fixada; en simulacre es pot canviar fins a lliurar.
- Cada resposta pot portar la seguretat ("Ho sé / Dubto / A l'atzar") per al calibratge.
- La narració dels supòsits es mostra per fases, com a l'examen imprès.
- Puntuació com el tribunal: anul·lades fora, nota escalada a 50 sobre les vàlides, penalització configurable.

## Tests

```bash
pnpm test           # unitats (puntuació)
```

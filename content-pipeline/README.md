# content-pipeline

Contingut base de la plataforma: exàmens oficials, temari i mapa de freqüències.

## Estructura

```
raw/exams/          PDF oficials (enunciats model A + plantilles) descarregats d'ics.gencat.cat
raw/convocatoria/   Convocatòria SLT/2380/2025, modificació SLT/2292/2026, tribunals, diligències
pages/<pdf>/        Pàgines renderitzades (PNG). Les plantilles tenen hi_p01.png (300 dpi) i overlay.png
data/exams/         <examen>.questions.json (transcripció), <plantilla>.auto.json (lectura òptica), <examen>.json (unit)
data/official_bank.json   Totes les preguntes oficials amb resposta
data/temario.json         Temari oficial literal + desglossament en epígrafs
data/classification/      Classificació de cada pregunta oficial per epígraf
data/frequency_map.*      Freqüència de cada epígraf als exàmens
data/exam_configs.json    Formats d'examen (històrics i provisional 2025)
data/sources/             Normativa per article (base documental)
scripts/                  Pipeline
```

## Pipeline

```bash
python -I scripts/render_pages.py raw/exams pages 150   # PDF -> PNG
# transcripció dels enunciats: per visió (agents), resultat a data/exams/<examen>.questions.json
python -I scripts/read_key.py 2024_A_key 2019_A_key 2016PI_key 2015_A_key  # lectura òptica de plantilles
python -I scripts/merge_exams.py      # enunciats + plantilles -> official_bank.json
python -I scripts/normalize_cases.py  # narració dels supòsits per fases (segments)
python -I scripts/frequency_map.py    # classificació (+ overrides.json) -> mapa de freqüències

# Normativa (base documental per a explicacions i tutor)
python -I scripts/fetch_normativa.py && python -I scripts/split_articles.py && python -I scripts/validate_normativa.py
```

`data/sources/` conté 19 normes del temari transversal troceades per article (1.642 fragments),
amb URL oficial i data de consolidació. TREBEP art. 49 té una nova redacció vigent des del 23/10/2026:
cal tornar a descarregar després d'aquesta data.

`read_key.py` mesura la tinta a cada bombolla amb la geometria de `scripts/key_grids.json` i detecta
files tatxades en vermell ("Anul·lar") i marques múltiples. Revisa `pages/<plantilla>/overlay.png`
si canvies la geometria.

## Exàmens disponibles

| Examen | Data | Test | Supòsits | Penalització | Temps |
|---|---|---|---|---|---|
| DSI-T.LLIURE-2015 model A | 19/06/2016 | 100 (5 amb diverses respostes) | — | no consta | no consta |
| DSI-PI-2016 | 11/06/2017 | 50 | 2 supòsits alternatius × 20 | no consta | no consta |
| DSI-LLIURE-2018 model A | 12/05/2019 | 76 | 3 (24 preguntes) | cap | 2 h |
| Conv. 100 estabilització model A | 02/06/2024 | 70 | 3 (25 preguntes, 2 anul·lades) | cap | 2 h |

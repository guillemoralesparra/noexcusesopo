# Plan — Plataforma de preparación OPE Infermeria ICS (A2-129)

> Borrador v2 · 16/10/2026 · Proyecto independiente y aislado. Lo marcado **[PENDIENTE]** depende de publicaciones del tribunal.

## 0. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Usuarios | Grupo pequeño de estudiantes. Sin pagos, sin escalado complejo; acceso por invitación |
| Revisión clínica | **No hay revisora.** La calidad del contenido depende de fuentes oficiales y de controles automáticos (ver §4) |
| Repositorio | Proyecto nuevo e independiente en `ICSAgent` |
| Catalán C1 | Sin módulo de preparación |
| Ritmo de estudio | **Sin calendario.** El alumno combina el estudio con el trabajo y entra cuando puede. La plataforma sugiere qué hacer en cada sesión, muestra cómo progresa y no impone fechas ni cuotas diarias |

---

## 1. Qué sabemos del examen (fuentes oficiales)

| Dato | Valor | Fuente |
|---|---|---|
| Convocatoria | 100-2025, Resolució SLT/2380/2025 (DOGC 9441, 26/06/2025) | DOGC |
| Plazas Infermeria A2-129 | **1.713** (1.371 libre + 342 promoción interna) | Annex 2 y 35 |
| Fecha del examen | "a partir de gener" (previsiblemente enero 2027) | Aviso ICS 17/09/2026 |
| Estructura | Oposición 100 pts + concurso 50 pts | Base 11 |
| Ejercicio 1 | Test de 4 opciones (temario transversal + específico). 50 pts, mínimo 25 | Base 11 |
| Ejercicio 2 | Supuestos prácticos (preguntas tipo test sobre casos). 50 pts, mínimo 25 | Base 11 |
| Idioma | Examen redactado **en catalán** | Base 11.3 |
| Nº de preguntas, penalización y tiempo | **[PENDIENTE]** diligencia del tribunal | — |
| Precedente 2024 | 70 preguntas de test + 3 supuestos con 25 preguntas | Examen oficial 02/06/2024 |
| Penalización en otras categorías de la misma convocatoria | −¼ o sin penalización | Diligencias 30/07/2026 |
| Temario | 11 temas transversales + 8 específicos (competenciales y amplios) | Annex 3 y 35.3 |
| Exámenes anteriores | Públicos con plantilla de respuestas: 2024, 2019, PI 2016, 2015 (PDF escaneados) | ics.gencat.cat |

### Implicaciones
- **Contenido en catalán**, el idioma del examen. El castellano queda como opción en las explicaciones.
- **Formato de examen configurable**, para ajustarlo cuando salga la diligencia.
- **La estrategia de respuesta depende de la penalización.** Con 4 opciones, el valor esperado de contestar al azar es:
  - Sin penalización: +0,25.
  - Con −¼: +0,06 (positivo incluso al azar).
  - Con −⅓: 0, y +0,11 si se descarta una opción.

  La plataforma lo enseña con los datos del propio alumno.
- **Temario competencial.** Se desglosa en epígrafes y se prioriza con lo que realmente se ha preguntado en 2015–2024.

---

### Hallazgos de la fase 1 (exámenes oficiales 2015–2024, 385 preguntas)
- **Sin penalización en 2019 ni en 2024**: 2 h en total para test + supuestos.
- **Lo que más se pregunta es el temario específico clínico.** E3 (urgencias, maternidad, cardiorrespiratorio, nefrourinario) es el 20 %, E4 el 18 % y E5 el 14 %. Los epígrafes estrella son respiratorio, cardiocirculatorio, neurológico, diabetes, infancia y UPP/heridas.
- **El temario transversal casi no ha caído (≈4 %).** Pero en 2025 es común a todas las categorías y entra explícitamente en el ejercicio 1. Es un riesgo no prepararlo. Los exámenes de otras categorías de la 100-2025 (18/10/2026) mostrarán su peso real.
- **17 preguntas oficiales están marcadas "a revisar"** porque su respuesta puede estar desactualizada (calendario vacunal, umbrales de alcohol, Pla de salut, etc.).
- Detalle completo en `content-pipeline/data/frequency_map.md`.

### Estado (17/10/2026)
- **Nombre:** NoExcusesOpo. Interfaz en catalán con botón a castellano (las preguntas, siempre en catalán).
- **Diseño:** mundo visual «Rajola de Sant Pau» (elegido por la usuaria): el temario es un paviment de 110 rajoles que se colocan al dominar cada epígrafe. Patrones de UX de Duolingo/UWorld (ver `docs/ux-research.md`). Responsive en móvil, tablet y ordenador (prioridad ordenador). Sistema documentado en `app/DESIGN.md`.
- **Explicaciones:** 383 explicaciones redactadas y verificadas sin API. Una resolución independiente a ciegas coincide con la plantilla oficial en el 97 %; 11 preguntas están marcadas como discutibles, con el motivo.
- **Pendiente:** publicar (Vercel + Supabase, cuando haya cuentas), repetición espaciada (FSRS), preguntas nuevas más allá de las oficiales, tutor IA (modelo barato tipo DeepSeek, opcional).

## 2. Principios pedagógicos

1. **Práctica de recuperación con feedback inmediato.** Estudiar es responder preguntas, no releer.
2. **Repetición espaciada (FSRS)** para preguntas y conceptos. Funciona con sesiones irregulares: cuando el alumno vuelve, el sistema le da lo más urgente sin acumular "deuda".
3. **Cola de errores.** Los fallos, sobre todo los cometidos con alta seguridad, vuelven más adelante.
4. **Calibración de la seguridad.** En cada respuesta: "segur / dubto / n'he descartat alguna". Sirve para entrenar cuándo arriesgar.
5. **Progresión por dominio.** Un epígrafe se da por dominado con acierto sostenido en sesiones distintas, no por haberlo "visto".
6. **Intercalado** de temas en repasos y simulacros.
7. **Explicaciones completas**: por qué es correcta la buena y por qué falla cada distractor, con la fuente citada.
8. **Tutor IA socrático.** Da pistas antes que respuestas y cita la fuente. Si no tiene una, no se lo inventa.
9. **Contenido sintetizado**: fichas cortas, esquemas y algoritmos.

### Plataforma tutora, no calendario
- **No hay planificación por fechas.** No hay "hoy te tocan 40 preguntas", ni rachas que castiguen, ni retrasos.
- **Ruta progresiva.** El temario se recorre por niveles de dominio. La plataforma siempre sabe cuál es el siguiente paso más útil.
- **Sesiones de duración libre.** Al entrar, el alumno elige cuánto tiempo tiene (≈10 / 25 / 45+ min o "lliure") y la plataforma compone la sesión.
- **Sugerencias, no obligaciones.** Siempre puede ignorar la sugerencia e ir a un tema, a sus falladas o a un simulacro.

---

## 3. Producto: módulos

### 3.1 Inicio
- Breve configuración: turno (lliure/PI) y, opcionalmente, datos para estimar los puntos del concurso.
- **Diagnóstico opcional** de ~30–40 preguntas para situar el nivel inicial por bloques.

### 3.2 "Què faig ara?" — pantalla principal
- El alumno elige un tiempo disponible y la plataforma propone una sesión con mezcla adaptada:
  - Repasos FSRS más urgentes.
  - Errores pendientes.
  - Siguiente epígrafe de la ruta (ficha corta + preguntas).
  - Bloque intercalado.
- Cada propuesta explica el porqué con el estado del alumno. Por ejemplo: "Tens 12 preguntes de seguretat transfusional a punt d'oblidar-se".
- Accesos directos: continuar ruta · falladas · tema concreto · simulacro.
- Tras una ausencia larga, sesión de "reenganche" con lo más importante, sin avisos de retraso.

### 3.3 Ruta progresiva
- Mapa del temario por bloques y epígrafes, con un estado por epígrafe: no iniciado → en aprendizaje → consolidando → dominado.
- **Orden sugerido**: lo más preguntado en exámenes oficiales y lo que es base de otros temas va primero. El alumno puede saltar de un punto a otro.
- Hitos de progreso: "Bloc transversal dominat al 60 %", "Primer simulacre complet".

### 3.4 Motor de preguntas
- Modos: por tema/epígrafe · falladas · en blanco · dudosas · exámenes oficiales 2015–2024 · simulacro completo (reloj y penalización configurables) · supuestos prácticos.
- Nota neta con penalización y nota sobre 50 por ejercicio.
- Cada pregunta lleva: epígrafe, dificultad estimada, origen (oficial / generada), fuente citada y estado de verificación.
- Botón "reportar error". Las reportadas se ocultan hasta que se revisan.

### 3.5 Fichas por epígrafe
- 1–2 pantallas: ideas clave, esquema o algoritmo, "trampas de examen" y enlace a la fuente oficial.
- Siempre seguidas de preguntas: no hay lectura sin práctica.

### 3.6 Tutor IA (Claude) con RAG
- Responde solo con la base documental indexada: normativa, guías públicas y explicaciones de la plataforma. Cita siempre la fuente; si no la encuentra, lo dice.
- Pistas escalonadas antes de dar la respuesta.
- Funciones: explicar una fallada, explicarlo de otra manera, preguntas de elaboración y razonamiento de supuestos prácticos.

### 3.7 Métricas de progreso
- **Dominio del temario**: % de epígrafes por estado, global y por bloque, con un heatmap.
- **Evolución**: acierto y nota neta a lo largo del tiempo (por sesiones, no por calendario).
- **Nota estimada actual** en un simulacro, con intervalo, y su distancia a los mínimos (25 + 25).
- **Calibración**: acierto real cuando dices "segur" o "dubto", y puntos ganados o perdidos por arriesgar o dejar en blanco.
- **Puntos débiles**: epígrafes con más fallos o más olvido, y conceptos que el alumno confunde.
- **Retención**: % de lo aprendido que se mantiene (estimación FSRS).
- **Actividad**: tiempo y preguntas acumuladas, solo como dato y sin objetivos impuestos.
- **Grupo** (opcional, anónimo): comparación con la media del grupo y simulacros comunes.

---

## 4. Contenido y calidad sin revisora clínica

Como nadie revisa el contenido clínico, el diseño prioriza fuentes verificables y controles automáticos estrictos.

| Paso | Qué | Cómo |
|---|---|---|
| C1 | **Exámenes oficiales** | OCR de los PDF 2015–2024 → JSON (pregunta, opciones, correcta según plantilla oficial, anuladas). Es el **contenido más fiable** y la columna vertebral |
| C2 | **Árbol del temario** | Desglose de los 19 temas en epígrafes y clasificación de las preguntas oficiales → mapa de frecuencias |
| C3 | **Base documental** | Normativa consolidada (BOE / Portal Jurídic) por artículo, más guías y protocolos públicos (Canal Salut, ICS, COIB). Solo fuentes de libre acceso, con fecha |
| C4 | **Preguntas generadas** | Claude genera preguntas en catalán con el estilo oficial: 4 opciones y explicación de cada una. **Solo a partir de un fragmento concreto de la base documental**, citándolo |
| C5 | **Verificación automática** | (a) un segundo pase independiente resuelve la pregunta sin ver la respuesta: si no coincide, se descarta; (b) se comprueba que la cita respalda la respuesta; (c) se detectan ambigüedades, "todas/ninguna" mal usadas y duplicados; (d) se marcan como "alto riesgo" los temas de dosis, fármacos y transfusión |
| C6 | **Transparencia** | Cada pregunta indica si es oficial o generada. Las de alto riesgo muestran la fuente de forma destacada |
| C7 | **Revisión por el grupo** | Los reportes de las propias estudiantes (enfermeras) sirven de revisión distribuida. Las preguntas reportadas quedan suspendidas |

**Legal:** solo material oficial público y contenido propio. No se copian materiales de academias. Aviso: "no és una plataforma oficial de l'ICS".

---

## 5. Arquitectura técnica

| Capa | Elección |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind, PWA para móvil |
| Backend / BD | Supabase: Postgres, Auth con enlace mágico por invitación, pgvector y RLS |
| Repetición espaciada | ts-fsrs |
| IA | Claude API: Sonnet para el tutor y la generación, Haiku para clasificación y verificación masiva; prompt caching |
| RAG | pgvector con chunks por artículo/epígrafe y metadatos de fuente y vigencia |
| Pipeline de contenido | Scripts en `/content-pipeline`: OCR → JSON → clasificación → generación → verificación → carga en BD |
| Hosting | Vercel + Supabase (plan gratuito o bajo, suficiente para un grupo pequeño) |
| Tests | Vitest (puntuación, FSRS, selector de sesión) + Playwright |

### Modelo de datos (núcleo)
`topics` (árbol del temario) · `questions` (ca/es, opciones, correcta, explicación por opción, topic_id, source_ref, origin, risk_level, verification_status) · `cases` (supuestos) · `sources` (chunks + embedding) · `exam_configs` · `attempts` (respuesta, confianza, tiempo, acierto) · `review_cards` (estado FSRS) · `mastery` (usuario × epígrafe) · `sessions` · `tutor_messages` · `reports`.

### Lógica clave
- **Selector de sesión.** Recibe el tiempo disponible y el estado del alumno y devuelve una mezcla priorizada, sin fechas:
  - Urgencia FSRS (menor retrievability primero).
  - Errores pendientes.
  - Siguiente epígrafe de la ruta: frecuencia en exámenes × falta de dominio.
  - Una proporción de intercalado.
- **Dominio por epígrafe**: acierto reciente ponderado y estabilidad FSRS, con umbrales para cambiar de estado.
- **Puntuación**: `neta = aciertos − fallos × penalización`, escalada según `exam_configs`.
- **Nota estimada**: dominio por epígrafe ponderado por su peso en el examen, con intervalo bootstrap.

---

## 6. Fases de implementación (orden, sin fechas)

1. **Contenido base**: OCR de los exámenes oficiales, árbol del temario, mapa de frecuencias, base documental indexada y `exam_configs` provisional.
2. **Practicar (primera versión usable)**: acceso por invitación, banco oficial, test por tema, falladas, simulacros con exámenes oficiales y nota neta, y explicaciones. Ya se puede usar en el grupo.
3. **Tutor y progresión**: FSRS, confianza en cada respuesta, cola de errores, "Què faig ara?", ruta progresiva, fichas de los epígrafes más preguntados.
4. **Métricas**: panel de progreso, calibración, nota estimada y puntos débiles.
5. **Ampliación del banco y tutor IA**: preguntas generadas con verificación, supuestos prácticos y chat socrático con citas.
6. **Ajuste final**: aplicar el formato oficial cuando lo publique el tribunal y simulacros comunes del grupo.

Además, vigilar la página de novetats del ICS por si sale la fecha del examen o la diligencia de criterios de Infermeria (se puede automatizar con la skill `schedule`).

---

## 7. Skills por etapa

| Etapa | Skill |
|---|---|
| OCR de exámenes escaneados | `anthropic-skills:pdf` |
| Lectura de normativa y guías para las fichas | `deepread` |
| Tutor, generación y verificación de preguntas, RAG | `claude-api` |
| Diseño de la plataforma | `frontend-design`, `theme-factory` |
| Gráficas de progreso y heatmap | `dataviz` |
| Tests E2E | `webapp-testing` |
| Vigilancia de publicaciones del ICS | `schedule` |

---

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Errores clínicos en preguntas generadas (no hay revisora) | Prioridad a las preguntas oficiales; generación anclada a una fuente; verificación por doble resolución; etiquetado de origen y riesgo; reportes del grupo |
| Formato real distinto al supuesto | `exam_configs` parametrizable |
| Estudio irregular por el trabajo | Sesiones de duración libre, FSRS tolerante a pausas, sin penalizar ausencias |
| Coste de IA | Haiku para las tareas masivas, caching, pocos usuarios |

---

## Fuentes principales
- Convocatoria SLT/2380/2025: https://portaldogc.gencat.cat/utilsEADOP/PDF/9441/2095990.pdf
- Modificación SLT/2292/2026 (no afecta al Annex 35): https://portaldogc.gencat.cat/utilsEADOP/PDF/9705/2160784.pdf
- Tribunal SLT/3381/2026: https://portaldogc.gencat.cat/utilsEADOP/PDF/9763/2173039.pdf
- Novetats ICS: https://ics.gencat.cat/ca/lics/treballeu-a-lics/treball-fix/novetats/index.html
- Exámenes anteriores: https://ics.gencat.cat/ca/lics/treballeu-a-lics/treball-fix/informacio-suport-preparar-oposicio/index.html
- Guía de recursos COIB: https://pbcoib.blob.core.windows.net/coib-publish/invar/c09104ac-8107-4b16-8517-cb2904054ec0
- Evidencia: Dunlosky 2013; Rowland 2014; Adesope 2017; Cepeda 2008; Butler, Fazio & Marsh 2011; Bastani et al. PNAS 2025; Kestin & Miller, Sci Rep 2025; benchmark FSRS
- Referentes: UWorld, AMBOSS, OpositaTest, SalusPlay, OpoFuden, GoKoan, Sanidad360

### Temario oficial (resumen)
**Transversal (Annex 3):** 1 LOSC, SISCAT y Pla de salut · 2 ICS · 3 Derechos del paciente y protección de datos · 4 Estatuto Marco · 5 EBEP y III Acord ICS · 6 Carrera profesional y DPO · 7 PRL y acoso · 8 Igualdad y violencia machista · 9 Bioética y secreto profesional · 10 Calidad, PDCA e Ishikawa · 11 Ofimática y administración electrónica.

**Específico (Annex 35.3):**
1. Cuidado, ética, PAE, comunicación, investigación, TIC e IA.
2. Promoción y prevención, ciclo vital, familia.
3. Urgencias, embarazo, cardiorrespiratorio, nefrourinario.
4. Nutrición/endocrino, neuro/musculoesquelético, infeccioso, digestivo.
5. Piel, hematología/inmunología, ORL/oftalmología/maxilofacial, multisistémico, salud mental, paciente terminal.
6. Adherencia, educación sanitaria, farmacología, administración y cálculo de dosis, nutrición.
7. Seguridad del paciente, asepsia, IRAS, aislamientos, seguridad transfusional y quirúrgica, conciliación.
8. Afrontamiento, cuidador, duelo.

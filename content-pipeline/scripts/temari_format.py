"""Format d'estudi per al text del temari convertit de PDF, sense canviar-ne el contingut.

Només arregla defectes de la conversió i la presentació:
- caràcters de fonts de símbols (Wingdings/Symbol, zona privada d'Unicode) → el caràcter que representen;
- vinyetes escrites com a text (■ • ● ▪ ►…) → llistes de Markdown;
- lligadures perdudes ("planifcació" → "planificació"), paraules partides a final de línia ("inter- vención")
  i majúscules soltes de les versaletes ("caTalà") → només quan la forma corregida és al vocabulari del mateix
  temari (no s'inventa cap paraula);
- text espaiat lletra a lletra ("D e p o s i c i o n e s") i capçaleres repetides així;
- punts de farciment dels índexs ("Introducció ........ 6") i negretes buides.

`Vocab` es construeix amb tot el text del temari abans de formatar. `verify()` comprova que cap paraula
desapareix: les úniques diferències permeses són les correccions anteriors.
"""
import collections
import re
import unicodedata

# Fonts de símbols: Wingdings/Symbol posen els glifs a la zona privada (U+F0xx)
PUA = {
    "": "■", "": "▪", "": "•", "": "•", "": "•", "": "•", "": "●",
    "": "✓", "": "✗", "": "→", "": "←", "": "↑", "": "↓", "": "→",
    "": "➢", "": "❖", "": "❑", "": "□", "": "☺", "": "☹",
    "": " ", "": "-", "": "≥", "": "≤", "": "±", "": "→", "": "↑", "": "↓",
}
BULLETS = "■•●▪►◆○❖➢✓❑□◦▸–"
WORD = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ·]+")


def fold(w: str) -> str:
    return w.lower()


class Vocab:
    """Freqüència de cada paraula (en minúscules) a tot el temari: decideix quines correccions són segures."""

    def __init__(self, texts):
        self.count = collections.Counter()  # sense distingir majúscules
        self.exact = collections.Counter()  # tal com s'escriu
        for t in texts:
            words = WORD.findall(t)
            self.exact.update(words)
            self.count.update(fold(w) for w in words)

    def known(self, w: str, min_count: int = 3) -> bool:
        return self.count[fold(w)] >= min_count

    def better(self, cand: str, orig: str) -> bool:
        """La forma corregida és habitual (≥10) i almenys tan freqüent com la deformada."""
        return self.count[fold(cand)] >= 10 and self.count[fold(cand)] >= self.count[fold(orig)]


def fix_ligature(w: str, v: Vocab) -> str:
    # "planifcació" → "planificació", "infamació" → "inflamació": s'hi afegeix la i o la l que es va perdre
    if len(w) < 5 or "f" not in w.lower():
        return w
    for i, ch in enumerate(w):
        if ch in "fF":
            for add in ("i", "l", "fi", "f"):
                cand = w[: i + 1] + add + w[i + 1:]
                if v.better(cand, w):
                    return cand
            # "fn", "fc", "fg"… no existeixen en català ni castellà: si posant-hi la i surt una paraula del temari, és una lligadura
            nxt = w[i + 1: i + 2].lower()
            if nxt and nxt in "bcdgjkmnpqsvwxz":
                cand = w[: i + 1] + "i" + w[i + 1:]
                if v.count[fold(cand)] >= 1:
                    return cand
    return w


def fix_case(w: str, v: Vocab) -> str:
    # Versaletes: "caTalà", "funDamentos", "InstItut" → la forma habitual del text
    inner = w[1:]
    # Majúscules amb la vocal accentuada en minúscula ("INSUFICIèNCIA"): tot en majúscules
    if len(w) >= 3 and all(c.isupper() or (c.lower() in "àáèéíïòóúüç·" and c.islower()) for c in w) and any(c.islower() for c in w):
        return w.upper()
    if not any(c.isupper() for c in inner) or w.isupper() or len(w) < 4:
        return w
    low = w.lower()
    cand = low[0].upper() + low[1:] if w[0].isupper() else low
    # Només si la forma normal surt sovint escrita així i molt més que la deformada (respecta dTpa, mmHg, McGraw)
    for c in (cand, low, low[0].upper() + low[1:]):
        if v.exact[c] >= 5 and v.exact[c] >= v.exact[w]:
            return c
    return w


def fix_words(line: str, v: Vocab) -> str:
    def one(m):
        w = m.group(0)
        return fix_case(fix_ligature(w, v), v)

    return WORD.sub(one, line)


def join_hyphen(line: str, v: Vocab) -> str:
    # Partició de final de línia que ha quedat com "inter- vención"
    def one(m):
        a, b = m.group(1), m.group(2)
        return a + b if v.better(a + b, a + "-" + b) or (v.known(a + b, 3) and not v.known(b, 3)) else m.group(0)

    return re.sub(r"\b([a-zà-ÿ]{2,})- ([a-zà-ÿ]{2,})\b", one, line)


def join_spaced(line: str, v: "Vocab") -> str:
    # "D e p o s i c i o n e s" → "Deposiciones", només si el resultat és una paraula del temari
    # (no toca seqüències de lletres de les taules, com "a A o a B o")
    def one(m):
        w = m.group(1).replace(" ", "")
        return w if v.count[fold(w)] >= 2 else m.group(1)

    return re.sub(r"(?<![\w])((?:[A-Za-zÀ-ÿ] ){5,}[A-Za-zÀ-ÿ])(?![\w])", one, line)


SPACED_HEADER = re.compile(r"^\s*\**\s*(?:[A-ZÀ-Ý] ){12,}[A-ZÀ-Ý]\s*\**\s*$")
# Punts de farciment amb el número de pàgina (pot anar en negreta) al final de la cel·la o de la línia
TOC_LEADER = re.compile(r"\s*\.{5,}\s*(?:\*\*)?\s*\d*\s*(?:\*\*)?\s*(?=\||<br>|$)")


LIST_ITEM = re.compile(r"^(\s*)([-*]|\d+\.) +")


def normalize_lists(text: str) -> str:
    """Sagnats de llista coherents: cada nivell, 3 espais més que el pare.

    El PDF deixa sagnats arbitraris (sovint 6 o més espais sense cap element pare), que en Markdown es
    convertirien en blocs de codi. Les línies de text sagnades fora d'una llista es desagnen.
    """
    out, levels, in_list = [], [], False
    for line in text.split("\n"):
        if not line.strip():
            out.append(line)
            continue
        m = LIST_ITEM.match(line)
        if m:
            ind = len(m.group(1).expandtabs(4))
            if not in_list:
                levels = [ind]
            else:
                while levels and levels[-1] > ind:
                    levels.pop()
                if not levels or levels[-1] < ind:
                    levels.append(ind)
            out.append("   " * (len(levels) - 1) + line[len(m.group(1)):])
            in_list = True
            continue
        stripped = line.lstrip()
        if stripped.startswith(("|", "<!--", "#")) or not line.startswith(" "):
            in_list = in_list and not stripped.startswith(("#",)) and line.startswith(" ")
            out.append(line if not stripped.startswith(("|", "#")) else stripped)
            if stripped.startswith("#") or not line.startswith(" "):
                in_list = False
            continue
        # Text sagnat: continuació de l'element anterior si som dins d'una llista; si no, paràgraf normal
        out.append("   " * len(levels) + stripped if in_list else stripped)
    return "\n".join(out)


def format_text(text: str, v: Vocab) -> str:
    text = unicodedata.normalize("NFC", text)
    text = text.replace("­", "").replace("​", "").replace(" ", " ")
    text = "".join(PUA.get(c, c) for c in text)
    text = re.sub(r"[-]", "", text)  # glifs de símbols sense equivalència coneguda
    out = []
    for line in text.split("\n"):
        if SPACED_HEADER.match(line):  # capçalera repetida espaiada ("P L A N S D E C U R E S …")
            continue
        line = TOC_LEADER.sub("", line)
        line = re.sub(r"\.{6,}", "……", line)  # espais per omplir dels formularis
        line = re.sub(rf"^(#{{1,6}} +)[{BULLETS}]\s*", r"", line)  # vinyeta dins d'un títol
        if re.fullmatch(rf"\s*[-*]\s+[{BULLETS}]?\s*", line):  # element de llista buit
            continue
        # "** **" i "****": dues negretes seguides (o una de buida); es fusionen mantenint l'espai que hi hagués
        line = re.sub(r"\*\*(\s*)\*\*", lambda m: m.group(1), line)
        # Subtítol numerat enganxat al paràgraf ("… **4.1.2. Clasificación** De manera …") → línia pròpia
        if not line.lstrip().startswith(("|", "#", "- ", "* ", "<!--")):
            line = re.sub(r"\s*\*\*(\d+(?:\.\d+)+\.?\s+[^*\n]{2,90}?)\*\*\s+(?=\S)",
                          lambda m: f"\n\n**{m.group(1).strip()}**\n\n", line).lstrip("\n")
        if not line.startswith("<!--") and not line.startswith("!["):
            line = join_spaced(line, v)
            line = join_hyphen(line, v)
            line = fix_words(line, v)
        # Vinyeta escrita com a text a l'inici de línia (amb o sense "- " davant) → element de llista
        m = re.match(rf"^(\s*)(?:[-*] +)?[{BULLETS}]\s*(?=\S)", line)
        if m and not line.lstrip().startswith("|"):
            line = m.group(1) + "- " + line[m.end():]
        # Vinyetes enmig d'un paràgraf ("… text ■ asma extrínseca: …") → elements de llista nous
        if not line.lstrip().startswith(("|", "#")) and re.search(r"\S\s+[■●▪►•]\s+\S", line):
            indent = re.match(r"^\s*", line).group(0)
            parts = re.split(r"\s+[■●▪►•]\s+", line)
            line = parts[0] + "".join(f"\n{indent}- {p}" for p in parts[1:])
        # Un element de llista que només és un subtítol numerat ("- **4.1.4. Tractament**") → subtítol
        line = re.sub(r"^\s*[-*] +(\*\*\d+(?:\.\d+)+\.?\s+[^*\n]{2,90}\*\*)\s*$", r"\n\1\n", line)
        out.append(line)
    text = normalize_lists("\n".join(out))
    # Llistes enganxades al paràgraf anterior: Markdown necessita una línia en blanc abans
    text = re.sub(r"(?m)^(?!\s*[-*] |\s*\d+\. |\s*$|\s*\||\s*<!--)(.+)\n(\s*- )", r"\1\n\n\2", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def tokens(text: str) -> collections.Counter:
    return collections.Counter(fold(w) for w in WORD.findall(text))


def verify(before: str, after: str, v: Vocab) -> list[str]:
    """Paraules que han desaparecut sense ser una correcció permesa (llista buida = contingut intacte)."""
    a, b = tokens(before), tokens(after)
    lost = a - b
    gained = b - a
    allowed = set()
    for w in gained:  # cada paraula nova ha de venir d'una correcció (lligadura, partició, lletres espaiades)
        allowed.add(w)
    problems = []
    for w, n in lost.items():
        # desaparicions acceptables: la forma deformada que s'ha corregit, o lletres soltes que s'han unit
        if len(w) == 1 or any(w in g or g.startswith(w) or g.endswith(w) or fix_ligature(w, v).lower() == g for g in allowed):
            continue
        problems.append(f"{w}×{n}")
    return problems

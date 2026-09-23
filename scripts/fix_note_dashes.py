"""
Repair the note prose that commit ec0200c damaged.

ec0200c deleted every em dash from sociology.ts and anthropology.ts without
putting anything in its place, so sentences that leaned on the dash lost their
join: "maintain racial purity Brahmin castes show the highest proportion".
d05ca61 patched the easiest case (a bold label) and left the rest.

The two files are provably identical to their pre-strip versions apart from
dashes, colons and whitespace, so this works from the original text at
ec0200c^ and chooses punctuation per site rather than guessing at the damage
after the fact. Dashes are not restored: the replacement is a colon, a comma
or a bracket, which is what the notes should have used.

Usage: python3 scripts/fix_note_dashes.py [--write]
"""
import re, subprocess, sys, collections

ORIGINAL_REV = "ec0200c^"
FILES = ["lib/noteContent/sociology.ts", "lib/noteContent/anthropology.ts"]

stats = collections.Counter()


def original(path):
    out = subprocess.run(["git", "show", "%s:%s" % (ORIGINAL_REV, path)],
                         capture_output=True, text=True)
    if out.returncode:
        sys.exit("cannot read %s:%s" % (ORIGINAL_REV, path))
    return out.stdout


def fix(text):
    # Anthropology wrote some dashes as "--". Normalise so one pass covers both.
    text = re.sub(r"\s--\s", " — ", text)
    # En dashes only ever sit in numeric ranges here (1818-1883, 0.48-0.53).
    text = re.sub(r"(?<=\d)\s*–\s*(?=\d)", "-", text)
    text = text.replace("–", "-")

    # 1. Attribution after a quotation: "... " - Marx  ->  "..." (Marx)
    def attribution(m):
        stats["attribution -> (name)"] += 1
        return '%s (%s)%s' % (m.group(1), m.group(2).strip(), m.group(3))
    text = re.sub(r'(["”])\s*—\s*([A-Z][A-Za-z.\'\s]{2,40}?)\s*(</blockquote>)',
                  attribution, text)

    # 2. Paired dashes inside one sentence: an aside, not a break.
    #    Commas normally; brackets when the aside has its own comma, so the
    #    sentence does not dissolve into a row of equal commas.
    def paired(m):
        inner = m.group(1)
        if re.search(r"[.;:]\s|<(p|li|h[234]|ul|blockquote)", inner):
            return m.group(0)
        if "," in inner:
            stats["aside -> (brackets)"] += 1
            return " (%s) " % inner
        stats["aside -> commas"] += 1
        return ", %s, " % inner
    text = re.sub(r"\s*—\s*(.{1,90}?)\s*—\s*(?=[a-z])", paired, text)

    # 3. A label introducing its gloss: <strong>Hegel</strong> - Dialectical ...
    def label(m):
        stats["label -> colon"] += 1
        return m.group(1) + ": "
    text = re.sub(r"(</strong>|</em>|\))\s*—\s*", label, text)

    # 4. Everything left is a single dash mid-sentence. It is nearly always
    #    introducing the explanation or the list that follows, which is a
    #    colon. Where the sentence already carries a colon a second one would
    #    not parse, so that case falls back to a comma.
    def single(m):
        head = text[:m.start()]
        sentence_start = max(head.rfind(". "), head.rfind(">"), head.rfind("; "))
        if ":" in head[sentence_start:]:
            stats["single -> comma (colon taken)"] += 1
            return ", "
        stats["single -> colon"] += 1
        return ": "
    text = re.sub(r"\s*—\s*", single, text)

    # The rules above each re-add one space, which doubles up where the dash
    # already sat at the end of a line or against a tag.
    text = re.sub(r":[ \t]{2,}", ": ", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r":[ \t]+(?=\n)", ":", text)
    text = re.sub(r",[ \t]{2,}", ", ", text)
    return text


def main():
    write = "--write" in sys.argv
    for path in FILES:
        src = original(path)
        out = fix(src)
        leftover = len(re.findall(r"—|\s--\s", out))
        print("== %s: %d dashes resolved, %d left" %
              (path, len(re.findall(r"—|\s--\s", src)), leftover))
        if write:
            open(path, "w", encoding="utf-8").write(out)
        else:
            open("/tmp/preview_" + path.split("/")[-1], "w", encoding="utf-8").write(out)
    print("\n== decisions:")
    for k, v in stats.most_common():
        print("  %-32s %d" % (k, v))
    print("\n%s" % ("WRITTEN" if write else "preview only, wrote /tmp/preview_*.ts"))


main()

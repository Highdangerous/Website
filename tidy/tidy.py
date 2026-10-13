#!/usr/bin/env python3
"""tidy - small CLI for boring file chores. Standard library only.

  tidy.py organize ~/Downloads          sort files into Images/, Documents/, ...
  tidy.py rename ./photos --prefix trip  rename files to trip_001.jpg, trip_002.jpg, ...
  tidy.py csv-summary data.csv           column types, missing values, basic stats

organize and rename only preview by default; add --apply to really do it.
"""
import argparse
import csv
import statistics
import sys
from collections import Counter
from pathlib import Path

CATEGORIES = {
    "Images": {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".heic", ".bmp"},
    "Documents": {".pdf", ".doc", ".docx", ".txt", ".md", ".odt", ".rtf", ".pptx", ".ppt"},
    "Spreadsheets": {".csv", ".xls", ".xlsx", ".ods"},
    "Archives": {".zip", ".tar", ".gz", ".7z", ".rar", ".bz2"},
    "Audio": {".mp3", ".wav", ".flac", ".m4a", ".ogg"},
    "Video": {".mp4", ".mov", ".mkv", ".avi", ".webm"},
    "Code": {".py", ".js", ".ts", ".html", ".css", ".json", ".sh", ".java", ".c", ".cpp"},
    "Installers": {".exe", ".dmg", ".msi", ".deb", ".apk", ".pkg"},
}


def category_for(path: Path) -> str:
    ext = path.suffix.lower()
    for name, exts in CATEGORIES.items():
        if ext in exts:
            return name
    return "Other"


def unique_target(target: Path) -> Path:
    """Return target, or target with ' (1)', ' (2)'... so nothing is overwritten."""
    if not target.exists():
        return target
    n = 1
    while True:
        candidate = target.with_name(f"{target.stem} ({n}){target.suffix}")
        if not candidate.exists():
            return candidate
        n += 1


def plan_organize(folder: Path) -> list[tuple[Path, Path]]:
    moves = []
    for item in sorted(folder.iterdir()):
        if item.is_file() and not item.name.startswith("."):
            moves.append((item, folder / category_for(item) / item.name))
    return moves


def plan_rename(folder: Path, prefix: str, start: int = 1) -> list[tuple[Path, Path]]:
    files = [f for f in sorted(folder.iterdir()) if f.is_file() and not f.name.startswith(".")]
    width = max(3, len(str(start + len(files))))
    return [
        (f, f.with_name(f"{prefix}_{i:0{width}d}{f.suffix.lower()}"))
        for i, f in enumerate(files, start)
    ]


def execute(moves: list[tuple[Path, Path]], apply: bool) -> int:
    done = 0
    for src, dst in moves:
        if src == dst:
            continue
        # Avoid clobbering files, including ones created earlier in this same run.
        final = unique_target(dst)
        subdir = "" if final.parent == src.parent else f"{final.parent.name}/"
        print(f"{src.name}  ->  {subdir}{final.name}")
        if apply:
            final.parent.mkdir(exist_ok=True)
            src.rename(final)
        done += 1
    verb = "Moved/renamed" if apply else "Would move/rename"
    print(f"\n{verb} {done} file(s)." + ("" if apply else " Re-run with --apply to do it."))
    return done


def cmd_organize(args) -> int:
    folder = Path(args.folder).expanduser()
    if not folder.is_dir():
        print(f"error: {folder} is not a folder", file=sys.stderr)
        return 1
    execute(plan_organize(folder), args.apply)
    return 0


def cmd_rename(args) -> int:
    folder = Path(args.folder).expanduser()
    if not folder.is_dir():
        print(f"error: {folder} is not a folder", file=sys.stderr)
        return 1
    # Two-step rename would be needed if new names collide with old ones;
    # unique_target keeps this safe by never overwriting.
    execute(plan_rename(folder, args.prefix, args.start), args.apply)
    return 0


def to_number(value: str):
    try:
        return float(value.replace(",", ""))
    except ValueError:
        return None


def summarise_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        columns = reader.fieldnames or []
        values = {c: [] for c in columns}
        rows = 0
        for row in reader:
            rows += 1
            for c in columns:
                values[c].append((row.get(c) or "").strip())
    summary = []
    for c in columns:
        present = [v for v in values[c] if v != ""]
        nums = [to_number(v) for v in present]
        info = {"column": c, "rows": rows, "missing": rows - len(present), "unique": len(set(present))}
        if present and all(n is not None for n in nums):
            info.update(type="number", min=min(nums), max=max(nums),
                        mean=statistics.fmean(nums), median=statistics.median(nums))
        else:
            info["type"] = "text"
            info["top"] = Counter(present).most_common(3)
        summary.append(info)
    return summary


def cmd_csv_summary(args) -> int:
    path = Path(args.file).expanduser()
    if not path.is_file():
        print(f"error: {path} not found", file=sys.stderr)
        return 1
    try:
        summary = summarise_csv(path)
    except (csv.Error, UnicodeDecodeError) as e:
        print(f"error: could not read CSV: {e}", file=sys.stderr)
        return 1
    if not summary:
        print("The file has no columns.")
        return 0
    print(f"{path.name}: {summary[0]['rows']} rows, {len(summary)} columns\n")
    for s in summary:
        print(f"- {s['column']} ({s['type']}) | missing: {s['missing']} | unique: {s['unique']}")
        if s["type"] == "number":
            print(f"    min {s['min']:g}  max {s['max']:g}  mean {s['mean']:.2f}  median {s['median']:g}")
        elif s["top"]:
            print("    top: " + ", ".join(f"{v!r} x{n}" for v, n in s["top"]))
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="tidy", description="Small CLI for boring file chores.")
    sub = p.add_subparsers(dest="command", required=True)

    o = sub.add_parser("organize", help="sort files in a folder into category subfolders")
    o.add_argument("folder")
    o.add_argument("--apply", action="store_true", help="actually move files (default: preview)")
    o.set_defaults(func=cmd_organize)

    r = sub.add_parser("rename", help="rename all files in a folder to prefix_001.ext, ...")
    r.add_argument("folder")
    r.add_argument("--prefix", required=True)
    r.add_argument("--start", type=int, default=1)
    r.add_argument("--apply", action="store_true", help="actually rename (default: preview)")
    r.set_defaults(func=cmd_rename)

    c = sub.add_parser("csv-summary", help="summarise the columns of a CSV file")
    c.add_argument("file")
    c.set_defaults(func=cmd_csv_summary)
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())

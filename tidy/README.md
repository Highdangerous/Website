# tidy

A tiny Python CLI for boring file chores. No dependencies, just Python 3.9+.

```sh
python3 tidy.py organize ~/Downloads            # preview
python3 tidy.py organize ~/Downloads --apply    # do it
python3 tidy.py rename ./photos --prefix trip --apply
python3 tidy.py csv-summary data.csv
```

| Command | What it does |
| --- | --- |
| `organize <folder>` | Sorts files into `Images/`, `Documents/`, `Archives/`, ... by extension |
| `rename <folder> --prefix P` | Renames files to `P_001.ext`, `P_002.ext`, ... |
| `csv-summary <file>` | Prints each column's type, missing values, unique count and min/max/mean/median (or top values for text) |

## Safety

- `organize` and `rename` **only preview** unless you pass `--apply`.
- Existing files are never overwritten; clashes become `name (1).ext`.
- Hidden files and subfolders are left alone.

## Tests

```sh
python3 -m unittest discover tests
```

## Ideas to extend

- `--undo` using a log of moves
- Organize by date (`2026/10/`) instead of type
- Find duplicate files by hash
- Custom categories from a config file

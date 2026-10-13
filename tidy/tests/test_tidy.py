import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import tidy  # noqa: E402


class TidyTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def touch(self, name, text=""):
        p = self.dir / name
        p.write_text(text)
        return p

    def test_category(self):
        self.assertEqual(tidy.category_for(Path("a.PNG")), "Images")
        self.assertEqual(tidy.category_for(Path("a.xyz")), "Other")

    def test_organize_preview_moves_nothing(self):
        self.touch("a.png")
        tidy.main(["organize", str(self.dir)])
        self.assertTrue((self.dir / "a.png").exists())

    def test_organize_apply(self):
        self.touch("a.png")
        self.touch("b.pdf")
        tidy.main(["organize", str(self.dir), "--apply"])
        self.assertTrue((self.dir / "Images" / "a.png").exists())
        self.assertTrue((self.dir / "Documents" / "b.pdf").exists())

    def test_organize_never_overwrites(self):
        (self.dir / "Images").mkdir()
        (self.dir / "Images" / "a.png").write_text("old")
        self.touch("a.png", "new")
        tidy.main(["organize", str(self.dir), "--apply"])
        self.assertEqual((self.dir / "Images" / "a.png").read_text(), "old")
        self.assertEqual((self.dir / "Images" / "a (1).png").read_text(), "new")

    def test_rename(self):
        self.touch("x.JPG")
        self.touch("y.jpg")
        tidy.main(["rename", str(self.dir), "--prefix", "trip", "--apply"])
        self.assertEqual(sorted(p.name for p in self.dir.iterdir()), ["trip_001.jpg", "trip_002.jpg"])

    def test_csv_summary(self):
        p = self.touch("d.csv", "name,age\nann,30\nbob,\nann,40\n")
        s = {c["column"]: c for c in tidy.summarise_csv(p)}
        self.assertEqual(s["age"]["type"], "number")
        self.assertEqual(s["age"]["missing"], 1)
        self.assertEqual(s["age"]["mean"], 35)
        self.assertEqual(s["name"]["top"][0], ("ann", 2))


if __name__ == "__main__":
    unittest.main()

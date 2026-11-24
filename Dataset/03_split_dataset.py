"""
03_split_dataset.py  -  turn one flat folder (image + label side by side) into a YOLO train/val/test dataset.

Plain Python, no Blender, no extra packages.   Example (Windows or Linux):
    python 03_split_dataset.py --src C:/Projects/mscSem3/Dataset/claude_ds_28sep --modality white_hot

Result (inside --src):
    dataset_white_hot/
        images/train  images/val  images/test
        labels/train  labels/val  labels/test
        data.yaml

Rules
  * Split is 80 / 10 / 10 (common default, not a sourced figure), done SEPARATELY for nilgai, boar, cow and empty
    frames, so every split has the same mix.
  * The split depends only on the file names and --seed, so white_hot, ironbow_rgb and ironbow_hsv get the SAME
    split. A scene is never in train for one colour map and in val for another.
  * Files are copied (the originals stay). Use --move to move them instead.
"""
import argparse
import os
import random
import shutil

CLASSES = ["nilgai", "boar", "cow"]          # must match CLASSES in 02_generate_dataset.py (ids 0, 1, 2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="dataset folder that holds white_hot / ironbow_rgb / ironbow_hsv")
    ap.add_argument("--modality", default="white_hot", choices=["white_hot", "ironbow_rgb", "ironbow_hsv"])
    ap.add_argument("--train", type=float, default=0.8)
    ap.add_argument("--val", type=float, default=0.1)          # test = the rest
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--move", action="store_true")
    a = ap.parse_args()

    src = os.path.join(a.src, a.modality)
    if not os.path.isdir(src):
        raise SystemExit("Folder not found: %s" % src)
    out = os.path.join(a.src, "dataset_" + a.modality)
    stems = sorted(f[:-4] for f in os.listdir(src) if f.endswith(".png") and os.path.exists(os.path.join(src, f[:-4] + ".txt")))
    if not stems:
        raise SystemExit("No image + label pairs in %s" % src)

    groups = {}
    for s in stems:
        groups.setdefault(s.rsplit("_", 1)[0], []).append(s)       # prefix = class name or 'empty'

    split = {"train": [], "val": [], "test": []}
    rng = random.Random(a.seed)
    for g in sorted(groups):
        items = groups[g][:]
        rng.shuffle(items)
        n = len(items)
        n_tr, n_va = int(round(n * a.train)), int(round(n * a.val))
        split["train"] += items[:n_tr]
        split["val"] += items[n_tr:n_tr + n_va]
        split["test"] += items[n_tr + n_va:]

    op = shutil.move if a.move else shutil.copy2
    for sp, items in split.items():
        os.makedirs(os.path.join(out, "images", sp), exist_ok=True)
        os.makedirs(os.path.join(out, "labels", sp), exist_ok=True)
        for s in items:
            op(os.path.join(src, s + ".png"), os.path.join(out, "images", sp, s + ".png"))
            op(os.path.join(src, s + ".txt"), os.path.join(out, "labels", sp, s + ".txt"))

    with open(os.path.join(out, "data.yaml"), "w") as f:
        f.write("path: %s\ntrain: images/train\nval: images/val\ntest: images/test\nnames:\n" % os.path.abspath(out).replace("\\", "/"))
        for i, c in enumerate(CLASSES):
            f.write("  %d: %s\n" % (i, c))

    print("Wrote", out)
    for sp, items in split.items():
        per = {g: sum(1 for s in items if s.rsplit("_", 1)[0] == g) for g in sorted(groups)}
        print("  %-5s %5d  %s" % (sp, len(items), per))


if __name__ == "__main__":
    main()
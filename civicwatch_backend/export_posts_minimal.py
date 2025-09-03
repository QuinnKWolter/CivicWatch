# export_posts_minimal.py
"""
Export post_id, created_at, and text to CSV for topic discovery.

Usage:
    python export_posts_minimal.py [--outfile path/to/file.csv]
"""

import os, sys, csv, django
from argparse import ArgumentParser

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "civicwatch_backend.settings")
django.setup()

from civicwatch.models import Post   # adjust to your real app label

parser = ArgumentParser()
parser.add_argument("--outfile", default="posts_for_topics.csv")
args = parser.parse_args()

COLUMNS = ["post_id", "created_at", "text"]

qs = (
    Post.objects
        .values("post_id", "created_at", "text")
)

with open(args.outfile, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(COLUMNS)

    for p in qs.iterator(chunk_size=10_000):
        writer.writerow([
            p["post_id"],
            p["created_at"].isoformat(sep=" ", timespec="seconds"),
            p["text"].replace("\n", " ").strip()
        ])

print(f"✅  Exported {qs.count():,} posts ➜ {args.outfile}")
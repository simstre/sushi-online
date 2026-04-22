#!/usr/bin/env python3
"""
Scrape CodeFusion restaurant menus from the public Firestore backend.

Pulls Restaurants + subcollections (Categories, Products, Modifiers, Locations)
for every restaurant on the platform, plus all image assets they reference.
Resumable: existing per-restaurant JSON files and downloaded images are skipped.

Usage:
    python scripts/scrape_codefusion.py                  # all active restaurants
    python scripts/scrape_codefusion.py --include-inactive
    python scripts/scrape_codefusion.py --only <restaurantId>
    python scripts/scrape_codefusion.py --no-images      # metadata only
    python scripts/scrape_codefusion.py --dry-run        # estimate sizes
"""

import argparse
import concurrent.futures
import hashlib
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

FIREBASE_API_KEY = "REDACTED_SECRET"
PROJECT_ID = "cold-fusion-9419a"
FIRESTORE_BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"

ROOT = Path(__file__).resolve().parent.parent / "scraped"
RESTAURANTS_DIR = ROOT / "restaurants"
IMAGES_DIR = ROOT / "images"
INDEX_PATH = ROOT / "index.json"


def fs_get(path, params=None):
    qs = {"key": FIREBASE_API_KEY}
    if params:
        qs.update(params)
    url = f"{FIRESTORE_BASE}/{path}?{urllib.parse.urlencode(qs)}"
    req = urllib.request.Request(url, headers={"User-Agent": "menu-archive/1.0"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read())
        except Exception as e:
            if attempt == 4:
                raise
            time.sleep(1.5 ** attempt)


def fs_list(collection_path):
    """Yield all documents in a Firestore collection, paginating."""
    token = None
    while True:
        params = {"pageSize": "300"}
        if token:
            params["pageToken"] = token
        data = fs_get(collection_path, params)
        for doc in data.get("documents", []):
            yield doc
        token = data.get("nextPageToken")
        if not token:
            break


def unwrap(field):
    """Unwrap a Firestore typed value into a plain Python value."""
    if field is None:
        return None
    if "stringValue" in field:
        return field["stringValue"]
    if "integerValue" in field:
        return int(field["integerValue"])
    if "doubleValue" in field:
        return field["doubleValue"]
    if "booleanValue" in field:
        return field["booleanValue"]
    if "nullValue" in field:
        return None
    if "timestampValue" in field:
        return field["timestampValue"]
    if "referenceValue" in field:
        return field["referenceValue"]
    if "geoPointValue" in field:
        return field["geoPointValue"]
    if "arrayValue" in field:
        return [unwrap(v) for v in field["arrayValue"].get("values", [])]
    if "mapValue" in field:
        return {k: unwrap(v) for k, v in field["mapValue"].get("fields", {}).items()}
    return field


def doc_to_dict(doc):
    out = {k: unwrap(v) for k, v in doc.get("fields", {}).items()}
    out["_id"] = doc["name"].rsplit("/", 1)[-1]
    return out


IMAGE_URL_RE = re.compile(r'https?://[^\s"\'<>]+?\.(?:jpe?g|png|gif|webp|heic|avif)(?:\?[^\s"\'<>]*)?', re.I)


def collect_image_urls(obj, out):
    if isinstance(obj, str):
        for m in IMAGE_URL_RE.findall(obj):
            out.add(m)
    elif isinstance(obj, dict):
        for v in obj.values():
            collect_image_urls(v, out)
    elif isinstance(obj, list):
        for v in obj:
            collect_image_urls(v, out)


def image_local_path(url, restaurant_id):
    """Deterministic local path for an image URL."""
    ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".avif"):
        ext = ".jpg"
    h = hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]
    return IMAGES_DIR / restaurant_id / f"{h}{ext}"


def download_image(url, dest):
    if dest.exists() and dest.stat().st_size > 0:
        return dest.stat().st_size, True  # already present
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "menu-archive/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
        tmp = dest.with_suffix(dest.suffix + ".part")
        tmp.write_bytes(data)
        tmp.rename(dest)
        return len(data), False
    except Exception as e:
        return 0, False


def scrape_restaurant(rid, name, skip_images=False, dry_run=False):
    """Fetch everything for one restaurant, write JSON, download images."""
    out_path = RESTAURANTS_DIR / f"{rid}.json"
    if out_path.exists() and not dry_run:
        # Still may need images; read back for URL list
        try:
            existing = json.loads(out_path.read_text())
            if existing.get("_complete"):
                # Only re-check images if --no-images not set
                if skip_images:
                    return {"restaurantId": rid, "name": name, "skipped": True}
                image_urls = set(existing.get("_imageUrls", []))
                stats = _sync_images(rid, image_urls)
                return {"restaurantId": rid, "name": name, "cached": True, **stats}
        except Exception:
            pass

    restaurant_doc = fs_get(f"Restaurants/{rid}")
    restaurant = doc_to_dict(restaurant_doc)

    locations = [doc_to_dict(d) for d in fs_list(f"Restaurants/{rid}/Locations")]

    menus_by_location = {}
    total_cats = total_prods = total_mods = 0
    for loc in locations:
        lid = loc["_id"]
        base = f"Restaurants/{rid}/Locations/{lid}"
        cats = [doc_to_dict(d) for d in fs_list(f"{base}/Categories")]
        prods = [doc_to_dict(d) for d in fs_list(f"{base}/Products")]
        mods = [doc_to_dict(d) for d in fs_list(f"{base}/Modifiers")]
        menus_by_location[lid] = {
            "categories": cats,
            "products": prods,
            "modifiers": mods,
        }
        total_cats += len(cats)
        total_prods += len(prods)
        total_mods += len(mods)

    image_urls = set()
    for obj in (restaurant, locations, menus_by_location):
        collect_image_urls(obj, image_urls)

    record = {
        "_id": rid,
        "_scrapedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "_imageUrls": sorted(image_urls),
        "_complete": True,
        "restaurant": restaurant,
        "locations": locations,
        "menusByLocation": menus_by_location,
    }

    if dry_run:
        return {
            "restaurantId": rid,
            "name": name,
            "categories": total_cats,
            "products": total_prods,
            "modifiers": total_mods,
            "locations": len(locations),
            "images": len(image_urls),
            "dryRun": True,
        }

    out_path.write_text(json.dumps(record, indent=2, ensure_ascii=False))

    stats = {"images_downloaded": 0, "images_cached": 0, "image_bytes": 0}
    if not skip_images:
        stats = _sync_images(rid, image_urls)

    return {
        "restaurantId": rid,
        "name": name,
        "categories": total_cats,
        "products": total_prods,
        "modifiers": total_mods,
        "locations": len(locations),
        "images": len(image_urls),
        **stats,
    }


def _sync_images(rid, urls):
    downloaded = cached = total_bytes = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = {
            pool.submit(download_image, u, image_local_path(u, rid)): u for u in urls
        }
        for fut in concurrent.futures.as_completed(futures):
            size, was_cached = fut.result()
            total_bytes += size
            if was_cached:
                cached += 1
            elif size > 0:
                downloaded += 1
    return {
        "images_downloaded": downloaded,
        "images_cached": cached,
        "image_bytes": total_bytes,
    }


def build_index():
    """Write index.json mapping rid -> summary."""
    entries = []
    for path in sorted(RESTAURANTS_DIR.glob("*.json")):
        try:
            d = json.loads(path.read_text())
        except Exception:
            continue
        r = d.get("restaurant", {})
        menus = d.get("menusByLocation", {})
        total_prods = sum(len(m.get("products", [])) for m in menus.values())
        total_cats = sum(len(m.get("categories", [])) for m in menus.values())
        entries.append({
            "id": r.get("_id") or d.get("_id"),
            "name": r.get("name"),
            "inactive": r.get("inactive", False),
            "landingUrl": r.get("landingUrl"),
            "categories": total_cats,
            "products": total_prods,
            "locations": [
                {"id": l.get("_id"), "address": l.get("address"), "name": l.get("name")}
                for l in d.get("locations", [])
            ],
            "imageCount": len(d.get("_imageUrls", [])),
            "file": f"restaurants/{path.name}",
        })
    entries.sort(key=lambda e: (e.get("name") or "").lower())
    INDEX_PATH.write_text(json.dumps({"generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                                      "count": len(entries),
                                      "restaurants": entries}, indent=2, ensure_ascii=False))
    return len(entries)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--include-inactive", action="store_true")
    ap.add_argument("--only", help="Scrape only this restaurant ID")
    ap.add_argument("--no-images", action="store_true", help="Skip image downloads")
    ap.add_argument("--dry-run", action="store_true", help="Count items without writing")
    ap.add_argument("--limit", type=int, default=0, help="Max restaurants to process (0=all)")
    ap.add_argument("--workers", type=int, default=4, help="Parallel restaurants")
    args = ap.parse_args()

    RESTAURANTS_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    if args.only:
        targets = [(args.only, args.only)]
    else:
        print("Listing restaurants...")
        targets = []
        for doc in fs_list("Restaurants"):
            f = doc.get("fields", {})
            rid = unwrap(f.get("id")) or doc["name"].rsplit("/", 1)[-1]
            name = unwrap(f.get("name")) or rid
            inactive = unwrap(f.get("inactive")) or False
            if inactive and not args.include_inactive:
                continue
            targets.append((rid, name))
        print(f"  {len(targets)} restaurants to process")

    if args.limit:
        targets = targets[: args.limit]

    start = time.time()
    total_bytes = 0
    total_images = 0
    done = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(scrape_restaurant, rid, name, args.no_images, args.dry_run): (rid, name) for rid, name in targets}
        for fut in concurrent.futures.as_completed(futures):
            rid, name = futures[fut]
            done += 1
            try:
                result = fut.result()
            except Exception as e:
                print(f"[{done}/{len(targets)}] ERROR {name} ({rid}): {e}", flush=True)
                continue
            total_bytes += result.get("image_bytes", 0)
            total_images += result.get("images_downloaded", 0)
            tag = "DRY" if result.get("dryRun") else ("CACHED" if result.get("cached") else ("SKIP" if result.get("skipped") else "OK"))
            print(f"[{done}/{len(targets)}] {tag} {name} ({rid}) "
                  f"cats={result.get('categories','-')} prods={result.get('products','-')} "
                  f"imgs={result.get('images','-')} dl={result.get('images_downloaded',0)} "
                  f"+{result.get('image_bytes',0)/1e6:.1f}MB",
                  flush=True)

    print(f"\nDone in {time.time()-start:.1f}s. Downloaded {total_images} images, {total_bytes/1e6:.1f} MB.")
    if not args.dry_run:
        n = build_index()
        print(f"Index written: {INDEX_PATH} ({n} entries)")


if __name__ == "__main__":
    main()

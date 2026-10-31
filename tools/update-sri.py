"""Pin the page's scripts and stylesheet with Subresource Integrity hashes.

Every GitHub Pages site under one account shares an origin, so the CSP's 'self'
alone would trust scripts from any of them. The integrity attributes make the
browser refuse any file whose bytes don't match what's in this repository.

Run it after changing app.js, style.css or vendor/qrcode.js:
    python3 tools/update-sri.py           # rewrite the integrity attributes in index.html
    python3 tools/update-sri.py --check   # exit 1 if any are missing or out of date
"""
import base64
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = ROOT / "index.html"
TAG = re.compile(r'<(?:script src|link rel="stylesheet" href)="([^"]+)"[^>]*>')


def sri(path):
    digest = hashlib.sha384((ROOT / path).read_bytes()).digest()
    return "sha384-" + base64.b64encode(digest).decode()


def pinned(match):
    tag, path = match.group(0), match.group(1)
    tag = re.sub(r' integrity="[^"]*"', "", tag)
    return tag[:-1] + f' integrity="{sri(path)}">'


def main():
    html = PAGE.read_text()
    updated = TAG.sub(pinned, html)
    paths = TAG.findall(html)
    if "--check" in sys.argv[1:]:
        if updated != html:
            print("Integrity hashes in index.html are missing or out of date. Run: python3 tools/update-sri.py")
            sys.exit(1)
        print("Integrity hashes match: " + ", ".join(paths))
        return
    PAGE.write_text(updated)
    for path in paths:
        print(f"{path}  {sri(path)}")


if __name__ == "__main__":
    main()

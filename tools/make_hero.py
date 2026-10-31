"""Generate a flat-vector illustration: two hands holding phones that show the same code.

Only SVG presentation attributes are used (no <style>, no style="..."), so the SVG
also works inlined into index.html without loosening its Content-Security-Policy.

Usage, from the repository root:
    python3 tools/make_hero.py img/hero.svg           # skin tones as published
    python3 tools/make_hero.py img/hero.svg yellow    # cartoon-yellow hands
    python3 tools/make_hero.py img/og.svg og && rsvg-convert img/og.svg -o img/og.png && rm img/og.svg
                                                      # 1200x630 link-preview crop
"""
import random
import sys

W, H = 1200, 720
CODE = "482 913"
SPARKLES = ((140, 110, 9), (1060, 150, 11), (980, 610, 8), (230, 600, 7), (600, 90, 8))


def stars(w=W, h=H, seed=7, sparkles=SPARKLES):
    rnd = random.Random(seed)
    parts = []
    for _ in range(90):
        x, y = rnd.uniform(0, w), rnd.uniform(0, h)
        r = rnd.choice([0.8, 1.0, 1.2, 1.6, 2.2])
        o = rnd.uniform(0.25, 0.85)
        parts.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r}" fill="#ffffff" opacity="{o:.2f}"/>')
    # a few four-point sparkles
    for x, y, s in sparkles:
        parts.append(
            f'<path d="M{x} {y-s} Q{x} {y} {x+s} {y} Q{x} {y} {x} {y+s} Q{x} {y} {x-s} {y} Q{x} {y} {x} {y-s}Z" fill="#ffffff" opacity="0.9"/>'
        )
    return "\n".join(parts)


def hand_back(skin, shade, sleeve, sleeve_shade):
    """Arm, sleeve and palm, drawn behind the phone. Local coords: phone centred at 0,0."""
    return f"""
    <line x1="-330" y1="395" x2="-820" y2="790" stroke="{sleeve}" stroke-width="160" stroke-linecap="round"/>
    <line x1="-430" y1="475" x2="-820" y2="790" stroke="{sleeve_shade}" stroke-width="40" stroke-linecap="round" transform="translate(30 50)"/>
    <line x1="-318" y1="386" x2="-352" y2="413" stroke="{sleeve_shade}" stroke-width="166"/>
    <line x1="-118" y1="238" x2="-325" y2="392" stroke="{skin}" stroke-width="108" stroke-linecap="round"/>
    <line x1="-150" y1="290" x2="-325" y2="420" stroke="{shade}" stroke-width="26" stroke-linecap="round"/>
    <ellipse cx="-50" cy="214" rx="128" ry="86" transform="rotate(-18 -50 214)" fill="{shade}"/>
    <ellipse cx="-56" cy="202" rx="124" ry="82" transform="rotate(-18 -56 202)" fill="{skin}"/>
    """


def hand_front(skin, shade, nail):
    """Thumb over the left edge and fingertips curling over the right edge."""
    fingers = []
    for i, (y, w, h) in enumerate(((0, 52, 44), (56, 52, 44), (112, 50, 42), (164, 44, 38))):
        x = 96
        fingers.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h/2}" fill="{shade}"/>')
        fingers.append(f'<rect x="{x}" y="{y - 3}" width="{w - 4}" height="{h - 4}" rx="{(h-4)/2}" fill="{skin}"/>')
        fingers.append(f'<rect x="{x + 4}" y="{y + 7}" width="16" height="{h - 22}" rx="7" fill="{nail}"/>')
    return f"""
    <line x1="-150" y1="190" x2="-98" y2="78" stroke="{shade}" stroke-width="58" stroke-linecap="round"/>
    <line x1="-154" y1="182" x2="-100" y2="70" stroke="{skin}" stroke-width="54" stroke-linecap="round"/>
    <rect x="-116" y="48" width="22" height="30" rx="10" transform="rotate(25 -105 63)" fill="{nail}"/>
    {''.join(fingers)}
    """


# Person A (left, white iPhone) and person B (right, black Galaxy).
LEFT_SKIN = dict(skin="#f2b48c", shade="#d98d66", nail="#f9d3bb")
RIGHT_SKIN = dict(skin="#8d5636", shade="#6a3d25", nail="#b07a5a")
LEFT_SLEEVE = dict(sleeve="#ff7a59", sleeve_shade="#d9573a")
RIGHT_SLEEVE = dict(sleeve="#36a9e1", sleeve_shade="#1f80b5")

FONT = 'font-family="system-ui, -apple-system, Helvetica, Arial, sans-serif"'


def iphone_chrome(edge, ink):
    """Rounded body, side buttons on both edges, pill cut-out, home indicator."""
    return dict(
        buttons=f"""
    <rect x="-119" y="-130" width="6" height="44" rx="3" fill="{edge}"/>
    <rect x="-119" y="-70" width="6" height="64" rx="3" fill="{edge}"/>
    <rect x="113" y="-110" width="6" height="74" rx="3" fill="{edge}"/>""",
        body_rx=40, bezel=11, screen_rx=31,
        camera='<rect x="-30" y="-203" width="60" height="18" rx="9" fill="#0a0b10"/>',
        status=f'<text x="-80" y="-189" {FONT} font-size="12" font-weight="700" fill="{ink}">9:41</text>',
        nav=f'<rect x="-34" y="196" width="68" height="5" rx="2.5" fill="{ink}" opacity="0.5"/>',
    )


def galaxy_chrome(edge, ink):
    """Squarer body, thin even bezels, hole-punch camera, Android status bar,
    three-button navigation, volume and power both on the right edge."""
    battery = (
        f'<rect x="66" y="-200" width="18" height="9" rx="2" fill="none" stroke="{ink}" stroke-width="1.4"/>'
        f'<rect x="68" y="-198" width="12" height="5" rx="1" fill="{ink}"/>'
        f'<rect x="84.5" y="-197.5" width="2" height="4" rx="1" fill="{ink}"/>'
    )
    signal = "".join(
        f'<rect x="{44 + i * 4.5}" y="{-191 - (i + 1) * 2.5}" width="3" height="{(i + 1) * 2.5}" rx="0.8" fill="{ink}"/>'
        for i in range(4)
    )
    nav = (
        # recent apps (|||), home (rounded square), back (<) — Samsung's default order
        "".join(f'<rect x="{-62 + i * 5}" y="191" width="2.2" height="12" rx="1.1" fill="{ink}" opacity="0.7"/>' for i in range(3))
        + f'<rect x="-7" y="191" width="14" height="13" rx="4.5" fill="none" stroke="{ink}" stroke-width="2" opacity="0.7"/>'
        + f'<path d="M62 190.5 L55 197 L62 203.5" fill="none" stroke="{ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>'
    )
    return dict(
        buttons=f"""
    <rect x="113" y="-150" width="6" height="80" rx="3" fill="{edge}"/>
    <rect x="113" y="-50" width="6" height="40" rx="3" fill="{edge}"/>""",
        body_rx=20, bezel=7, screen_rx=14,
        camera='<circle cx="0" cy="-200" r="7" fill="#050608"/><circle cx="-1.8" cy="-201.8" r="1.8" fill="#2a3150"/>',
        status=f'<text x="-90" y="-191" {FONT} font-size="12" font-weight="600" fill="{ink}">9:41</text>{signal}{battery}',
        nav=nav,
    )


def phone_shell(theme, model, content, screen=None):
    """Phone body, bezel and system chrome around `content` (screen centred at 0,0)."""
    light = theme == "light"
    body = "url(#bodyLight)" if light else "url(#bodyDark)"
    edge = "#c3c9d6" if light else "#3a3d48"
    ink = "#1d2340" if light else "#eef1ff"
    if screen is None:
        screen = "#f3f5fb" if light else "#151a2c"
    c = (iphone_chrome if model == "iphone" else galaxy_chrome)(edge, ink)
    b = c["bezel"]
    return f"""{c['buttons']}
    <rect x="-115" y="-225" width="230" height="450" rx="{c['body_rx']}" fill="{body}" stroke="{edge}" stroke-width="3"/>
    <rect x="{-115 + b}" y="{-225 + b}" width="{230 - 2 * b}" height="{450 - 2 * b}" rx="{c['screen_rx']}" fill="{screen}"/>
    {c['camera']}
    {c['status']}
    {content}
    {c['nav']}
    """


def phone(theme, name, model="iphone"):
    light = theme == "light"
    card = "#ffffff" if light else "#222842"
    ink = "#1d2340" if light else "#eef1ff"
    muted = "#8a91a8" if light else "#8f97b8"
    accent = "#14a37f" if light else "#4ee6b8"
    track = "#e3e7f0" if light else "#2f3654"
    row = "#e6e9f2" if light else "#232a44"
    avatar = "#ffb347" if light else "#a78bfa"
    return phone_shell(theme, model, f"""
    <text x="-86" y="-146" font-family="system-ui, -apple-system, Helvetica, Arial, sans-serif" font-size="18" font-weight="800" fill="{ink}">Authenticator</text>
    <rect x="-90" y="-122" width="180" height="168" rx="18" fill="{card}"/>
    <circle cx="-62" cy="-89" r="15" fill="{avatar}"/>
    <text x="-62" y="-84" text-anchor="middle" font-family="system-ui, -apple-system, Helvetica, Arial, sans-serif" font-size="14" font-weight="800" fill="#ffffff">{name[0]}</text>
    <text x="-39" y="-94" font-family="system-ui, -apple-system, Helvetica, Arial, sans-serif" font-size="10.5" fill="{muted}">Shared Code with</text>
    <text x="-39" y="-78" font-family="system-ui, -apple-system, Helvetica, Arial, sans-serif" font-size="14" font-weight="700" fill="{ink}">{name}</text>
    <text x="0" y="-20" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="37" font-weight="800" fill="{accent}">{CODE}</text>
    <rect x="-70" y="12" width="140" height="7" rx="3.5" fill="{track}"/>
    <rect x="-70" y="12" width="92" height="7" rx="3.5" fill="{accent}"/>
    <rect x="-90" y="62" width="180" height="54" rx="14" fill="{row}"/>
    <rect x="-90" y="126" width="180" height="54" rx="14" fill="{row}" opacity="0.7"/>""")


def holder(cx, cy, angle, mirror, theme, name, skin, shade, nail, sleeve, sleeve_shade, model="iphone"):
    flip = ' transform="scale(-1 1)"' if mirror else ""
    return f"""
  <g transform="translate({cx} {cy}) rotate({angle})">
    <g{flip}>{hand_back(skin, shade, sleeve, sleeve_shade)}</g>
    {phone(theme, name, model)}
    <g{flip}>{hand_front(skin, shade, nail)}</g>
  </g>"""


DEFS = """<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#121848"/>
    <stop offset="1" stop-color="#2d2272"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#6b7cff" stop-opacity="0.55"/>
    <stop offset="0.6" stop-color="#6b7cff" stop-opacity="0.12"/>
    <stop offset="1" stop-color="#6b7cff" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="badgeGlow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#4ee6b8" stop-opacity="0.7"/>
    <stop offset="1" stop-color="#4ee6b8" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="bodyLight" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ffffff"/>
    <stop offset="1" stop-color="#dde2ec"/>
  </linearGradient>
  <linearGradient id="bodyDark" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#34363f"/>
    <stop offset="1" stop-color="#0c0d11"/>
  </linearGradient>
</defs>"""


def main():
    options = set(sys.argv[2:])
    # Link previews use 1200x630 (1.91:1), so the "og" option crops the top and bottom.
    view = (0, 50, 1200, 630) if "og" in options else (0, 0, W, H)
    out = []
    add = out.append

    add(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view[0]} {view[1]} {view[2]} {view[3]}" width="{view[2]}" height="{view[3]}" role="img" aria-labelledby="hero-title">')
    add('<title id="hero-title">Two hands holding phones, one white and one black, both showing the same code 482 913</title>')
    add(DEFS)
    add(f'<rect width="{W}" height="{H}" fill="url(#sky)"/>')
    add(f'<circle cx="600" cy="360" r="430" fill="url(#glow)"/>')
    add(stars())
    # floating shapes
    add('<circle cx="1085" cy="560" r="46" fill="#ff7a59" opacity="0.22"/>')
    add('<circle cx="120" cy="250" r="30" fill="#36a9e1" opacity="0.25"/>')
    add('<rect x="930" y="70" width="44" height="44" rx="10" transform="rotate(20 952 92)" fill="#ffd166" opacity="0.25"/>')

    # connection between the two codes
    add('<path d="M488 300 Q600 230 712 300" fill="none" stroke="#4ee6b8" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round" opacity="0.9"/>')
    add('<circle cx="600" cy="360" r="120" fill="url(#badgeGlow)"/>')
    add('<circle cx="600" cy="360" r="74" fill="none" stroke="#4ee6b8" stroke-width="2" stroke-dasharray="3 9" stroke-linecap="round" opacity="0.6"/>')
    add('<circle cx="600" cy="360" r="52" fill="#2fd49b"/>')
    add('<circle cx="600" cy="354" r="52" fill="#4ee6b8"/>')
    add('<path d="M576 355 L593 372 L626 337" fill="none" stroke="#0f3d34" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>')

    if "yellow" in options:
        # Cartoon yellow for both hands, so the picture doesn't imply anyone's race.
        left_skin = right_skin = dict(skin="#fed90f", shade="#e0b000", nail="#fff0a0")
    else:
        left_skin, right_skin = LEFT_SKIN, RIGHT_SKIN

    add(holder(355, 360, 7, False, "light", "Sam", **LEFT_SLEEVE, **left_skin))
    add(holder(845, 360, -7, True, "dark", "Alex", model="galaxy", **RIGHT_SLEEVE, **right_skin))
    add("</svg>")
    open(sys.argv[1], "w").write("\n".join(out))


if __name__ == "__main__":
    main()

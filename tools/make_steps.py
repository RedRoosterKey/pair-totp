"""Generate the wizard step illustrations in the same style as img/hero.svg.

Like make_hero.py, only SVG presentation attributes are used (no <style>).

Usage, from the repository root:
    python3 tools/make_steps.py img
writes img/step-name-a.svg, step-name-b.svg, step-secret.svg, step-scan-a.svg,
step-scan-b.svg and step-done.svg.
"""
import os
import random
import sys

from make_hero import (
    DEFS, FONT, LEFT_SKIN, LEFT_SLEEVE, RIGHT_SKIN, RIGHT_SLEEVE,
    hand_back, hand_front, phone_shell, stars,
)

W, H = 1200, 540
MINT, MINT_SHADE, MINT_INK = "#4ee6b8", "#2fd49b", "#0f3d34"
YELLOW = "#ffd166"
MONO = 'font-family="ui-monospace, Menlo, Consolas, monospace"'


def scene(title, body, seed, sparkles):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-labelledby="t">
<title id="t">{title}</title>
{DEFS}
<rect width="{W}" height="{H}" fill="url(#sky)"/>
<circle cx="600" cy="270" r="380" fill="url(#glow)"/>
{stars(W, H, seed, sparkles)}
{body}
</svg>
"""


def floaters(*items):
    """Faint background shapes: ("c", x, y, r, colour) or ("s", x, y, size, colour)."""
    parts = []
    for kind, x, y, r, colour in items:
        if kind == "c":
            parts.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{colour}" opacity="0.22"/>')
        else:
            parts.append(f'<rect x="{x - r / 2}" y="{y - r / 2}" width="{r}" height="{r}" rx="{r / 4.4:.0f}" '
                         f'transform="rotate(20 {x} {y})" fill="{colour}" opacity="0.25"/>')
    return "\n".join(parts)


def badge(cx, cy, r, inner):
    """Mint disc with a darker lip and a glow, like the hero's check mark."""
    return f"""
<circle cx="{cx}" cy="{cy}" r="{r * 2.3:.0f}" fill="url(#badgeGlow)"/>
<circle cx="{cx}" cy="{cy}" r="{r * 1.42:.0f}" fill="none" stroke="{MINT}" stroke-width="2" stroke-dasharray="3 9" stroke-linecap="round" opacity="0.6"/>
<circle cx="{cx}" cy="{cy}" r="{r}" fill="{MINT_SHADE}"/>
<circle cx="{cx}" cy="{cy - r * 0.11:.1f}" r="{r}" fill="{MINT}"/>
<g transform="translate({cx} {cy - r * 0.11:.1f})">{inner}</g>"""


# --- Steps 2 and 3: name tag ------------------------------------------------

def name_tag(colour, shade):
    w, h = 460, 300
    x, y = -w / 2, -h / 2
    return f"""
  <rect x="{x + 10}" y="{y + 16}" width="{w}" height="{h}" rx="28" fill="#070a24" opacity="0.4"/>
  <rect x="{x}" y="{y + 6}" width="{w}" height="{h}" rx="28" fill="{shade}"/>
  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="28" fill="{colour}"/>
  <text x="0" y="{y + 62}" text-anchor="middle" {FONT} font-size="54" font-weight="900" letter-spacing="6" fill="#ffffff">HELLO</text>
  <text x="0" y="{y + 92}" text-anchor="middle" {FONT} font-size="21" font-weight="700" letter-spacing="1" fill="#ffffff">my name is</text>
  <rect x="{x + 20}" y="{y + 110}" width="{w - 40}" height="{h - 146}" rx="12" fill="#ffffff"/>"""


def marker(colour):
    """Felt-tip pen with its cap pushed on the back, pointing left. Local origin at the tip."""
    return f"""
  <rect x="8" y="-21" width="250" height="42" rx="12" fill="#070a24" opacity="0.35" transform="translate(6 10)"/>
  <path d="M0 -5 L26 -14 L26 14 L0 5 Z" fill="#2a2f45"/>
  <rect x="-6" y="-5" width="10" height="10" rx="3" fill="#1d2340"/>
  <rect x="24" y="-17" width="30" height="34" rx="5" fill="#d7dbe6"/>
  <rect x="50" y="-21" width="160" height="42" rx="10" fill="#2a2f45"/>
  <rect x="50" y="-21" width="160" height="12" rx="6" fill="#3d4360"/>
  <rect x="96" y="-14" width="70" height="28" rx="5" fill="#ffffff" opacity="0.9"/>
  <rect x="108" y="-5" width="46" height="10" rx="5" fill="{colour}"/>
  <rect x="200" y="-23" width="60" height="46" rx="12" fill="{colour}"/>
  <rect x="204" y="-23" width="52" height="12" rx="6" fill="#ffffff" opacity="0.25"/>"""


def writing_hand(skin, shade, nail, sleeve, sleeve_shade, pen):
    """A hand gripping the marker, drawn in the pen's frame: tip at 0,0, pen along +x.
    The hand sits on the +y side; the arm leaves towards +y, angled back towards the tip."""
    def blob(fill, dx=0, dy=0):
        return f"""<g transform="translate({dx} {dy})">
      <ellipse cx="118" cy="56" rx="78" ry="60" transform="rotate(20 118 56)" fill="{fill}"/>
      <circle cx="66" cy="34" r="20" fill="{fill}"/>
      <circle cx="88" cy="56" r="21" fill="{fill}"/>
      <circle cx="112" cy="74" r="21" fill="{fill}"/>
    </g>"""

    return f"""
  <line x1="118" y1="60" x2="40" y2="300" stroke="{skin}" stroke-width="104" stroke-linecap="round"/>
  <line x1="72" y1="140" x2="30" y2="270" stroke="{shade}" stroke-width="22" stroke-linecap="round" transform="translate(36 10)"/>
  <line x1="47" y1="278" x2="-161" y2="915" stroke="{sleeve}" stroke-width="150"/>
  <line x1="47" y1="278" x2="41" y2="297" stroke="{sleeve_shade}" stroke-width="156"/>
  {blob(shade, 5, 6)}
  {blob(skin)}
  {marker(pen)}
  <line x1="150" y1="-4" x2="58" y2="-14" stroke="{shade}" stroke-width="30" stroke-linecap="round" transform="translate(3 4)"/>
  <line x1="150" y1="-4" x2="58" y2="-14" stroke="{skin}" stroke-width="28" stroke-linecap="round"/>
  <rect x="48" y="-26" width="22" height="16" rx="7" fill="{nail}"/>
  <line x1="138" y1="40" x2="70" y2="16" stroke="{shade}" stroke-width="32" stroke-linecap="round" transform="translate(3 4)"/>
  <line x1="138" y1="40" x2="70" y2="16" stroke="{skin}" stroke-width="30" stroke-linecap="round"/>
  <rect x="60" y="5" width="20" height="17" rx="7" transform="rotate(20 70 13)" fill="{nail}"/>"""


def step_name(colour, shade, left):
    tilt = -5 if left else 5
    skin, sleeve = (LEFT_SKIN, LEFT_SLEEVE) if left else (RIGHT_SKIN, RIGHT_SLEEVE)
    # The tag sits away from the writing hand so "HELLO my name is" stays clear,
    # and the pen tip hovers over the empty white area, ready to write.
    tag_x = 650 if left else 550
    tip_x, tip_y = (520, 300) if left else (680, 300)
    flip = "scale(-1 1) " if left else ""
    body = floaters(("c", 1085, 430, 40, colour), ("c", 120, 150, 28, MINT), ("s", 960, 80, 40, YELLOW))
    body += f"""
<g transform="translate({tag_x} 270) rotate({tilt})">{name_tag(colour, shade)}</g>
<ellipse cx="{tip_x + (6 if left else -6)}" cy="{tip_y + 22}" rx="16" ry="5" fill="#1d2340" opacity="0.18"/>
<g transform="translate({tip_x} {tip_y}) {flip}rotate(-55) scale(0.9)">{writing_hand(**skin, **sleeve, pen=colour)}</g>"""
    who = "Person A" if left else "Person B"
    return scene(f'A hand holding a marker, about to write a name on a blank "Hello, my name is" tag, for {who}',
                 body, 11 if left else 12, ((150, 90, 9), (1050, 120, 11), (200, 470, 7), (1010, 470, 8)))


# --- Step 4: one secret, two people ----------------------------------------

def key(fill, hole):
    """Old-style key pointing right, centred roughly on 0,0."""
    return f"""
  <circle cx="-42" cy="0" r="30" fill="{fill}"/>
  <circle cx="-42" cy="0" r="12" fill="{hole}"/>
  <rect x="-16" y="-8" width="82" height="16" rx="5" fill="{fill}"/>
  <rect x="34" y="4" width="14" height="22" rx="3" fill="{fill}"/>
  <rect x="54" y="4" width="12" height="16" rx="3" fill="{fill}"/>"""


def person(cx, cy, colour, shade):
    return f"""
<circle cx="{cx}" cy="{cy + 6}" r="62" fill="{shade}"/>
<circle cx="{cx}" cy="{cy}" r="62" fill="{colour}"/>
<circle cx="{cx}" cy="{cy - 16}" r="20" fill="#ffffff"/>
<path d="M{cx - 34} {cy + 34} Q{cx - 34} {cy + 6} {cx} {cy + 6} Q{cx + 34} {cy + 6} {cx + 34} {cy + 34} Z" fill="#ffffff"/>"""


def step_secret():
    rnd = random.Random(32)
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
    glyphs = []
    placed = 0
    while placed < 46:
        x, y = rnd.uniform(330, 870), rnd.uniform(40, 500)
        if (x - 600) ** 2 + ((y - 270) * 1.25) ** 2 < 170 ** 2:
            continue
        if abs(y - 270) < 40:  # keep the beams clear
            continue
        size = rnd.choice([18, 22, 26, 30, 36])
        colour = rnd.choice([MINT, "#ffffff", "#b9c2ff"])
        glyphs.append(f'<text x="{x:.0f}" y="{y:.0f}" text-anchor="middle" {MONO} font-size="{size}" '
                      f'font-weight="800" fill="{colour}" opacity="{rnd.uniform(0.2, 0.6):.2f}">{rnd.choice(alphabet)}</text>')
        placed += 1

    beams = "".join(
        f'<path d="M{a} 270 Q{(a + b) / 2} {230} {b} 270" fill="none" stroke="{MINT}" stroke-width="4" '
        f'stroke-dasharray="2 12" stroke-linecap="round" opacity="0.9"/>'
        for a, b in ((300, 470), (730, 900))
    )
    travellers = "".join(
        f'<g transform="translate({x} 247) scale(0.42)">{key(MINT, "#1f2160")}</g>' for x in (392, 808)
    )
    body = floaters(("c", 1090, 460, 36, "#ff7a59"), ("c", 110, 110, 26, "#36a9e1"), ("s", 930, 70, 40, YELLOW))
    body += "\n" + "\n".join(glyphs)
    body += f"""
<circle cx="600" cy="270" r="210" fill="none" stroke="#b9c2ff" stroke-width="2" stroke-dasharray="1 14" stroke-linecap="round" opacity="0.5"/>
{beams}
{travellers}
{badge(600, 270, 92, f'<g transform="rotate(-30) scale(1.2)">{key(MINT_INK, MINT)}</g>')}
{person(230, 270, "#ff7a59", "#d9573a")}
{person(970, 270, "#36a9e1", "#1f80b5")}"""
    return scene("A glowing key made of random letters, shared between two people", body, 13,
                 ((150, 440, 8), (1060, 140, 11), (600, 40, 8), (1000, 500, 7)))


# --- Steps 5 and 6: scanning the QR code -----------------------------------

def fake_qr(seed, x, y, size, modules=25):
    """A QR-looking pattern (it doesn't decode). Returns one path, dark on transparent."""
    rnd = random.Random(seed)
    m = size / modules
    cells = set()
    for r in range(modules):
        for c in range(modules):
            if rnd.random() < 0.5:
                cells.add((r, c))
    finders = ((0, 0), (0, modules - 7), (modules - 7, 0))
    for fr, fc in finders:
        for r in range(-1, 8):
            for c in range(-1, 8):
                cells.discard((fr + r, fc + c))
        for r in range(7):
            for c in range(7):
                edge = r in (0, 6) or c in (0, 6)
                core = 2 <= r <= 4 and 2 <= c <= 4
                if edge or core:
                    cells.add((fr + r, fc + c))
    d = "".join(f"M{x + c * m:.2f} {y + r * m:.2f}h{m:.2f}v{m:.2f}h{-m:.2f}z" for r, c in sorted(cells))
    return f'<path d="{d}" fill="#111522"/>'


def brackets(x, y, w, h, arm, colour, width):
    pts = ((x, y, 1, 1), (x + w, y, -1, 1), (x, y + h, 1, -1), (x + w, y + h, -1, -1))
    return "".join(
        f'<path d="M{px} {py + sy * arm} V{py} H{px + sx * arm}" fill="none" stroke="{colour}" '
        f'stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"/>'
        for px, py, sx, sy in pts
    )


def laptop(cx, cy, seed):
    sw, sh = 420, 270
    x, y = cx - sw / 2, cy - sh / 2
    qx, qy, qs = cx - 75, y + 76, 150
    return f"""
<rect x="{x - 14}" y="{y - 14}" width="{sw + 28}" height="{sh + 28}" rx="20" fill="#2a2d3c" stroke="#3a3d48" stroke-width="3"/>
<rect x="{x}" y="{y}" width="{sw}" height="{sh}" rx="6" fill="#f4f5f7"/>
<rect x="{cx - 110}" y="{y + 16}" width="220" height="{sh - 16}" rx="10" fill="#ffffff"/>
<rect x="{cx - 92}" y="{y + 32}" width="120" height="12" rx="6" fill="#1d2340"/>
<rect x="{cx - 92}" y="{y + 52}" width="170" height="8" rx="4" fill="#c7ccd8"/>
<rect x="{qx - 6}" y="{qy - 6}" width="{qs + 12}" height="{qs + 12}" fill="#ffffff"/>
{fake_qr(seed, qx, qy, qs)}
{brackets(qx - 18, qy - 18, qs + 36, qs + 36, 26, MINT, 6)}
<line x1="{qx - 10}" y1="{qy + qs * 0.62:.0f}" x2="{qx + qs + 10}" y2="{qy + qs * 0.62:.0f}" stroke="{MINT}" stroke-width="4" stroke-linecap="round" opacity="0.85"/>
<path d="M{x - 60} {y + sh + 14} H{x + sw + 60} L{x + sw + 30} {y + sh + 40} H{x - 30} Z" fill="#c3c9d6"/>
<path d="M{x - 60} {y + sh + 14} H{x + sw + 60} L{x + sw + 56} {y + sh + 22} H{x - 56} Z" fill="#e6e9f2"/>
<rect x="{cx - 40}" y="{y + sh + 14}" width="80" height="8" rx="4" fill="#a9b0c2"/>"""


def camera_screen(seed):
    """What the phone sees: the laptop's QR code inside a viewfinder."""
    return f"""
    <rect x="-104" y="-214" width="208" height="428" rx="14" fill="#0d1020" opacity="0.92"/>
    <text x="0" y="-150" text-anchor="middle" {FONT} font-size="15" font-weight="700" fill="#ffffff">Scan a QR code</text>
    <rect x="-96" y="-118" width="192" height="230" rx="8" fill="#1d2134"/>
    <rect x="-80" y="-100" width="160" height="194" rx="6" fill="#e9ebf0" opacity="0.85"/>
    <rect x="-62" y="-66" width="124" height="124" fill="#ffffff"/>
    {fake_qr(seed, -56, -60, 112)}
    {brackets(-76, -80, 152, 152, 24, MINT, 5)}
    <line x1="-66" y1="8" x2="66" y2="8" stroke="{MINT}" stroke-width="3" stroke-linecap="round"/>
    <rect x="-70" y="138" width="140" height="34" rx="17" fill="#ffffff" opacity="0.14"/>
    <text x="0" y="160" text-anchor="middle" {FONT} font-size="12.5" font-weight="600" fill="#ffffff">Hold steady…</text>"""


def scanning_hand(cx, cy, angle, mirror, theme, model, skin, shade, nail, sleeve, sleeve_shade, seed):
    flip = ' transform="scale(-1 1)"' if mirror else ""
    return f"""
<g transform="translate({cx} {cy}) rotate({angle}) scale(0.92)">
  <g{flip}>{hand_back(skin, shade, sleeve, sleeve_shade)}</g>
  {phone_shell(theme, model, camera_screen(seed), screen="#0d1020")}
  <g{flip}>{hand_front(skin, shade, nail)}</g>
</g>"""


def step_scan(left):
    seed = 5 if left else 6
    if left:
        phone = scanning_hand(345, 300, 8, False, "light", "iphone", **LEFT_SKIN, **LEFT_SLEEVE, seed=seed)
        lap_x, beam = 830, "M470 120 Q640 40 780 150"
        who, phone_desc = "white iPhone", "Person A"
    else:
        phone = scanning_hand(855, 300, -8, True, "dark", "galaxy", **RIGHT_SKIN, **RIGHT_SLEEVE, seed=seed)
        lap_x, beam = 370, "M730 120 Q560 40 420 150"
        who, phone_desc = "black Android phone", "Person B"
    body = floaters(("c", 1100, 470, 36, "#ff7a59"), ("c", 100, 90, 26, "#36a9e1"), ("s", 600, 470, 36, YELLOW))
    body += f"""
{laptop(lap_x, 245, seed)}
<path d="{beam}" fill="none" stroke="{MINT}" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round" opacity="0.9"/>
{phone}"""
    return scene(f"A hand holding a {who} up to scan a QR code on a laptop screen, for {phone_desc}", body, 14 if left else 15,
                 ((600, 60, 9), (1080, 110, 10), (110, 480, 7), (640, 500, 7)))


# --- Step 7: high five ------------------------------------------------------

def open_hand(skin, shade, sleeve, sleeve_shade):
    """Raised open hand, palm towards the viewer, wrist at 0,0, fingers up, thumb on the left."""
    fingers = ((-42, 98), (-14, 112), (14, 104), (42, 84))

    def shape(fill):
        return f"""
    <line x1="-54" y1="-34" x2="-112" y2="-104" stroke="{fill}" stroke-width="36" stroke-linecap="round"/>
    {''.join(f'<line x1="{x}" y1="-110" x2="{x}" y2="{-110 - n}" stroke="{fill}" stroke-width="26" stroke-linecap="round"/>' for x, n in fingers)}
    <rect x="-64" y="-150" width="128" height="160" rx="50" fill="{fill}"/>"""

    return f"""
    <line x1="0" y1="40" x2="0" y2="700" stroke="{skin}" stroke-width="96" stroke-linecap="round"/>
    <line x1="30" y1="60" x2="30" y2="700" stroke="{shade}" stroke-width="24" stroke-linecap="round"/>
    <line x1="0" y1="190" x2="0" y2="900" stroke="{sleeve}" stroke-width="156"/>
    <line x1="0" y1="190" x2="0" y2="212" stroke="{sleeve_shade}" stroke-width="164"/>
    <line x1="48" y1="240" x2="48" y2="900" stroke="{sleeve_shade}" stroke-width="36"/>
    <g transform="translate(6 6)">{shape(shade)}</g>
    {shape(skin)}
    <path d="M-30 -60 Q0 -40 34 -62" fill="none" stroke="{shade}" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
    <path d="M-40 -20 Q-10 0 22 -8" fill="none" stroke="{shade}" stroke-width="5" stroke-linecap="round" opacity="0.6"/>"""


def burst(cx, cy):
    rays = []
    for i in range(7):
        a = -75 + i * 25
        rays.append(f'<line x1="0" y1="-78" x2="0" y2="-118" stroke="{YELLOW if i % 2 else MINT}" stroke-width="9" '
                    f'stroke-linecap="round" transform="rotate({a})"/>')
    return f'<g transform="translate({cx} {cy})">{"".join(rays)}</g>'


def confetti(seed):
    rnd = random.Random(seed)
    colours = ["#ff7a59", "#36a9e1", YELLOW, MINT, "#b9c2ff"]
    parts = []
    for _ in range(38):
        x, y = rnd.uniform(60, 1140), rnd.uniform(30, 510)
        if abs(x - 600) < 280 and y > 60:
            continue
        w, h, a = rnd.choice([(14, 6), (10, 10), (16, 5)]) + (rnd.uniform(0, 180),)
        parts.append(f'<rect x="{x - w / 2:.0f}" y="{y - h / 2:.0f}" width="{w}" height="{h}" rx="2" '
                     f'transform="rotate({a:.0f} {x:.0f} {y:.0f})" fill="{rnd.choice(colours)}" opacity="0.85"/>')
    return "\n".join(parts)


def step_done():
    left = open_hand(**{k: LEFT_SKIN[k] for k in ("skin", "shade")}, **LEFT_SLEEVE)
    right = open_hand(**{k: RIGHT_SKIN[k] for k in ("skin", "shade")}, **RIGHT_SLEEVE)
    body = floaters(("c", 1090, 120, 34, MINT), ("c", 110, 130, 28, YELLOW))
    body += f"""
{confetti(77)}
{burst(600, 200)}
<g transform="translate(470 370) rotate(32)">{left}</g>
<g transform="translate(730 370) rotate(-32) scale(-1 1)">{right}</g>"""
    return scene("Two hands meeting in a high five, with confetti", body, 16,
                 ((140, 470, 8), (1060, 440, 10), (600, 40, 9)))


def main():
    out_dir = sys.argv[1]
    files = {
        "step-name-a.svg": step_name("#ff7a59", "#d9573a", True),
        "step-name-b.svg": step_name("#36a9e1", "#1f80b5", False),
        "step-secret.svg": step_secret(),
        "step-scan-a.svg": step_scan(True),
        "step-scan-b.svg": step_scan(False),
        "step-done.svg": step_done(),
    }
    for name, svg in files.items():
        with open(os.path.join(out_dir, name), "w") as f:
            f.write(svg)


if __name__ == "__main__":
    main()

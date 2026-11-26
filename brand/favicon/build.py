# Pixel favicon concepts on a 16x16 grid, written as 256x256 SVG (1 cell = 16 units).
import sys
PAL = {
 'K': '#2a1a1e',  # outline ink (logo outline)
 'W': '#f3ede0',  # card stock
 'R': '#e03c3c',  # heart red
 'O': '#c8602a',  # diamond orange
 'S': '#1a1013',  # hard drop shadow
 'U': '#b8442e',  # rust (wordmark)
 'L': '#e08a3a',  # orange outline (wordmark)
 'D': '#2d2640',  # balatro panel purple
}
def svg(rows, name):
    assert len(rows)==16 and all(len(r)==16 for r in rows), name
    paths={}
    for y,r in enumerate(rows):
        x=0
        while x<16:
            c=r[x]
            if c=='.': x+=1; continue
            x0=x
            while x<16 and r[x]==c: x+=1
            paths.setdefault(c,[]).append(f"M{x0*16} {y*16}h{(x-x0)*16}v16h-{(x-x0)*16}z")
    body=''.join(f'<path fill="{PAL[c]}" d="{"".join(d)}"/>' for c,d in paths.items())
    open(name,'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" shape-rendering="crispEdges">{body}</svg>\n')

# A — one card, the red ten's heart, hard Balatro shadow
A=[
"................",
"...KKKKKKKKK....",
"...KWWWWWWWKS...",
"...KWRWWWWWKS...",
"...KWWWWWWWKS...",
"...KWRRWRRWKS...",
"...KRRRRRRRKS...",
"...KRRRRRRRKS...",
"...KWRRRRRWKS...",
"...KWWRRRWWKS...",
"...KWWWRWWWKS...",
"...KWWWWWWWKS...",
"...KWWWWWRWKS...",
"...KWWWWWWWKS...",
"...KKKKKKKKKS...",
"....SSSSSSSSS...",
]
# B — the logo's pair: 10 of diamonds behind, 10 of hearts in front
B=[
"......KKKKKKKKK.",
"......KWWWWWWWK.",
"......KWWWWWOWK.",
"......KWWWWOOOK.",
".KKKKKKKKKWOOOK.",
".KWWWWWWWKWOOOK.",
".KWRWRWWWKWWOWK.",
".KRRRRRWWKWWWWK.",
".KRRRRRWWKWWWWK.",
".KWRRRWWWKKKKKK.",
".KWWRWWWWKS.....",
".KWWWWWWWKS.....",
".KWWWWWWWKS.....",
".KWWWWWWWKS.....",
".KKKKKKKKKS.....",
"..SSSSSSSSS.....",
]
# C — "10" in the wordmark's rust with orange outline, on a Balatro purple tile
C=[
"..DDDDDDDDDDDD..",
".DDDDDDDDDDDDDD.",
"DDDDDDDDDDDDDDDD",
"DDDDLLDDLLLLLDDD",
"DDDLULDLUUUUULDD",
"DDLUULDLULLLULDD",
"DDDLULDLULDLULDD",
"DDDLULDLULDLULDD",
"DDDLULDLULDLULDD",
"DDDLULDLULDLULDD",
"DDDLULDLULLLULDD",
"DDLUUULLUUUUULDD",
"DDDLLLDDLLLLLDDD",
"DDDDDDDDDDDDDDDD",
".DDDDDDDDDDDDDD.",
"..DDDDDDDDDDDD..",
]
svg(A,'a-card.svg'); svg(B,'b-pair.svg'); svg(C,'c-ten.svg')
print('ok')

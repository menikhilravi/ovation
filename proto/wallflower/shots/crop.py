import sys, json, glob, os
from PIL import Image
# usage: crop.py dir cx cy halfw halfh scale
d, cx, cy, hw, hh, sc = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), float(sys.argv[6])
files = sorted(f for f in glob.glob(os.path.join(d, '*.png')) if '_z' not in f and 'sheet' not in f)
tiles = []
for f in files:
    im = Image.open(f)
    s = im.size[0] / 1440 if im.size[0] > 1500 else 1
    c = im.crop((int((cx-hw)*s), int((cy-hh)*s), int((cx+hw)*s), int((cy+hh)*s))).resize((int(2*hw*sc), int(2*hh*sc)), Image.LANCZOS)
    tiles.append((os.path.basename(f), c))
cols = min(4, len(tiles)); rows = (len(tiles)+cols-1)//cols
tw, th = tiles[0][1].size
sheet = Image.new('RGB', (cols*tw, rows*th), (0,0,0))
for i,(n,t) in enumerate(tiles): sheet.paste(t, ((i%cols)*tw, (i//cols)*th))
sheet.save(os.path.join(d, 'sheet.png')); print(len(tiles), 'tiles', [n for n,_ in tiles])

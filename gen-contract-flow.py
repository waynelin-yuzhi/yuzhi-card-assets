from PIL import Image, ImageDraw, ImageFont
import math, os, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
FONT = '/System/Library/AssetsV2/com_apple_MobileAsset_Font8/86ba2c91f017a3749571a82f2c6d890ac7ffb2fb.asset/AssetData/PingFang.ttc'
def font(size, weight='semibold'):
    idx = {'regular': 2, 'medium': 6, 'semibold': 10}[weight]
    return ImageFont.truetype(FONT, size, index=idx)

W, H = 1170, 570            # LINE hero 39:19（@2x）
BG = '#F1ECE1'; MOSS = '#5F6E58'; MOSS_DK = '#4A5743'; AMBER = '#B8862C'; INK = '#2D342A'
MUTED = '#8A8275'; LINE = '#CFD3C7'; PAPER = '#FFFCF5'; FUTURE = '#B4BAAE'

STEPS = ['線上簽名', '植間用印', '貴司用印', '寄回植間']
STATES = {
    1: {'badge': '請先線上簽名',      'foot': '線上簽名即成立，紙本由植間用印後寄出'},
    2: {'badge': '植間用印中',        'foot': '已簽名，植間用印後寄出一式兩份'},
    3: {'badge': '請用印、寄回一份',  'foot': '收到紙本後用印，留一份、寄回一份'},
    4: {'badge': '流程完成',          'foot': '紙本已寄回，感謝您'},
}

def draw_check(d, cx, cy, r, color):
    # 打勾：兩段線
    pts = [(cx - r*0.42, cy + r*0.02), (cx - r*0.12, cy + r*0.34), (cx + r*0.46, cy - r*0.36)]
    d.line(pts, fill=color, width=int(r*0.22), joint='curve')
    for p in pts: d.ellipse([p[0]-r*0.11, p[1]-r*0.11, p[0]+r*0.11, p[1]+r*0.11], fill=color)

def render(stage):
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    # 左上標籤
    tag = '植間｜合約簽署流程'
    f_tag = font(30)
    tw = d.textlength(tag, font=f_tag)
    d.rectangle([0, 0, tw + 64, 74], fill=MOSS_DK)
    d.text((32, 18), tag, font=f_tag, fill=PAPER)

    cxs = [175, 448, 722, 995]; cy = 318; r = 66
    done_n = 4 if stage == 4 else stage - 1
    cur = None if stage == 4 else stage
    # 箭頭
    for i in range(3):
        x1 = cxs[i] + r + 22; x2 = cxs[i+1] - r - 22
        col = MOSS if i + 1 <= done_n else LINE
        d.line([(x1, cy), (x2 - 26, cy)], fill=col, width=5)
        head = MOSS if i + 1 <= done_n else '#9AA394'
        d.polygon([(x2 - 30, cy - 17), (x2, cy), (x2 - 30, cy + 17)], fill=head)
    # 圓與標籤
    f_num = font(56); f_lb = font(40); f_lb_m = font(40, 'medium')
    for i, cx in enumerate(cxs):
        n = i + 1
        if n <= done_n:
            d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=MOSS, outline=MOSS, width=6)
            draw_check(d, cx, cy, r, PAPER)
            lab_col, lab_f = INK, f_lb
        elif n == cur:
            d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=PAPER, outline=AMBER, width=7)
            t = str(n); tw = d.textlength(t, font=f_num)
            d.text((cx, cy + 2), t, font=f_num, fill=AMBER, anchor='mm')
            lab_col, lab_f = INK, f_lb
            # 琥珀小標
            f_b = font(26); bt = STATES[stage]['badge']; bw = d.textlength(bt, font=f_b) + 56
            bx = min(max(cx - bw/2, 24), W - bw - 24); by = cy - r - 96
            d.rounded_rectangle([bx, by, bx + bw, by + 54], radius=27, fill=AMBER)
            d.text((bx + 28, by + 12), bt, font=f_b, fill=PAPER)
            # 小三角指向圓
            d.polygon([(cx - 12, by + 54), (cx + 12, by + 54), (cx, by + 68)], fill=AMBER)
        else:
            d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=PAPER, outline=FUTURE, width=6)
            t = str(n); tw = d.textlength(t, font=f_num)
            d.text((cx, cy + 2), t, font=f_num, fill=FUTURE, anchor='mm')
            lab_col, lab_f = MUTED, f_lb_m
        lab = STEPS[i]; lw = d.textlength(lab, font=lab_f)
        d.text((cx - lw/2, cy + r + 30), lab, font=lab_f, fill=lab_col)
    if stage == 4:
        f_b = font(26); bt = STATES[4]['badge']; bw = d.textlength(bt, font=f_b) + 56
        cx = cxs[3]; bx = min(cx - bw/2, W - bw - 24); by = cy - r - 96
        d.rounded_rectangle([bx, by, bx + bw, by + 54], radius=27, fill=MOSS)
        d.text((bx + 28, by + 12), bt, font=f_b, fill=PAPER)
        d.polygon([(cx - 12, by + 54), (cx + 12, by + 54), (cx, by + 68)], fill=MOSS)
    # 底部一句
    f_ft = font(27, 'regular'); ft = STATES[stage]['foot']; fw = d.textlength(ft, font=f_ft)
    d.text(((W - fw)/2, 505), ft, font=f_ft, fill=MUTED)
    path = os.path.join(OUT, 'contract-flow-%d.png' % stage)
    img.save(path, optimize=True)
    return path

for s in (1, 2, 3, 4):
    print(render(s))

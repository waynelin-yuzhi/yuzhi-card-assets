#!/usr/bin/env python3
# 從 Express 範例縮圖做去字底圖：只換掉「字的筆畫」像素（不是整塊長方形，否則印出來每塊都是沒紙紋的框）
# 補法＝周邊光影（遮罩外正規化卷積）＋附近乾淨紙紋平移複製（高頻、夾在紙紋自身範圍內）
# 用法：python3 make-bg.py <範例縮圖.png> <輸出.png>
import sys
from PIL import Image
import numpy as np
from scipy import ndimage as ndi
srcp, outp = sys.argv[1], sys.argv[2]
src=np.array(Image.open(srcp).convert('RGB')).astype(float); H,W,_=src.shape
lum=src.mean(axis=2)
bgl=ndi.median_filter(lum,size=11)
# 文字所在區（600×452 座標）：左上祝詞、中央主句、右下署名、框下品牌列
regions=[(42,80,372,124),(48,160,552,300),(140,348,552,404),(150,428,462,451)]
mask=np.zeros((H,W),bool); inreg=np.zeros((H,W),bool)
for x0,y0,x1,y1 in regions:
    inreg[y0:y1,x0:x1]=True
    sl=(slice(y0,y1),slice(x0,x1))
    mask[sl]|=(lum[sl]<214)|((bgl[sl]-lum[sl])>9)
leafzone=ndi.binary_dilation((lum<200)&~inreg,iterations=5)   # 葉子與框線：不擦、也不拿來當紙紋
mask=ndi.binary_dilation(mask&~leafzone,iterations=3)&~leafzone
w=((~mask)&(~leafzone)&(lum>=205)).astype(float)   # 光影只取乾淨紙面、不讓葉子的深色滲進來
def lowpass(ch,s):
    num=ndi.gaussian_filter(ch*w,s); den=ndi.gaussian_filter(w,s); return num/np.maximum(den,1e-6)
low=np.stack([lowpass(src[:,:,c],10) for c in range(3)],axis=2)
hp=src-low
validsrc=(~ndi.binary_dilation(mask,iterations=2))&(~leafzone)&(lum>=214)
lo,hi=np.percentile(hp[validsrc&inreg].mean(axis=1),[1,99]); hp=np.clip(hp,lo,hi)
fill=np.zeros_like(src); have=np.zeros((H,W),bool)
ds=[26,48,70,95,120,150]
shifts=[(0,s*d) for d in ds for s in (1,-1)]+[(s*d,0) for d in (40,80,120,160,200) for s in (1,-1)]+[(sx*dx,sy*dy) for dx in (33,66,99,140) for dy in (36,72,110) for sx in (1,-1) for sy in (1,-1)]
for dx,dy in shifts:
    sh_hp=np.roll(np.roll(hp,dy,0),dx,1); sh_v=np.roll(np.roll(validsrc,dy,0),dx,1)
    ok=mask&~have&sh_v; fill[ok]=sh_hp[ok]; have|=ok
left=mask&~have
if left.any():
    pool=hp[validsrc&inreg]; idx=np.random.default_rng(1).integers(0,len(pool),int(left.sum())); fill[left]=pool[idx]
soft=ndi.gaussian_filter(mask.astype(float),1.0)[:,:,None]
out=src*(1-soft)+(low+fill)*soft
img=Image.fromarray(np.clip(out,0,255).astype(np.uint8))
img.save(outp.replace('.png','-600.png'))
big=img.resize((2400,1808),Image.LANCZOS); b=np.array(big).astype(float)
b=np.clip(b+np.random.default_rng(5).normal(0,1.4,b.shape[:2])[:,:,None],0,255).astype(np.uint8)
Image.fromarray(b).save(outp)
print({'masked':int(mask.sum()),'fallback':int(left.sum())})

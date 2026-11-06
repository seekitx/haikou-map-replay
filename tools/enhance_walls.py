"""Conservative wall visualization from the reconstructed occupancy raster.
Output encodes kept observations as 128 and newly inferred cells as 255.
Processing affects only display, never the original data or navigation maps.
"""
from pathlib import Path
import json, struct, zlib
import numpy as np
from scipy import ndimage

root = Path(__file__).resolve().parent.parent
image = (root / 'assets/map.png').read_bytes()
pos = 8; blocks = []
while pos < len(image):
    length = struct.unpack('>I', image[pos:pos+4])[0]
    kind = image[pos+4:pos+8]; value = image[pos+8:pos+8+length]; pos += length+12
    if kind == b'IHDR': width, height, depth, color, *_ = struct.unpack('>IIBBBBB', value)
    if kind == b'IDAT': blocks.append(value)
    if kind == b'IEND': break
if (depth, color) != (8, 0): raise ValueError('Expected a grayscale source image')
rows = np.frombuffer(zlib.decompress(b''.join(blocks)), dtype=np.uint8).reshape(height,width+1)
if np.any(rows[:,0]): raise ValueError('Unexpected PNG row filters')
pixels=rows[:,1:]
# 2x2 source pixels per display cell: each cell spans 10 cm.
source=pixels < 78
pad=np.pad(source,((0,height%2),(0,width%2)),constant_values=False)
raw=pad.reshape(pad.shape[0]//2,2,pad.shape[1]//2,2).any(axis=(1,3))
labels,count=ndimage.label(raw, structure=np.ones((3,3),dtype=bool))
sizes=np.bincount(labels.ravel());keep=(sizes>=3);keep[0]=False
clean=keep[labels]
# A one-cell radius local closing bridges tiny breaks; preserve the cleaned observations.
footprint=np.array([[0,1,0],[1,1,1],[0,1,0]],dtype=bool)
closed=clean | ndimage.binary_closing(clean,structure=footprint)
# Very slight smoothing; observations remain untouched after cleanup.
blurred=ndimage.gaussian_filter(closed.astype(np.float32),sigma=.45)
smooth=closed | (blurred >= .28)
extra=smooth & ~clean
result=np.zeros(raw.shape,dtype=np.uint8);result[clean]=128;result[extra]=255
h,w=result.shape

def chunk(kind,value):return struct.pack('>I',len(value))+kind+value+struct.pack('>I',zlib.crc32(kind+value)&0xffffffff)
raw_bytes=b''.join(b'\x00'+result[y].tobytes() for y in range(h))
(root/'assets/walls-enhanced.png').write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,0,0,0,0))+chunk(b'IDAT',zlib.compress(raw_bytes,6))+chunk(b'IEND',b''))
summary={'cell_m':.1,'grid_width':w,'grid_height':h,'occupancy_threshold':78,'min_component_cells':3,'closing_radius_cells':1,'gaussian_sigma_cells':.45,'source_cells':int(raw.sum()),'removed_small_cells':int(raw.sum()-clean.sum()),'added_cells':int(extra.sum()),'result_cells':int(smooth.sum())}
(root/'assets/wall-enhancement.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(summary,ensure_ascii=False))

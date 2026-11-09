"""Create continuous display-only wall surfaces from the 2D map.

Uses a conservative, local 15 cm-radius closing and contour simplification.
Short isolated obstacles remain in the source floor image but are not extruded as walls.
Does not infer building heights or claim openings are verified. Original map is untouched.
Requires numpy, scipy, contourpy and shapely 2.1+.
"""
from pathlib import Path
import json,struct,zlib
import numpy as np
from scipy import ndimage
import contourpy
from shapely.geometry import LineString
from shapely.ops import polygonize
from shapely import constrained_delaunay_triangles

root=Path(__file__).resolve().parent.parent
blob=(root/'assets/map.png').read_bytes();offset=8;blocks=[]
while offset<len(blob):
 n=struct.unpack('>I',blob[offset:offset+4])[0];tag=blob[offset+4:offset+8];v=blob[offset+8:offset+8+n];offset+=n+12
 if tag==b'IHDR':w,h,depth,color,*_=struct.unpack('>IIBBBBB',v)
 if tag==b'IDAT':blocks.append(v)
 if tag==b'IEND':break
if (depth,color)!=(8,0):raise ValueError('Expected 8-bit grayscale map')
rows=np.frombuffer(zlib.decompress(b''.join(blocks)),dtype=np.uint8).reshape(h,w+1)
if np.any(rows[:,0]):raise ValueError('Unsupported PNG filter')
image=rows[:,1:]
# Use the same reconstructed map as the current viewer. Preserve original cells after noise removal.
raw=image<105
labels,count=ndimage.label(raw,structure=np.ones((3,3),bool));sizes=np.bincount(labels.ravel());keep=sizes>=3;keep[0]=False
clean=keep[labels]
yy,xx=np.ogrid[-3:4,-3:4];disk=(xx*xx+yy*yy)<=9
closed=clean | ndimage.binary_closing(clean,structure=disk)
# A single-cell dilation supplies a thin wall footprint before smoothing its outline.
expanded=ndimage.binary_dilation(closed,structure=ndimage.generate_binary_structure(2,1))
field=ndimage.gaussian_filter(expanded.astype(np.float32),sigma=.85)
field=np.pad(field,2,constant_values=0)
cg=contourpy.contour_generator(z=field,line_type='Separate')
lines=cg.lines(.44)
polys=[]
for polygon in polygonize([LineString(c) for c in lines if len(c)>=4]):
 q=polygon.representative_point(); col=int(round(q.x));row=int(round(q.y))
 if not (0<=row<field.shape[0] and 0<=col<field.shape[1] and field[row,col]>=.44):continue
 # 2 pixels corresponds to 10 cm; keep topology and drop sub-0.0075 m² artifacts.
 polygon=polygon.simplify(2.0 if polygon.area > 60 else .8,preserve_topology=True)
 if not polygon.is_empty and polygon.is_valid and polygon.area>=3:polys.append(polygon)
# A 2D occupancy scan contains furniture and speckles as well as walls. Rendering
# every separate region at wall height creates misleading freestanding pillars.
# Keep long regions and substantial fragments close to a long region; keep all
# source observations visible on the floor and in the original-wall view.
def longest_side_m(polygon):
 coords=list(polygon.minimum_rotated_rectangle.exterior.coords)
 return max(((x2-x1)**2+(y2-y1)**2)**.5 for (x1,y1),(x2,y2) in zip(coords,coords[1:]))*.05
all_polys=polys
long_polys=[p for p in all_polys if longest_side_m(p)>=2.0]
polys=[p for p in all_polys if longest_side_m(p)>=2.0 or (longest_side_m(p)>=.75 and any(p.distance(wall)*.05<=.30 for wall in long_polys))]
print('Contours:',len(lines),'wall surfaces:',len(polys),'not raised:',len(all_polys)-len(polys),flush=True)
# Convert pixel coordinates to world metres, Y-up. A 2.8 m wall is purely illustrative.
scale=.05;wall_h=2.8
vertices=[]
def point(x,y,elevation):return ((x-2-w/2)*scale,elevation,(y-2-h/2)*scale)
for p in polys:
 for triangle in constrained_delaunay_triangles(p).geoms:
  coords=list(triangle.exterior.coords)[:3]
  if len(coords)==3:
   for x,y in coords:vertices.extend(point(x,y,wall_h))
 for ring in [p.exterior,*p.interiors]:
  coords=list(ring.coords)
  for (x1,y1),(x2,y2) in zip(coords,coords[1:]):
   a=point(x1,y1,0);b=point(x2,y2,0);c=point(x2,y2,wall_h);d=point(x1,y1,wall_h)
   for xyz in (a,b,c,a,c,d):vertices.extend(xyz)
vertices=np.asarray(vertices,dtype='<f4')
(root/'assets/wall-surfaces.bin').write_bytes(vertices.tobytes())
meta={'resolution_m':scale,'threshold_gray_below':105,'min_component_pixels':3,'closing_radius_m':.15,'outline_simplification_m':.1,'display_height_m':wall_h,'min_wall_length_m':2.0,'near_wall_fragment_min_length_m':.75,'near_wall_distance_m':.30,'surface_count_before_filter':len(all_polys),'surface_count':len(polys),'not_raised_count':len(all_polys)-len(polys),'triangle_count':int(len(vertices)//9),'detected_pixels':int(raw.sum()),'filtered_pixels':int(raw.sum()-clean.sum()),'closing_added_pixels':int((closed & ~clean).sum())}
(root/'assets/wall-surfaces.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(meta,ensure_ascii=False),flush=True)
# Comparison image, used for visual inspection, not as source data.
observed=clean; added=closed & ~clean; mask=field[2:-2,2:-2]>=.44
rgb=np.zeros((h,w,3),np.uint8);rgb[:]=[10,24,20];rgb[mask]=[76,123,91];rgb[observed]=[126,194,142];rgb[added]=[218,184,105]
def chunk(t,b):return struct.pack('>I',len(b))+t+b+struct.pack('>I',zlib.crc32(t+b)&0xffffffff)
raw_png=b''.join(b'\0'+rgb[y].tobytes() for y in range(h))
(root/'assets/wall-surface-preview.png').write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw_png,6))+chunk(b'IEND',b''))

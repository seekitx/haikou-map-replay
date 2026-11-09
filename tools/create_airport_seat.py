import bpy, math
from pathlib import Path
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
root=Path(__file__).resolve().parent.parent

def material(name,color,metallic=0,rough=.45):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metallic;p.inputs['Roughness'].default_value=rough
 return m
blue=material('深蓝色座垫',(.055,.14,.26),0,.58); frame=material('拉丝银色金属',(.43,.49,.54),.72,.3); dark=material('深灰支撑',(.10,.13,.16),.55,.4)
def box(name,loc,dim,mat,bevel=.025):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=dim;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('柔和边缘','BEVEL');mod.width=bevel;mod.segments=3
  mod=o.modifiers.new('平滑法线','WEIGHTED_NORMAL')
 o.data.materials.append(mat);return o
# One seat unit; repeated and rotated to follow each mapped curved row.
box('软包座面',(0,0,.48),(.47,.52,.085),blue,.045)
back=box('软包靠背',(0,.235,.76),(.47,.085,.56),blue,.04);back.rotation_euler[0]=math.radians(-8)
box('横向金属梁',(0,0,.37),(.52,.09,.10),frame,.018)
for x in [-.22,.22]:
 box('金属扶手',(x,.015,.69),(.035,.48,.035),frame,.014)
 box('扶手立柱',(x,-.15,.57),(.035,.035,.22),frame,.012)
 box('座椅支撑脚',(x,0,.19),(.055,.12,.38),dark,.015)
 box('脚底',(x,0,.035),(.15,.38,.05),frame,.02)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(root/'assets/airport-seat.glb'),export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'assets/airport-seat.blend'))

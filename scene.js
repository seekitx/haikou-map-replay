import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
const $ = id => document.getElementById(id);
const data = window.MAP_DATA;
const stage = $('stage');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: $('canvas'), antialias: true, alpha: true }); }
catch (error) { $('error').hidden = false; $('error').textContent = '无法显示三维场景，请尝试使用支持三维显示的浏览器。'; throw error; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, .1, 500);
camera.position.set(26, 66, 75).multiplyScalar(stage.clientWidth < 700 ? 1.35 : 1);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = .09; controls.minDistance = 2.2; controls.maxDistance = 190; controls.maxPolarAngle = Math.PI / 2 - .06;
controls.target.set(0, 0, 0); controls.update(); controls.saveState();
const defaultDistance = camera.position.distanceTo(controls.target);
const ambient=new THREE.HemisphereLight(0xffffff, 0x94a5bd, 1.65);ambient.layers.enable(1);scene.add(ambient);
const directional = new THREE.DirectionalLight(0xffffff, 1.5); directional.position.set(-30, 70, 35);directional.layers.enable(1); scene.add(directional);
const grid = new THREE.GridHelper(160, 80, 0xc3d1e1, 0xe1e8f0); grid.position.y = -.12; grid.material.transparent = true; grid.material.opacity = .25; scene.add(grid);
const resolution = data.resolution, width = data.width * resolution, height = data.height * resolution;
const toWorld = ([x,y], h = .30) => new THREE.Vector3((x - data.width / 2) * resolution, h, (y - data.height / 2) * resolution);

// Positions are hand matched to the floor raster using the user's identification.
// The input is 2D: shape, height, materials and side of the bench back are illustrative.
const mapModels = new THREE.Group(); mapModels.name='illustrative-pillars-and-benches'; scene.add(mapModels);
const modelButton=$('map-models'); modelButton.disabled=true;
modelButton.onclick=()=>{mapModels.visible=!mapModels.visible;modelButton.setAttribute('aria-pressed',String(mapModels.visible));};
const pillarMaterial=new THREE.MeshStandardMaterial({color:0xd7dde5,roughness:.72,metalness:.03});
const pillarTrim=new THREE.MeshStandardMaterial({color:0x8797aa,roughness:.7,metalness:.12});
const benchMaterial=new THREE.MeshStandardMaterial({color:0x94bba5,roughness:.78,metalness:.04,side:THREE.DoubleSide});
const legMaterial=new THREE.MeshStandardMaterial({color:0x597e6c,roughness:.75,metalness:.15});
const legGeometry=new THREE.CylinderGeometry(.035,.035,.38,8);
function addPillar([x,y,r]){
  const point=toWorld([x,y],0), radius=r*resolution, height=2.8;
  const body=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,32),pillarMaterial);
  body.position.set(point.x,height/2,point.z);mapModels.add(body);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(radius*1.04,radius*1.04,.08,32),pillarTrim);
  base.position.set(point.x,.04,point.z);mapModels.add(base);
}
function addBench(row,template){
  const [x1,y1,x2,y2,w,bend]=row;
  const length=Math.hypot(x2-x1,y2-y1)*resolution;
  const count=Math.max(2,Math.round(length/.52));
  for(let i=0;i<count;i++){
    const t=(i+.5)/count, x=x1*(1-t)+x2*t+4*bend*t*(1-t), y=y1*(1-t)+y2*t;
    const dx=x2-x1+4*bend*(1-2*t),dy=y2-y1;
    const seat=template.clone(true), point=toWorld([x,y],0);
    seat.position.copy(point); seat.rotation.y=-Math.atan2(dy,dx); seat.scale.set(length/count/.52,1,Math.min(1.15,w*resolution/.65));mapModels.add(seat);
  }
}
Promise.all([fetch('assets/map-objects.json?v=20261109-1').then(response=>{if(!response.ok)throw new Error('model positions');return response.json();}),new GLTFLoader().loadAsync('assets/airport-seat.glb?v=1')]).then(([objects,seat])=>{
  if(!Array.isArray(objects.pillars)||!Array.isArray(objects.benches))throw new Error('invalid model positions');
  objects.pillars.forEach(addPillar);objects.benches.forEach(row=>addBench(row,seat.scene));
  $('canvas').dataset.pillarCount=String(objects.pillars.length);$('canvas').dataset.benchCount=String(objects.benches.length);modelButton.disabled=false;
}).catch(()=>{$('error').hidden=false;$('error').textContent='柱子和座椅模型加载失败，请刷新页面。';});
const positions = data.trajectory.flatMap(p => { const v = toWorld(p); return [v.x, v.y, v.z]; });
const pathGeometry = new THREE.BufferGeometry(); pathGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
// Two independent line buffers meet exactly at the interpolated robot position.
const remainingGeometry = pathGeometry.clone();
const remainingLine = new THREE.Line(remainingGeometry, new THREE.LineBasicMaterial({color: 0x8895a5, transparent:true, opacity:.72})); scene.add(remainingLine);
const playedGeometry = pathGeometry.clone(); playedGeometry.setDrawRange(0, 1);
const playedLine = new THREE.Line(playedGeometry, new THREE.LineBasicMaterial({color: 0x176be5})); playedLine.renderOrder=1; scene.add(playedLine);
let previousSplit=-1;
function updatePathSplit(a,b,f){
  const base=pathGeometry.attributes.position, done=playedGeometry.attributes.position, remaining=remainingGeometry.attributes.position;
  if(previousSplit>=0){
    const next=Math.min(previousSplit+1,base.count-1);
    done.setXYZ(next,base.getX(next),base.getY(next),base.getZ(next));
    remaining.setXYZ(previousSplit,base.getX(previousSplit),base.getY(previousSplit),base.getZ(previousSplit));
  }
  const x=base.getX(a)+(base.getX(b)-base.getX(a))*f, y=base.getY(a)+(base.getY(b)-base.getY(a))*f, z=base.getZ(a)+(base.getZ(b)-base.getZ(a))*f;
  if(a!==b)done.setXYZ(b,x,y,z);
  remaining.setXYZ(a,x,y,z);
  playedGeometry.setDrawRange(0,a===b?a+1:a+2);
  remainingGeometry.setDrawRange(a,base.count-a);
  done.needsUpdate=true;remaining.needsUpdate=true;previousSplit=a;
}
// Photo-referenced Blender model. Motion is a visualization of recorded positions.
const robot = new THREE.Group();robot.name='alphabot2-replay';scene.add(robot);
let robotReady=false, followRobot=false, followMode=null, wheelAngle=0, wheelPivots=[];
$('follow').disabled=true;$('eagle').disabled=true;
const wheelRadius=.105, cumulativeDistance=new Float64Array(data.trajectory.length);
for(let i=1;i<data.trajectory.length;i++){const a=data.trajectory[i-1],b=data.trajectory[i];cumulativeDistance[i]=cumulativeDistance[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1])*resolution;}
new GLTFLoader().load('assets/alphabot2-reference-v7.glb?v=7',gltf=>{
  robot.add(gltf.scene);gltf.scene.traverse(object=>object.layers.enable(1));wheelPivots=['AB7_Wheel_L','AB7_Wheel_R'].map(name=>gltf.scene.getObjectByName(name)).filter(Boolean);
  $('canvas').dataset.wheelCount=String(wheelPivots.length);
  if(wheelPivots.length!==2){$('error').hidden=false;$('error').textContent='机器人模型已加载，但轮子未能正常加载。';}
  wheelPivots.forEach(wheel=>wheel.rotation.x=wheelAngle);robotReady=true;$('follow').disabled=false;$('eagle').disabled=false;
},undefined,()=>{$('error').hidden=false;$('error').textContent='机器人模型加载失败，请刷新页面。';});
const eagleRing=new THREE.Mesh(new THREE.RingGeometry(.72,.86,48),new THREE.MeshBasicMaterial({color:0x2575e8,transparent:true,opacity:.9,side:THREE.DoubleSide}));eagleRing.rotation.x=-Math.PI/2;eagleRing.position.y=.08;eagleRing.visible=false;eagleRing.layers.enable(1);robot.add(eagleRing);
function setFollow(on,mode='close'){
  followRobot=on;followMode=on?mode:null;$('canvas').dataset.followMode=followMode||'none';
  controls.enablePan=!on;controls.minDistance=on?5:2.2;controls.maxDistance=on?(mode==='eagle'?40:15):190;
  const close=on&&mode==='close',eagle=on&&mode==='eagle';
  $('follow').setAttribute('aria-pressed',String(close));$('follow').textContent=close?'退出跟随':'跟随机器人';
  $('eagle').setAttribute('aria-pressed',String(eagle));$('eagle').textContent=eagle?'退出鹰眼':'鹰眼跟随';eagleRing.visible=eagle;
  if(on){controls.target.copy(robot.position).add(new THREE.Vector3(0,close ? .85 : 0,0));camera.position.copy(controls.target).add(eagle?new THREE.Vector3(0,30,.03):new THREE.Vector3(2.4,4.6,3.3));controls.update();}
}
$('follow').onclick=()=>{if(robotReady)setFollow(!(followRobot&&followMode==='close'),'close')};
$('eagle').onclick=()=>{if(robotReady)setFollow(!(followRobot&&followMode==='eagle'),'eagle')};

let originalWalls, enhancedWalls; let wallMode = 'enhanced';
function showWallMode(mode){if(mode==='enhanced'&&!enhancedWalls)return;wallMode=mode;if(originalWalls)originalWalls.visible=mode==='original';if(enhancedWalls)enhancedWalls.visible=mode==='enhanced';$('wall-enhanced').setAttribute('aria-pressed',String(mode==='enhanced'));$('wall-original').setAttribute('aria-pressed',String(mode==='original'));$('wall-key').hidden=mode!=='enhanced'}
$('wall-enhanced').onclick=()=>showWallMode('enhanced');$('wall-original').onclick=()=>showWallMode('original');
const image = new Image();
image.onload = () => {
  const source = document.createElement('canvas'); source.width = data.width; source.height = data.height;
  const ctx = source.getContext('2d', {willReadFrequently:true}); ctx.drawImage(image,0,0); const pixels = ctx.getImageData(0,0,data.width,data.height); const raw = pixels.data;
  const floor = ctx.createImageData(data.width,data.height), dst=floor.data;
  for(let i=0;i<raw.length;i+=4){let v=raw[i]; if(v===205)continue; let wall=Math.max(0,Math.min(1,(155-v)/95)); dst[i]=239-wall*85;dst[i+1]=243-wall*76;dst[i+2]=248-wall*65;dst[i+3]=Math.round(225+wall*30);}
  ctx.putImageData(floor,0,0);
  const texture = new THREE.CanvasTexture(source); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide}));plane.rotation.x=-Math.PI/2;plane.position.y=0;scene.add(plane);
  // Retain the unmodified obstacle view for comparison.
  function buildInstances(cells, stride, rounded, color){
    const size=stride*resolution, wallHeight=2.8;
    const geometry=rounded?new RoundedBoxGeometry(size*1.04,wallHeight,size*1.04,2,size*.20):new THREE.BoxGeometry(size*1.04,wallHeight,size*1.04);
    const material=new THREE.MeshStandardMaterial({color,roughness:.83,metalness:.04,transparent:true,opacity:.82});
    const mesh=new THREE.InstancedMesh(geometry,material,cells.length), transform=new THREE.Object3D();
    cells.forEach(([x,y],i)=>{transform.position.set((x+stride/2-data.width/2)*resolution,wallHeight/2,(y+stride/2-data.height/2)*resolution);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix)});
    mesh.instanceMatrix.needsUpdate=true;return mesh;
  }
  const stride=4, cells=[];
  for(let y=0;y<data.height;y+=stride)for(let x=0;x<data.width;x+=stride){let min=255;for(let oy=0;oy<stride&&y+oy<data.height;oy++)for(let ox=0;ox<stride&&x+ox<data.width;ox++)min=Math.min(min,raw[((y+oy)*data.width+x+ox)*4]);if(min<78)cells.push([x,y]);}
  originalWalls=buildInstances(cells,stride,false,0xaabbd1);scene.add(originalWalls);
  // Contours are joined into one continuous display mesh; the source raster remains unchanged.
  fetch('assets/wall-surfaces.bin?v=20261109-height28')
    .then(response=>{if(!response.ok)throw new Error('Could not load wall surfaces');return response.arrayBuffer()})
    .then(buffer=>{
      const points=new Float32Array(buffer);if(points.length===0||points.length%9!==0)throw new Error('Invalid wall surface data');
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(points,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();
      enhancedWalls=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xb9c9dd,roughness:.85,metalness:.02,side:THREE.DoubleSide}));
      enhancedWalls.name='continuous-display-walls';scene.add(enhancedWalls);showWallMode(wallMode);
    })
    .catch(()=>{showWallMode('original');$('error').hidden=false;$('error').textContent='连续墙面加载失败，已显示原始墙体。'});


};
image.onerror=()=>{$('error').hidden=false;$('error').textContent='地图数据加载失败，请刷新页面。'};
image.src='assets/map.png';
const totalDistance=cumulativeDistance[cumulativeDistance.length-1];
let progress=0,playing=false,speed=.5,last=0;
// Locate the segment by travelled distance, including repeated stationary points.
function locateDistance(distance){
  let lo=0,hi=cumulativeDistance.length-1;
  while(lo<hi){const mid=Math.floor((lo+hi+1)/2);if(cumulativeDistance[mid]<=distance)lo=mid;else hi=mid-1;}
  const a=lo,b=Math.min(a+1,cumulativeDistance.length-1),span=cumulativeDistance[b]-cumulativeDistance[a];
  return {a,b,f:span>0?(distance-cumulativeDistance[a])/span:0};
}
function drawProgress(){const count=data.trajectory.length;const distance=progress*totalDistance;const {a,b,f}=locateDistance(distance);updatePathSplit(a,b,f);$('canvas').dataset.distanceMeters=distance.toFixed(4);$('canvas').dataset.speedMps=String(speed);wheelAngle=distance/wheelRadius;wheelPivots.forEach(wheel=>wheel.rotation.x=wheelAngle);$('canvas').dataset.wheelAngle=wheelAngle.toFixed(5);const old=robot.position.clone();robot.position.copy(toWorld(data.trajectory[a],0)).lerp(toWorld(data.trajectory[b],0),f);const ahead=toWorld(data.trajectory[Math.min(count-1,b+5)],0),behind=toWorld(data.trajectory[Math.max(0,a-3)],0),direction=ahead.sub(behind);if(direction.lengthSq()>.0001)robot.rotation.y=Math.atan2(direction.x,direction.z);if(followRobot){const delta=robot.position.clone().sub(old);camera.position.add(delta);controls.target.add(delta)}$('canvas').dataset.robotXZ=robot.position.x.toFixed(3)+','+robot.position.z.toFixed(3);$('canvas').dataset.cameraXZ=camera.position.x.toFixed(3)+','+camera.position.z.toFixed(3);$('canvas').dataset.targetXZ=controls.target.x.toFixed(3)+','+controls.target.z.toFixed(3);const pct=Math.round(progress*100);$('seek').value=Math.round(progress*1000);$('percent').textContent=pct+'%';$('progress-label').textContent='回放进度 '+pct+'%';}
function setPlaying(on){playing=on;last=0;$('play').textContent=on?'❚❚':'▶';$('play').setAttribute('aria-label',on?'暂停轨迹':'播放轨迹');$('play-status').textContent=on?'· 正在回放':'· 已暂停'}
$('play').onclick=()=>{if(progress>=1)progress=0;setPlaying(!playing);drawProgress()};$('seek').oninput=e=>{progress=Number(e.target.value)/1000;drawProgress()};document.querySelectorAll('.speed').forEach(b=>b.onclick=()=>{speed=Number(b.dataset.speed);$('canvas').dataset.speedMps=String(speed);document.querySelectorAll('.speed').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b))})});
function updateCameraLabels(){const radius=camera.position.distanceTo(controls.target);let tilt=Math.round(controls.getPolarAngle()*180/Math.PI), angle=Math.round(controls.getAzimuthalAngle()*180/Math.PI), distance=Math.round(radius/defaultDistance*100);$('tilt').value=tilt;$('rotation').value=angle;$('distance').value=distance;$('tilt-value').textContent=tilt+'°';$('rotation-value').textContent=angle+'°';$('distance-value').textContent=distance+'%'}
function setCamera(tilt, angle, distance){let spherical=new THREE.Spherical(Math.max(controls.minDistance,Math.min(controls.maxDistance,distance)),Math.max(.001,Math.min(controls.maxPolarAngle,tilt*Math.PI/180)),angle*Math.PI/180);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();updateCameraLabels()}
controls.addEventListener('change',updateCameraLabels);
['tilt','rotation','distance'].forEach(id=>$(id).addEventListener('input',()=>setCamera(Number($('tilt').value),Number($('rotation').value),defaultDistance*Number($('distance').value)/100)));
function selectView(is3d){setFollow(false);$('view-3d').setAttribute('aria-pressed',String(is3d));$('view-2d').setAttribute('aria-pressed',String(!is3d));if(is3d)controls.reset();else setCamera(0,Number($('rotation').value),camera.position.distanceTo(controls.target));updateCameraLabels()}
$('view-3d').onclick=()=>selectView(true);$('view-2d').onclick=()=>selectView(false);$('camera-reset').onclick=()=>selectView(true);$('reset').onclick=()=>selectView(true);
$('zoom-in').onclick=()=>setCamera(controls.getPolarAngle()*180/Math.PI,controls.getAzimuthalAngle()*180/Math.PI,camera.position.distanceTo(controls.target)*.8);
$('zoom-out').onclick=()=>setCamera(controls.getPolarAngle()*180/Math.PI,controls.getAzimuthalAngle()*180/Math.PI,camera.position.distanceTo(controls.target)*1.25);
function resize(){let w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(stage);resize();updateCameraLabels();drawProgress();
function frame(t){if(playing){if(last)progress=totalDistance>0?Math.min(1,progress+(t-last)/1000*speed/totalDistance):1;last=t;drawProgress();if(progress>=1)setPlaying(false)}controls.update();renderer.autoClear=true;camera.layers.set(0);renderer.render(scene,camera);if(followRobot&&robotReady){renderer.autoClear=false;renderer.clearDepth();camera.layers.set(1);renderer.render(scene,camera);camera.layers.set(0)}requestAnimationFrame(frame)}requestAnimationFrame(frame);

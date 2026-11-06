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
scene.add(new THREE.HemisphereLight(0xd9ffe5, 0x10251b, 2.0));
const directional = new THREE.DirectionalLight(0xb2f9c5, 2); directional.position.set(-30, 70, 35); scene.add(directional);
const grid = new THREE.GridHelper(160, 80, 0x4c8b68, 0x315544); grid.position.y = -.12; grid.material.transparent = true; grid.material.opacity = .12; scene.add(grid);
const resolution = data.resolution, width = data.width * resolution, height = data.height * resolution;
const toWorld = ([x,y], h = .30) => new THREE.Vector3((x - data.width / 2) * resolution, h, (y - data.height / 2) * resolution);
const positions = data.trajectory.flatMap(p => { const v = toWorld(p); return [v.x, v.y, v.z]; });
const pathGeometry = new THREE.BufferGeometry(); pathGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
const fullLine = new THREE.Line(pathGeometry, new THREE.LineBasicMaterial({color: 0x81a598, transparent:true, opacity:.4})); scene.add(fullLine);
const playedGeometry = pathGeometry.clone(); playedGeometry.setDrawRange(0, 1);
const playedLine = new THREE.Line(playedGeometry, new THREE.LineBasicMaterial({color: 0xb4ff77})); scene.add(playedLine);
// Photo-referenced Blender model. Motion is a visualization of recorded positions.
const robot = new THREE.Group();robot.name='alphabot2-replay';scene.add(robot);
let robotReady=false, followRobot=false;
new GLTFLoader().load('assets/alphabot2-reference.glb?v=1',gltf=>{robot.add(gltf.scene);robotReady=true;},undefined,()=>{$('error').hidden=false;$('error').textContent='机器人模型加载失败，请刷新页面。';});
function setFollow(on){followRobot=on;$('follow').setAttribute('aria-pressed',String(on));$('follow').textContent=on?'退出跟随':'跟随机器人';if(on){controls.target.copy(robot.position).add(new THREE.Vector3(0,.85,0));camera.position.copy(controls.target).add(new THREE.Vector3(3.7,3.1,5.3));controls.update();}}
$('follow').onclick=()=>{if(robotReady)setFollow(!followRobot)};

let originalWalls, enhancedWalls; let wallMode = 'enhanced';
function showWallMode(mode){if(mode==='enhanced'&&!enhancedWalls)return;wallMode=mode;if(originalWalls)originalWalls.visible=mode==='original';if(enhancedWalls)enhancedWalls.visible=mode==='enhanced';$('wall-enhanced').setAttribute('aria-pressed',String(mode==='enhanced'));$('wall-original').setAttribute('aria-pressed',String(mode==='original'));$('wall-key').hidden=mode!=='enhanced'}
$('wall-enhanced').onclick=()=>showWallMode('enhanced');$('wall-original').onclick=()=>showWallMode('original');
const image = new Image();
image.onload = () => {
  const source = document.createElement('canvas'); source.width = data.width; source.height = data.height;
  const ctx = source.getContext('2d', {willReadFrequently:true}); ctx.drawImage(image,0,0); const pixels = ctx.getImageData(0,0,data.width,data.height); const raw = pixels.data;
  const floor = ctx.createImageData(data.width,data.height), dst=floor.data;
  for(let i=0;i<raw.length;i+=4){let v=raw[i]; if(v===205)continue; let wall=Math.max(0,Math.min(1,(155-v)/95)); dst[i]=21+wall*46;dst[i+1]=53+wall*68;dst[i+2]=40+wall*52;dst[i+3]=Math.round(105+wall*105);}
  ctx.putImageData(floor,0,0);
  const texture = new THREE.CanvasTexture(source); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide}));plane.rotation.x=-Math.PI/2;plane.position.y=0;scene.add(plane);
  // Retain the unmodified obstacle view for comparison.
  function buildInstances(cells, stride, rounded, color){
    const size=stride*resolution, wallHeight=.65;
    const geometry=rounded?new RoundedBoxGeometry(size*1.04,wallHeight,size*1.04,2,size*.20):new THREE.BoxGeometry(size*1.04,wallHeight,size*1.04);
    const material=new THREE.MeshStandardMaterial({color,roughness:.83,metalness:.04,transparent:true,opacity:.82});
    const mesh=new THREE.InstancedMesh(geometry,material,cells.length), transform=new THREE.Object3D();
    cells.forEach(([x,y],i)=>{transform.position.set((x+stride/2-data.width/2)*resolution,wallHeight/2,(y+stride/2-data.height/2)*resolution);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix)});
    mesh.instanceMatrix.needsUpdate=true;return mesh;
  }
  const stride=4, cells=[];
  for(let y=0;y<data.height;y+=stride)for(let x=0;x<data.width;x+=stride){let min=255;for(let oy=0;oy<stride&&y+oy<data.height;oy++)for(let ox=0;ox<stride&&x+ox<data.width;ox++)min=Math.min(min,raw[((y+oy)*data.width+x+ox)*4]);if(min<78)cells.push([x,y]);}
  originalWalls=buildInstances(cells,stride,false,0x6eb38b);scene.add(originalWalls);
  // Contours are joined into one continuous display mesh; the source raster remains unchanged.
  fetch('assets/wall-surfaces.bin?v=20261106-smooth2')
    .then(response=>{if(!response.ok)throw new Error('Could not load wall surfaces');return response.arrayBuffer()})
    .then(buffer=>{
      const points=new Float32Array(buffer);if(points.length===0||points.length%9!==0)throw new Error('Invalid wall surface data');
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(points,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();
      enhancedWalls=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x84c89d,roughness:.85,metalness:.02,side:THREE.DoubleSide}));
      enhancedWalls.name='continuous-display-walls';scene.add(enhancedWalls);showWallMode(wallMode);
    })
    .catch(()=>{showWallMode('original');$('error').hidden=false;$('error').textContent='连续墙面加载失败，已显示原始墙体。'});


};
image.onerror=()=>{$('error').hidden=false;$('error').textContent='地图数据加载失败，请刷新页面。'};
image.src='assets/map.png';
let progress=0,playing=false,speed=1,last=0;
function drawProgress(){const count=data.trajectory.length;const n=Math.max(1,Math.ceil(progress*(count-1))+1);playedGeometry.setDrawRange(0,n);let k=progress*(count-1),a=Math.floor(k),b=Math.min(a+1,count-1),f=k-a;const old=robot.position.clone();robot.position.copy(toWorld(data.trajectory[a],0)).lerp(toWorld(data.trajectory[b],0),f);const ahead=toWorld(data.trajectory[Math.min(count-1,b+5)],0),behind=toWorld(data.trajectory[Math.max(0,a-3)],0),direction=ahead.sub(behind);if(direction.lengthSq()>.0001)robot.rotation.y=Math.atan2(direction.x,direction.z);if(followRobot){const delta=robot.position.clone().sub(old);camera.position.add(delta);controls.target.add(delta)}const pct=Math.round(progress*100);$('seek').value=Math.round(progress*1000);$('percent').textContent=pct+'%';$('progress-label').textContent='回放进度 '+pct+'%';}
function setPlaying(on){playing=on;last=0;$('play').textContent=on?'❚❚':'▶';$('play').setAttribute('aria-label',on?'暂停轨迹':'播放轨迹');$('play-status').textContent=on?'· 正在回放':'· 已暂停'}
$('play').onclick=()=>{if(progress>=1)progress=0;setPlaying(!playing);drawProgress()};$('seek').oninput=e=>{progress=Number(e.target.value)/1000;drawProgress()};document.querySelectorAll('.speed').forEach(b=>b.onclick=()=>{speed=Number(b.dataset.speed);document.querySelectorAll('.speed').forEach(x=>x.classList.toggle('active',x===b))});
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
function frame(t){if(playing){if(last)progress=Math.min(1,progress+(t-last)/55000*speed);last=t;drawProgress();if(progress>=1)setPlaying(false)}controls.update();renderer.render(scene,camera);requestAnimationFrame(frame)}requestAnimationFrame(frame);

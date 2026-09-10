'use client';
import {useEffect,useRef,useState} from 'react';
import type * as THREE from 'three';
import {cycleOffset,narrativeAmount,deskAmount,returnAmount,cyclePhase,reveal,btrReveal,btrStepAt,storyPhase,BTR_STORIES,LAYER_WINDOWS,AssemblyReplay} from './explosion-motion';
import {createExplosionLayout} from './explosion-layout';
import {PointerTap} from './pointer-tap';
import {dialReading,fmt,observedYears,type CountryData} from '@/lib/climate';
export type SceneControls={explode:boolean;replay:number;paused:boolean;camera:'atelier'|'plan'|'back';mode:'instrument'|'engine';selected:string|null;loop?:boolean;progress?:number|null;zoom?:number;inputToken?:number;playSeconds?:number};
export const phases=[
 {title:'Opening the planet',description:'Scroll down and the connected data rises one layer at a time. The movement explains structure; it never stands for progress.'},
 {title:'01 · The Paris Agreement — the plate under every promise',description:'Pledges, observations, reporting and support conditions all seat on one shared design.'},
 {title:'02 · NDC — the pledge becomes a ring',description:'The reduction written in the document rises as a target ring. The blue arc is the size of the promise, not a measured result.'},
 {title:'03 · Observations — the record becomes gears',description:'Inventory gears and record markers rise in turn. Only observations actually held are shown as data.'},
 {title:'04 · BTR — eight pieces inside one report',description:'The reporting module lifts first. Keep scrolling to read each component inside it.'},
 {title:'05 · International support — the condition on the promise',description:'Support conditions rise last. Finance needed and finance received stay separate facts, and unknown stays unknown.'},
 {title:'Laid flat, for one look at the whole',description:'Parts that have finished their explanation spread out like a drawing on a desk, then return to their seats one by one.'},
 {title:'One by one, back into one machine',description:'Target ring, inventory gears, reporting and support return to the Paris plate. The shell closes last.'},
 {title:'One planet, connected again',description:'Every record is back in its seat. The gears keep turning. Scroll back to revisit any scene.'}
];
export default function MovementScene({data,controls,onSelect,onReady,onPhase,onProgress}:{data:CountryData;controls:SceneControls;onSelect:(id:string)=>void;onReady?:(canvas:HTMLCanvasElement)=>void;onPhase?:(index:number)=>void;onProgress?:(value:number)=>void}){
 const host=useRef<HTMLDivElement>(null);const current=useRef(controls);const select=useRef(onSelect);const ready=useRef(onReady);const phaseCallback=useRef(onPhase);const progressCallback=useRef(onProgress);const [failed,setFailed]=useState(false);
 useEffect(()=>{current.current=controls;select.current=onSelect;ready.current=onReady;phaseCallback.current=onPhase;progressCallback.current=onProgress},[controls,onSelect,onReady,onPhase,onProgress]);
 useEffect(()=>{let cleanup=()=>{};let cancelled=false;void(async()=>{try{
 const T=await import('three');const {RoomEnvironment}=await import('three/addons/environments/RoomEnvironment.js');const {OrbitControls}=await import('three/addons/controls/OrbitControls.js');if(cancelled||!host.current)return;
 setFailed(false);const el=host.current;const scene=new T.Scene();const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0xf4f2ec,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;el.appendChild(renderer.domElement);renderer.outputColorSpace=T.SRGBColorSpace;renderer.domElement.setAttribute('role','img');renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','A model of one country\u2019s climate data. Scroll to move the story, drag to rotate, use the zoom slider to move closer, tap a part to open it.');ready.current?.(renderer.domElement);
 const pm=new T.PMREMGenerator(renderer);const room=new RoomEnvironment();const env=pm.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.46;room.dispose();pm.dispose();
 const key=new T.DirectionalLight(0xfff5e5,2.1);key.position.set(-5,-3,11);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-7;key.shadow.camera.right=7;key.shadow.camera.top=7;key.shadow.camera.bottom=-7;key.shadow.bias=-.001;key.shadow.normalBias=.025;key.shadow.radius=4;scene.add(key);scene.add(new T.AmbientLight(0xf3f8ff,.38));
 const camera=new T.PerspectiveCamera(34,1,.1,100);const world=new T.Group();world.rotation.z=-.13;scene.add(world);
 const silver=new T.MeshStandardMaterial({color:0xa4afb2,metalness:.94,roughness:.27});const edge=new T.MeshStandardMaterial({color:0xe4e8e7,metalness:.9,roughness:.22});const steel=new T.MeshStandardMaterial({color:0x5f737b,metalness:.82,roughness:.3});const porcelain=new T.MeshPhysicalMaterial({color:0xa7b0b4,metalness:.86,roughness:.3,clearcoat:.28});const white=new T.MeshStandardMaterial({color:0xf9fbf5,metalness:.1,roughness:.38});const shadow=new T.MeshStandardMaterial({color:0x52616a,metalness:.5,roughness:.5});
 const blue=new T.MeshPhysicalMaterial({color:0x2b54b7,metalness:.18,roughness:.18,clearcoat:1});const teal=new T.MeshPhysicalMaterial({color:0x276f68,metalness:.35,roughness:.25,clearcoat:1});const violet=new T.MeshPhysicalMaterial({color:0x5b4c99,metalness:.2,roughness:.22,clearcoat:1});const gold=new T.MeshPhysicalMaterial({color:0x8f6b2a,metalness:.45,roughness:.24,clearcoat:1});const glass=new T.MeshPhysicalMaterial({color:0x86a5e4,transparent:true,opacity:.66,transmission:.3,thickness:.22,metalness:.05,roughness:.14,ior:1.45,side:T.DoubleSide,depthWrite:false});const clear=new T.MeshPhysicalMaterial({color:0xd1daf5,transparent:true,opacity:.32,transmission:.55,roughness:.12,side:T.DoubleSide,depthWrite:false});const ghost=new T.MeshStandardMaterial({color:0xada3bf,metalness:.35,roughness:.4,transparent:true,opacity:.65});
 const floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.ShadowMaterial({opacity:.14}));floor.position.z=-3.43;floor.receiveShadow=true;scene.add(floor);
 const parts:THREE.Group[]=[];const gears:{g:THREE.Group;speed:number;phase:number}[]=[];const hits:THREE.Object3D[]=[];const textures:THREE.Texture[]=[];const labels:{el:HTMLDivElement;anchor:THREE.Object3D;offset:[number,number];phase:number}[]=[];const topLabels=document.createElement('div');topLabels.className='projected-labels';el.appendChild(topLabels);topLabels.setAttribute('aria-hidden','true');const btrLayer=document.createElement('div');btrLayer.className='projected-labels btr-layer';el.appendChild(btrLayer);
 function mesh(geometry:THREE.BufferGeometry,material:THREE.Material,parent:THREE.Object3D,x=0,y=0,z=0){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function cylinder(parent:THREE.Object3D,r:number,h:number,z:number,mat:THREE.Material=porcelain,x=0,y=0){const m=mesh(new T.CylinderGeometry(r,r,h,72),mat,parent,x,y,z);m.rotation.x=Math.PI/2;return m;}
 function ring(parent:THREE.Object3D,r:number,t:number,z:number,mat:THREE.Material=edge,arc=Math.PI*2){return mesh(new T.TorusGeometry(r,t,12,140,arc),mat,parent,0,0,z);}
 function annulus(parent:THREE.Object3D,r:number,inner:number,h:number,z:number,mat:THREE.Material){const shape=new T.Shape();shape.absarc(0,0,r,0,Math.PI*2,false);const hole=new T.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);shape.holes.push(hole);return mesh(new T.ExtrudeGeometry(shape,{depth:h,bevelEnabled:true,bevelSize:.04,bevelThickness:.04,bevelSegments:3,curveSegments:80}),mat,parent,0,0,z);}
 function rounded(w:number,h:number,r:number){const s=new T.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);return s;}
 function slab(parent:THREE.Object3D,w:number,h:number,z:number,mat:THREE.Material,depth=.16){return mesh(new T.ExtrudeGeometry(rounded(w,h,.13),{depth,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:3,curveSegments:16}),mat,parent,0,0,z);}
 function clickable(obj:THREE.Object3D,id:string){obj.userData.click=id;hits.push(obj);return obj;}
 function screw(parent:THREE.Object3D,x:number,y:number,z:number,r=.07){cylinder(parent,r,.055,z,edge,x,y);const cut=mesh(new T.BoxGeometry(r*1.45,.013,.008),steel,parent,x,y,z+.03);cut.rotation.z=.6;}
 function ghost_(obj:THREE.Object3D){obj.traverse(o=>{if(o instanceof T.Mesh){const m=(o.material as THREE.MeshStandardMaterial).clone();m.transparent=true;m.opacity=.23;m.depthWrite=false;o.material=m;}});return obj;}
 // All wheel motion is explanatory. Evidence remains encoded in materials,
 // source records and labels, never in whether an animated wheel happens to stop.
 const trend=data.derived.trend_annual_mtco2e??null;

 function part(id:string,phase:number,z:number){const g=new T.Group();g.userData={id,phase,home:z};g.position.z=z;world.add(g);parts.push(g);return g;}
 function cog(parent:THREE.Object3D,x:number,y:number,r:number,count:number,mat:THREE.Material,sign=1){const g=new T.Group();g.position.set(x,y,.05);parent.add(g);const sh=new T.Shape();for(let i=0;i<count*4;i++){const a=i/count/4*Math.PI*2;const rr=r+(i%4===1||i%4===2?1:-1)*r/count;const x=Math.cos(a)*rr,y=Math.sin(a)*rr;if(i===0)sh.moveTo(x,y);else sh.lineTo(x,y);}sh.closePath();for(let j=0;j<5;j++){const a=j/5*Math.PI*2;const hole=new T.Path();hole.absarc(Math.cos(a)*r*.55,Math.sin(a)*r*.55,r*.2,0,Math.PI*2,true);sh.holes.push(hole);}const hole=new T.Path();hole.absarc(0,0,r*.17,0,Math.PI*2,true);sh.holes.push(hole);mesh(new T.ExtrudeGeometry(sh,{depth:.13,bevelEnabled:true,bevelSize:.015,bevelThickness:.017,bevelSegments:2,curveSegments:20}),mat,g);ring(g,r*.78,.023,.155,edge);cylinder(g,r*.16,.2,.12,steel);screw(g,0,0,.25,r*.075);gears.push({g,speed:sign*24/count*.52,phase:parent.userData.phase??2});return g;}
 function engraving(parent:THREE.Object3D,text:string,color:string,w:number,h:number,z:number){const cv=document.createElement('canvas');cv.width=512;cv.height=160;const ctx=cv.getContext('2d')!;ctx.clearRect(0,0,512,160);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 66px Helvetica, Arial';ctx.fillText(text,256,80);const texture=new T.CanvasTexture(cv);texture.colorSpace=T.SRGBColorSpace;textures.push(texture);return mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}),parent,0,0,z);}
 function label(anchor:THREE.Object3D,title:string,value:string,color:string,phase:number,offset:[number,number]){const div=document.createElement('div');div.className='component-label';div.style.setProperty('--component-color',color);const name=document.createElement('strong');name.textContent=title;const val=document.createElement('span');val.textContent=value;div.appendChild(name);div.appendChild(val);topLabels.appendChild(div);labels.push({el:div,anchor,offset,phase});}
 // The source document as a physical token. It rides with its component and
 // anchors that component's label, so the box, the leader line and the reading
 // are one object rather than three unrelated ones.
 function chip(parent:THREE.Group,name:string,mat:THREE.Material,css:string,x:number,y:number,z:number,id:string){const g=new T.Group();g.position.set(x,y,z);parent.add(g);clickable(slab(g,1.16,.86,0,mat,.2),id);slab(g,1.00,.70,.22,white,.06);engraving(g,name,css,.80,.28,.33);screw(g,-.38,-.24,.34,.028);screw(g,.38,.24,.34,.028);return g;}
 // The neutral chassis is the shared country contract; it contains no claimed climate values.
 const chassis=part('treaty',0,-.22);clickable(annulus(chassis,2.96,1.04,.22,0,porcelain),'treaty');annulus(chassis,3.07,2.9,.14,-.12,silver);ring(chassis,3.04,.032,.11,edge);ring(chassis,2.94,.024,.25,white);cylinder(chassis,1.03,.11,.09,white);ring(chassis,1.07,.022,.19,silver);
 engraving(chassis,'PARIS AGREEMENT · 2015','#3c464d',1.75,.14,.29).position.y=-2.42;
 const anchorT=chip(chassis,'PARIS',porcelain,'#4c565c',-2.62,-2.62,.30,'treaty');label(anchorT,'01 / Paris plate','The shared design every part seats on','#4c565c',0,[-150,26]);
 for(let i=0;i<12;i++){const a=i/12*Math.PI*2;screw(chassis,Math.cos(a)*2.73,Math.sin(a)*2.73,.28,.066);}
 // 1. NDC records become the target ring. The arc length is the actual pledged reduction.
 const promise=part('pledge',1,.40);clickable(annulus(promise,2.82,2.4,.12,0,clear),'pledge');ring(promise,2.85,.028,.12,edge);ring(promise,2.37,.015,.13,edge);const ratio=(data.ndc.reduction_pct??0)/100;
 const segments:THREE.Mesh[]=[];for(let i=0;i<50;i++){const g=new T.TorusGeometry(2.61,.082,8,8,Math.PI*2/50*.78);const m=mesh(g,i<Math.round(ratio*50)?blue:porcelain,promise,0,0,.17);m.rotation.z=Math.PI/2+i/50*Math.PI*2;segments.push(m);clickable(m,'pledge');}
 const anchorN=chip(promise,'NDC',blue,'#2b54b7',-1.86,2.62,.37,'pledge');label(anchorN,'02 / NDC target ring',`${fmt(data.ndc.reduction_pct)}% pledged cut`,'#2b54b7',1,[-110,-28]);
 // 2. Only loaded observations become metal markers; the gear train has mechanical support, not invented time-series points.
 const inventory=part('delivery',2,.35);
 const sourceGears:[number,number,number,number,THREE.Material,number,string][]=[[-1.05,-.30,.87,36,teal,1,'delivery'],[.55,-.30,.70,29,steel,-1,'source:DS-05'],[1.33,.75,.58,24,steel,1,'source:DS-02']];
 sourceGears.forEach(([x,y,r,n,mat,sign,id])=>{const g=clickable(cog(inventory,x,y,r,n,mat,sign),id);g.userData.source=id;const available=id==='delivery'?data.series.observed.length>0:(data.sources??[]).some(s=>s.id===id.slice(7)&&s.connection==='connected');g.userData.available=available;if(!available)ghost_(g);const cap=new T.Group();cap.position.set(x,y,.43);inventory.add(cap);engraving(cap,id==='delivery'?'INVENTORY':id==='source:DS-05'?'EDGAR':'TRACE','#3c464d',r*1.22,r*.30,.02);clickable(cap,id);});
 const gearSupports:[[number,number],[number,number]][]=[[[-1.05,-.30],[.55,-.30]],[[.55,-.30],[1.33,.75]]];gearSupports.forEach(([a,b])=>{const dx=b[0]-a[0],dy=b[1]-a[1];const bar=new T.Group();bar.position.set((a[0]+b[0])/2,(a[1]+b[1])/2,-.17);bar.rotation.z=Math.atan2(dy,dx);inventory.add(bar);slab(bar,Math.hypot(dx,dy),.13,0,silver,.065);});
 const dataMarks:THREE.Mesh[]=[];data.series.observed.forEach((p,i)=>{const a=Math.PI*.1+i/Math.max(data.series.observed.length,15)*Math.PI*1.8;const m=cylinder(inventory,.075,.045,.25,teal,Math.cos(a)*2.26,Math.sin(a)*2.26);clickable(m,'delivery');dataMarks.push(m)});
 const anchorI=chip(inventory,'INV',teal,'#1b6f68',-2.28,-1.79,.30,'delivery');label(anchorI,'03 / Observations',`${data.series.observed.length} observed years${trend==null?' · no trend computed':` · ${trend>0?'+':'−'}${fmt(Math.abs(trend),2)} MtCO₂e per year`}`,'#1b6f68',2,[-144,10]);
 // 3. BTR submission seats a bridge. Eight individual states remain independent of submission.
 const evidence=part('evidence',3,.78);const bridge=new T.Group();bridge.position.set(.65,.72,0);bridge.rotation.z=.16;evidence.add(bridge);clickable(slab(bridge,2.0,.48,0,porcelain,.13),'evidence');screw(bridge,-.81,0,.19,.07);screw(bridge,.81,0,.19,.07);engraving(bridge,'BTR',data.btr.submitted===true?'#5b4c99':'#9a93a6',.7,.22,.174);
 const sockets:THREE.Group[]=[];Object.entries(data.btr.components).forEach(([key,state],i)=>{const a=Math.PI*2*i/8;const g=new T.Group();g.position.set(Math.cos(a)*1.95,Math.sin(a)*1.95,.12);evidence.add(g);const pad=mesh(new T.CylinderGeometry(.34,.34,.6,8),new T.MeshBasicMaterial({visible:false}),g,0,0,.1);pad.rotation.x=Math.PI/2;pad.castShadow=pad.receiveShadow=false;clickable(pad,'evidence:'+key);clickable(ring(g,.13,.024,.02,edge),'evidence:'+key);if(state.state==='observed')cylinder(g,.107,.08,.04,violet);else if(state.state==='pledged')cylinder(g,.107,.05,.04,glass);else if(state.state==='absent')cylinder(g,.098,.08,-.04,shadow);else{ring(g,.102,.009,.034,ghost);engraving(g,'?', '#8d84a0',.10,.06,.052);}sockets.push(g);g.userData.key=key});
 const anchorB=chip(evidence,'BTR',violet,'#5b4c99',2.18,1.58,.27,'evidence');label(anchorB,'04 / BTR reporting duty',data.btr.submitted===true?`Submitted · ${Object.values(data.btr.components).filter(c=>c.state==='unknown').length} unparsed`:'Submission unparsed','#5b4c99',3,[36,-42]);
 // 4. Finance docks beside the mechanism. Unknown receipts never make this conditional wheel mesh.
 const finance=part('conditions',4,.44);finance.position.set(3.58,-.38,.44);const fg=cog(finance,0,0,.55,23,gold,-1);clickable(fg,'conditions');if(data.finance_need.received_usd==null)ghost_(fg);ring(finance,.68,.018,.13,edge);cylinder(finance,.11,.15,.15,gold);const anchorF=chip(finance,'FIN',gold,'#8f6b2a',0,1.06,.04,'conditions');label(anchorF,'05 / International support',data.finance_need.received_usd==null?'Receipts unknown \u2192 not meshed':'Receiving finance is not fulfilling a condition','#8f6b2a',4,[32,18]);
 // 5. The assessment core seats only after the inputs. It refuses an unsupported conclusion.
 const core=part('assessment',5,1.02);const corePlate=slab(core,.89,.75,0,porcelain,.13);clickable(corePlate,'delivery');engraving(core,'VC','#3c464d',.63,.24,.174);ring(core,.48,.018,.05,edge);

 function disposeScene(){const materials=new Set<THREE.Material>();scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points||o instanceof T.Line){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());key.shadow.dispose();env.dispose();renderer.dispose();renderer.domElement.remove();topLabels.remove();btrLayer.remove();}
 cleanup=disposeScene;
 const earthTexture=await new T.TextureLoader().loadAsync('/textures/earth.jpg');if(cancelled){earthTexture.dispose();cleanup();return;}earthTexture.colorSpace=T.SRGBColorSpace;earthTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());textures.push(earthTexture);
 // The shell is evidence of scope, not a lid: the mechanism has to stay legible
 // through it, so it is glass rather than a painted ball.
 const earthMaterial=new T.MeshPhysicalMaterial({map:earthTexture,color:0xa9bccd,emissive:0xffffff,emissiveMap:earthTexture,emissiveIntensity:.58,metalness:.05,roughness:.44,clearcoat:.22,clearcoatRoughness:.3,transparent:true,opacity:.55,depthWrite:false,side:T.DoubleSide});
 const north=new T.Group(),south=new T.Group();world.add(north,south);
 for(const [g,start] of [[north,0],[south,Math.PI/2]] as const){const shell=new T.SphereGeometry(2.90,128,72,0,Math.PI*2,start,Math.PI/2);shell.rotateX(Math.PI/2);const planet=clickable(mesh(shell,earthMaterial,g),'planet');planet.castShadow=true;planet.renderOrder=3;ring(g,2.90,.035,0,edge);ring(g,2.82,.020,.012,gold);}
 const atmosphereMaterial=new T.ShaderMaterial({transparent:true,side:T.BackSide,depthWrite:false,uniforms:{glowColor:{value:new T.Color(0x538fd3)}},vertexShader:'varying vec3 n; varying vec3 v; void main(){vec4 mv=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',fragmentShader:'varying vec3 n; varying vec3 v; uniform vec3 glowColor; void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),3.);gl_FragColor=vec4(glowColor,rim*.18);}'});
 const atmosphere=new T.SphereGeometry(2.935,96,48,0,Math.PI*2,0,Math.PI/2);atmosphere.rotateX(Math.PI/2);mesh(atmosphere,atmosphereMaterial,north);
 const equator=part('planet-label',0,-.23);ring(equator,3.11,.01,0,steel);engraving(equator,'ONE PLANET · SHARED RESPONSIBILITY','#4c565c',2.32,.17,.09).position.y=-2.82;
 const obligations=new T.Group();chassis.add(obligations);const obligationNames=['ARTICLE 2','ARTICLE 4','ARTICLE 13','ARTICLE 14'];for(let i=0;i<4;i++){const g=new T.Group();const a=i*Math.PI/2+.38;g.position.set(Math.cos(a)*2.08,Math.sin(a)*2.08,.22);g.rotation.z=a-Math.PI/2;obligations.add(g);clickable(slab(g,.80,.27,0,steel,.06),'treaty');engraving(g,obligationNames[i],'#d6e0e6',.68,.10,.094);}
 const confirmedGaps=Object.values(data.btr.components).filter(c=>c.state==='absent').length;const offTrack=data.derived.on_track===false;const unresolved=data.derived.on_track==null;
 const warningMat=new T.MeshStandardMaterial({color:0xa6432f,emissive:0x7e261c,emissiveIntensity:.25,metalness:.3,roughness:.38});
 if(offTrack||confirmedGaps>0){const brokenArc=ring(chassis,2.99,.027,.31,warningMat,Math.PI*.32);brokenArc.rotation.z=-Math.PI*.4;clickable(brokenArc,'planet');}
 // Keep the earlier open-work instrument as the resting pose. This is an
 // explanatory cutaway, independent of whether a country's goal is met.
 north.position.set(0,.65,3.8);camera.up.set(0,0,1);south.position.z=-.34;
 for(const g of parts){if(g!==chassis&&g!==equator)g.position.z+=Math.min(4,g.userData.phase)*.28;}
 for(const {g} of gears)g.position.z+=.32;

 world.rotation.z=0;world.updateMatrixWorld(true);
 const assemblies=[...parts.filter(g=>g!==equator),north,south].map((g,index)=>{
  const box=new T.Box3().setFromObject(g);const center=box.getCenter(new T.Vector3());
  const shell:'upper'|'lower'|null=g===north?'upper':g===south?'lower':null;
  return {g,id:shell??String(g.userData.id),layer:shell==='upper'?4:shell==='lower'?0:g===core?2:Math.min(4,g.userData.phase),shell,home:g.position.clone(),box,center,bounds:[box.min.toArray(),box.max.toArray()] as [[number,number,number],[number,number,number]]};
 });
 world.rotation.z=-.13;
 let layout=createExplosionLayout(assemblies,1);
 const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableZoom=false;renderer.domElement.style.touchAction='pan-y';orbit.enableDamping=true;orbit.dampingFactor=.085;orbit.autoRotateSpeed=.65;orbit.minDistance=3;orbit.maxDistance=100;orbit.target.set(0,0,.25);
 camera.position.set(5.2,-16,10.8);camera.lookAt(orbit.target);orbit.update();
 let disposed=false,raf=0,last=performance.now(),amount=0,gearTime=0,lastPhase=-1,lastPercent=-1,lastReplay=current.current.replay,lastInput=current.current.inputToken;
 let dirty=true,fitDirty=true,manualCamera=false,lastKey='',lastProgress=current.current.progress,lastExplode=current.current.explode,lastPaused=current.current.paused;
 const replay=new AssemblyReplay();const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const pos=new T.Vector3(),pointer=new T.Vector2(),ray=new T.Raycaster(),tap=new PointerTap();
 const cameraGoal=new T.Vector3(),lookGoal=new T.Vector3();const front=new T.Vector3(0,-.001,1).normalize(),iso=new T.Vector3(.20,-1,.50).normalize(),back=new T.Vector3(-.3,.9,.6).normalize();
 const lines=document.createElementNS('http://www.w3.org/2000/svg','svg');lines.classList.add('assembly-leaders');topLabels.insertBefore(lines,topLabels.firstChild);
 const leaders=labels.map(()=>{const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');lines.appendChild(line);return line;});
 sockets.sort((a,b)=>BTR_STORIES.findIndex(item=>item.key===a.userData.key)-BTR_STORIES.findIndex(item=>item.key===b.userData.key));
 const socketHomes=sockets.map(g=>g.position.clone());const gearHomes=gears.map(({g})=>g.position.z);
 const btrStateText:Record<string,string>={observed:'Reported',pledged:'Pledged',absent:'Confirmed absent',unknown:'Unparsed'};
 const btrTags=sockets.map((g,i)=>{const key=String(g.userData.key);const item=BTR_STORIES.find(item=>item.key===key);const state=data.btr.components[key]?.state??'unknown';
  const tag=document.createElement('button');tag.type='button';tag.className='btr-piece-label state-'+state;tag.style.visibility='hidden';
  const num=document.createElement('small');num.textContent=`${String(i+1).padStart(2,'0')} / ${item?.short??key}`;
  const name=document.createElement('strong');name.textContent=item?.title??key;
  const read=document.createElement('span');read.textContent=btrStateText[state]??state;
  tag.appendChild(num);tag.appendChild(name);tag.appendChild(read);tag.addEventListener('click',()=>select.current('evidence:'+key));btrLayer.appendChild(tag);return tag;});
 const btrAnchors=sockets.map(()=>({x:0,y:0,set:false}));
 const btrLeaders=sockets.map(()=>{const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');line.setAttribute('class','btr-leader');lines.appendChild(line);return line;});
 const threadPositions=new Float32Array(sockets.length*6);const threadGeometry=new T.BufferGeometry();threadGeometry.setAttribute('position',new T.BufferAttribute(threadPositions,3));
 const threads=new T.LineSegments(threadGeometry,new T.LineBasicMaterial({color:0x9d93b2,transparent:true,opacity:.4}));threads.frustumCulled=false;evidence.add(threads);
 const markerGeometry=new T.BufferGeometry();const markerPositions=new Float32Array(assemblies.length*3);markerGeometry.setAttribute('position',new T.BufferAttribute(markerPositions,3));
 const markers=new T.Points(markerGeometry,new T.PointsMaterial({color:0x969ba1,size:3,sizeAttenuation:false,depthTest:false}));markers.frustumCulled=false;markers.renderOrder=10;world.add(markers);
 function resize(){const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setPixelRatio(Math.min(devicePixelRatio,w<768?1.5:2));renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();layout=createExplosionLayout(assemblies,w/Math.max(1,h-90));manualCamera=false;fitDirty=dirty=true;}
 const observer=new ResizeObserver(resize);observer.observe(el);resize();
 const changed=()=>{dirty=true};const started=()=>{manualCamera=true;fitDirty=false;dirty=true};
 orbit.addEventListener('change',changed);orbit.addEventListener('start',started);
 const motionChanged=()=>{replay.cancel();fitDirty=dirty=true;manualCamera=false;};reduced.addEventListener('change',motionChanged);
 const contextLost=(event:Event)=>{event.preventDefault();cleanup();setFailed(true);};renderer.domElement.addEventListener('webglcontextlost',contextLost);
 function pick(event:PointerEvent){const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const result=ray.intersectObjects(hits.filter(o=>{let p:THREE.Object3D|null=o;while(p){if(!p.visible)return false;p=p.parent;}return true}),true);if(result.length){let o:THREE.Object3D|null=result[0].object;while(o&&!o.userData.click)o=o.parent;if(o)select.current(o.userData.click)}}
 const down=(e:PointerEvent)=>tap.down(e.pointerId,e.clientX,e.clientY,e.pointerType==='touch'?12:5);
 const move=(e:PointerEvent)=>tap.move(e.pointerId,e.clientX,e.clientY);
 const up=(e:PointerEvent)=>{if(tap.up(e.pointerId,e.clientX,e.clientY))pick(e)};
 const cancel=(e:PointerEvent)=>tap.cancel(e.pointerId);
 renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',cancel);renderer.domElement.addEventListener('lostpointercapture',cancel);
 function placeParts(){
  const story=narrativeAmount(amount);const internal=(layer:number)=>story*(1-returnAmount(amount,layer));
  assemblies.forEach((part,i)=>{
   const cell=layout.cells.get(part.id)!;const offset=cycleOffset(amount,part.layer,part.center,{x:cell.x,y:cell.y,z:0},part.shell);
   const float=part.shell?0:Math.sin(gearTime*.8+part.layer*.9)*.025*(part.layer===0?.25:1);
   part.g.position.copy(part.home).add(pos.set(offset.x,offset.y,offset.z+float));
   markerPositions[i*3]=part.center.x+offset.x;markerPositions[i*3+1]=part.center.y+offset.y;markerPositions[i*3+2]=part.center.z+offset.z+float;
  });
  // Each family has its own secondary motion, after its supporting layer lifts.
  segments.forEach((m,i)=>{const t=reveal(internal(1),.235+i*.0014,.26+i*.0014);m.position.z=.17+t*(.12+.012*Math.sin(gearTime+i*.16));});
  dataMarks.forEach((m,i)=>{const start=.375+i/Math.max(1,dataMarks.length)*.065;m.position.z=.25+.16*reveal(internal(2),start,start+.025);});
  gears.forEach(({g,speed,phase},i)=>{g.rotation.z=gearTime*speed;g.position.z=gearHomes[i]+.18*reveal(internal(phase===4?4:2),phase===4?.94:.395+i*.018,phase===4?.99:.43+i*.018);});
  sockets.forEach((g,i)=>{
   const t=btrReveal(internal(3),i);g.position.copy(socketHomes[i]);g.position.z+=t*(.82+i*.035+.03*Math.sin(gearTime*1.05+i*.65));g.scale.setScalar(1+t*.65);
   threadPositions.set([socketHomes[i].x,socketHomes[i].y,socketHomes[i].z,g.position.x,g.position.y,g.position.z],i*6);
  });
  threadGeometry.attributes.position.needsUpdate=true;threads.visible=internal(3)>.615;
  markerGeometry.attributes.position.needsUpdate=true;markers.visible=amount>.12;
  north.rotation.z=south.rotation.z=gearTime*.085;
  world.rotation.z=-.13*(1-deskAmount(amount)*(1-returnAmount(amount,0)));floor.visible=amount<.7||amount>.99;equator.visible=amount<.7||amount>.99;world.updateMatrixWorld(true);
 }

 function fit(){
  const c=current.current;const bounds=new T.Box3();const story=narrativeAmount(amount);const deskView=deskAmount(amount)*(1-reveal(amount,.84,.96));
  assemblies.forEach(part=>{const box=part.box.clone().translate(part.g.position.clone().sub(part.home));
   // Frame the mechanism generously; the decorative poles may extend beyond
   // the study's edge, as in the previous close-up. Fit complete shells in plan.
   if(c.camera==='atelier'&&deskView<.001){
    if(part.shell==='upper')box.max.z=box.min.z+.45;
    if(part.shell==='lower')box.min.z=box.max.z-1.0;
   }
   if(part.shell==='upper'&&deskView<.001){const fade=1-reveal(story,.08,.22); const anchor=assemblies.find(p=>p.id==='evidence')!;const focusZ=anchor.g.position.z+1;box.min.z=focusZ+(box.min.z-focusZ)*fade;box.max.z=focusZ+(box.max.z-focusZ)*fade;}
   if(part.g===evidence)box.max.z+=1.3*btrReveal(story*(1-returnAmount(amount,3)),7);
   box.applyMatrix4(world.matrixWorld);bounds.union(box);
  });
  bounds.getCenter(lookGoal);
  const direction=(c.camera==='plan'?new T.Vector3(.16,-.8,1).normalize():c.camera==='back'?back:iso).clone().lerp(front,deskView).normalize();
  const right=new T.Vector3().crossVectors(camera.up,direction).normalize();const up=new T.Vector3().crossVectors(direction,right).normalize();
  const tangent=Math.tan(T.MathUtils.degToRad(camera.fov/2));
  const tanY=tangent*Math.max(.5,(el.clientHeight-80)/el.clientHeight);
  const tanX=tangent*camera.aspect*Math.max(.5,(el.clientWidth-36)/el.clientWidth);
  let distance=0;
  // Fit in camera space. World-Z depth is not screen height in this oblique view.
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
   const corner=new T.Vector3(x,y,z).sub(lookGoal);const depth=corner.dot(direction);
   distance=Math.max(distance,depth+Math.abs(corner.dot(right))/tanX,depth+Math.abs(corner.dot(up))/tanY);
  }
  distance=distance*1.04/(c.zoom??1);
  cameraGoal.copy(direction).multiplyScalar(distance).add(lookGoal);camera.far=Math.max(150,distance+80);camera.updateProjectionMatrix();
 }
 function updateLabels(){
  const story=narrativeAmount(amount);
  const placed:{x:number;y:number;w:number;h:number}[]=[];
  labels.forEach(({el:tag,anchor,offset,phase},i)=>{
   const part=assemblies.find(p=>p.g===anchor||p.g===anchor.parent);
   if(!part)return;const box=part.box.clone().translate(part.g.position.clone().sub(part.home));
   const projected=new T.Box2();let inDepth=false;
   for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){pos.set(x,y,z).applyMatrix4(world.matrixWorld).project(camera);inDepth ||= pos.z>=-1&&pos.z<=1;projected.expandByPoint(pointer.set((pos.x*.5+.5)*el.clientWidth,(-pos.y*.5+.5)*el.clientHeight));}
   anchor.getWorldPosition(pos).project(camera);const cx=(pos.x*.5+.5)*el.clientWidth,cy=(-pos.y*.5+.5)*el.clientHeight;
   const reached=phase===0||story>=LAYER_WINDOWS[Math.min(4,phase)][0];
   const active=storyPhase(story)===phase+1;
   const show=(amount<.70||amount>.99)&&reached&&inDepth&&cx>=0&&cx<=el.clientWidth&&cy>=0&&cy<=el.clientHeight&&(el.clientWidth>=600||active);
   tag.style.opacity=show?'1':'0';leaders[i].style.opacity=show?'1':'0';if(!show)return;
   const w=tag.offsetWidth,h=tag.offsetHeight;let x=Math.max(12,Math.min(el.clientWidth-w-12,cx+(i<2?-w-26:30)));let y=Math.max(48,Math.min(el.clientHeight-h-48,cy+offset[1]));
   let tries=0;while(placed.some(r=>x<r.x+r.w+8&&x+w+8>r.x&&y<r.y+r.h+8&&y+h+8>r.y)&&tries++<40){y+=22;if(y+h>el.clientHeight-48){y=48;x=x<el.clientWidth/2?el.clientWidth-w-12:12;}}
   placed.push({x,y,w,h});tag.style.transform=`translate(${x}px,${y}px)`;
   tag.classList.toggle('is-active',current.current.selected?.split(':')[0]===part.id||storyPhase(story)===phase+1);
   const edgeX=cx<x?x:cx>x+w?x+w:x+w/2;leaders[i].setAttribute('points',`${edgeX},${y+h/2} ${cx},${y+h/2} ${cx},${cy}`);
  });  btrTags.forEach((tag,i)=>{sockets[i].getWorldPosition(pos);pos.project(camera);const active=btrStepAt(story)===i;
   const show=btrReveal(story,i)>.05&&story<.91&&pos.z>=-1&&pos.z<=1&&(el.clientWidth>=600||active);
   tag.style.opacity=show?(active?'1':'.74'):'0';tag.style.visibility=show?'visible':'hidden';btrLeaders[i].style.opacity=show?'1':'0';
   tag.classList.toggle('is-active',active);if(!show)return;
   let cx=(pos.x*.5+.5)*el.clientWidth,cy=(-pos.y*.5+.5)*el.clientHeight;const anchor=btrAnchors[i];
   if(anchor.set&&Math.hypot(cx-anchor.x,cy-anchor.y)<4){cx=anchor.x;cy=anchor.y}else{anchor.x=cx;anchor.y=cy;anchor.set=true}
   const w=tag.offsetWidth,h=tag.offsetHeight;let x=Math.max(6,Math.min(el.clientWidth-w-6,cx-w/2)),y=cy-h-16,free=false;
   for(const dx of [0,-w*.8,w*.8,-w*1.6,w*1.6]){
    for(const step of [0,-1,-2,-3,1,2,3,-4,4]){
     const ty=step<=0?cy-h-16+step*(h+8):cy+16+(step-1)*(h+8);
     if(ty<6||ty>el.clientHeight-h-34)continue;
     x=Math.max(6,Math.min(el.clientWidth-w-6,cx-w/2+dx));y=ty;
     if(!placed.some(r=>x<r.x+r.w+6&&x+w+6>r.x&&y<r.y+r.h+6&&y+h+6>r.y)){free=true;break}
    }
    if(free)break;
   }
   placed.push({x,y,w,h});tag.style.transform=`translate(${x}px,${y}px)`;
   btrLeaders[i].setAttribute('points',`${cx<x?x:cx>x+w?x+w:x+w/2},${y<cy?y+h:y} ${cx},${cy}`);
  });
 }
 placeParts();fit();camera.position.copy(cameraGoal);orbit.target.copy(lookGoal);orbit.update();
 function frame(now:number){if(disposed)return;raf=requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;
  const c=current.current,still=reduced.matches;
  if(c.replay!==lastReplay){lastReplay=c.replay;if(c.progress==null)replay.start(still);lastProgress=c.progress;lastExplode=c.explode;manualCamera=false;fitDirty=true;}
  if(c.inputToken!==lastInput||c.progress!==lastProgress||c.explode!==lastExplode){replay.cancel();lastInput=c.inputToken;lastProgress=c.progress;lastExplode=c.explode;manualCamera=false;fitDirty=dirty=true;}
  lastPaused=c.paused;
  replay.update(amount,dt,c.paused,c.loop===true&&!still);
  if(replay.stage==='close'){amount=0;replay.update(0,0,false,true);}
  const target=replay.stage!=='idle'?replay.target:c.explode?1:c.progress!=null?Math.max(0,Math.min(1,c.progress/100)):0;
  const previous=amount;
  // The story plays at a fixed rate so each layer gets its own moment on screen.
  // Only the slider snaps: that is direct manipulation and must not lag.
  const step=dt/(replay.stage==='close'?12:(c.playSeconds??56)),scrub=replay.stage==='idle'&&c.progress!=null;
  if(still)amount=target;
  else if(!c.paused||replay.stage==='idle')amount=scrub?(Math.abs(target-amount)<.0001?target:T.MathUtils.damp(amount,target,8,dt)):(Math.abs(target-amount)<=step?target:amount+Math.sign(target-amount)*step);
  const moving=previous!==amount;
  const key=[c.camera,c.zoom,c.selected,c.paused,still].join('|');if(key!==lastKey){if(c.camera!==lastKey.split('|')[0]||String(c.zoom)!==lastKey.split('|')[1]){fitDirty=true;manualCamera=false;}lastKey=key;dirty=true;}
  if(moving){dirty=true;if(!manualCamera)fitDirty=true;}
  orbit.enableRotate=true;orbit.mouseButtons.LEFT=T.MOUSE.ROTATE;orbit.touches.ONE=T.TOUCH.ROTATE;
  // Keep the readable study angle steady; the gears supply the motion.
  orbit.autoRotate=false;
  const animate=!still&&!c.paused;
  if(animate){gearTime+=dt;dirty=true;}
  if(moving||animate)placeParts();

  if(fitDirty){fit();const rate=still?1:1-Math.exp(-8*dt);camera.position.lerp(cameraGoal,rate);orbit.target.lerp(lookGoal,rate);if(camera.position.distanceTo(cameraGoal)<.0001&&orbit.target.distanceTo(lookGoal)<.0001){camera.position.copy(cameraGoal);orbit.target.copy(lookGoal);fitDirty=false;}dirty=true;}
  orbit.update(dt);
  const phase=cyclePhase(amount);
  if(phase!==lastPhase){lastPhase=phase;phaseCallback.current?.(phase);dirty=true;}
  const percent=Math.round(amount*100);if(percent!==lastPercent){lastPercent=percent;progressCallback.current?.(percent);}
  if(dirty){camera.updateMatrixWorld();renderer.render(scene,camera);updateLabels();dirty=false;}
 }raf=requestAnimationFrame(frame);
 cleanup=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(raf);observer.disconnect();reduced.removeEventListener('change',motionChanged);orbit.removeEventListener('change',changed);orbit.removeEventListener('start',started);orbit.dispose();renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointermove',move);renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('pointercancel',cancel);renderer.domElement.removeEventListener('lostpointercapture',cancel);disposeScene();};
 }catch(error){cleanup();console.error('3D movement unavailable',error);if(!cancelled)setFailed(true)}})();return()=>{cancelled=true;cleanup()}},[data]);
 return <div ref={host} className="scene-host" aria-label={`${data.country.name_en}: NDC, inventory, BTR and finance assemble into a climate evidence instrument.`}>{failed&&<div className="fallback"><StaticDial data={{...data,observed_years:observedYears(data)}}/><p>3D is unavailable in this browser. Every figure is still readable below.</p></div>}</div>
}
export function StaticDial({data}:{data:{ndc:{reduction_pct:number|null};btr:{components:Record<string,{state:string}>};emissions_profile?:{total_mtco2e:number|null;latest_year:number|null};observed_years?:number|null}}){const pct=data.ndc.reduction_pct;const reading=dialReading(data);
return <svg viewBox="0 0 420 420" aria-label="Static climate evidence dial"><circle cx="210" cy="210" r="185" fill="#eceae2" stroke="#c8c2b4"/><circle cx="210" cy="210" r="163" fill="none" stroke="#ddd8cd" strokeWidth="20"/>{pct!=null&&<circle cx="210" cy="210" r="163" fill="none" stroke="#2b54b7" strokeWidth="12" strokeDasharray={`${pct/100*1024} 1024`} transform="rotate(-90 210 210)"/>}{Object.entries(data.btr.components).map(([k,v],i)=>{const a=i/8*Math.PI*2;return <circle key={k} cx={210+100*Math.cos(a)} cy={210+100*Math.sin(a)} r="9" fill={v.state==='observed'?'#5b4c99':v.state==='absent'?'#4c565c':'none'} stroke="#a294b3" strokeDasharray={v.state==='unknown'?'2 3':undefined}/>})}<text x="210" y="203" textAnchor="middle" fill="#161a1e" fontSize="42" fontFamily="Instrument Serif, Georgia, serif">{reading.value}</text><text x="210" y="234" textAnchor="middle" fill="#6a747b" fontSize="20" letterSpacing="1">{reading.label}</text></svg>}

// One remembered relationship and one shared structure keep the background quiet.
// Construction requires both builders to arrive and contribute. Use requires
// another creature to reach one end and traverse the completed crossing.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function createRelationships(){return {bond:null,bridge:null};}
export function bridgeGeometry(state,world){
  const u=state.bridge?.u ?? state.bond?.u;
  const v=state.bridge?.v ?? state.bond?.v;
  const half=Math.min(44,world.width*.10);
  return {x:u*world.width,y:v*world.height,half};
}
function go(body,target,dt){
  const d=distance(body,target),step=Math.min(d,body.pace*dt);
  if(d<.01)return body;
  return {...body,x:body.x+(target.x-body.x)/d*step,y:body.y+(target.y-body.y)/d*step,
    heading:Math.atan2(target.y-body.y,target.x-body.x)};
}
export function advanceRelationships(state, previous, moved, dt){
  let bond=state.bond && {...state.bond};
  let bridge=state.bridge && {...state.bridge,work:[...state.bridge.work]};
  const bodies=moved.bodies.map(b=>({...b}));
  const time=moved.time;
  if(!bond && time>3){
    outer:for(let a=0;a<bodies.length;a++)for(let b=a+1;b<bodies.length;b++){
      if(distance(bodies[a],bodies[b])<(bodies[a].radius+bodies[b].radius)*.8){
        const x=(bodies[a].x+bodies[b].x)/2,y=(bodies[a].y+bodies[b].y)/2;
        bond={a,b,metAt:time,meetings:1,phase:'greet',
          u:clamp(x/moved.width,.24,.76),v:clamp(y/moved.height,.22,.78)};
        break outer;
      }
    }
  }
  if(!bond)return {state:{bond,bridge},world:{...moved,bodies}};
  const geometry=bridgeGeometry({bond,bridge},moved);
  const {x,y,half}=geometry;
  if(bond.phase==='greet'){
    for(const id of [bond.a,bond.b]) bodies[id]={...previous.bodies[id],heading:Math.atan2(bodies[id===bond.a?bond.b:bond.a].y-bodies[id].y,bodies[id===bond.a?bond.b:bond.a].x-bodies[id].x)};
    if(time-bond.metAt>1.4)bond.phase='apart';
  }else if(bond.phase==='apart' && time-bond.metAt>8)bond.phase='return';
  else if(bond.phase==='return'){
    bodies[bond.a]=go(previous.bodies[bond.a],{x:x-12,y},dt);
    bodies[bond.b]=go(previous.bodies[bond.b],{x:x+12,y},dt);
    if(distance(bodies[bond.a],{x:x-12,y})<5 && distance(bodies[bond.b],{x:x+12,y})<5){
      bond.phase='build';bond.meetings=2;
      bridge={u:bond.u,v:bond.v,work:[0,0],progress:0,visitor:null,stage:'waiting',uses:0};
    }
  }else if(bond.phase==='build'){
    [bond.a,bond.b].forEach((id,i)=>{
      const target={x:x+(i?half:-half),y};
      bodies[id]=go(previous.bodies[id],target,dt);
      if(distance(bodies[id],target)<3)bridge.work[i]=Math.min(4,bridge.work[i]+dt);
    });
    bridge.progress=Math.min(...bridge.work)/4;
    if(bridge.progress>=1){bond.phase='free';bridge.completedAt=time;}
  }
  if(bridge?.progress>=1 && bridge.uses===0){
    if(bridge.visitor===null){
      const candidates=bodies.filter(b=>b.id!==bond.a && b.id!==bond.b);
      candidates.sort((a,b)=>distance(a,{x:x-half,y})-distance(b,{x:x-half,y}));
      if(candidates.length){bridge.visitor=candidates[0].id;bridge.stage='approach';}
    }
    const id=bridge.visitor;
    if(id!==null){
      const target={x:x+(bridge.stage==='approach'?-half:half),y};
      bodies[id]=go(previous.bodies[id],target,dt);
      if(distance(bodies[id],target)<2){
        if(bridge.stage==='approach')bridge.stage='cross';
        else {bridge.stage='used';bridge.uses=1;bridge.usedAt=time;}
      }
    }
  }
  // The small break can only be crossed at its deck after construction.
  if(bridge){
    for(let i=0;i<bodies.length;i++){
      if(bond.phase==='build' && (i===bond.a||i===bond.b))continue;
      const old=previous.bodies[i],next=bodies[i];
      if((old.x-x)*(next.x-x)<0 && Math.abs(next.y-y)<18){
        const onDeck=bridge.progress>=1 && Math.abs(next.y-y)<6;
        if(!onDeck)bodies[i]={...next,x:old.x,heading:Math.PI-next.heading};
      }
    }
  }
  return {state:{bond,bridge},world:{...moved,bodies}};
}

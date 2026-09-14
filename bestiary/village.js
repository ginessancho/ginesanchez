// A small drawing simulation. Roles are learned through practice, never anatomy.
// All work and visits require arrival; the clock alone cannot build a village.
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const roles = ['carry', 'raise', 'join'];
export const MAX_PLACES = 5;

export function villageLayout(width, height) {
  // On small screens the settlement lives below the introduction. On wide
  // screens it spreads into the margins and across the foot of the page.
  return width > 1000
    ? [[.13,.65],[.84,.70],[.50,.85],[.15,.88],[.83,.90]]
    : [[.19,.78],[.77,.79],[.49,.90],[.18,.94],[.82,.94]];
}
export function createVillage(world) {
  return {
    places: ['bridge','garden','shelter'].map((kind,id) => ({
      id, kind, founded: false, work: [0,0,0], contributors: [], progress: 0,
      condition: 1, uses: 0, repairs: 0, stock: kind === 'garden' ? 3 : 0,
    })),
    people: world.bodies.map(b => ({id:b.id, task:null, wait: b.id % 5,
      hunger: .25 + (b.id % 4)*.12, rest: .2+(b.id % 5)*.12, company:.3,
      practice:[0,0,0], friends:[], known:[], lastPlace:null, trips:0})),
    paths:[], events:[],
  };
}
export function placePoint(place, world) {
  const [u,v] = villageLayout(world.width,world.height)[place.id];
  return {x:u*world.width,y:v*world.height};
}
export function placeScale(world) { return Math.min(1.3,world.width/450,world.height/600); }
export function sourcePoint(place,world) {
  const p=placePoint(place,world),s=placeScale(world);
  return {x:p.x+(place.id%2 ? -48 : 48)*s,y:p.y-48*s};
}
function workPoint(place,role,world) {
  const p=placePoint(place,world),s=placeScale(world);
  return {x:p.x+(role-1)*24*s,y:p.y+12*s};
}
function move(body,target,dt,world) {
  const d=distance(body,target),amount=Math.min(d,body.pace*1.5*dt);
  if(d<.001)return {...body};
  return {...body,x:clamp(body.x+(target.x-body.x)/d*amount,8,world.width-8),
    y:clamp(body.y+(target.y-body.y)/d*amount,8,world.height-8),
    heading:Math.atan2(target.y-body.y,target.x-body.x)};
}
function record(state,time,text) {
  state.events.push({time,text});
  if(state.events.length>8)state.events.shift();
}
function trail(state,from,to) {
  if(from===null || from===to)return;
  const a=Math.min(from,to),b=Math.max(from,to);
  const path=state.paths.find(p=>p.a===a&&p.b===b);
  if(path)path.uses=Math.min(24,path.uses+1);
  else state.paths.push({a,b,uses:1});
}
function remember(person,place,state) {
  if(!person.known.includes(place.id))person.known.push(place.id);
  for(const id of place.contributors) {
    if(id!==person.id && !person.friends.includes(id))person.friends.push(id);
    const other=state.people[id];
    if(id!==person.id && !other.friends.includes(person.id))other.friends.push(person.id);
  }
}
function finish(person,place,state) {
  trail(state,person.lastPlace,place.id);
  person.lastPlace=place.id;person.trips++;
  person.task=null;person.wait=3+(person.id*7+person.trips)%8;
}
export function advanceVillage(input, previous, moved, dt) {
  const state={...input,places:input.places.map(p=>({...p,work:[...p.work],contributors:[...p.contributors]})),
    people:input.people.map(p=>({...p,task:p.task&&{...p.task},practice:[...p.practice],friends:[...p.friends],known:[...p.known]})),
    paths:input.paths.map(p=>({...p})),events:[...input.events]};
  const bodies=moved.bodies.map(b=>({...b})), time=moved.time,s=placeScale(moved);
  for(const place of state.places) {
    if(place.progress===1) {
      place.condition=Math.max(.18,place.condition-dt/420);
      if(place.kind==='garden')place.stock=Math.min(6,place.stock+dt*.035*place.condition);
    }
  }
  // A well-used place can be copied by creatures that have learned there.
  if(state.places.length<MAX_PLACES) {
    const example=state.places.find(p=>p.kind!=='bridge'&&p.uses>=7&&!p.copied);
    if(example) {
      example.copied=true;
      state.places.push({id:state.places.length,kind:example.kind,founded:false,
        work:[0,0,0],contributors:[],progress:0,condition:1,uses:0,repairs:0,stock:0,example:example.id});
      record(state,time,'A familiar idea finds a new place.');
    }
  }
  for(const person of state.people) {
    const id=person.id,body=previous.bodies[id];
    person.hunger=clamp(person.hunger+dt*.006,0,1);
    person.rest=clamp(person.rest+dt*.004,0,1);
    person.company=clamp(person.company+dt*.005,0,1);
    person.wait=Math.max(0,person.wait-dt);
    if(!person.task && person.wait===0) {
      const near=state.places.filter(p=>distance(body,placePoint(p,moved))<Math.max(145, moved.width*.23));
      // Curiosity starts local projects. The whole population is never assigned
      // to one destination; at most three builders and three visitors per place.
      for(const p of near) {
        if(!person.known.includes(p.id))person.known.push(p.id);
        if(!p.founded && time>2 && (p.example===undefined||person.known.includes(p.example))) {
          p.founded=true;record(state,time,`A ${p.kind} begins.`);
        }
      }
      const candidates=state.places.filter(p=>person.known.includes(p.id)||near.includes(p));
      const options=[];
      for(const p of candidates) {
        const active=state.people.filter(o=>o.task?.place===p.id);
        const d=distance(body,placePoint(p,moved));
        const familiar = p.contributors.some(i => person.friends.includes(i)) ? .1 : 0;
        if(p.founded&&p.progress<1&&active.filter(o=>o.task.kind==='build').length<3) {
          options.push({place:p,kind:'build',score:.9+familiar-d/900});
        }
        if(p.progress===1&&active.filter(o=>o.task.kind!=='build').length<3) {
          const need=p.kind==='garden'?person.hunger:p.kind==='shelter'?person.rest:person.company;
          options.push({place:p,kind:p.condition<.8?'repair':'visit',
            score:need+familiar+(p.condition<.8?.3:0)-d/1400+(person.lastPlace===p.id?-.35:.15)});
        }
      }
      options.sort((a,b)=>b.score-a.score);
      const choice=options[0];
      if(choice && choice.score>.12) {
        const p=choice.place;
        if(choice.kind==='build') {
          const busy=state.people.filter(o=>o.task?.place===p.id&&o.task.kind==='build').map(o=>o.task.role);
          const available=roles.map((_,i)=>i).filter(i=>
            (p.work[i]<3 || (p.contributors.length<2 && !p.contributors.includes(id))) && !busy.includes(i));
          available.sort((a,b)=>p.work[a]-p.work[b]||person.practice[a]-person.practice[b]||((a+id)%3)-((b+id)%3));
          if(available.length)person.task={kind:'build',place:p.id,role:available[0],phase:'gather',held:false,elapsed:0};
        } else person.task={kind:choice.kind,place:p.id,phase:'approach',elapsed:0};
      }
    }
    const task=person.task;
    if(!task)continue;
    const p=state.places[task.place],center=placePoint(p,moved);
    let target;
    if(task.kind==='build') {
      target=task.phase==='gather'?sourcePoint(p,moved):workPoint(p,task.role,moved);
      if(task.phase==='gather')target={x:target.x+(task.role-1)*16*s,y:target.y+(task.role%2)*10*s};
    }
    else if(p.kind==='bridge')target={x:center.x+(task.phase==='cross'?30:-30)*s,y:center.y};
    else {const angle=id*2.399;target={x:center.x+Math.cos(angle)*38*s,y:center.y+Math.sin(angle)*24*s};}
    bodies[id]=move(body,target,dt,moved);
    if(distance(bodies[id],target)>3)continue;
    task.elapsed+=dt;
    if(task.kind==='build') {
      if(task.phase==='gather'&&task.elapsed>=.8) {
        task.phase='work';task.held=true;task.elapsed=0;
      } else if(task.phase==='work'&&task.elapsed>=1.5/(1+person.practice[task.role]*.08)) {
        p.work[task.role]=Math.min(3,p.work[task.role]+1);
        person.practice[task.role]=Math.min(8,person.practice[task.role]+1);
        if(!p.contributors.includes(id))p.contributors.push(id);
        remember(person,p,state);
        // Shared work is required even if one creature has all three skills.
        p.progress=Math.min(p.contributors.length<2?.9:1,p.work.reduce((a,b)=>a+b,0)/9);
        task.held=false;task.elapsed=0;task.phase='gather';
        if(p.progress===1) {p.completedAt=time;record(state,time,`The ${p.kind} is ready for everyone.`);}
        if(p.work[task.role]>=3)finish(person,p,state);
      }
    } else if(p.kind==='bridge'&&task.phase==='approach') {
      task.phase='cross';task.elapsed=0;
    } else if(task.elapsed>= (task.kind==='repair'?3:4)) {
      p.uses++;remember(person,p,state);
      if(task.kind==='repair'||p.kind==='garden') {
        p.condition=Math.min(1,p.condition+.16);p.repairs++;
        if(p.kind==='garden')p.stock=Math.min(6,p.stock+1);
      }
      if(p.kind==='garden'&&p.stock>=1){p.stock--;person.hunger=.08;}
      if(p.kind==='shelter')person.rest=.08;
      person.company=Math.max(0,person.company-.45);
      finish(person,p,state);
    }
  }
  // The creek is present before construction. Creatures detour around it;
  // a completed deck opens a direct route through the middle.
  const bridge=state.places[0],c=placePoint(bridge,moved);
  for(let i=0;i<bodies.length;i++) {
    const old=previous.bodies[i],next=bodies[i];
    if((old.x-c.x)*(next.x-c.x)<0&&Math.abs(next.y-c.y)<32*s &&
      !(bridge.progress===1&&Math.abs(next.y-c.y)<7*s)) {
      const side=old.y<c.y?-1:1;
      bodies[i]={...next,x:old.x,y:clamp(old.y+side*old.pace*dt,8,moved.height-8),heading:side*Math.PI/2};
    }
  }
  return {state,world:{...moved,bodies}};
}

// Shared drawing vocabulary for animation and the reduced-motion illustration.
export function villageMarks(state,world) {
  const marks=[],s=placeScale(world);
  const line=(points)=>marks.push({points,closed:false,solid:false});
  for(const p of state.places) {
    const center=placePoint(p,world),{x,y}=center;
    const stroke=pts=>line(pts.map(([dx,dy])=>({x:x+dx*s,y:y+dy*s})));
    if(p.kind==='bridge') {
      stroke([[-6,-32],[-9,-19],[-5,-5],[-8,10],[-5,32]]);
      stroke([[6,-32],[3,-18],[7,-4],[4,12],[7,32]]);
    }
    const src=sourcePoint(p,world);
    if(p.progress<1)for(let k=0;k<3;k++)line([{x:src.x-9*s,y:src.y+k*4*s},{x:src.x+10*s,y:src.y+(k*4-3)*s}]);
    if(!p.founded)continue;
    const progress=p.progress;
    if(progress===0){stroke([[-20,8],[-16,8],[-16,3]]);stroke([[20,8],[16,8],[16,3]]);}
    // Old places lose details as they weather; tending restores them.
    const details=p.condition>.45;
    if(p.kind==='bridge') {
      if(progress>0)stroke([[-30,5],[-30+60*Math.min(1,progress*1.5),5]]);
      if(progress>.25)stroke([[-30,-5],[-30+60*progress,-5]]);
      if(details)for(let k=0;k<Math.floor(progress*9);k++)stroke([[-27+k*7,-5],[-27+k*7,5]]);
    } else if(p.kind==='shelter') {
      if(progress>0)stroke([[-26,12],[-26,12-38*Math.min(1,progress*3)]]);
      if(progress>.25)stroke([[26,12],[26,12-38*Math.min(1,(progress-.25)*3)]]);
      if(progress>.5)stroke([[-33,-24],[0,-45],[33,-24]]);
      if(progress>.8&&details){stroke([[-19,11],[-19,3],[17,3],[17,11]]);stroke([[-33,-24],[33,-24]]);}
    } else {
      if(progress>0)stroke([[-30,12],[-36,0],[-24,-12],[24,-12],[36,0],[30,12],[-30,12]]);
      for(let k=0;k<Math.floor(progress*6);k++) {
        const dx=-22+k*9,dy=(k%2)*8-2,grow=(details?1:.4)*(p.stock>0?1:.65);
        stroke([[dx,dy],[dx,dy-18*grow]]);
        stroke([[dx,dy-7*grow],[dx-5,dy-12*grow]]);
        stroke([[dx,dy-12*grow],[dx+5,dy-16*grow]]);
      }
    }
    if(p.progress===1&&p.uses>0) {
      // The marks of gathering accumulate around inhabited places.
      for(let i=0;i<Math.min(5,Math.floor(p.uses/2));i++)stroke([[-24+i*12,21],[-20+i*12,22]]);
    }
  }
  for(const person of state.people) {
    const task=person.task,b=world.bodies[person.id];
    if(task?.held) {
      const y=b.y-b.radius*.5;
      if(task.role===0)line([{x:b.x-10*s,y},{x:b.x+12*s,y:y-4*s}]);
      else if(task.role===1)line([{x:b.x-6*s,y},{x:b.x,y:y-9*s},{x:b.x+6*s,y}]);
      else line([{x:b.x-5*s,y},{x:b.x-5*s,y:y-6*s},{x:b.x+5*s,y:y-6*s},{x:b.x+5*s,y}]);
    }
    if(task&&task.elapsed>0&&task.phase!=='gather') {
      const y=b.y-b.radius*.8;
      const pulse=Math.sin(world.time*3+person.id)*2;
      line([{x:b.x-3,y:y-3-pulse},{x:b.x,y:y-6-pulse},{x:b.x+3,y:y-3-pulse}]);
    }
  }
  return marks;
}

// Light, short footsteps accumulate into routes without outlining a network.
export function villageTrailMarks(state,world) {
  const marks=[],s=placeScale(world);
  for(const path of state.paths) {
    const a=placePoint(state.places[path.a],world),b=placePoint(state.places[path.b],world);
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy));
    const pieces=Math.ceil(d/9),strength=Math.min(1,path.uses/5);
    for(let i=0;i<pieces;i++) {
      if((i*7%11)/11>strength)continue;
      const point=t=>{
        const bend=Math.sin(t*Math.PI)*16*s;
        return {x:a.x+dx*t-dy/d*bend,y:a.y+dy*t+dx/d*bend};
      };
      marks.push({points:[point(i/pieces),point((i+.35)/pieces)],closed:false,solid:false});
    }
  }
  return marks;
}

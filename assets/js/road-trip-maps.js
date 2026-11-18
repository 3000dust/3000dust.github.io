/* Road trip waypoint maps for Beyond Research. No API key or JS library required.
   The dashed polylines connect saved stops, not actual road geometry. */
(() => {
  'use strict';
  const dataNode = document.getElementById('road-trip-route-data');
  const containers = [...document.querySelectorAll('.road-trip-widget[data-trip-id]')];
  if (!dataNode || !containers.length) return;
  let trips;
  try {
    trips = JSON.parse(dataNode.textContent);
    if (!Array.isArray(trips)) throw new Error('Route data is not a list');
  } catch (e) {
    console.error('Road trip map data:', e);
    containers.forEach(e => { const m=e.querySelector('.road-trip-widget__map');if(m)m.textContent='Map preview unavailable. Use the original Google driving directions below.';});
    return;
  }
  const tripById = new Map(trips.map(t => [String(t.id), t]));
  const RAD = Math.PI / 180, TILE = 256, SVG_NS='http://www.w3.org/2000/svg';
  const instances=[];
  const bounds=(a,b,c)=>Math.max(b,Math.min(c,a));
  function merc(lat,lon,z){
    const world=TILE*Math.pow(2,z),r=bounds(lat,-85.0511,85.0511)*RAD;
    return {x:(lon+180)/360*world,y:(1-Math.asinh(Math.tan(r))/Math.PI)/2*world};
  }
  function unmerc(x,y,z){
    const world=TILE*Math.pow(2,z);
    return {lat:Math.atan(Math.sinh(Math.PI*(1-2*y/world)))/RAD,lon:x/world*360-180};
  }
  function make(tag,cls,parent){const e=document.createElement(tag);if(cls)e.className=cls;parent.appendChild(e);return e;}
  function svgNode(tag,attrs,parent){const e=document.createElementNS(SVG_NS,tag);for(const [k,v] of Object.entries(attrs||{}))e.setAttribute(k,String(v));parent.appendChild(e);return e;}
  function start(div){
    if(div.dataset.initialized==='true')return;
    const trip=tripById.get(div.dataset.tripId);
    const holder=div.querySelector('.road-trip-widget__map');
    if(!trip||!holder||!Array.isArray(trip.stops)||trip.stops.length<2){
      if(holder)holder.textContent='Trip preview unavailable. The original map is available below.';
      return;
    }
    div.dataset.initialized='true';div.dataset.stopCount=String(trip.stops.length);
    const canvas=make('canvas','road-trip-widget__geography',holder);
    canvas.setAttribute('aria-hidden','true');
    const tiles=make('div','road-trip-widget__tiles',holder);
    tiles.setAttribute('aria-hidden','true');
    const svg=svgNode('svg',{class:'road-trip-widget__routes',role:'img','aria-label':'Map of '+trip.title+' with '+trip.stops.length+' stops'},holder);
    const controls=make('div','road-trip-widget__controls',holder);
    controls.setAttribute('aria-label','Map controls');
    for(const [value,title,caption] of [['in','Zoom in','+'],['out','Zoom out','−'],['reset','Show entire trip','⌖']]){
      const button=make('button','',controls);button.type='button';button.textContent=caption;button.setAttribute('aria-label',title);button.title=title;button.dataset.action=value;
    }
    const tip=make('div','road-trip-widget__popup',holder);tip.hidden=true;
    const attr=make('div','road-trip-widget__attribution',holder);
    const link=make('a','',attr);link.href='https://www.openstreetmap.org/copyright';link.target='_blank';link.rel='noopener';link.textContent='© OpenStreetMap contributors';
    let W=holder.clientWidth||780,H=holder.clientHeight||330,z=6,lat=40,lon=-90,raf=0;
    let initial=null,pointerStart=null;
    const tileElements=new Map();
    function fit(){
      W=holder.clientWidth||780;H=holder.clientHeight||330;
      const coords=trip.stops.map(s=>merc(+s[0],+s[1],0));
      const loX=Math.min(...coords.map(p=>p.x)),hiX=Math.max(...coords.map(p=>p.x));
      const loY=Math.min(...coords.map(p=>p.y)),hiY=Math.max(...coords.map(p=>p.y));
      const spanX=Math.max(6,hiX-loX),spanY=Math.max(5,hiY-loY);
      const zz=Math.log2(Math.min((W-75)/spanX,(H-75)/spanY));
      z=bounds(zz,2.3,12);const middle=unmerc((loX+hiX)/2,(loY+hiY)/2,0);lat=middle.lat;lon=middle.lon;
      initial={lat,lon,z};
    }
    function toScreen(a,b){
      const p=merc(a,b,z),c=merc(lat,lon,z),world=TILE*Math.pow(2,z);
      let dx=p.x-c.x;
      if(dx>world/2)dx-=world;if(dx< -world/2)dx+=world;
      return {x:W/2+dx,y:H/2+p.y-c.y};
    }
    function drawGeography(){
      const ratio=Math.min(2,window.devicePixelRatio||1);
      canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio);
      const ctx=canvas.getContext('2d');if(!ctx)return;
      ctx.setTransform(ratio,0,0,ratio,0,0);
      ctx.fillStyle='#deedf3';ctx.fillRect(0,0,W,H);
      const geo=window.BOYU_FLIGHT_MAP_GEOGRAPHY;
      if(!geo || !Array.isArray(geo.land))return;
      function paint(rings,fill,stroke,w,closed){
        ctx.beginPath();
        for(const line of rings){let first=true,prev=NaN;
          for(const [x,y] of line){const p=toScreen(y,x);if(first||Math.abs(p.x-prev)>TILE*Math.pow(2,z)/2){ctx.moveTo(p.x,p.y);first=false;}else ctx.lineTo(p.x,p.y);prev=p.x;}
          if(closed)ctx.closePath();
        }
        if(fill){ctx.fillStyle=fill;ctx.fill('evenodd');}
        if(stroke){ctx.lineWidth=w;ctx.strokeStyle=stroke;ctx.stroke();}
      }
      paint(geo.land,'#e2e9e5','#b3c7ce',.8,true);
      if(z>=4&&Array.isArray(geo.states))paint(geo.states,null,'#bdd1d3',.65,false);
    }
    function drawTiles(){
      const tz=bounds(Math.floor(z),0,15),scale=Math.pow(2,z-tz),n=Math.pow(2,tz);
      const c=merc(lat,lon,tz),tSize=TILE*scale;
      const a=Math.floor(c.x/TILE-W/(2*tSize))-1,b=Math.ceil(c.x/TILE+W/(2*tSize))+1;
      const top=Math.max(0,Math.floor(c.y/TILE-H/(2*tSize))-1),bottom=Math.min(n-1,Math.ceil(c.y/TILE+H/(2*tSize))+1);
      const used=new Set();
      for(let x=a;x<=b;x++)for(let y=top;y<=bottom;y++){
        const xx=((x%n)+n)%n,key=[tz,xx,y].join(':');used.add(key);
        let img=tileElements.get(key);
        if(!img){
          img=make('img','',tiles);img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='strict-origin-when-cross-origin';
          img.src='https://tile.openstreetmap.org/'+tz+'/'+xx+'/'+y+'.png';tileElements.set(key,img);
        }
        img.style.width=(tSize+1)+'px';img.style.height=(tSize+1)+'px';
        img.style.left=(W/2+(x*TILE-c.x)*scale)+'px';img.style.top=(H/2+(y*TILE-c.y)*scale)+'px';
      }
      for(const [key,img] of tileElements)if(!used.has(key)){img.remove();tileElements.delete(key);}
    }
    function showPopup(event,index){
      const s=trip.stops[index];
      tip.textContent=(index+1)+' / '+trip.stops.length+' · '+s[2];tip.hidden=false;
      const rect=holder.getBoundingClientRect();
      const x=event.clientX?event.clientX-rect.left:toScreen(s[0],s[1]).x;
      const y=event.clientY?event.clientY-rect.top:toScreen(s[0],s[1]).y;
      tip.style.left=bounds(x+12,7,Math.max(7,W-tip.offsetWidth-10))+'px';
      tip.style.top=bounds(y+12,7,Math.max(7,H-tip.offsetHeight-10))+'px';
    }
    function drawPath(){
      svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.replaceChildren();
      const points=trip.stops.map(s=>toScreen(+s[0],+s[1]));
      const d=points.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+','+p.y.toFixed(2)).join(' ');
      svgNode('path',{d,class:'road-trip-widget__line'},svg);
      // Use all saved waypoints for geometry; thin crowded marker symbols so they stay legible.
      const occupied=[];
      for(let i=0;i<points.length;i++){
        const p=points[i],endpoint=i===0||i===points.length-1;
        if(p.x<0||p.x>W||p.y<0||p.y>H)continue;
        if(!endpoint&&occupied.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<14))continue;
        occupied.push(p);
        const dot=svgNode('g',{'class':'road-trip-widget__stop',role:'button',tabindex:'0','aria-label':(i+1)+' '+trip.stops[i][2]},svg);
        svgNode('circle',{cx:p.x,cy:p.y,r:endpoint?6:3.8,class:'road-trip-widget__stop-dot'},dot);
        if(endpoint){
          const label=svgNode('text',{x:p.x,y:p.y+0.5,'text-anchor':'middle','dominant-baseline':'middle'},dot);
          label.textContent=i===0?'A':'B';
        }
        const tooltip=svgNode('title',{},dot);tooltip.textContent=(i+1)+'. '+trip.stops[i][2];
        dot.addEventListener('click',e=>{e.stopPropagation();showPopup(e,i);});
        dot.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showPopup(e,i);}});
      }
    }
    function draw(){
      W=holder.clientWidth||780;H=holder.clientHeight||330;
      drawGeography();drawTiles();drawPath();
    }
    function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;draw();});}
    function move(newZ,newLat,newLon){z=bounds(newZ,2,15);lat=bounds(newLat,-84,84);lon=((newLon+540)%360)-180;tip.hidden=true;schedule();}
    function zoomAt(factor,cx=W/2,cy=H/2){
      const origin=merc(lat,lon,z);const anchor=unmerc(origin.x+cx-W/2,origin.y+cy-H/2,z);
      const newZ=bounds(z+Math.log2(factor),2,15);
      const changed=merc(anchor.lat,anchor.lon,newZ);
      const updated=unmerc(changed.x-(cx-W/2),changed.y-(cy-H/2),newZ);
      move(newZ,updated.lat,updated.lon);
    }
    controls.addEventListener('click',e=>{
      const button=e.target.closest('[data-action]');if(!button)return;
      if(button.dataset.action==='in')zoomAt(1.42);
      if(button.dataset.action==='out')zoomAt(1/1.42);
      if(button.dataset.action==='reset'){fit();schedule();}
    });
    holder.addEventListener('wheel',e=>{
      // Do not trap page scrolling through nine maps. Ctrl+wheel (or pinch) zooms the map.
      if(!e.ctrlKey&&!e.metaKey)return;
      e.preventDefault();const rect=holder.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY*.002),e.clientX-rect.left,e.clientY-rect.top);
    },{passive:false});
    holder.addEventListener('pointerdown',e=>{
      if(e.target.closest('button,.road-trip-widget__stop,a'))return;
      if(e.button!==0)return;
      const rect=holder.getBoundingClientRect();
      pointerStart={x:e.clientX,y:e.clientY,lat,lon,z};
      holder.setPointerCapture(e.pointerId);holder.classList.add('is-dragging');tip.hidden=true;
    });
    holder.addEventListener('pointermove',e=>{
      if(!pointerStart)return;
      const center=merc(pointerStart.lat,pointerStart.lon,pointerStart.z);
      const newPos=unmerc(center.x-(e.clientX-pointerStart.x),center.y-(e.clientY-pointerStart.y),pointerStart.z);
      move(pointerStart.z,newPos.lat,newPos.lon);
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture'])holder.addEventListener(event,()=>{pointerStart=null;holder.classList.remove('is-dragging');});
    holder.addEventListener('click',e=>{if(!e.target.closest('.road-trip-widget__stop,.road-trip-widget__controls'))tip.hidden=true;});
    const old=div.querySelector('details.road-trip-widget__original');
    if(old)old.addEventListener('toggle',()=>{
      // Delay loading Google embeds until the visitor explicitly opens them.
      if(!old.open)return;
      const iframe=old.querySelector('iframe[data-source]');
      if(iframe){iframe.src=iframe.dataset.source;iframe.removeAttribute('data-source');}
    });
    fit();schedule();
    if(typeof ResizeObserver==='function')new ResizeObserver(()=>{fit();schedule();}).observe(holder);
    else window.addEventListener('resize',()=>{fit();schedule();});
    div.dataset.ready='true';
    instances.push({id:trip.id,points:trip.stops.length,holder});
  }
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);start(entry.target);}
    },{rootMargin:'280px 0px'});
    containers.forEach(div=>observer.observe(div));
  }else containers.forEach(start);
  window.BOYU_ROAD_TRIP_MAPS={startAll:()=>containers.forEach(start),getInitialized:()=>instances.map(x=>({id:x.id,stops:x.points}))};
})();
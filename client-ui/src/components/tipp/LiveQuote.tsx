import {useEffect,useRef,useState} from 'react';
/** The price slot stays fixed while a short-lived signal shows feed movement. */
export function LiveQuote({value,locked=false}:{value:number;locked?:boolean}){
 const previous=useRef(value),queued=useRef(0),[movement,setMovement]=useState({direction:0,revision:0});
 useEffect(()=>{
  if(value!==previous.current){queued.current=value>previous.current?1:-1;previous.current=value;}
  if(locked){setMovement(p=>({...p,direction:0}));return;}
  if(!queued.current)return;
  const direction=queued.current;queued.current=0;setMovement(p=>({direction,revision:p.revision+1}));
  const timer=setTimeout(()=>setMovement(p=>({...p,direction:0})),3000);return()=>clearTimeout(timer);
 },[value,locked]);
 return <span className="ht-live-quote"><span>{locked?'Gesperrt':value.toFixed(2)}</span><span className="ht-quote-signal" aria-live="polite">{!locked&&movement.direction!==0&&<i key={movement.revision} className={movement.direction>0?'is-up':'is-down'} role="img" aria-label={movement.direction>0?'Quote gestiegen':'Quote gefallen'}>{movement.direction>0?'↑':'↓'}</i>}</span></span>;
}

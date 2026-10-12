import { GetSessionDataManager } from '@octane/renderer';
export type DirectMessage = { id:string;sender:number;recipient:number;body:string;mime:string;duration:number;created:number;delivered:number;read:number;size:number };
type Listener=(messages:DirectMessage[])=>void;
let socket:WebSocket|null=null, ready=false, stopped=true, retry:ReturnType<typeof setTimeout>, ping:ReturnType<typeof setInterval>;
const listeners=new Set<Listener>(), statuses=new Set<()=>void>();
const pending=new Map<string,{resolve:(data:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
export const isDirectChatReady=()=>ready;
export const subscribeDirectChatStatus=(fn:()=>void)=>{statuses.add(fn);return()=>{statuses.delete(fn);};};
const setReady=(value:boolean)=>{ready=value;statuses.forEach(fn=>fn());};
export function directChatRequest(action:string,data:Record<string,unknown>={}):Promise<any>{
 if(!ready||socket?.readyState!==WebSocket.OPEN)return Promise.reject(new Error('Die Chatverbindung ist noch nicht bereit.'));
 const requestId=crypto.randomUUID();
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error('Keine Bestätigung erhalten. Bitte den Chat prüfen, bevor du erneut sendest.'));},20000);
  pending.set(requestId,{resolve,reject,timer});
  socket.send(JSON.stringify({header:'getProfile',data:{username:GetSessionDataManager().userName,action,text:JSON.stringify({...data,requestId})}}));
 });
}
function connect(){
 if(stopped)return;
 const token=localStorage.getItem('kubboch-sto');
 if(!token||!GetSessionDataManager().userName){retry=setTimeout(connect,3000);return;}
 const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/habboje-ws`);socket=ws;
 ws.onopen=()=>ws.send(JSON.stringify({header:'auth',data:{sso:token}}));
 ws.onmessage=event=>{
  if(stopped||socket!==ws)return;
  try{
   const packet=JSON.parse(event.data);
   if(packet.header==='authResponse'){
    if(packet.data?.data==='Success')ws.send(JSON.stringify({header:'getProfile',data:{username:GetSessionDataManager().userName,action:'dmSubscribe',text:JSON.stringify({requestId:crypto.randomUUID()})}}));
    else ws.close();
    return;
   }
   if(packet.header!=='directChat')return;
   const data=JSON.parse(packet.data.data);
   if(data.action==='ready'&&!data.error){setReady(true);void directChatRequest('dmHistory').catch(()=>{});}
   if(data.message)listeners.forEach(fn=>fn([data.message]));
   if(Array.isArray(data.messages))listeners.forEach(fn=>fn([...data.messages].reverse()));
   const request=pending.get(data.requestId);if(request){clearTimeout(request.timer);pending.delete(data.requestId);data.error?request.reject(new Error(data.error)):request.resolve(data);}
  }catch{/* Ignore an unrelated or malformed websocket packet. */}
 };
 ws.onclose=()=>{if(socket!==ws)return;setReady(false);pending.forEach(p=>{clearTimeout(p.timer);p.reject(new Error('Chatverbindung unterbrochen.'));});pending.clear();if(!stopped)retry=setTimeout(connect,3000);};
 clearInterval(ping);ping=setInterval(()=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({header:'ping',data:{}}));},10000);
}
export function startDirectChat(listener:Listener){
 listeners.add(listener);if(stopped){stopped=false;connect();}
 return()=>{listeners.delete(listener);if(!listeners.size){stopped=true;clearTimeout(retry);clearInterval(ping);socket?.close();setReady(false);}};
}
export async function sendDirectMedia(peer:number,blob:Blob,duration=0,id:string=crypto.randomUUID()){
 const max=blob.type==='image/gif'?2*1024*1024:384*1024;
 if(blob.size<(blob.type==='image/gif'?14:128)||blob.size>max)throw new Error(blob.type==='image/gif'?'GIF-Dateien dürfen maximal 2 MB groß sein.':'Die Aufnahme ist leer oder zu groß.');
 await directChatRequest('dmUploadStart',{peer,id,mime:blob.type,size:blob.size,duration});
 for(let offset=0;offset<blob.size;offset+=192*1024){
  const bytes=new Uint8Array(await blob.slice(offset,offset+192*1024).arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
  await directChatRequest('dmUploadChunk',{id,offset,data:btoa(binary)});
 }
 await directChatRequest('dmUploadFinish',{id});
}
export async function loadDirectMedia(id:string):Promise<Blob>{
 const chunks:Uint8Array[]=[];let offset=0,mime='',size=0;
 do{
  const data=await directChatRequest('dmMedia',{id,offset});
  if(data.size>2*1024*1024||data.size<1||!['image/gif','audio/webm','audio/webm;codecs=opus','audio/ogg','audio/ogg;codecs=opus','audio/mp4'].includes(data.mime))throw new Error('Ungültige Mediendatei.');
  if(offset&& (data.size!==size||data.mime!==mime))throw new Error('Datei wurde während des Ladens geändert.');
  size=data.size;mime=data.mime;const bytes=Uint8Array.from(atob(data.data),c=>c.charCodeAt(0));if(!bytes.length||offset+bytes.length>size)throw new Error('Datei unvollständig.');chunks.push(bytes);offset+=bytes.length;
 }while(offset<size);
 return new Blob(chunks as BlobPart[],{type:mime});
}

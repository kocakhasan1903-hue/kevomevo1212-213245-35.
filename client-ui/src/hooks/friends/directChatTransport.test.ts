import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('@octane/renderer',()=>({GetSessionDataManager:()=>({userName:'Test'})}));
class Socket {
 static OPEN=1;static latest:Socket;readyState=1;onopen:any;onmessage:any;onclose:any;sent:any[]=[];
 constructor(){Socket.latest=this;}send(value:string){this.sent.push(JSON.parse(value));}close(){this.readyState=3;this.onclose?.();}
 message(data:any){this.onmessage({data:JSON.stringify({header:'directChat',data:{data:JSON.stringify(data)}})});}
}
let transport:typeof import('./directChatTransport'),stop:()=>void;
beforeEach(async()=>{vi.resetModules();vi.useFakeTimers();vi.stubGlobal('WebSocket',Socket);localStorage.setItem('kubboch-sto','test-token');transport=await import('./directChatTransport');});
afterEach(()=>{stop?.();vi.useRealTimers();vi.unstubAllGlobals();localStorage.clear();});
function ready(fn=vi.fn()) {stop=transport.startDirectChat(fn);const ws=Socket.latest;ws.onopen();ws.onmessage({data:JSON.stringify({header:'authResponse',data:{data:'Success'}})});ws.message({action:'ready'});return ws;}
it('does not send before server subscription and correlates acknowledgement/errors',async()=>{
 stop=transport.startDirectChat(vi.fn());await expect(transport.directChatRequest('dmSend')).rejects.toThrow('nicht bereit');Socket.latest.message({action:'ready'});
 const result=transport.directChatRequest('dmSend',{peer:8,id:'stable-id',body:'Hallo'});const sent=JSON.parse(Socket.latest.sent.at(-1).data.text);
 Socket.latest.message({requestId:'unrelated',error:'ignored'});Socket.latest.message({requestId:sent.requestId,message:{id:'stored'}});
 expect((await result).message.id).toBe('stored');
 const rejected=transport.directChatRequest('dmSend');const rejection=expect(rejected).rejects.toThrow('Nicht erlaubt');Socket.latest.message({requestId:JSON.parse(Socket.latest.sent.at(-1).data.text).requestId,error:'Nicht erlaubt'});await rejection;
});
it('delivers history oldest first and keeps incoming messages independent of requests',()=>{
 const listener=vi.fn();const ws=ready(listener);ws.message({messages:[{id:'new'},{id:'old'}]});expect(listener).toHaveBeenLastCalledWith([{id:'old'},{id:'new'}]);ws.message({action:'message',message:{id:'live',delivered:12,read:0}});expect(listener).toHaveBeenLastCalledWith([{id:'live',delivered:12,read:0}]);
});
it('fails pending operations on disconnect instead of treating them as delivered',async()=>{
 const ws=ready();const result=transport.directChatRequest('dmSend');const failure=expect(result).rejects.toThrow('unterbrochen');ws.close();await failure;expect(transport.isDirectChatReady()).toBe(false);
});
it('rejects unsupported media responses',async()=>{
 const ws=ready();const result=transport.loadDirectMedia('known');const failure=expect(result).rejects.toThrow('Ungültige');ws.message({requestId:JSON.parse(ws.sent.at(-1).data.text).requestId,size:12,mime:'text/html',data:'Zm9v'});await failure;
});
it('connects when the login token becomes available after mounting',async()=>{
 localStorage.removeItem('kubboch-sto');const previous=Socket.latest;stop=transport.startDirectChat(vi.fn());expect(Socket.latest).toBe(previous);
 localStorage.setItem('kubboch-sto','test-token');await vi.advanceTimersByTimeAsync(3000);expect(Socket.latest).not.toBe(previous);
});

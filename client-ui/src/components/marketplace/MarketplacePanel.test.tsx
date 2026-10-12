/* @vitest-environment jsdom */
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {MarketplacePanel} from './MarketplacePanel';
class FakeSocket {
 static OPEN=1;static last:FakeSocket;readyState=1;onopen:any;onmessage:any;onclose:any;onerror:any;sent:any[]=[];
 constructor(){FakeSocket.last=this;}
 send(value:string){this.sent.push(JSON.parse(value));}
 close(){}
 receive(header:string,data:any){act(()=>this.onmessage({data:JSON.stringify({header,data:{data:typeof data==='string'?data:JSON.stringify(data)}})}));}
}
const offer={id:123,name:'Sessel',asset:'chair',seller:'Alpha',own:false,price:55,proceeds:50,state:1};
function ready(){
 render(<MarketplacePanel username="Syntetic"/>);const ws=FakeSocket.last;
 act(()=>ws.onopen());ws.receive('authResponse','Success');
 const q=JSON.parse(ws.sent.at(-1).data.text);
 ws.receive('marketState',{items:[offer],total:1,enabled:true,currency:0,notice:'',page:0,tab:'browse',requestId:q.requestId});
 return ws;
}
describe('Marketplace trade confirmation',()=>{
 beforeEach(()=>{vi.stubGlobal('WebSocket',FakeSocket);localStorage.setItem('kubboch-sto','cms_test');});
 afterEach(()=>{cleanup();vi.unstubAllGlobals();localStorage.clear();});
 it('never buys when merely opening an offer and sends the confirmed quote only once',()=>{
  const ws=ready();fireEvent.click(screen.getByText('Sessel'));
  expect(ws.sent.filter(m=>m.data?.action==='marketBuy')).toHaveLength(0);
  const buy=screen.getByRole('button',{name:'Für 55 Taler kaufen'});fireEvent.click(buy);fireEvent.click(buy);
  const purchases=ws.sent.filter(m=>m.data?.action==='marketBuy');expect(purchases).toHaveLength(1);
  expect(JSON.parse(purchases[0].data.text)).toMatchObject({id:123,price:55});
 });
 it('keeps a failed purchase visible and does not invent a successful sale',()=>{
  const ws=ready();fireEvent.click(screen.getByText('Sessel'));fireEvent.click(screen.getByRole('button',{name:'Für 55 Taler kaufen'}));
  ws.receive('profileError','Nicht genug Taler');
  expect(screen.getAllByText('Nicht genug Taler').length).toBeGreaterThan(0);
  expect(screen.getByRole('dialog',{name:'Angebot'})).toBeTruthy();
  expect(screen.queryByText(/Gekauft!/)).toBeNull();
 });
 it('canceling an offer preview sends no trade request',()=>{
  const ws=ready();fireEvent.click(screen.getByText('Sessel'));fireEvent.click(screen.getByRole('button',{name:'Abbrechen'}));
  expect(ws.sent.filter(m=>m.data?.action==='marketBuy')).toHaveLength(0);
 });
 it('claims only the enabled vault, through one confirmed emulator request',()=>{
  const ws=ready();fireEvent.click(screen.getByRole('tab',{name:'Meine Angebote'}));
  const q=JSON.parse(ws.sent.at(-1).data.text);
  ws.receive('marketState',{items:[],total:0,enabled:true,currency:0,notice:'',page:0,tab:'own',ownSection:1,requestId:q.requestId,vaults:[{type:0,amount:50,enabled:true},{type:104,amount:0,enabled:false},{type:5,amount:0,enabled:false},{type:-2,amount:0,enabled:false}]});
  expect(screen.getByRole('button',{name:'Diamanten: 0 Verkaufserlöse abholen'})).toBeDisabled();
  const vault=screen.getByRole('button',{name:'Taler: 50 Verkaufserlöse abholen'});fireEvent.click(vault);fireEvent.click(vault);
  const claims=ws.sent.filter(m=>m.data?.action==='marketClaim');expect(claims).toHaveLength(1);expect(JSON.parse(claims[0].data.text).currency).toBe(0);
 });
 it('reconnects without repeating a previously sent trade',()=>{
  const ws=ready();fireEvent.click(screen.getByText('Sessel'));fireEvent.click(screen.getByRole('button',{name:'Für 55 Taler kaufen'}));
  act(()=>ws.onclose());fireEvent.click(screen.getByRole('button',{name:'Neu verbinden'}));
  const next=FakeSocket.last;act(()=>next.onopen());next.receive('authResponse','Success');
  expect(next.sent.filter(m=>m.data?.action==='marketBuy')).toHaveLength(0);
  expect(next.sent.some(m=>m.data?.action==='marketList')).toBe(true);
 });
});

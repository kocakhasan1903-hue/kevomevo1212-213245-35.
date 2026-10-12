import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appearanceBackground, useCmsProfile } from './useCmsProfile';

class ProfileSocket {
 static OPEN=1;
 static instances:ProfileSocket[]=[];
 readyState=1;
 onopen:()=>void;
 onmessage:(event:any)=>void;
 onerror:()=>void;
 onclose:()=>void;
 send=vi.fn();close=vi.fn();
 constructor(public url:string){ProfileSocket.instances.push(this);}
 receive(header:string,data:any){this.onmessage?.({data:JSON.stringify({header,data:{data}})});}
}
describe('CMS profile transport',()=>{
 beforeEach(()=>{vi.useFakeTimers();ProfileSocket.instances=[];vi.stubGlobal('WebSocket',ProfileSocket);localStorage.setItem('kubboch-sto','cms_session_for_test');});
 afterEach(()=>{cleanup();localStorage.clear();vi.unstubAllGlobals();vi.useRealTimers();});
 it('authenticates first, rejects another owner response, and saves through the authenticated socket',()=>{
  const hook=renderHook(()=>useCmsProfile('Alice',17));const socket=ProfileSocket.instances[0];
  act(()=>socket.onopen());expect(JSON.parse(socket.send.mock.calls[0][0]).header).toBe('auth');
  act(()=>socket.receive('authResponse','Success'));
  expect(JSON.parse(socket.send.mock.calls[1][0])).toEqual({header:'getProfile',data:{username:'Alice',action:'get',text:'',postId:0}});
  act(()=>socket.receive('profileExtras',JSON.stringify({ownerId:18,appearance:{}})));expect(hook.result.current.data).toBeNull();
  act(()=>socket.receive('profileExtras',JSON.stringify({ownerId:17,appearance:{borderWidth:2}})));expect(hook.result.current.data.appearance.borderWidth).toBe(2);
  act(()=>hook.result.current.send('clientAppearance','{"mainColor":"#123456"}'));expect(hook.result.current.pending).toBe(true);
  act(()=>socket.receive('profileError','Du kannst nur dein eigenes Profil bearbeiten.'));expect(hook.result.current.pending).toBe(false);expect(hook.result.current.error).toContain('eigenes Profil');
  hook.unmount();expect(socket.close).toHaveBeenCalledOnce();
 });
 it('does not reuse a consumed game SSO as a website session',()=>{
  localStorage.setItem('kubboch-sto','game_ticket');const hook=renderHook(()=>useCmsProfile('Alice',17));
  expect(ProfileSocket.instances).toHaveLength(0);expect(hook.result.current.error).toContain('Webseite');
 });
 it('updates another open view of the same profile after a confirmed save',()=>{
  const first=renderHook(()=>useCmsProfile('Alice',17)),second=renderHook(()=>useCmsProfile('Alice',17)),other=renderHook(()=>useCmsProfile('Bob',18));
  act(()=>ProfileSocket.instances[0].receive('profileExtras',JSON.stringify({ownerId:17,action:'clientAppearance',appearance:{borderColor:'#123456'}})));
  expect(first.result.current.data.appearance.borderColor).toBe('#123456');expect(second.result.current.data.appearance.borderColor).toBe('#123456');expect(other.result.current.data).toBeNull();
 });
 it('clears a pending request on timeout',()=>{
  const hook=renderHook(()=>useCmsProfile('Alice',17));const socket=ProfileSocket.instances[0];
  act(()=>{socket.onopen();socket.receive('authResponse','Success');});act(()=>vi.advanceTimersByTime(12000));
  expect(hook.result.current.pending).toBe(false);expect(hook.result.current.error).toContain('Serverbestätigung');
 });
 it('reports a stalled authentication and a disconnected pending save',()=>{
  const hook=renderHook(()=>useCmsProfile('Alice',17));const socket=ProfileSocket.instances[0];
  act(()=>vi.advanceTimersByTime(12000));expect(hook.result.current.error).toContain('Profilverbindung');
  act(()=>{socket.onopen();socket.receive('authResponse','Success');socket.receive('profileExtras',JSON.stringify({ownerId:17}));});
  act(()=>hook.result.current.send('clientAppearance','{}'));expect(hook.result.current.pending).toBe(true);
  act(()=>socket.onclose());expect(hook.result.current.pending).toBe(false);expect(hook.result.current.error).toContain('geschlossen');
  const calls=socket.send.mock.calls.length;act(()=>hook.result.current.send('clientAppearance','{}'));expect(socket.send.mock.calls).toHaveLength(calls);
 });
 it('rejects script URLs and URLs containing credentials',()=>{
  expect(appearanceBackground('javascript:alert(1)')).toEqual({});expect(appearanceBackground('https://user:secret@example.org/a.png')).toEqual({});
  expect(appearanceBackground('#123456')).toEqual({backgroundColor:'#123456'});expect(appearanceBackground('https://example.org/a.gif').backgroundImage).toContain('a.gif');
 });
});

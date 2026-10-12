import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DraggableWindow } from './DraggableWindow';
import { GetLocalStorage } from '../../api';
vi.mock('../../api',()=>({GetLocalStorage:vi.fn(()=>null),SetLocalStorage:vi.fn()}));
beforeEach(()=>vi.mocked(GetLocalStorage).mockReturnValue(null));
afterEach(()=>{cleanup();localStorage.clear();vi.useRealTimers();vi.clearAllMocks();});
function Window({id,close,protectedEditor=false}:any){return <DraggableWindow uniqueKey={id}><div className={protectedEditor?'habbix-profile-editor':''}><div className="drag-handler"/><button className="octane-card-close-button" onClick={close}>Schließen</button></div></DraggableWindow>;}
describe('Smart Mode window dismissal',()=>{
 it('closes only the topmost window after it has been brought to the front',()=>{
  localStorage.setItem('habbix.smart-mode',JSON.stringify({escape:true}));const first=vi.fn(),second=vi.fn();
  render(<><Window id="first" close={first}/><Window id="second" close={second}/></>);
  fireEvent.mouseDown(document.querySelector('[data-window-key="first"]'));
  fireEvent.keyDown(window,{key:'Escape'});
  expect(first).toHaveBeenCalledOnce();expect(second).not.toHaveBeenCalled();
 });
 it('keeps a profile editor open when ESC or an outside click is used',()=>{
  localStorage.setItem('habbix.smart-mode',JSON.stringify({escape:true,outside:true}));const close=vi.fn();
  render(<Window id="profile" close={close} protectedEditor/>);
  fireEvent.keyDown(window,{key:'Escape'});fireEvent.pointerDown(document.body);expect(close).not.toHaveBeenCalled();
 });
 it('keeps Smart Mode fully readable while applying transparency to other windows',()=>{
  localStorage.setItem('habbix.smart-mode',JSON.stringify({opacity:40}));
  render(<><Window id="habbix-smart-mode" close={vi.fn()}/><Window id="navigator" close={vi.fn()}/></>);
  expect((document.querySelector('[data-window-key="habbix-smart-mode"]') as HTMLElement).style.opacity).toBe('1');
  expect((document.querySelector('[data-window-key="navigator"]') as HTMLElement).style.opacity).toBe('0.4');
 });
 it('closes a navigator with ESC and never invokes its help button',()=>{
  localStorage.setItem('habbix.smart-mode',JSON.stringify({escape:true}));const help=vi.fn(),close=vi.fn();
  render(<DraggableWindow uniqueKey="navigator"><div className="drag-handler"><button className="octane-navigator-air__close octane-navigator-air__help" onClick={help}>Hilfe</button><button className="octane-navigator-air__close" onClick={close}>Schließen</button></div></DraggableWindow>);
  fireEvent.keyDown(window,{key:'Escape'});expect(close).toHaveBeenCalledOnce();expect(help).not.toHaveBeenCalled();
 });
 it('closes the marketplace search but protects an open purchase confirmation',()=>{
  localStorage.setItem('habbix.smart-mode',JSON.stringify({escape:true}));const close=vi.fn();
  const Market=({confirm=false}:any)=><DraggableWindow uniqueKey="habbix-marketplace"><div className="hmp-window-header"><button onClick={close}>Schließen</button></div><form className="hmp-search"><input/></form>{confirm&&<section className="hmp-confirm">Kauf bestätigen</section>}</DraggableWindow>;
  const result=render(<Market/>);(document.querySelector('.hmp-search input') as HTMLInputElement).focus();fireEvent.keyDown(window,{key:'Escape'});expect(close).toHaveBeenCalledOnce();
  close.mockClear();result.rerender(<Market confirm/>);fireEvent.keyDown(window,{key:'Escape'});expect(close).not.toHaveBeenCalled();
 });
 it('closes a window after inactivity and resets its timer on interaction',()=>{
  vi.useFakeTimers();localStorage.setItem('habbix.smart-mode',JSON.stringify({idleSeconds:2}));const close=vi.fn();
  render(<Window id="inventory" close={close}/>);
  act(()=>vi.advanceTimersByTime(1500));fireEvent.pointerMove(document.querySelector('[data-window-key="inventory"]'));
  act(()=>vi.advanceTimersByTime(1500));expect(close).not.toHaveBeenCalled();
  act(()=>vi.advanceTimersByTime(500));expect(close).toHaveBeenCalledOnce();
 });
 it('closes the first window when clicking another window, and leaves the clicked window open',()=>{
  localStorage.setItem('habbix.smart-mode',JSON.stringify({outside:true}));const first=vi.fn(),second=vi.fn();
  render(<><Window id="first" close={first}/><Window id="second" close={second}/></>);
  fireEvent.pointerDown(document.querySelector('[data-window-key="second"]'));
  expect(first).toHaveBeenCalledOnce();expect(second).not.toHaveBeenCalled();
 });
 it('opens centered even when Smart Mode contains a saved off-center position',()=>{
  vi.mocked(GetLocalStorage).mockReturnValue({offset:{x:110,y:70}});
  const result=render(<Window id="inventory" close={vi.fn()}/>);
  const expected=`translate3d(${Math.round((window.innerWidth-340)/2)}px, ${Math.round((window.innerHeight-462)/2)}px, 0)`;
  expect((document.querySelector('[data-window-key="inventory"]') as HTMLElement).style.transform).toBe(expected);
  expect(GetLocalStorage).not.toHaveBeenCalled();
  result.unmount();localStorage.setItem('habbix.smart-mode',JSON.stringify({remember:false}));vi.mocked(GetLocalStorage).mockClear();
  render(<Window id="inventory" close={vi.fn()}/>);expect(GetLocalStorage).not.toHaveBeenCalled();
 });
});

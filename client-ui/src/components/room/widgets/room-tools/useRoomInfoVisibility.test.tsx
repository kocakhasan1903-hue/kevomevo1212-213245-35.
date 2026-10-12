/* @vitest-environment jsdom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useRoomInfoVisibility } from './useRoomInfoVisibility';
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>{cleanup();vi.useRealTimers();});
it('starts mobile room information compact and still allows manual opening after a room change',()=>{
 const hook=renderHook(({id})=>useRoomInfoVisibility(id,true),{initialProps:{id:1}});
 expect(hook.result.current[0]).toBe(false);
 act(()=>hook.result.current[1]());expect(hook.result.current[0]).toBe(true);
 act(()=>vi.advanceTimersByTime(7000));expect(hook.result.current[0]).toBe(true);
 hook.rerender({id:2});expect(hook.result.current[0]).toBe(false);
 act(()=>hook.result.current[1]());expect(hook.result.current[0]).toBe(true);
});
it('auto-collapses 6.5 seconds after entering and starts fresh for a new room',()=>{
 const hook=renderHook(({id})=>useRoomInfoVisibility(id),{initialProps:{id:1}});
 act(()=>vi.advanceTimersByTime(6499));expect(hook.result.current[0]).toBe(true);
 act(()=>vi.advanceTimersByTime(1));expect(hook.result.current[0]).toBe(false);
 hook.rerender({id:2});expect(hook.result.current[0]).toBe(true);
 act(()=>vi.advanceTimersByTime(6500));expect(hook.result.current[0]).toBe(false);
});
it('keeps a manually reopened panel open and cancels old-room timers',()=>{
 const hook=renderHook(({id})=>useRoomInfoVisibility(id),{initialProps:{id:1}});
 act(()=>vi.advanceTimersByTime(5000));hook.rerender({id:2});
 act(()=>vi.advanceTimersByTime(1500));expect(hook.result.current[0]).toBe(true);
 act(()=>hook.result.current[1]());act(()=>hook.result.current[1]());
 act(()=>vi.advanceTimersByTime(10000));expect(hook.result.current[0]).toBe(true);
 hook.unmount();expect(vi.getTimerCount()).toBe(0);
});

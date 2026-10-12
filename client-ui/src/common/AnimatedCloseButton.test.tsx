import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {AnimatedCloseButton} from './AnimatedCloseButton';
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
describe('Animated window close',()=>{
 it('shows the click animation before closing, and ignores a second click',()=>{
  vi.useFakeTimers();const close=vi.fn();render(<AnimatedCloseButton onClick={close}>Schließen</AnimatedCloseButton>);
  const button=screen.getByRole('button');fireEvent.click(button);fireEvent.click(button);
  expect(button).toHaveClass('is-closing');expect(close).not.toHaveBeenCalled();
  act(()=>vi.advanceTimersByTime(120));expect(close).toHaveBeenCalledTimes(1);
 });
 it('cancels a pending close callback when the window unmounts',()=>{
  vi.useFakeTimers();const close=vi.fn();const view=render(<AnimatedCloseButton onClick={close}/>);
  fireEvent.click(screen.getByRole('button'));view.unmount();act(()=>vi.advanceTimersByTime(120));expect(close).not.toHaveBeenCalled();
 });
 it('respects reduced motion without delaying the close',()=>{
  vi.stubGlobal('matchMedia',()=>({matches:true}));const close=vi.fn();render(<AnimatedCloseButton onClick={close}/>);
  fireEvent.click(screen.getByRole('button'));expect(close).toHaveBeenCalledTimes(1);
 });
});

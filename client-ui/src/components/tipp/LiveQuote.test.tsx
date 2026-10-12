import {act,cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {LiveQuote} from './LiveQuote';
afterEach(()=>{cleanup();vi.useRealTimers();});
it('only shows direction after a change and removes it after three seconds',()=>{vi.useFakeTimers();const view=render(<LiveQuote value={2}/>);expect(screen.queryByRole('img')).toBeNull();view.rerender(<LiveQuote value={2.5}/>);expect(screen.getByRole('img',{name:'Quote gestiegen'})).toBeInTheDocument();act(()=>vi.advanceTimersByTime(3000));expect(screen.queryByRole('img')).toBeNull();view.rerender(<LiveQuote value={1.8}/>);expect(screen.getByRole('img',{name:'Quote gefallen'})).toBeInTheDocument();act(()=>vi.advanceTimersByTime(3000));expect(screen.queryByRole('img')).toBeNull();});
it('keeps changes hidden during a goal suspension and signals the released price',()=>{vi.useFakeTimers();const view=render(<LiveQuote value={2}/>);view.rerender(<LiveQuote value={1.5} locked/>);expect(screen.queryByRole('img')).toBeNull();view.rerender(<LiveQuote value={1.5}/>);expect(screen.getByRole('img',{name:'Quote gefallen'})).toBeInTheDocument();});

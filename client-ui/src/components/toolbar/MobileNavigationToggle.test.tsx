import {useState} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {MobileNavigationToggle} from './MobileNavigationToggle';
afterEach(cleanup);
it('can restore a collapsed inert rail because its handle lives outside it',()=>{
    function Example(){const [closed,setClosed]=useState(true);return <div data-testid="rail" inert={closed} aria-hidden={closed}><MobileNavigationToggle collapsed={closed} onToggle={()=>setClosed(!closed)}/><button>Navigator</button></div>}
    render(<Example/>);
    const handle=screen.getByRole('button',{name:'Navigation ausklappen'});
    expect(handle.parentElement).toBe(document.body);
    expect(screen.getByTestId('rail').contains(handle)).toBe(false);
    expect(screen.queryByRole('button',{name:'Navigator'})).toBeNull();
    fireEvent.click(handle);
    expect(screen.getByRole('button',{name:'Navigator'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Navigation einklappen'}));
    expect(screen.getByRole('button',{name:'Navigation ausklappen'})).toBeTruthy();
});

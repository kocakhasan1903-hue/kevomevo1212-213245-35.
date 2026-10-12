import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {ToolbarItemView} from './ToolbarItemView';
let mobile=true;
vi.mock('../../hooks/useMobileClient',()=>({useMobileClient:()=>mobile}));
afterEach(()=>{cleanup();mobile=true;});
it('keeps sprite art on an independent child and activates from keyboard',()=>{
 const click=vi.fn();render(<ToolbarItemView icon="rooms" className="tb-icon" onClick={click}/>);
 const button=screen.getByRole('button',{name:'Räume'});
 expect(button.classList.contains('icon-rooms')).toBe(false);
 expect(button.querySelector('.octane-icon.icon-rooms')).not.toBeNull();
 fireEvent.keyDown(button,{key:'Enter'});expect(click).toHaveBeenCalledOnce();
});
it('preserves the native desktop sprite structure',()=>{
 mobile=false;const {container}=render(<ToolbarItemView icon="rooms" className="tb-icon"/>);
 expect(container.firstElementChild?.classList.contains('icon-rooms')).toBe(true);
 expect(container.querySelector('.habbix-mobile-icon-art')).toBeNull();
});

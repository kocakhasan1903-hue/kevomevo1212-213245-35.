import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {MobileNoticeStack} from './MobileNoticeStack';
afterEach(cleanup);
it('shows a compact stack and lets users expand extra notices',()=>{
 const {container}=render(<MobileNoticeStack count={2}><div>Gift</div><div>News</div></MobileNoticeStack>);
 const toggle=screen.getByRole('button',{name:'1 weitere Hinweise'});
 expect(toggle.getAttribute('aria-expanded')).toBe('false');fireEvent.click(toggle);
 expect(container.querySelector('.is-expanded')).not.toBeNull();
 expect(screen.getByRole('button',{name:'Weniger anzeigen'}).getAttribute('aria-expanded')).toBe('true');
});
it('renders nothing when no notice exists',()=>{const {container}=render(<MobileNoticeStack count={0}>Empty</MobileNoticeStack>);expect(container.childElementCount).toBe(0);});

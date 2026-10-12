import {cleanup,render,screen,waitFor} from '@testing-library/react';
import {afterEach,describe,expect,it} from 'vitest';
import {RightNoticeRail,RightRailSlot} from './RightNoticeRail';
afterEach(cleanup);
describe('right-side event and notification rail',()=>{
 it('keeps notifications below live cards in one shared layout',async()=>{
  render(<><RightNoticeRail/><RightRailSlot slot="events"><div>Worträtsel</div></RightRailSlot><RightRailSlot slot="lotto"><div>Lotto</div></RightRailSlot><RightRailSlot slot="notices"><div>Habbo online</div></RightRailSlot></>);
  await waitFor(()=>expect(document.getElementById('habbix-right-events')).toContainElement(screen.getByText('Worträtsel')));
  expect(document.getElementById('habbix-right-lotto')).toContainElement(screen.getByText('Lotto'));
  expect(document.getElementById('habbix-right-notices')).toContainElement(screen.getByText('Habbo online'));
  const rail=screen.getByLabelText('Live-Events und Hotelmeldungen');
  expect(rail.firstElementChild).toHaveClass('habbix-right-event-list');
  expect(rail.lastElementChild).toHaveClass('habbix-right-notice-list');
 });
 it('tracks the wallet position instead of a hard-coded notification offset',()=>{
  const wallet=document.createElement('div');wallet.className='habbix-wallet-bar';document.body.append(wallet);
  wallet.getBoundingClientRect=()=>({bottom:112,right:window.innerWidth-16} as DOMRect);
  render(<RightNoticeRail/>);
  const rail=screen.getByLabelText('Live-Events und Hotelmeldungen');
  expect(rail.style.getPropertyValue('--habbix-rail-top')).toBe('122px');
  expect(rail.style.getPropertyValue('--habbix-rail-right')).toBe('16px');
  wallet.remove();
 });
});

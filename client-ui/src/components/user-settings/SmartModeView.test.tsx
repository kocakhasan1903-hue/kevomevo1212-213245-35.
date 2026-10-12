/* @vitest-environment jsdom */
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {SmartModeView} from './SmartModeView';
vi.mock('../../layout',()=>{const Card=({children,...props}:any)=><div className={props.className}>{children}</div>;Card.Header=({headerText,onCloseClick}:any)=><header>{headerText}<button onClick={onCloseClick}>Schließen</button></header>;Card.Content=({children}:any)=><main>{children}</main>;return {OctaneCard:Card};});
afterEach(()=>{cleanup();localStorage.clear();});
describe('Smart Mode controls',()=>{
 it('saves all switches through their labels and preserves other settings',()=>{
  render(<SmartModeView onClose={vi.fn()}/>);
  fireEvent.click(screen.getByLabelText('Bei Klick außerhalb schließen'));
  fireEvent.click(screen.getByLabelText('ESC zum Schließen'));
  expect(screen.getByText('Beim Öffnen immer mittig')).toBeTruthy();
  expect(screen.queryByLabelText('Position speichern')).toBeNull();
  expect(JSON.parse(localStorage.getItem('habbix.smart-mode')!)).toMatchObject({outside:true,escape:true,opacity:100,idleSeconds:0});
 });
 it('updates the displayed opacity, bounds the idle timeout, and closes on request',()=>{
  const close=vi.fn();render(<SmartModeView onClose={close}/>);
  fireEvent.change(screen.getByRole('slider'),{target:{value:'60'}});
  expect(screen.getByText('Deckkraft: 60%')).toBeTruthy();
  fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'9999'}});
  expect(JSON.parse(localStorage.getItem('habbix.smart-mode')!)).toMatchObject({opacity:60,idleSeconds:3600});
  fireEvent.click(screen.getByRole('button',{name:'Schließen'}));expect(close).toHaveBeenCalledOnce();
 });
});

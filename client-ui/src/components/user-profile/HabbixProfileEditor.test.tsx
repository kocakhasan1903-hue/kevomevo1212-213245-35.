import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HabbixProfileEditor } from './HabbixProfileEditor';
vi.mock('../../layout',()=>({OctaneCard:Object.assign(({children}:any)=><div>{children}</div>,{Header:({headerText}:any)=><h2>{headerText}</h2>,Content:({children}:any)=><div>{children}</div>})}));
afterEach(cleanup);
describe('Profile customization draft',()=>{
 it('keeps edits local until save and sends both avatar and tag settings together',()=>{
  const save=vi.fn();render(<HabbixProfileEditor profile={{ownerId:17,appearance:{avatar:'#000000',clientStyle:{tags:[]}}}} onSave={save} onClose={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Avatar'}));fireEvent.click(screen.getByRole('button',{name:'Diamant'}));
  fireEvent.click(screen.getByRole('button',{name:'Tags'}));fireEvent.change(screen.getByRole('textbox',{name:'Neuer Profil-Tag'}),{target:{value:'gaming'}});fireEvent.click(screen.getByRole('button',{name:'Hinzufügen'}));
  expect(save).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Speichern'}));
  const [action,text]=save.mock.calls[0],payload=JSON.parse(text);expect(action).toBe('clientAppearance');expect(payload.tags).toEqual(['gaming']);expect(payload.avatarColor).toBe('#1d3038');expect(payload.appearance.avatar).toBe('');expect(payload.appearance.borderWidth).toBe(3);
 });
 it('prevents adding duplicate tags',()=>{
  render(<HabbixProfileEditor profile={{ownerId:17,appearance:{clientStyle:{tags:['gaming']}}}} onSave={()=>{}} onClose={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Tags'}));fireEvent.change(screen.getByRole('textbox',{name:'Neuer Profil-Tag'}),{target:{value:'gaming'}});
  expect((screen.getByRole('button',{name:'Hinzufügen'}) as HTMLButtonElement).disabled).toBe(true);
 });
});

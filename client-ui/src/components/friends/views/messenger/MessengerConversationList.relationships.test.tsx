import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {MessengerConversationList,ConversationRow} from './MessengerConversationList';
afterEach(cleanup);
const row=(id:number,relationship=0):ConversationRow=>({id,name:`Freund ${id}`,avatar:null,relationship,preview:'Nachricht',unread:id===1?2:0});
describe('relationship chat priority',()=>{
 it('puts all three relationship types before ordinary chats and labels each type',()=>{
  render(<MessengerConversationList conversations={[row(1),row(2,3),row(3,1),row(4,2)]} contacts={[]} onOpen={vi.fn()}/>);
  const names=screen.getAllByRole('button').filter(b=>b.classList.contains('hmx-list-row')).map(b=>b.textContent);
  expect(names[0]).toContain('Freund 2');expect(names[1]).toContain('Freund 3');expect(names[2]).toContain('Freund 4');expect(names[3]).toContain('Freund 1');
  expect(screen.getByRole('img',{name:'Beziehung: Herz'})).toBeTruthy();expect(screen.getByRole('img',{name:'Beziehung: Lächeln'})).toBeTruthy();expect(screen.getByRole('img',{name:'Beziehung: Totenkopf'})).toBeTruthy();
  expect(screen.getByLabelText('2 ungelesene Nachrichten')).toBeTruthy();
 });
 it('updates order and removes the indicator when the relationship is cleared',()=>{
  const view=render(<MessengerConversationList conversations={[row(1),row(2,1)]} contacts={[]} onOpen={vi.fn()}/>);
  view.rerender(<MessengerConversationList conversations={[row(1),row(2)]} contacts={[]} onOpen={vi.fn()}/>);
  expect(screen.queryByRole('img',{name:'Beziehung: Herz'})).toBeNull();
  expect(screen.getAllByRole('button').filter(b=>b.classList.contains('hmx-list-row'))[0].textContent).toContain('Freund 1');
 });
});

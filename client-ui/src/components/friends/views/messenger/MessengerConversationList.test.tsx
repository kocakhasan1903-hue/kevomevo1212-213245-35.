import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MessengerConversationList } from './MessengerConversationList';
afterEach(cleanup);
it('filters unread conversations, searches contacts and opens the actual user ID',()=>{
    const open=vi.fn();
    render(<MessengerConversationList onOpen={open} conversations={[{id:2,name:'Alpha',avatar:null,preview:'Hallo',unread:2},{id:3,name:'Beta',avatar:null,preview:'Gelesen',unread:0}]} contacts={[{id:4,name:'Charlie',avatar:null,preview:'Online',unread:0}]}/>);
    expect(screen.queryByText('Wähle einen Chat aus')).toBeNull();
    expect(screen.queryByRole('button',{name:'Kontakte'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Ungelesen'}));
    expect(screen.queryByText('Beta')).toBeNull(); expect(screen.getByText('Alpha')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Neuen Chat starten'));
    fireEvent.change(screen.getByLabelText('Unterhaltungen suchen'),{target:{value:'char'}});
    fireEvent.click(screen.getByText('Charlie').closest('button')!); expect(open).toHaveBeenCalledWith(4);
});
it('offers a new conversation instead of an empty chat pane',()=>{
    render(<MessengerConversationList conversations={[]} contacts={[]} onOpen={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Neue Nachricht'}));
    expect(screen.getByText('Noch keine Freunde')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Zurück zu Nachrichten'));
    expect(screen.getByText('Deine Nachrichten')).toBeTruthy();
});

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('./giphy', () => ({searchGiphy:vi.fn().mockResolvedValue({items:[{id:'sample',title:'Hallo GIF',url:'https://media.giphy.com/media/sample/200.gif',preview:'https://media.giphy.com/media/sample/100.gif'}],next:1,more:false})}));
import { GiphyPicker } from './GiphyPicker';
afterEach(cleanup);
it('previews first, sends only explicitly and retains the selected GIF after failure', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('Verbindung unterbrochen')).mockResolvedValue(undefined);
    render(<GiphyPicker scope="private" onSend={send}/>);
    fireEvent.click(screen.getByLabelText('GIF im Chat senden'));
    fireEvent.click(await screen.findByRole('button',{name:'Hallo GIF'}));
    expect(send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'GIF senden'}));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent','Verbindung unterbrochen');
    fireEvent.click(screen.getByRole('button',{name:'GIF senden'}));
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
    expect(send).toHaveBeenCalledTimes(2); expect(send.mock.calls[0][0].id).toBe(send.mock.calls[1][0].id);
});
it('closes with Escape without sending and returns focus to the GIF button', async () => {
    const send=vi.fn(); render(<GiphyPicker scope="room" onSend={send}/>);
    fireEvent.click(screen.getByLabelText('GIF im Raum senden'));
    await screen.findByRole('button',{name:'Hallo GIF'});
    fireEvent.keyDown(screen.getByLabelText('GIPHY durchsuchen'),{key:'Escape'});
    expect(screen.queryByRole('dialog')).toBeNull(); expect(send).not.toHaveBeenCalled(); expect(document.activeElement).toBe(screen.getByLabelText('GIF im Raum senden'));
});

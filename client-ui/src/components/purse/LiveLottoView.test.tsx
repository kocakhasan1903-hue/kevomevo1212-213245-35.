import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LiveLottoView } from './LiveLottoView';

class Socket {
    static latest: Socket; static OPEN = 1;
    readyState = 1; onmessage: (event: { data: string }) => void;
    constructor() { Socket.latest = this; }
    send() {} close() {}
    snapshot() { this.onmessage({data: JSON.stringify({header:'lottoData', data:{data:JSON.stringify({prize:24000,diamonds:6,entries:0,serverTime:1000,drawAt:1120,ticketPrice:2000})}})}); }
}
afterEach(() => { cleanup(); document.querySelector('.octane-app-root')?.remove(); localStorage.clear(); vi.unstubAllGlobals(); });
it('mounts the live announcement outside the transformed wallet and cleans up on unmount', () => {
    vi.stubGlobal('WebSocket', Socket);
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    localStorage.setItem('kubboch-sto','cms_test');
    const root=document.createElement('div');root.className='octane-app-root';document.body.append(root);
    const view=render(<div className="octane-purse-container" style={{transform:'translateY(0)'}}><LiveLottoView/></div>,{container:root});
    expect(screen.queryByLabelText('Live Lotto')).toBeNull();
    act(()=>Socket.latest.snapshot());
    const panel=screen.getByLabelText('Live Lotto');
    expect(panel.parentElement).toBe(root);
    expect(panel.closest('.octane-purse-container')).toBeNull();
    expect(panel.textContent).toContain('02:00');
    view.unmount();
    expect(screen.queryByLabelText('Live Lotto')).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--habbix-live-lotto-height')).toBe('');
});

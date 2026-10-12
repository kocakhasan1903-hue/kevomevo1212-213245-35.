import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RoomVoiceControls } from './RoomVoiceControls';
import type { useRoomVoice } from '../../../../hooks/rooms/widgets/useRoomVoice';
vi.mock('../chat/RoomVoicePlayer', () => ({ VoiceAudioControl: () => <span>Audio</span>, voiceTime: () => '0:02' }));
afterEach(cleanup);
it('finalizes a recording before sending exactly once, without automatically retrying', () => {
    const voice: ReturnType<typeof useRoomVoice> = { phase: 'recording', ready: true, elapsed: 2, preview: '', start: vi.fn(), stop: vi.fn(), cancel: vi.fn(), send: vi.fn() };
    const view = render(<RoomVoiceControls voice={voice} disabled={false}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Sprachnachricht senden' }));
    expect(voice.stop).toHaveBeenCalledOnce();
    expect(voice.send).not.toHaveBeenCalled();
    view.rerender(<RoomVoiceControls voice={{...voice, phase:'preview'}} disabled={false}/>);
    expect(voice.send).toHaveBeenCalledOnce();
    view.rerender(<RoomVoiceControls voice={{...voice, phase:'sending'}} disabled={false}/>);
    view.rerender(<RoomVoiceControls voice={{...voice, phase:'preview'}} disabled={false}/>);
    expect(voice.send).toHaveBeenCalledOnce();
});
it('does not send after a recording fails or gets cancelled', () => {
    const voice: ReturnType<typeof useRoomVoice> = { phase: 'recording', ready: true, elapsed: 2, preview: '', start: vi.fn(), stop: vi.fn(), cancel: vi.fn(), send: vi.fn() };
    const view = render(<RoomVoiceControls voice={voice} disabled={false}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Sprachnachricht senden' }));
    view.rerender(<RoomVoiceControls voice={{...voice, phase:'idle'}} disabled={false}/>);
    view.rerender(<RoomVoiceControls voice={{...voice, phase:'preview'}} disabled={false}/>);
    expect(voice.send).not.toHaveBeenCalled();
});

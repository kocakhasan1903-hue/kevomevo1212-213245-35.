import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { audioTime, MessengerAudioPlayer } from './MessengerAudioPlayer';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('uses media events for playback, seeking, speed and completion', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function () { this.dispatchEvent(new Event('play')); return Promise.resolve(); });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function () { this.dispatchEvent(new Event('pause')); });
    const { container } = render(<MessengerAudioPlayer src="blob:test" duration={42} />);
    const audio = container.querySelector('audio')!;
    await act(async () => fireEvent.click(screen.getByLabelText('Sprachnachricht abspielen')));
    expect(screen.getByLabelText('Sprachnachricht pausieren')).toBeTruthy();
    audio.currentTime = 12; fireEvent.timeUpdate(audio);
    expect(screen.getByText('0:12 / 0:42')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Audioposition'), { target: { value: '20' } });
    expect(audio.currentTime).toBe(20);
    fireEvent.click(screen.getByLabelText('Wiedergabegeschwindigkeit 1x'));
    expect(audio.playbackRate).toBe(1.5);
    fireEvent.ended(audio);
    expect(audio.currentTime).toBe(0);
    expect(screen.getByLabelText('Sprachnachricht abspielen')).toBeTruthy();
});
it('shows a playback failure without claiming the clip is playing', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('blocked'));
    render(<MessengerAudioPlayer src="blob:test" duration={9} />);
    await act(async () => fireEvent.click(screen.getByLabelText('Sprachnachricht abspielen')));
    expect(screen.getByRole('alert').textContent).toContain('nicht abgespielt');
    expect(screen.getByLabelText('Sprachnachricht abspielen')).toBeTruthy();
    expect(audioTime(Infinity)).toBe('0:00');
});

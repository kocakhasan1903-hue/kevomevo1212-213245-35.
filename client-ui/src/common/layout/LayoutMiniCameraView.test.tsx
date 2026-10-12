import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LayoutMiniCameraView } from './LayoutMiniCameraView';

const mocks = vi.hoisted(() => ({
    texture: { id: 'texture', destroy: vi.fn() },
    createTextureFromRoom: vi.fn(),
    generateImageUrl: vi.fn(() => Promise.resolve('data:image/png;base64,YQ=='))
}));
vi.mock('@octane/renderer', async () => ({
    ...await vi.importActual<typeof import('@octane/renderer')>('@octane/renderer'),
    GetRoomEngine: () => ({ createTextureFromRoom: mocks.createTextureFromRoom }),
    TextureUtils: { generateImageUrl: mocks.generateImageUrl }
}));
vi.mock('../../api', () => ({
    LocalizeText: (key: string) => key, PlaySound: vi.fn(), SoundNames: { CAMERA_SHUTTER: 'camera-shutter' },
    blitRoomCanvasToViewfinder: vi.fn(), getViewfinderRoomFrame: vi.fn(() => ({ x: 3, y: 30, width: 320, height: 320 }))
}));
vi.mock('../draggable-window', () => ({ DraggableWindow: ({ children }: any) => children }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('room photograph selection', () => {
    it('only uploads the explicitly selected shot once, and keeps it alive until the camera closes', async () => {
        mocks.createTextureFromRoom.mockReturnValue(mocks.texture);
        const receive = vi.fn(() => new Promise<void>(() => undefined));
        const { unmount } = render(<LayoutMiniCameraView roomId={42} textureReceiver={receive} onClose={vi.fn()} />);
        expect(screen.queryByRole('button', { name: 'Als Raumbild übernehmen' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Foto aufnehmen' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Aufnahme 1 auswählen' })).toHaveAttribute('aria-pressed', 'true'));
        expect(receive).not.toHaveBeenCalled();
        const save = screen.getByRole('button', { name: 'Als Raumbild übernehmen' });
        fireEvent.click(save); fireEvent.click(save);
        expect(receive).toHaveBeenCalledExactlyOnceWith(mocks.texture);
        expect(mocks.texture.destroy).not.toHaveBeenCalled();
        unmount();
        expect(mocks.texture.destroy).toHaveBeenCalledOnce();
    });
    it('lets a selected photograph be removed and recaptured without sending an upload', async () => {
        mocks.createTextureFromRoom.mockReturnValue(mocks.texture);
        const receive = vi.fn();
        render(<LayoutMiniCameraView roomId={42} textureReceiver={receive} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Foto aufnehmen' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Aufnahme löschen' })).toBeEnabled());
        fireEvent.click(screen.getByRole('button', { name: 'Aufnahme löschen' }));
        expect(screen.queryByRole('button', { name: 'Als Raumbild übernehmen' })).not.toBeInTheDocument();
        expect(mocks.texture.destroy).toHaveBeenCalledOnce();
        expect(receive).not.toHaveBeenCalled();
    });
});

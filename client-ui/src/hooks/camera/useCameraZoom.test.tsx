import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useCameraZoom } from './useCameraZoom';

const Camera = ({ enabled = true }) => {
    const { zoom, viewfinderRef } = useCameraZoom(enabled);
    return <div data-testid="viewfinder" ref={viewfinderRef}><output>{zoom}</output></div>;
};
afterEach(cleanup);
describe('camera wheel zoom', () => {
    it('zooms up/down, clamps the crop, and consumes the wheel', () => {
        render(<Camera />);
        const viewfinder = screen.getByTestId('viewfinder');
        expect(fireEvent.wheel(viewfinder, { deltaY: -100 })).toBe(false);
        expect(screen.getByText('1.1')).toBeInTheDocument();
        for (let i = 0; i < 30; i++) fireEvent.wheel(viewfinder, { deltaY: -100 });
        expect(screen.getByText('3')).toBeInTheDocument();
        for (let i = 0; i < 30; i++) fireEvent.wheel(viewfinder, { deltaY: 100 });
        expect(screen.getByText('1')).toBeInTheDocument();
    });
    it('does not zoom a selected photograph or a camera that is saving', () => {
        const { rerender } = render(<Camera />);
        fireEvent.wheel(screen.getByTestId('viewfinder'), { deltaY: -1 });
        rerender(<Camera enabled={false} />);
        fireEvent.wheel(screen.getByTestId('viewfinder'), { deltaY: -1 });
        expect(screen.getByText('1.1')).toBeInTheDocument();
    });
});

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PurseView } from './PurseView';

vi.mock('../../api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../api')>();

    return {
        ...actual,
        GetConfigurationValue: (key: string, fallback: unknown) => {
            if (key === 'system.currency.types') return [0, 5];
            if (key === 'currency.display.number.short') return false;
            if (key === 'currency.asset.icon.url') return '/currency/%type%.png';

            return fallback;
        },
        LocalizeText: (key: string) => key,
        localizeWithFallback: (_key: string, fallback: string) => fallback
    };
});

vi.mock('../../hooks', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../hooks')>();

    return {
        ...actual,
        usePurse: () => ({
            hcDisabled: false,
            purse: {
                activityPoints: new Map([
                    [0, 3692],
                    [5, 760], [104, 3692]
                ]),
                clubDays: 0,
                clubPeriods: 0,
                credits: 37,
                minutesUntilExpiration: -1
            }
        })
    };
});

describe('PurseView', () => {
    afterEach(() => cleanup());

    it('shows exact currency balances in the new wallet', () => {
        const { container } = render(<PurseView />);
        const wallet = container.querySelector('.habbix-wallet-bar') as HTMLElement;
        const amounts = Array.from(wallet.querySelectorAll('.octane-purse-button__amount')).map((element) => element.textContent?.trim());

        expect(within(wallet).getByTitle('Eventsterne')).toHaveTextContent('3.692');
        expect(amounts).toContain('760');
        expect(amounts).not.toContain('3.7k');
        expect(within(wallet).getByTitle('Eventsterne')).toBeInTheDocument();
        expect(within(wallet).queryByTitle('Duckets')).not.toBeInTheDocument();
        expect(within(wallet).getByTitle('Flammen')).toBeInTheDocument();
        expect(within(wallet).getByTitle('Diamanten')).toBeInTheDocument();
    });

    it('retains help, club, earnings and the settings menu with logout', () => {
        const { container } = render(<PurseView />);

        const actionColumn = container.querySelector('.habbix-wallet-bar');
        expect(actionColumn).toBeTruthy();

        const actionButtons = within(actionColumn as HTMLElement).getAllByRole('button');
        expect(actionButtons.map((button) => button.getAttribute('aria-label'))).toEqual(['Einstellungen','Smart Mode','Abmelden']);

        const settingsButton = within(actionColumn as HTMLElement).getByRole('button',{name:'Einstellungen'});
        expect(settingsButton).toBeTruthy();

        fireEvent.click(settingsButton!);

        const settingsMenu = container.querySelector('.octane-purse-menu');
        expect(settingsMenu).toBeTruthy();
        expect(within(settingsMenu as HTMLElement).getByRole('button', { name: 'Translate' })).toBeInTheDocument();
        expect(within(settingsMenu as HTMLElement).getByRole('button', { name: 'Abmelden' })).toBeInTheDocument();
    });
});




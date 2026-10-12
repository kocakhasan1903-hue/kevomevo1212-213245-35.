import { describe, expect, it } from 'vitest';
import { MessengerThreadChat } from '../../../../../api';
import { getMessageStatusPresentation } from './messageStatus.helpers';

describe('getMessageStatusPresentation', () =>
{
    it('renders one muted tick for a sent message', () =>
    {
        expect(getMessageStatusPresentation(MessengerThreadChat.SENT)).toEqual({ ticks: '✓', isRead: false, label: 'Zugestellt' });
    });

    it('renders two blue ticks for a read message', () =>
    {
        expect(getMessageStatusPresentation(MessengerThreadChat.READ)).toEqual({ ticks: '✓✓', isRead: true, label: 'Gelesen' });
    });
});

it('shows neutral double ticks only after a delivery receipt',()=>{expect(getMessageStatusPresentation(MessengerThreadChat.DELIVERED)).toEqual({ticks:'✓✓',isRead:false,label:'Empfangen'});});

import { MessengerThreadChat } from '../../../../../api';

export interface MessageStatusPresentation
{
    ticks: string;
    isRead: boolean;
    label: string;
}

export const getMessageStatusPresentation = (status: number): MessageStatusPresentation =>
{
    const isRead = status === MessengerThreadChat.READ;

    const delivered = status === MessengerThreadChat.DELIVERED;
    return { ticks: isRead || delivered ? '✓✓' : '✓', isRead, label: isRead ? 'Gelesen' : delivered ? 'Empfangen' : 'Zugestellt' };
};

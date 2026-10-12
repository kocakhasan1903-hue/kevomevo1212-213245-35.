import { FC } from 'react';
import { LocalizeText, NotificationBubbleItem, OpenUrl } from '../../../../api';
import { LayoutCurrencyIcon, LayoutNotificationBubbleView, LayoutNotificationBubbleViewProps } from '../../../../common';

export interface NotificationClubGiftBubbleViewProps extends LayoutNotificationBubbleViewProps {
    item: NotificationBubbleItem;
}

export const NotificationClubGiftBubbleView: FC<NotificationClubGiftBubbleViewProps> = (props) => {
    const { item = null, onClose = null, ...rest } = props;

    return (
        <LayoutNotificationBubbleView {...rest} className="notification-club-gift" fadesOut timeoutMs={8000} onClose={onClose}
            role="button" tabIndex={0} aria-label="Club-Geschenk ansehen"
            onClick={() => { OpenUrl(item.linkUrl); onClose(); }}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); OpenUrl(item.linkUrl); onClose(); } }}>
            <LayoutCurrencyIcon className="shrink-0" type="hc" />
            <div><strong className="notification-club-title">Dein Club-Geschenk</strong><span className="notification-club-copy">{LocalizeText('notifications.text.club_gift')}</span></div>
        </LayoutNotificationBubbleView>
    );
};

import { FC } from 'react';
import { NotificationBubbleItem, OpenUrl, SanitizeHtml } from '../../../../api';
import { Flex, LayoutNotificationBubbleView, LayoutNotificationBubbleViewProps, Text } from '../../../../common';

export interface NotificationDefaultBubbleViewProps extends LayoutNotificationBubbleViewProps {
    item: NotificationBubbleItem;
}

export const NotificationDefaultBubbleView: FC<NotificationDefaultBubbleViewProps> = (props) => {
    const { item = null, onClose = null, ...rest } = props;

    const htmlText = item.message.replace(/\r\n|\r|\n/g, '<br />');

    return (
        <LayoutNotificationBubbleView
            alignItems="center"
            gap={2}
            onClick={(event) => item.linkUrl && item.linkUrl.length && OpenUrl(item.linkUrl)}
            onClose={onClose}
            {...rest}
        >
            {!!item.iconUrl?.length && <Flex center className="notification-bubble-icon"><img alt="" className="no-select" src={item.iconUrl}/></Flex>}
            <Text className="notification-bubble-message" wrap dangerouslySetInnerHTML={{ __html: SanitizeHtml(htmlText) }} variant="white" />
        </LayoutNotificationBubbleView>
    );
};

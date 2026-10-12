import { ReactNode, useState } from 'react';
import { EventAuctionWidget } from './EventPanel';
import { EventLiveWidget } from './EventLiveWidget';
import { EventController } from './EventTypes';
import { RightRailSlot } from '../right-side/RightNoticeRail';

export function EventLiveStack({ controller, roomId, renderFurniture }: {
    controller: EventController; roomId: number; renderFurniture?: (spriteId: number, type: string) => ReactNode;
}) {
    const [hidden, setHidden] = useState<number[]>([]);
    const activities = controller.data?.activities?.filter(item =>
        ['auction', 'giveaway', 'riddle'].includes(item.kind) && item.status === 'active' &&
        !hidden.includes(item.id) && (item.scope !== 'room' || item.roomId === roomId));
    if (!activities?.length) return null;
    return <RightRailSlot slot="events"><aside className="hep-live-stack" aria-label="Live Events">{activities.map(activity => {
        const onClose = () => setHidden(previous => [...previous, activity.id]);
        return activity.kind === 'auction'
            ? <EventAuctionWidget key={activity.id} auction={activity} controller={controller} renderFurniture={renderFurniture} onClose={onClose}/>
            : <EventLiveWidget key={activity.id} activity={activity} controller={controller} renderFurniture={renderFurniture} onClose={onClose}/>;
    })}</aside></RightRailSlot>;
}

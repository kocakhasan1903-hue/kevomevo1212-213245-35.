import { EventLiveStack } from './EventLiveStack';
import { AddLinkEventTracker, GetSessionDataManager, ILinkEventTracker, RemoveLinkEventTracker } from '@octane/renderer';
import { useEffect, useState } from 'react';
import { TryVisitRoom } from '../../api';
import { DraggableWindow, DraggableWindowPosition, LayoutAvatarImageView, LayoutFurniImageView } from '../../common';
import { AnimatedCloseButton } from '../../common/AnimatedCloseButton';
import { useRoom } from '../../hooks';
import { EventPanel } from './EventPanel';
import { useEventController } from './useEventController';

export function EventView() {
    const [visible, setVisible] = useState<'plan' | 'manager' | null>(null);
    const [managerTab,setManagerTab]=useState<'auction'|'fishing'|'voice'|'settings'>('auction');
    const { roomSession } = useRoom();
    const controller = useEventController(GetSessionDataManager().userName, roomSession?.roomId || 0);
    const furniture = (spriteId: number, type: string) => <LayoutFurniImageView productClassId={spriteId} productType={type} direction={2} style={{ width: '100%', height: '100%', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }} />;
    useEffect(() => {
        const trackers: ILinkEventTracker[] = [
            { eventUrlPrefix: 'eventplan/', linkReceived: () => setVisible(previous => previous === 'plan' ? null : 'plan') },
            { eventUrlPrefix: 'events/', linkReceived: url => { const tab=url.split('/')[1]; if(tab==='voice'||tab==='fishing'||tab==='settings'){setManagerTab(tab);setVisible('manager');}else{setManagerTab('auction');setVisible(previous => previous === 'manager' ? null : 'manager');} } }
        ];
        trackers.forEach(tracker => AddLinkEventTracker(tracker));
        return () => trackers.forEach(tracker => RemoveLinkEventTracker(tracker));
    }, []);

    return <>{visible && <DraggableWindow uniqueKey="habbix-events" handleSelector=".hep-window-header" windowPosition={DraggableWindowPosition.CENTER}><div className={`hep-window${visible === 'plan' ? ' is-plan' : ''}`} role="dialog" aria-label={visible === 'plan' ? 'Eventplan' : 'Event Management'}><header className="hep-window-header">{visible === 'plan' ? 'Eventplan' : 'Event Management'}{controller.data?.canManage && <button className="hep-header-action" onClick={() => setVisible(visible === 'plan' ? 'manager' : 'plan')}>{visible === 'plan' ? 'Verwalten' : 'Eventplan'}</button>}<AnimatedCloseButton aria-label="Events schließen" onClick={() => setVisible(null)}>×</AnimatedCloseButton></header><EventPanel initialManagerTab={managerTab} controller={controller} manager={visible === 'manager'} roomId={roomSession?.roomId || 0} onVisitRoom={TryVisitRoom} renderFurniture={furniture} renderAvatar={look => <LayoutAvatarImageView figure={look} headOnly nativeCroppedHead direction={2} />} /></div></DraggableWindow>}<EventLiveStack controller={controller} roomId={roomSession?.roomId || 0} renderFurniture={furniture}/></>;
}

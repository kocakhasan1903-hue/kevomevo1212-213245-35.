import { useEffect, useState } from 'react';
import { EventItemImage, EventMoney, EventFeedback } from './EventPanel';
import { EventController, HotelEvent } from './EventTypes';

export function EventLiveWidget({ activity, controller, onClose, renderFurniture }: {
    activity: HotelEvent; controller: EventController; onClose: () => void;
    renderFurniture?: (spriteId: number, type: string) => React.ReactNode;
}) {
    const [remaining, setRemaining] = useState(0);
    useEffect(() => {
        const received = Date.now(), server = controller.data?.now || Math.floor(received / 1000);
        const tick = () => setRemaining(Math.max(0, Math.floor(activity.endsAt - server - (Date.now() - received) / 1000)));
        tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
    }, [activity.endsAt, controller.data?.now]);
    const giveaway = activity.kind === 'giveaway';
    return <section className="hep-auction-widget" aria-label={giveaway ? 'Live Giveaway' : 'Live Worträtsel'}>
        <header><strong>{giveaway ? 'LIVE GIVEAWAY' : 'LIVE WORTRÄTSEL'}</strong><time>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</time><button aria-label="Event ausblenden" onClick={onClose}>×</button></header>
        {!giveaway && <p className="hep-live-question">{activity.question || 'Das Rätsel wird geladen …'}</p>}
        <div className="hep-live-rewards">
            {activity.itemId > 0 && <><EventItemImage asset={activity.asset} name={activity.itemName} spriteId={activity.spriteId} furniType={activity.furniType} renderFurniture={renderFurniture} /><span>{activity.amount} × {activity.itemName}</span></>}
            {!!activity.rewardCredits && <EventMoney value={activity.rewardCredits} />}
            {!!activity.rewardDiamonds && <EventMoney value={activity.rewardDiamonds} currency="diamonds" />}
            {!!activity.rewardEventstars && <EventMoney value={activity.rewardEventstars} currency="eventstars" />}
            {!!activity.rewardFlames && <EventMoney value={activity.rewardFlames} currency="flames" />}
        </div>
        <p className="hep-live-hint">{giveaway ? `${activity.participants || 0} Teilnehmer · Auch mit :giveaway teilnehmen.` : 'Schreibe das Lösungswort in den Raumchat. Die erste richtige Antwort gewinnt.'}</p>
        {giveaway && <button className="hep-primary hep-live-action" disabled={activity.joined || remaining <= 0 || controller.busy || !controller.ready || controller.needsRefresh} onClick={() => controller.request('eventJoin', { id: activity.id })}>{activity.joined ? 'Du nimmst teil' : 'Teilnehmen'}</button>}
        <EventFeedback controller={{ ...controller, data: controller.data ? { ...controller.data, notice: undefined } : null }} />
        <div className="hep-live-progress"><span style={{ width: `${Math.min(100, remaining / Math.max(1, activity.endsAt - activity.startsAt) * 100)}%` }} /></div>
    </section>;
}

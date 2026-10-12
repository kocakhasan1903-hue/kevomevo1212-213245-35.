import type { AdministrationState, FishingAdministration } from './EventAdministrationView';
export type EventKind = 'auction' | 'giveaway' | 'riddle';
export type EventCurrency = 'credits' | 'diamonds' | 'eventstars' | 'flames';
export type CatalogEventItem = { id: number; asset: string; name: string; spriteId?: number; furniType?: string };
export type PlannedEvent = { id: number; title: string; description: string; roomId: number; roomName: string; host: string; startsAt: number; endsAt: number };
export type WordCollection = { id: number; name: string; words: string[]; intervalSeconds: number; uniformReward: boolean; rewardCredits: number; rewardDiamonds: number; rewardEventstars?: number; rewardFlames?: number; rewards?: { word: string; credits: number; diamonds: number; eventstars?: number; flames?: number }[]; autoPlay?: boolean; nextAt?: number };
export type HotelEvent = {
    id: number; kind: EventKind; title: string; itemId: number; asset: string; itemName: string; amount: number; spriteId?: number; furniType?: string;
    currency: EventCurrency; startPrice: number; highestBid: number; minBid: number; highestBidder: string;
    winner: string; winners?: { id: number; name: string; look: string }[]; starter?: string; starterLook?: string; winnerLook?: string; highestBidderLook?: string; roomId: number; roomName: string; scope: 'hotel' | 'room';
    startsAt: number; endsAt: number; status: 'active' | 'ended' | 'cancelled'; joined?: boolean; question?: string;
    rewardCredits?: number; rewardDiamonds?: number; rewardEventstars?: number; rewardFlames?: number; entries?: number; participants?: number; maxBid?: number;
};
export type EventState = {
    administration?:AdministrationState; fishingAdmin?:FishingAdministration;
    requestId: string; canManage: boolean; planEditable?: boolean; now: number; notice?: string; username?: string;
    balance: { credits: number; diamonds: number; eventstars?: number; flames?: number };
    plan: PlannedEvent[]; activities: HotelEvent[]; catalog?: CatalogEventItem[]; collections?: WordCollection[]; statistics?: { id: number; name: string; look: string; count: number }[];
};
export type EventController = {
    data: EventState | null; catalog: CatalogEventItem[]; error: string; busy: boolean; ready: boolean;
    needsRefresh: boolean; action: string; request: (action?: string, values?: Record<string, unknown>) => void; reconnect: () => void;
};

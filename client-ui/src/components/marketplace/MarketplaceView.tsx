import { AnimatedCloseButton } from '../../common/AnimatedCloseButton';
import { AddLinkEventTracker, GetSessionDataManager, ILinkEventTracker, RemoveLinkEventTracker } from '@octane/renderer';
import { useEffect, useState } from 'react';
import { DraggableWindow, DraggableWindowPosition } from '../../common';
import { MarketplacePanel } from './MarketplacePanel';

export function MarketplaceView(){
 const [visible,setVisible]=useState(false);
 useEffect(()=>{const tracker:ILinkEventTracker={eventUrlPrefix:'marketplace/',linkReceived:()=>setVisible(v=>!v)};AddLinkEventTracker(tracker);return()=>RemoveLinkEventTracker(tracker);},[]);
 if(!visible)return null;
 return <DraggableWindow uniqueKey="habbix-marketplace" handleSelector=".hmp-window-header" windowPosition={DraggableWindowPosition.CENTER}><div className="hmp-window" role="dialog" aria-label="Marktplatz"><header className="hmp-window-header">Marktplatz<AnimatedCloseButton aria-label="Marktplatz schließen" onClick={()=>setVisible(false)}>×</AnimatedCloseButton></header><MarketplacePanel username={GetSessionDataManager().userName}/></div></DraggableWindow>;
}

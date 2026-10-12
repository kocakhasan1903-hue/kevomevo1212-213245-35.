import {useEffect,useState} from 'react';
import {AddLinkEventTracker,GetSessionDataManager,RemoveLinkEventTracker} from '@octane/renderer';
import {DraggableWindow,DraggableWindowPosition,LayoutAvatarImageView} from '../../common';
import {AnimatedCloseButton} from '../../common/AnimatedCloseButton';
import {TippPanel} from './TippPanel';
import {useTippController} from './useTippController';
function TippWindow({onClose}:{onClose:()=>void}){const controller=useTippController(GetSessionDataManager().userName);return <DraggableWindow uniqueKey="habbico-tipp" handleSelector=".ht-window-header" windowPosition={DraggableWindowPosition.CENTER}><div className="ht-window" role="dialog" aria-label="Habbico Tipp"><header className="ht-window-header">Habbico Tipp<AnimatedCloseButton aria-label="Habbico Tipp schließen" onClick={onClose}><span aria-hidden="true">×</span></AnimatedCloseButton></header><TippPanel controller={controller} renderAvatar={look=><LayoutAvatarImageView figure={look} direction={3} headOnly nativeCroppedHead/>}/></div></DraggableWindow>;}
export function TippView(){const [visible,setVisible]=useState(false);useEffect(()=>{const tracker={eventUrlPrefix:'habbico-tipp/',linkReceived:()=>setVisible(v=>!v)};AddLinkEventTracker(tracker);return()=>RemoveLinkEventTracker(tracker);},[]);return visible?<TippWindow onClose={()=>setVisible(false)}/>:null;}

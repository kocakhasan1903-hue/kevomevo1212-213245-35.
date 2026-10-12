import { useEffect, useState } from 'react';
import { GetSessionDataManager } from '@octane/renderer';
import { TryVisitRoom } from '../../api';
import { useCmsProfile } from '../../hooks/habbix/useCmsProfile';
export function HabbixProfileTabs({profile,children}:any){
 const [tab,setTab]=useState('Gruppen');
 const cms=useCmsProfile(profile.username,profile.id),own=profile.id===GetSessionDataManager().userId;
 useEffect(()=>setTab('Gruppen'),[profile.id]);
 return <div className="habbix-profile-tabs"><nav aria-label="Profilbereiche">{['Gruppen','Räume','Fotos'].map(value=><button type="button" key={value} aria-pressed={tab===value} onClick={()=>setTab(value)}>{value}</button>)}</nav><div key={tab} className="habbix-profile-tab-body">{tab==='Gruppen'?children:<>{cms.error&&<p role="alert">{cms.error}</p>}{!cms.data?<p role="status">Profil wird geladen …</p>:<>{tab==='Räume'&&(cms.data.rooms?.length?cms.data.rooms.map((room:any)=><button key={room.id} type="button" className="habbix-profile-room" onClick={()=>TryVisitRoom(room.id)}><strong>{room.roomName}</strong><span>{room.userCount} / {room.userMax}</span></button>):<p>{own?'Du hast':'Dieser Habbo hat'} noch keine Räume.</p>)}{tab==='Fotos'&&(cms.data.photos?.length?<div className="habbix-profile-photos">{cms.data.photos.map((photo:any)=><article key={photo.id}><img loading="lazy" src={/^https:\/\//.test(photo.url)||/^\/(?!\/)/.test(photo.url)?photo.url:undefined} alt="Veröffentlichtes Hotelfoto"/><time>{new Date(photo.date*1000).toLocaleDateString('de-DE')}</time><button type="button" onClick={()=>TryVisitRoom(photo.roomId)}>Raum besuchen</button></article>)}</div>:<p>{own?'Du hast':'Dieser Habbo hat'} noch keine Fotos.</p>)}</>}</>}</div></div>;
}

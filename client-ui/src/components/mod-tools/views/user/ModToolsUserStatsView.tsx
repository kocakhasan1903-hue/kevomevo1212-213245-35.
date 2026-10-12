import { GetSessionDataManager } from '@octane/renderer';
import { useEffect, useState } from 'react';
import { LayoutAvatarImageView } from '../../../../common';

const statFields = [['credits','Taler'],['diamonds','Diamanten'],['eventstars','Eventsterne'],['flames','Flammen'],['lottoWins','Lotto Gewinne'],['eventLevel','Event Level'],['keysUsed','Schlüssel verwendet'],['boxesOpened','Boxen geöffnet'],['creditsCollected','Taler gesammelt'],['diamondsCollected','Diamanten gesammelt'],['bottlesCollected','Pfandflaschen']];
const roleplayFields = [['health','Gesundheit'],['shield','Schild'],['kills','Kills'],['deaths','Deaths'],['killstreak','Killstreak'],['inJail','Im Gefängnis'],['police','Polizei'],['medic','Medic'],['banned','RPG Ban'],['bounty','Bounty']];
const booleans = new Set(['inJail','police','medic','banned']);

export const ModToolsUserStatsView = ({userId,roleplay}: {userId:number;roleplay:boolean}) => {
    const [data,setData] = useState<any>(null),[error,setError] = useState(''),[revision,setRevision] = useState(0);
    useEffect(()=>{
        setData(null);setError('');
        const sso=localStorage.getItem('kubboch-sto'), username=GetSessionDataManager().userName;
        if(!sso||!username){setError('Bitte über die Webseite einchecken.');return;}
        const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/habboje-ws`);
        const requestId=`stats-${userId}-${Date.now()}-${revision}`;
        const timer=setTimeout(()=>setError('Stats konnten nicht geladen werden. Bitte aktualisieren.'),20000);
        ws.onopen=()=>ws.send(JSON.stringify({header:'auth',data:{sso}}));
        ws.onmessage=event=>{try{
            const m=JSON.parse(event.data);
            if(m.header==='authResponse'){
                if(m.data?.data!=='Success'){clearTimeout(timer);setError('Die Webseiten-Anmeldung ist abgelaufen.');return;}
                ws.send(JSON.stringify({header:'getProfile',data:{username,action:'moderationUserStats',text:JSON.stringify({requestId,userId}),postId:0}}));
            }
            if(m.header==='moderationState'){
                const next=typeof m.data.data==='string'?JSON.parse(m.data.data):m.data.data;
                if(next.requestId!==requestId||next.userId!==userId)return;
                clearTimeout(timer);setData(next);ws.onclose=null;ws.close();
            }
            if(m.header==='profileError'||m.header==='profileResponse'){clearTimeout(timer);setError(String(m.data.data));}
        }catch{clearTimeout(timer);setError('Ungültige Stats-Antwort.');}};
        ws.onerror=()=>{clearTimeout(timer);setError('Die Stats-Verbindung ist unterbrochen.');};
        ws.onclose=()=>{clearTimeout(timer);setError('Die Stats-Verbindung wurde geschlossen. Bitte aktualisieren.');};
        return()=>{clearTimeout(timer);ws.onmessage=null;ws.onerror=null;ws.onclose=null;ws.close();};
    },[userId,revision]);
    const values=roleplay?data?.roleplay:data?.stats;
    const value=(key:string)=>{
        if(values?.[key]===undefined)return 'Nicht verfügbar';
        if(booleans.has(key))return values[key]?'Ja':'Nein';
        if(key==='health'&&values.maxHealth!==undefined)return `${values.health}/${values.maxHealth}`;
        if(key==='shield'&&values.maxShield!==undefined)return `${values.shield}/${values.maxShield}`;
        return Number(values[key]).toLocaleString('de-DE');
    };
    return <section className="hsm-user-stats">
        <div className="hsm-stats-heading">{data?.look&&<LayoutAvatarImageView figure={data.look} gender={data.gender} direction={3} headOnly nativeCroppedHead/>}<strong>{roleplay?'Roleplay Stats':'Stats'}</strong><button type="button" onClick={()=>setRevision(n=>n+1)}>Aktualisieren</button></div>
        {error&&<p role="alert" className="hsm-mod-error">{error}</p>}
        {!data&&!error?<p className="hsm-mod-empty">Stats werden geladen …</p>:<>
            {roleplay&&data&&!data.roleplayAvailable&&<p className="hsm-mod-empty">Für diesen User sind keine Roleplay-Daten im Emulator vorhanden.</p>}
            <dl>{(roleplay?roleplayFields:statFields).map(([key,label])=><div key={key}><dt>{label}:</dt><dd className={values?.[key]===undefined?'is-unavailable':''}>{value(key)}</dd></div>)}</dl>
        </>}
    </section>;
};

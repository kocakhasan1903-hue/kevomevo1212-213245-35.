import { useEffect, useState } from 'react';

/** One bounded public lookup per visible result, rather than opening every profile. */
export function useNavigatorOwnerFigures(ids: number[]) {
    const key = [...new Set(ids.filter(id => id > 0))].sort((a,b) => a-b).slice(0,100).join(',');
    const [figures, setFigures] = useState<Record<number,string>>({});
    useEffect(() => {
        if(!key) return;
        const requestId = crypto.randomUUID();
        const socket = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/habboje-ws`);
        const timeout = setTimeout(() => socket.close(), 15000);
        socket.onopen = () => socket.send(JSON.stringify({header:'cmsExplore', data:{kind:'roomOwners', requestId, ownerIds:key.split(',').map(Number)}}));
        socket.onmessage = event => {
            try {
                const message = JSON.parse(event.data);
                if(message.header !== 'cmsExplore') return;
                const data = JSON.parse(message.data.data);
                if(data.requestId !== requestId) return;
                const next: Record<number,string> = {};
                for(const owner of data.items || []) if(owner.id > 0 && typeof owner.look === 'string') next[owner.id] = owner.look;
                setFigures(next);
                clearTimeout(timeout); socket.close();
            } catch { /* The room list remains usable without an avatar. */ }
        };
        return () => {clearTimeout(timeout);socket.onmessage=null;socket.onopen=null;socket.close();};
    }, [key]);
    return figures;
}

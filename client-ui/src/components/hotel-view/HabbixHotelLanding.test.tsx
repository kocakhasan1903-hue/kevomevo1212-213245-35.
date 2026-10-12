import {act,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {HabbixHotelLanding} from './HabbixHotelLanding';
const actions=vi.hoisted(()=>({profile:vi.fn(),room:vi.fn()}));
vi.mock('../../api',()=>({GetUserProfile:actions.profile,TryVisitRoom:actions.room}));
vi.mock('../../common',()=>({LayoutAvatarImageView:()=> <span/>}));
vi.mock('../../hooks/habbix/useCmsProfile',()=>({avatarStyle:(a:any)=>({border:`${a.borderWidth}px solid ${a.borderColor}`}),appearanceBackground:(s:string)=>({backgroundImage:s?.startsWith('https:')?`url(${s})`:undefined})}));
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();vi.clearAllMocks();});
it('loads published photos and real event balances, opens their rooms and profiles',()=>{
 let socket:any;class Ws{readyState=1;static OPEN=1;onopen:any;onmessage:any;onerror:any;send=vi.fn();close=vi.fn();constructor(){socket=this;}}
 vi.stubGlobal('WebSocket',Ws);localStorage.setItem('kubboch-sto','cms_test');const view=render(<HabbixHotelLanding/>);
 act(()=>{socket.onopen();socket.onmessage({data:JSON.stringify({header:'authResponse',data:{data:'Success'}})});});
 expect(socket.send).toHaveBeenCalledWith(JSON.stringify({header:'lotto',data:{action:'landing'}}));
 const user={userId:12,username:'Testhabbo',figure:'test',appearance:{borderColor:'#22cccc',borderWidth:4,avatar:'https://example.com/avatar.gif'}};
 act(()=>socket.onmessage({data:JSON.stringify({header:'hotelLandingData',data:{data:JSON.stringify({photos:[{...user,id:1,roomId:8,url:'/photos/1.png',date:1,roomName:'Fotoraum'}],leaders:[{...user,eventstars:125}]})}})}));
 expect(screen.getByText('125 Eventsterne')).toBeTruthy();fireEvent.click(screen.getByText('Raum: Fotoraum'));expect(actions.room).toHaveBeenCalledWith(8);fireEvent.click(screen.getByText('125 Eventsterne').closest('button')!);expect(actions.profile).toHaveBeenCalledWith(12);
 expect(view.container.querySelector('.hhl-avatar')?.getAttribute('style')).toContain('4px solid');view.unmount();expect(socket.close).toHaveBeenCalled();
});

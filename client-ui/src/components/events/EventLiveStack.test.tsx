import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { EventLiveStack } from './EventLiveStack';
import { EventController, HotelEvent } from './EventTypes';
afterEach(cleanup);
const activity = {id:1,kind:'auction',title:'Sessel',itemId:0,asset:'',itemName:'Sessel',amount:1,currency:'credits',startPrice:1,highestBid:0,minBid:1,highestBidder:'',winner:'',roomId:42,roomName:'Quizraum',scope:'room',startsAt:1000,endsAt:1060,status:'active'} as HotelEvent;
const controller = (activities:HotelEvent[],balance=20000):EventController => ({data:{now:1000,requestId:'',canManage:false,username:'Test',balance:{credits:balance,diamonds:0},activities,plan:[]},catalog:[],busy:false,ready:true,needsRefresh:false,error:'',action:'',request:vi.fn(),reconnect:vi.fn()});
it('shows independent auction, giveaway and riddle popups only in the matching scope',()=>{
 const data=controller([activity,{...activity,id:2,kind:'giveaway'},{...activity,id:3,kind:'riddle',question:'a b c'},{...activity,id:4,kind:'riddle',roomId:99,question:'Fremder Raum'},{...activity,id:5,kind:'riddle',status:'ended',question:'Beendet'},{...activity,id:6,kind:'giveaway',scope:'hotel',roomId:99}]);
 render(<EventLiveStack controller={data} roomId={42}/>);
 expect(screen.getByLabelText('Live Auktion')).toBeInTheDocument();
 expect(screen.getAllByLabelText('Live Giveaway')).toHaveLength(2);
 expect(screen.getByLabelText('Live Worträtsel')).toHaveTextContent('a b c');
 expect(screen.queryByText('Fremder Raum')).toBeNull();expect(screen.queryByText('Beendet')).toBeNull();
 fireEvent.click(screen.getByLabelText('Auktion ausblenden'));
 expect(screen.queryByLabelText('Live Auktion')).toBeNull();expect(screen.getByLabelText('Live Worträtsel')).toBeInTheDocument();
 expect(data.request).not.toHaveBeenCalled();
});
it('sends quick bids immediately above the current highest bid, independently of the input',()=>{
 const data=controller([{...activity,highestBid:500,minBid:501}]);const view=render(<EventLiveStack controller={data} roomId={42}/>);
 fireEvent.change(screen.getByLabelText('Dein Gebot'),{target:{value:'999'}});
 for(const [label,amount] of [['+100',600],['+1.000',1500],['+10.000',10500]] as const){
  fireEvent.click(screen.getByText(label));expect(data.request).toHaveBeenLastCalledWith('eventBid',{id:1,bid:amount});
 }
 expect(data.request).toHaveBeenCalledTimes(3);
 const next={...data,data:{...data.data,activities:[{...activity,highestBid:1500,minBid:1501}]}};
 view.rerender(<EventLiveStack controller={next} roomId={42}/>);
 fireEvent.click(screen.getByText('+100'));expect(data.request).toHaveBeenLastCalledWith('eventBid',{id:1,bid:1600});
 fireEvent.change(screen.getByLabelText('Dein Gebot'),{target:{value:'2000'}});
 fireEvent.click(screen.getByText('Bieten'));expect(data.request).toHaveBeenLastCalledWith('eventBid',{id:1,bid:2000});
});
it('respects limits and blocks quick bids while pending, disconnected, stale or expired',()=>{
 const data=controller([{...activity,maxBid:101}],50000);const view=render(<EventLiveStack controller={data} roomId={42}/>);
 expect(screen.getByText('+1.000')).toBeDisabled();fireEvent.click(screen.getByText('+100'));
 expect(data.request).toHaveBeenCalledWith('eventBid',{id:1,bid:101});vi.mocked(data.request).mockClear();
 for(const blocked of [{busy:true},{ready:false},{needsRefresh:true}]){
  view.rerender(<EventLiveStack controller={{...data,...blocked}} roomId={42}/>);
  expect(screen.getByText('+100')).toBeDisabled();fireEvent.click(screen.getByText('+100'));
  fireEvent.submit(screen.getByText('Bieten').closest('form'));expect(data.request).not.toHaveBeenCalled();
 }
 view.rerender(<EventLiveStack controller={{...data,data:{...data.data,now:1100}}} roomId={42}/>);
 expect(screen.getByText('Bieten')).toBeDisabled();expect(screen.getByText('+100')).toBeDisabled();
});

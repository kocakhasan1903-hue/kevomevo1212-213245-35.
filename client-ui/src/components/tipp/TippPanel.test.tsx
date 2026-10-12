import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {TippPanel,TippState} from './TippPanel';
const market={key:'home',kind:'h2h',side:'home',odds:2.5,available:true};
const data:TippState={serverTime:1000,weekUsed:0,weekLimit:10,weekReset:5000,feedMessage:'Test',canManage:false,balance:{credits:1000,diamonds:50},games:[{id:'1',home:'Heim',away:'Gast',league:'Liga',starts:2000,updated:1000,source:'Test',status:'open',markets:[market]}],mine:[],recent:[],winners:[],losers:[]};
afterEach(cleanup);
it('distinguishes a missing live score from a confirmed nil-nil and updates it',()=>{
 const game={...data.games[0],starts:900};
 const {view,props}=setup({games:[game]});
 expect(screen.getByLabelText('Spielstand Heim gegen Gast')).toHaveTextContent('– : –');
 view.rerender(<TippPanel controller={{...props.controller,data:{...data,games:[{...game,live_home:0,live_away:0,score_updated:1000,clock:"32′"}]}}}/>);
 expect(screen.getByLabelText('Spielstand Heim gegen Gast')).toHaveTextContent('0 : 0');
 view.rerender(<TippPanel controller={{...props.controller,data:{...data,games:[{...game,live_home:1,live_away:0,score_updated:1001,clock:"33′"}]}}}/>);
 expect(screen.getByLabelText('Spielstand Heim gegen Gast')).toHaveTextContent('1 : 0');
});
function setup(overrides:Partial<TippState>={}){const submit=vi.fn();const props={controller:{data:{...data,...overrides},error:'',busy:false,waiting:false,request:vi.fn(),submit}};const view=render(<TippPanel {...props}/>);return {submit,view,props};}
it('builds an explicit slip, computes profit tax, and submits only the chosen currency/stake',()=>{const {submit}=setup();fireEvent.click(screen.getByRole('button',{name:/^1\s*2\.50$/}));expect(screen.getByText('246')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Schein verbindlich abgeben'}));expect(submit).toHaveBeenCalledWith(expect.objectContaining({stake:100,currency:-1,selections:[expect.objectContaining({gameId:'1',key:'home'})]}),false);});
it('blocks suspended and stale markets as well as unverified live feeds',()=>{for(const game of [{...data.games[0],markets:[{...market,available:false}]},{...data.games[0],updated:800},{...data.games[0],starts:900}]){setup({games:[game]});expect(screen.getByRole('button',{name:/1\s*Gesperrt/})).toBeDisabled();cleanup();}});
it('enforces balance and weekly limit in the form',()=>{setup({weekUsed:10});fireEvent.click(screen.getByRole('button',{name:/^1\s*2\.50$/}));expect(screen.getByRole('button',{name:'Schein verbindlich abgeben'})).toBeDisabled();cleanup();setup({balance:{credits:20,diamonds:10}});fireEvent.click(screen.getByRole('button',{name:/^1\s*2\.50$/}));expect(screen.getByRole('button',{name:'Schein verbindlich abgeben'})).toBeDisabled();});
it('invalidates a selected quote when the server changes its price',()=>{const {view,props}=setup();fireEvent.click(screen.getByRole('button',{name:/^1\s*2\.50$/}));view.rerender(<TippPanel controller={{...props.controller,data:{...data,games:[{...data.games[0],markets:[{...market,odds:1.7}]}]}}}/>);expect(screen.getByText(/Quote geändert oder gesperrt/)).toBeInTheDocument();expect(screen.getByRole('button',{name:'Schein verbindlich abgeben'})).toBeDisabled();});


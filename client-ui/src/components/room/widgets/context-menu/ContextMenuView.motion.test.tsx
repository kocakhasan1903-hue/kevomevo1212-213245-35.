/* @vitest-environment jsdom */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ContextMenuView } from './ContextMenuView';
vi.mock('@octane/renderer',()=>({GetStage:()=>({width:1200,height:800}),RoomObjectType:{USER:1,BOT:2,RENTABLE_BOT:3}}));
vi.mock('../../../../api',()=>({AddAnimationTickerCallback:()=>()=>{},FixedSizeStack:class{},GetRoomObjectBounds:vi.fn(),GetRoomObjectScreenLocation:vi.fn(),GetRoomSession:()=>({roomId:1})}));
vi.mock('../../../../common',()=>({Flex:({classNames=[],children,alignItems,justifyContent,...props}:any)=><div {...props} className={classNames.join(' ')}>{children}</div>}));
afterEach(cleanup);
it('retains the content for the closing animation but makes collapsed actions inert',()=>{
 const {container}=render(<ContextMenuView objectId={1} category={1} collapsable onClose={()=>{}}><button>Meine Outfits</button></ContextMenuView>);
 const footer=container.querySelector('.octane-context-menu-footer');
 fireEvent.click(footer);
 expect(container.querySelector('.octane-context-menu')).toHaveClass('menu-hidden');
 expect(container.querySelector('.habbix-context-content')).toHaveAttribute('inert');
 expect(container.querySelector('.habbix-context-content')).toHaveAttribute('aria-hidden','true');
 expect(container).toHaveTextContent('Meine Outfits');
 fireEvent.click(footer);
 expect(container.querySelector('.octane-context-menu')).not.toHaveClass('menu-hidden');
 expect(container.querySelector('.habbix-context-content')).not.toHaveAttribute('inert');
});

import {cleanup,fireEvent,render} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({canvas:null as HTMLCanvasElement|null,touch:vi.fn(),dispatch:vi.fn()}));
vi.mock('@octane/renderer',()=>({
 GetRenderer:()=>({canvas:state.canvas}),GetRoomEngine:()=>({getRoomInstanceGeometry:()=>({scale:64}),getRoomInstanceRenderingCanvasScale:()=>1}),RoomGeometry:{SCALE_ZOOMED_OUT:32},
 GetEventDispatcher:()=>({dispatchEvent:state.dispatch,addEventListener:vi.fn(),removeEventListener:vi.fn()}),
 RoomObjectMouseEvent:class {static CLICK='click'},RoomObjectTileMouseEvent:class {},RoomSession:class {},
 RoomZoomEvent:class {constructor(public roomId:number,public level:number){}},
}));
vi.mock('../../api',()=>({DispatchMouseEvent:vi.fn(),DispatchTouchEvent:state.touch}));
vi.mock('../../hooks',()=>({useRoom:()=>({roomSession:{roomId:9}}),useRoomKeyboardMovement:()=>{}}));
vi.mock('./widgets/RoomWidgetsView',()=>({RoomWidgetsView:()=>null}));
vi.mock('./widgets/wired-fx/WiredVariableFxOverlayView',()=>({WiredVariableFxOverlayView:()=>null}));
vi.mock('./spectator/RoomSpectatorView',()=>({RoomSpectatorView:()=>null}));
import {RoomView} from './RoomView';
beforeEach(()=>vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}))));
afterEach(()=>{cleanup();vi.clearAllMocks();vi.unstubAllGlobals();});
describe('canvas touch gestures',()=>{
 it('pinches room zoom without walking/clicking a tile at the end',()=>{
  state.canvas=document.createElement('canvas');render(<RoomView/>);
  fireEvent.touchStart(state.canvas,{touches:[{clientX:0,clientY:0},{clientX:100,clientY:0}]});
  fireEvent.touchMove(state.canvas,{touches:[{clientX:0,clientY:0},{clientX:200,clientY:0}]});
  expect(state.dispatch).toHaveBeenCalledWith(expect.objectContaining({roomId:9,level:2}));
  fireEvent.touchEnd(state.canvas,{touches:[],changedTouches:[{clientX:200,clientY:0}]});
  expect(state.touch).not.toHaveBeenCalled();
  fireEvent.touchStart(state.canvas,{touches:[{clientX:10,clientY:20}]});
  expect(state.touch).toHaveBeenCalledOnce();
 });
 it('removes touch listeners when leaving the room',()=>{
  state.canvas=document.createElement('canvas');const view=render(<RoomView/>);view.unmount();
  fireEvent.touchStart(state.canvas,{touches:[{clientX:10,clientY:20}]});expect(state.touch).not.toHaveBeenCalled();
 });
});

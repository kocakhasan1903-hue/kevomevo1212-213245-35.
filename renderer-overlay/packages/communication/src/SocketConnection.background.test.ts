import {afterEach,describe,expect,it,vi} from 'vitest';
import {SocketConnection} from './SocketConnection';
const visibility=Object.getOwnPropertyDescriptor(document,'visibilityState');
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();if(visibility)Object.defineProperty(document,'visibilityState',visibility);else delete (document as any).visibilityState;});
const setVisible=(value:string)=>Object.defineProperty(document,'visibilityState',{configurable:true,value});
describe('mobile background reconnect',()=>{
 it('parks retry attempts while hidden and reconnects when brought back before ten minutes',()=>{
  vi.useFakeTimers();vi.setSystemTime(1000);setVisible('hidden');
  const connection=new SocketConnection();const state=connection as any;
  state._socketUrl='wss://hotel.example/ws';state._isAuthenticated=true;
  state._socket={readyState:WebSocket.CLOSED};
  state._onVisibility();state.onSocketClosed({code:1000,reason:''});
  expect(connection.connectionState.phase).toBe('reconnecting');expect(state._reconnectTimer).toBeNull();
  vi.advanceTimersByTime(9*60*1000);setVisible('visible');
  const create=vi.spyOn(state,'createSocket').mockImplementation(()=>{});
  state._onVisibility();vi.advanceTimersByTime(3000);
  expect(create).toHaveBeenCalledWith('wss://hotel.example/ws');
 });
 it('never resumes a session explicitly closed by the server',()=>{
  vi.useFakeTimers();setVisible('visible');
  const connection=new SocketConnection();const state=connection as any;
  state._socketUrl='wss://hotel.example/ws';state._wasAuthenticated=true;
  state._socket={readyState:WebSocket.CLOSED};state.serverDisconnected(2);
  const retry=vi.spyOn(state,'attemptReconnect');state._onVisibility();expect(retry).not.toHaveBeenCalled();
 });
});

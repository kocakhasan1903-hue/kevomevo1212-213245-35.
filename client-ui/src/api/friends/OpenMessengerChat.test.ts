import {describe,expect,it,vi} from 'vitest';
vi.mock('@octane/renderer',()=>({CreateLinkEvent:vi.fn()}));
import {CreateLinkEvent} from '@octane/renderer';
import {OpenMessengerChat} from './OpenMessengerChat';
describe('chat entry point',()=>{
 it('opens overview instead of toggling a potentially hidden messenger',()=>{OpenMessengerChat();expect(CreateLinkEvent).toHaveBeenLastCalledWith('friends-messenger/overview');OpenMessengerChat();expect(CreateLinkEvent).toHaveBeenLastCalledWith('friends-messenger/overview');});
 it('still opens direct and team conversations explicitly',()=>{OpenMessengerChat(42);expect(CreateLinkEvent).toHaveBeenLastCalledWith('friends-messenger/42');OpenMessengerChat(-1);expect(CreateLinkEvent).toHaveBeenLastCalledWith('friends-messenger/-1');});
});

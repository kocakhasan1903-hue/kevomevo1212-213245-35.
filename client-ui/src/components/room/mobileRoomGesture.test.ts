import {describe,expect,it} from 'vitest';
import {pinchRoomScale,touchDistance} from './mobileRoomGesture';
describe('mobile room pinch zoom',()=>{
 it('zooms in and out relative to the gesture start',()=>{expect(pinchRoomScale(1,100,200)).toBe(2);expect(pinchRoomScale(2,100,50)).toBe(1);});
 it('clamps zoom and ignores a zero-distance start',()=>{expect(pinchRoomScale(1,100,1000)).toBe(4);expect(pinchRoomScale(1,100,1)).toBe(.5);expect(pinchRoomScale(2,0,100)).toBe(2);});
 it('measures both fingers rather than a one-finger drag',()=>{expect(touchDistance([{clientX:0,clientY:0},{clientX:30,clientY:40}])).toBe(50);expect(touchDistance([{clientX:0,clientY:0}])).toBe(0);});
});

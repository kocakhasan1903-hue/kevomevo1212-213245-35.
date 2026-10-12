/* @vitest-environment jsdom */
import {describe,expect,it,vi} from 'vitest';
const master=vi.hoisted(()=>({getGlobalTransform:()=>({applyInverse:(p:{x:number;y:number})=>p}),worldTransform:{applyInverse:(p:{x:number;y:number})=>({x:p.x+320,y:p.y+320})}}));
const renderer=vi.hoisted(()=>({canvas:{width:1600,height:1200,getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})},resolution:2}));
vi.mock('@octane/renderer',()=>({GetRenderer:()=>renderer,GetRoomEngine:()=>({getActiveRoomInstanceRenderingCanvas:()=>({master})}),OctaneRectangle:class{constructor(public x:number,public y:number,public width:number,public height:number){}},TextureUtils:{}}));
import {getViewfinderRoomFrame} from './blitRoomCanvasToViewfinder';
describe('Camera crop and zoom',()=>{
 const target={getBoundingClientRect:()=>({left:100,top:80,width:320,height:320})} as HTMLCanvasElement;
 it('keeps the same center and crops to half the dimensions at 200%, independently of device resolution',()=>{
  const normal=getViewfinderRoomFrame(target,320,320,1)!;
  const zoomed=getViewfinderRoomFrame(target,320,320,2)!;
  expect(normal).toMatchObject({x:100,y:80,width:320,height:320});
  expect(zoomed).toMatchObject({x:180,y:160,width:160,height:160});
  expect(zoomed.x+zoomed.width/2).toBe(normal.x+normal.width/2);
 });
 it('bounds zoom and declines capture if no viewfinder exists',()=>{
  expect(getViewfinderRoomFrame(target,320,320,.1)?.width).toBe(320);
  expect(getViewfinderRoomFrame(target,320,320,100)?.width).toBeCloseTo(320/3);
  expect(getViewfinderRoomFrame(null)).toBeNull();
 });
 it('ignores the cached offscreen render transform on every snapshot',()=>{
  for(let i=0;i<5;i++)expect(getViewfinderRoomFrame(target,320,320)).toMatchObject({x:100,y:80,width:320,height:320});
 });
 it('uses visible CSS dimensions even when the output buffer has a different size',()=>{
  const scaled={getBoundingClientRect:()=>({left:100,top:80,width:256,height:256})} as HTMLCanvasElement;
  expect(getViewfinderRoomFrame(scaled,320,320,2)).toMatchObject({x:164,y:144,width:128,height:128});
 });
});

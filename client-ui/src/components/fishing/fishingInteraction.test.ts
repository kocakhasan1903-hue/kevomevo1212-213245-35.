import {describe,it,expect} from 'vitest';
import {isFishingWater,canShowFishing,fishSaleTotal,waterDoubleTap} from './fishingInteraction';
describe('Fishing interactions',()=>{
 it('only starts on configured tile water when targeted',()=>{const water=[{x:3,y:4,itemId:0}];expect(isFishingWater(3,4,water)).toBe(true);expect(isFishingWater(2,4,water)).toBe(false);expect(isFishingWater(3,4,[{x:3,y:4,itemId:99}])).toBe(true);});
 it('requires two taps on the same water within the double-click interval',()=>{expect(waterDoubleTap(null,1,2,100)).toBe(false);expect(waterDoubleTap({x:1,y:2,at:100},1,2,450)).toBe(true);expect(waterDoubleTap({x:1,y:2,at:100},2,2,200)).toBe(false);expect(waterDoubleTap({x:1,y:2,at:100},1,2,600)).toBe(false);});
 it('never shows fishing in an unconfigured, disabled or different room',()=>{expect(canShowFishing(false,12,12)).toBe(false);expect(canShowFishing(true,12,0)).toBe(false);expect(canShowFishing(true,12,13)).toBe(false);expect(canShowFishing(true,12,12)).toBe(true);});
 it('shows both currencies and handles unknown inventory entries safely',()=>{expect(fishSaleTotal([{species:'barsch'},{species:'lachs'},{species:'missing'}],[{key:'barsch',price:150,diamonds:0},{key:'lachs',price:200,diamonds:1}])).toEqual({credits:350,diamonds:1});});
});

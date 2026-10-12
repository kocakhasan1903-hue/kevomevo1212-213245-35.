export type WaterTile={x:number;y:number;itemId:number};
export function isFishingWater(x:number,y:number,water:WaterTile[]):boolean{return water.some(w=>w.x===x&&w.y===y);}
export function canShowFishing(enabled:boolean,roomId:number,configuredRoom:number):boolean{return enabled&&configuredRoom>0&&roomId===configuredRoom;}
export function fishSaleTotal(bag:{species:string}[],fish:{key:string;price:number;diamonds:number}[]){return bag.reduce((sum,item)=>{const f=fish.find(f=>f.key===item.species);return{credits:sum.credits+(f?.price||0),diamonds:sum.diamonds+(f?.diamonds||0)};},{credits:0,diamonds:0});}

export type WaterTap={x:number;y:number;at:number};
export function waterDoubleTap(previous:WaterTap|null,x:number,y:number,at:number):boolean{return !!previous&&previous.x===x&&previous.y===y&&at-previous.at>=0&&at-previous.at<=450;}

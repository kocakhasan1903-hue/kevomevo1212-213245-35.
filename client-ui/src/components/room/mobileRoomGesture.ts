export const touchDistance = (touches: ArrayLike<{clientX:number;clientY:number}>) => touches.length < 2 ? 0 : Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
export const pinchRoomScale = (startScale:number,startDistance:number,distance:number) => startDistance <= 0 ? startScale : Math.max(0.5,Math.min(4,startScale*distance/startDistance));

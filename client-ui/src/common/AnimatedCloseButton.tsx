import { ButtonHTMLAttributes, MouseEvent, useEffect, useRef, useState } from 'react';

/** Leave the close gesture visible briefly before unmounting the window. */
export function AnimatedCloseButton({onClick,className='',children,...props}:ButtonHTMLAttributes<HTMLButtonElement>){
    const [closing,setClosing]=useState(false);
    const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
    useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
    const close=(event:MouseEvent<HTMLButtonElement>)=>{
        event.stopPropagation();
        if(timer.current)return;
        if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){onClick?.(event);return;}
        setClosing(true);
        timer.current=setTimeout(()=>{timer.current=null;setClosing(false);onClick?.(event);},120);
    };
    return <button {...props} type="button" className={`${className} habbix-animated-close${closing?' is-closing':''}`} onClick={close}>{children}</button>;
}

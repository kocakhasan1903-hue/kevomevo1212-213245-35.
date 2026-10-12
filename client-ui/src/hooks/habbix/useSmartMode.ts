import { useEffect, useState } from 'react';
export interface SmartModeSettings { outside: boolean; escape: boolean; remember: boolean; idleSeconds: number; opacity: number }
const defaults:SmartModeSettings={outside:false,escape:false,remember:true,idleSeconds:0,opacity:100};
export function readSmartMode():SmartModeSettings {
 try{const value=JSON.parse(localStorage.getItem('habbix.smart-mode')||'{}');return {outside:value.outside===true,escape:value.escape===true,remember:value.remember!==false,idleSeconds:Math.max(0,Math.min(3600,Number(value.idleSeconds)||0)),opacity:Math.max(40,Math.min(100,Number(value.opacity)||100))};}catch{return {...defaults};}
}
export function useSmartMode(){
 const [settings,setSettings]=useState(readSmartMode);
 useEffect(()=>{const refresh=()=>setSettings(readSmartMode());window.addEventListener('habbix-smart-mode',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('habbix-smart-mode',refresh);window.removeEventListener('storage',refresh);};},[]);
 const save=(patch:Partial<SmartModeSettings>)=>{localStorage.setItem('habbix.smart-mode',JSON.stringify({...readSmartMode(),...patch}));window.dispatchEvent(new Event('habbix-smart-mode'));};
 return {settings,save};
}

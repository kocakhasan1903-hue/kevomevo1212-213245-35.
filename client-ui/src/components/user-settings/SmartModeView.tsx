import { FaClock, FaLightbulb, FaPalette } from 'react-icons/fa';
import { OctaneCard } from '../../layout';
import { useSmartMode } from '../../hooks/habbix/useSmartMode';
export function SmartModeView({onClose}:{onClose:()=>void}){
 const {settings,save}=useSmartMode();
 return <OctaneCard uniqueKey="habbix-smart-mode" className="habbix-smart-window">
  <OctaneCard.Header headerText="Smart Mode" onCloseClick={onClose}/>
  <OctaneCard.Content>
   <p className="habbix-smart-description">Smart Mode schließt offene Fenster automatisch, wenn du außerhalb des Fensters klickst.</p>
   <div className="habbix-smart-columns">
    <section className="habbix-smart-left">
     <h3><FaLightbulb aria-hidden="true"/>Basis Einstellungen</h3>
     <label className="habbix-smart-toggle"><span><strong>Smart Mode</strong><small>{settings.outside?'Aktiviert':'Deaktiviert'}</small></span><input type="checkbox" aria-label="Bei Klick außerhalb schließen" checked={settings.outside} onChange={e=>save({outside:e.target.checked})}/></label>
     <div className="habbix-smart-toggle"><span><strong>Fensterposition</strong><small>Beim Öffnen immer mittig</small></span></div>
     <label className="habbix-smart-toggle"><span><strong>ESC zum Schließen</strong><small>ESC Taste</small></span><input type="checkbox" aria-label="ESC zum Schließen" checked={settings.escape} onChange={e=>save({escape:e.target.checked})}/></label>
    </section>
    <section className="habbix-smart-right">
     <h3><FaClock aria-hidden="true"/>Auto Close Timer</h3>
     <label className="habbix-smart-field"><strong>Automatisches Schließen</strong><small>Nach {settings.idleSeconds} Sekunden Inaktivität (0 = deaktiviert)</small><input type="number" aria-label="Nach Sekunden ohne Aktivität (0 = aus)" min="0" max="3600" value={settings.idleSeconds} onChange={e=>save({idleSeconds:Math.max(0,Math.min(3600,Number(e.target.value)||0))})}/></label>
     <h3><FaPalette aria-hidden="true"/>Transparenz</h3>
     <label className="habbix-smart-field"><strong>Transparenz Level</strong><small>Deckkraft: {settings.opacity}%</small><input type="range" aria-label="Deckkraft" min="40" max="100" value={settings.opacity} onChange={e=>save({opacity:Number(e.target.value)})}/></label>
    </section>
   </div>
  </OctaneCard.Content>
 </OctaneCard>;
}

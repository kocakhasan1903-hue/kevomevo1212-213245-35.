"""Build the optional fishing plugin and patch only its website adapter classes."""
from pathlib import Path
import argparse, subprocess, zipfile
p=argparse.ArgumentParser();p.add_argument('--core',required=True);p.add_argument('--website',required=True);p.add_argument('--output',default='built');a=p.parse_args()
root=Path(__file__).resolve().parent;core=Path(a.core).resolve(strict=True);website=Path(a.website).resolve(strict=True);out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(core) as z:
    required=['com/eu/habbo/habbohotel/economy/EconomyLedger.class','com/eu/habbo/habbohotel/users/LedgerWalletMutation.class']
    missing=[n for n in required if n not in z.namelist()]
    if missing:raise SystemExit('Core API incompatible: '+', '.join(missing)+'. Use the included Polaris sources; do not replace a running core blindly.')
classes=out/'fishing-classes';classes.mkdir(exist_ok=True)
subprocess.run(['javac','-encoding','UTF-8','-cp',str(core),'-d',str(classes),*[str(f) for f in (root/'src').rglob('*.java')]],check=True)
subprocess.run(['jar','--create','--file',str(out/'HabbixFishing.jar'),'-C',str(classes),'.','-C',str(root),'plugin.json'],check=True)
web=out/'website-classes';web.mkdir(exist_ok=True);sources=root.parent/'website/src/main/java/server/websocket/incoming/common/profile'
subprocess.run(['javac','-encoding','UTF-8','-cp',str(core)+':'+str(website),'-d',str(web),*[str(sources/(n+'.java')) for n in ('EventAdministration','ProfileEvents','ProfileVoiceChannels')]],check=True)
patches={f.relative_to(web).as_posix():f for f in web.rglob('*.class')}
with zipfile.ZipFile(website) as before,zipfile.ZipFile(out/'website.jar','w',zipfile.ZIP_DEFLATED) as after:
    for member in before.infolist():
        if member.filename not in patches:after.writestr(member,before.read(member))
    for name,f in patches.items():after.write(f,name)
print('Built HabbixFishing.jar and website.jar; existing website classes preserved except the three adapter classes.')

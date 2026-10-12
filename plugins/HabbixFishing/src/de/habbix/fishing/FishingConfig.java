package de.habbix.fishing;

import java.util.*;

public final class FishingConfig {
    public boolean enabled=false;
    public int roomId=0,range=2,minWait=40,maxWait=80,staffRank=7,merchantX=-1,merchantY=-1;
    public boolean passRequired=true,manualHook=false;
    public List<Water> water=new ArrayList<>();
    public Map<String,Integer> prices=new LinkedHashMap<>();
    public List<FishingRules.Fish> fish=FishingRules.defaults();
    public int pass1=1900,pass3=4200,pass6=8200,passWarning=300,waterCheck=3,maxWarnings=3,xpPerCatch=5,xpPerSale=5,upgradeXp=100,repairMinimum=1500,maxRod=4;
    public double catchChance=.35,junkChance=.25,wearCatch=2,wearMiss=.5,wearBaseMiss=1,repairBase=2,repairMultiplier=.1;
    public record Water(int x,int y,int itemId) {}
    public FishingRules.Fish fish(String key){return fish.stream().filter(f->f.key.equals(key)).findFirst().orElseThrow(()->new IllegalArgumentException("Unbekannter Fisch."));}
    public int price(String key){return fish(key).price;}
    public int passPrice(int hours){return hours==1?pass1:hours==3?pass3:pass6;}
    public int repairCost(int level,double durability){return level<=0?(int)Math.ceil((100-durability)*repairBase):Math.max(repairMinimum,(int)Math.ceil(FishingRules.rod(level).price()*repairMultiplier*(100-durability)/100));}
    public void validate(){
        if(roomId<0||range<1||range>4||minWait<5||maxWait<minWait||maxWait>120||staffRank<7||staffRank>99||maxRod<1||maxRod>4||passWarning<0||passWarning>86400||waterCheck<1||waterCheck>30||maxWarnings<1||maxWarnings>20||xpPerCatch<0||xpPerCatch>10000||xpPerSale<0||xpPerSale>10000||upgradeXp<1||upgradeXp>100000||repairMinimum<0||repairMinimum>1000000)throw new IllegalArgumentException("Ungültige Angel-Konfiguration.");
        for(int n:new int[]{pass1,pass3,pass6})if(n<0||n>1000000)throw new IllegalArgumentException("Ungültiger Passpreis.");
        for(double n:new double[]{catchChance,junkChance,repairMultiplier})if(!Double.isFinite(n)||n<0||n>1)throw new IllegalArgumentException("Chance oder Multiplikator muss zwischen 0 und 1 liegen.");
        for(double n:new double[]{wearCatch,wearMiss,wearBaseMiss,repairBase})if(!Double.isFinite(n)||n<0||n>100)throw new IllegalArgumentException("Ungültiger Verschleiß oder Reparaturpreis.");
        if(fish==null||fish.size()>200||fish.isEmpty())throw new IllegalArgumentException("1–200 Fischarten erforderlich.");Set<String> keys=new HashSet<>();for(var f:fish){if(f==null)throw new IllegalArgumentException("Ungültiger Fisch.");f.validate();if(!keys.add(f.key))throw new IllegalArgumentException("Fisch-ID doppelt.");}
        if(enabled&&(roomId==0||water==null||water.isEmpty()||fish.stream().noneMatch(f->f.enabled)))throw new IllegalArgumentException("Erst Raum, Wasser und mindestens eine aktive Fischart einrichten.");
        if(water==null||water.size()>2048||prices==null)throw new IllegalArgumentException("Zu viele Wasserfelder.");
        for(Water w:water)if(w==null||w.x<0||w.y<0||w.x>255||w.y>255||w.itemId<0)throw new IllegalArgumentException("Ungültiges Wasserfeld.");
        for(var p:prices.entrySet()){FishingRules.species(p.getKey());if(p.getValue()<0||p.getValue()>10000)throw new IllegalArgumentException("Preis außerhalb 0–10000.");}
    }
}

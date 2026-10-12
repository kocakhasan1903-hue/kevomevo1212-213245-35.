package de.habbix.fishing;

import java.util.*;
import java.util.random.RandomGenerator;

/** Game rules shared by the plugin and its deterministic regression tests. */
public final class FishingRules {
    public record Species(String key,String name,String rarity,int price,int xp,int weight,int minGrams,int maxGrams,boolean junk,String color) {}
    public static class Fish {
        public String key,name,type="FISH",color="#85a875",iconUrl="",legacyIcon="",description="";
        public int weight=10,sortOrder=0,price=20,diamonds=0,minGrams=100,maxGrams=1000;
        public boolean enabled=true;
        public Species species(int xp){return new Species(key,name,weight<=2?"Legendär":weight<=9?"Selten":"Häufig",price,xp,weight,minGrams,maxGrams,type.equals("TRASH"),color);}
        public void validate(){
            if(key==null||!key.matches("[a-z0-9_]{1,32}")||name==null||name.isBlank()||name.length()>64||!List.of("FISH","TRASH").contains(type)||weight<1||weight>10000||price<0||price>1000000||diamonds<0||diamonds>10000||sortOrder<0||sortOrder>10000||minGrams<1||maxGrams<minGrams||maxGrams>1000000||color==null||!color.matches("#[0-9a-fA-F]{6}"))throw new IllegalArgumentException("Ungültige Fischwerte.");
            if(description==null||description.length()>500||legacyIcon==null||!legacyIcon.matches("[a-zA-Z0-9_-]{0,64}")||iconUrl==null||iconUrl.length()>300||!iconUrl.isEmpty()&&!((iconUrl.startsWith("/assets/")||iconUrl.startsWith("/client/assets/"))&&!iconUrl.contains("..")||iconUrl.matches("https://[a-zA-Z0-9.-]+/[^\\s]*")))throw new IllegalArgumentException("Ungültige Beschreibung oder Icon-Adresse.");
        }
    }
    public static List<Fish> defaults(){
        String[][] rows={{"barsch","Kleiner Barsch","12","1","150","0"},{"lachs","Lachs","8","1","200","1"},{"karpfen","Karpfen","10","2","181","1"},{"forelle","Forelle","11","4","190","0"},{"hecht","Hecht","9","6","220","1"},{"thunfisch","Thunfisch","7","7","320","1"},{"zander","Zander","6","8","283","1"},{"aal","Aal","5","9","294","1"},{"hai","Hai","3","10","370","5"},{"goldfisch","Goldfisch","2","11","2500","6"},{"stoer","Stör","4","11","500","0"},{"legendaer","Legendärer Fisch","1","12","6000","5"},{"dose","Alte Dose","50","101","4","0"},{"flasche","Plastikflasche","45","102","5","0"},{"schuh","Alter Schuh","40","103","7","0"},{"haken","Rostiger Haken","35","104","8","0"},{"angel","Alte Angel","30","105","10","0"}};
        String[] colors={"#85a875","#df8f81","#bda576","#79babc","#8e9e6e","#879eb5","#d8bf7a","#959478","#98a9b5","#f0cc65","#9b9b93","#b69eda","#909aa2","#8eaf9c","#a98769","#9b8b75","#bd9774"};
        List<Fish> result=new ArrayList<>();int i=0;for(String[] row:rows){Fish f=new Fish();f.key=row[0];f.name=row[1];f.weight=Integer.parseInt(row[2]);f.sortOrder=Integer.parseInt(row[3]);f.price=Integer.parseInt(row[4]);f.diamonds=Integer.parseInt(row[5]);f.type=i>=12?"TRASH":"FISH";f.color=colors[i++];f.iconUrl="/client/assets/fishing/"+f.key+".svg";f.legacyIcon=f.key;f.description=f.type.equals("TRASH")?"Ein Fund vom Gewässergrund. Beim Fischhändler verkaufbar.":"Ein Fang aus dem Angelpark. Beim Fischhändler verkaufbar.";result.add(f);}return result;
    }
    public static Species roll(RandomGenerator random,int level,FishingConfig config){
        Rod rod=rod(level);if(random.nextDouble()>=Math.min(1,config.catchChance+rod.catchBonus/100.0))return null;
        List<Fish> pool=config.fish.stream().filter(f->f.enabled).toList();
        boolean junk=random.nextDouble()<Math.max(0,config.junkChance-new double[]{0,.09,.15,.19,.30}[rod.level]);
        List<Fish> chosen=pool.stream().filter(f->f.type.equals(junk?"TRASH":"FISH")).toList();if(chosen.isEmpty())chosen=pool;
        int total=chosen.stream().mapToInt(f->f.weight+(f.weight<=9&&!f.type.equals("TRASH")?rod.rareBonus:0)).sum();if(total<=0)return null;
        int n=random.nextInt(total);for(Fish f:chosen){n-=f.weight+(f.weight<=9&&!f.type.equals("TRASH")?rod.rareBonus:0);if(n<0)return f.species(config.xpPerCatch);}throw new IllegalStateException();
    }
    public record Rod(int level,String name,int xp,int price,int catchBonus,int rareBonus) {}
    public static final List<Species> SPECIES=List.of(
        new Species("rotfeder","Rotfeder","Häufig",18,8,35,120,650,false,"#cb8b67"),
        new Species("barsch","Flussbarsch","Häufig",28,12,27,250,1800,false,"#85a875"),
        new Species("forelle","Bachforelle","Ungewöhnlich",45,18,18,400,3200,false,"#77b8bb"),
        new Species("hecht","Hecht","Selten",90,30,9,1500,11000,false,"#bba1d2"),
        new Species("zander","Zander","Selten",110,35,7,1000,8000,false,"#d8bf7a"),
        new Species("goldkarpfen","Goldkarpfen","Legendär",350,70,1,2000,12000,false,"#f0cc65"),
        new Species("dose","Alte Dose","Schrott",3,2,2,50,250,true,"#8e9ba2"),
        new Species("stiefel","Alter Stiefel","Schrott",5,3,1,200,900,true,"#ac8b72"));
    public static final List<Rod> RODS=List.of(new Rod(0,"Basis Angel",0,0,0,0),new Rod(1,"Fortgeschrittene Angel",100,1000,10,5),new Rod(2,"Experten Angel",200,2000,20,10),new Rod(3,"Meister Angel",300,3000,30,15),new Rod(4,"Legendäre Angel",400,4000,45,25));
    public static Species species(String key){return SPECIES.stream().filter(s->s.key.equals(key)).findFirst().orElseThrow(()->new IllegalArgumentException("Unbekannter Fisch."));}
    public static Rod rod(int level){return RODS.get(Math.clamp(level,0,RODS.size()-1));}
    public static boolean inReach(int x,int y,int waterX,int waterY,int range){return range>=1 && Math.max(Math.abs((long)x-waterX),Math.abs((long)y-waterY))<=range;}
    public static Species roll(RandomGenerator random,int level){
        Rod rod=rod(level);if(random.nextInt(100)>=68+rod.catchBonus)return null;
        int total=SPECIES.stream().mapToInt(s->adjustedWeight(s,rod)).sum();int n=random.nextInt(total);
        for(Species s:SPECIES){n-=adjustedWeight(s,rod);if(n<0)return s;}throw new IllegalStateException();
    }
    private static int adjustedWeight(Species s,Rod r){return s.rarity.equals("Selten")||s.rarity.equals("Legendär")?s.weight+r.rareBonus:Math.max(1,s.weight-(s.junk?r.level-1:0));}
    public static int grams(Species s,RandomGenerator r){return r.nextInt(s.minGrams,s.maxGrams+1);}
    public static int bounded(String text,int min,int max){int n;try{n=Integer.parseInt(text);}catch(Exception e){throw new IllegalArgumentException("Bitte eine ganze Zahl eingeben.");}if(n<min||n>max)throw new IllegalArgumentException("Erlaubt: "+min+" bis "+max+".");return n;}
}

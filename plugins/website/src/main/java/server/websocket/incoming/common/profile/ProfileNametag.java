package server.websocket.incoming.common.profile;

import com.google.gson.*;
import java.sql.*;
import java.util.*;

/** Cosmetic client identity settings. Every write is bound to the authenticated owner. */
public final class ProfileNametag {
 private static String color(JsonObject source,String key,String fallback){
  if(!source.has(key))return fallback;
  String value=source.get(key).getAsString();
  if(!value.matches("#[0-9a-fA-F]{6}"))throw new IllegalArgumentException("Bitte eine gültige Hex-Farbe wählen.");
  return value.toLowerCase(Locale.ROOT);
 }
 private static int number(JsonObject source,String key,int min,int max){
  if(!source.has(key))return 0;
  int value=source.get(key).getAsInt();
  if(value<min||value>max)throw new IllegalArgumentException("Schatten oder Glow liegt außerhalb des erlaubten Bereichs.");
  return value;
 }
 public static JsonObject sanitize(String text){
  if(text==null||text.length()>2500)throw new IllegalArgumentException("Ungültiger Nametag.");
  JsonObject source=new JsonParser().parse(text).getAsJsonObject(),clean=new JsonObject();
  String tag=source.has("tag")?source.get("tag").getAsString().trim():"";
  if(tag.codePointCount(0,tag.length())>5||java.util.regex.Pattern.compile("[\\p{Cntrl}<>\\[\\]\\u202A-\\u202E\\u2066-\\u2069]").matcher(tag).find())throw new IllegalArgumentException("Der Tag darf höchstens 5 Zeichen ohne Steuerzeichen enthalten.");
  clean.addProperty("tag",tag);clean.addProperty("tagColor",color(source,"tagColor","#299e9a"));clean.addProperty("nameColor",color(source,"nameColor","#ffffff"));
  for(String name:new String[]{"tagShadow","nameShadow","tagGlow","nameGlow"}){
   JsonObject from=source.has(name)?source.getAsJsonObject(name):new JsonObject(),effect=new JsonObject();
   effect.addProperty("color",color(from,"color","#000000"));effect.addProperty("blur",number(from,"blur",0,20));
   effect.addProperty("x",name.endsWith("Glow")?0:number(from,"x",-10,10));effect.addProperty("y",name.endsWith("Glow")?0:number(from,"y",-10,10));clean.add(name,effect);
  }
  return clean;
 }
 public static JsonObject save(Connection c,int author,int owner,String text)throws SQLException{
  if(author!=owner)throw new IllegalArgumentException("Du kannst nur deinen eigenen Nametag bearbeiten.");
  JsonObject style=sanitize(text);
  try(PreparedStatement p=c.prepareStatement("INSERT INTO website_profile_nametag(user_id,style) VALUES(?,?) ON DUPLICATE KEY UPDATE style=VALUES(style)")){p.setInt(1,author);p.setString(2,style.toString());p.executeUpdate();}
  JsonArray entries=new JsonArray();
  try(PreparedStatement p=c.prepareStatement("SELECT username FROM users WHERE id=?")){p.setInt(1,author);try(ResultSet r=p.executeQuery()){if(r.next()){JsonObject entry=new JsonObject();entry.addProperty("username",r.getString(1));entry.add("style",style);entries.add(entry);}}}
  return result("nametagSave",entries);
 }
 public static JsonObject list(Connection c,String text)throws SQLException{
  if(text==null||text.length()>8000)throw new IllegalArgumentException("Zu viele Nametags angefragt.");
  JsonArray input=new JsonParser().parse(text).getAsJsonArray();
  if(input.size()>100)throw new IllegalArgumentException("Zu viele Nametags angefragt.");
  LinkedHashMap<String,JsonObject> entries=new LinkedHashMap<>();
  for(JsonElement item:input){String name=item.getAsString();if(name.isEmpty()||name.length()>32)continue;JsonObject entry=new JsonObject();entry.addProperty("username",name);entry.add("style",JsonNull.INSTANCE);entries.put(name.toLowerCase(Locale.ROOT),entry);}
  if(!entries.isEmpty()){
   String marks=String.join(",",Collections.nCopies(entries.size(),"?"));
   try(PreparedStatement p=c.prepareStatement("SELECT u.username,n.style,a.border_color,a.border_width,a.client_style FROM users u LEFT JOIN website_profile_nametag n ON n.user_id=u.id LEFT JOIN website_profile_appearance a ON a.user_id=u.id WHERE LOWER(u.username) IN ("+marks+")")){
    int i=0;for(String name:entries.keySet())p.setString(++i,name);
    try(ResultSet r=p.executeQuery()){while(r.next()){JsonObject entry=entries.get(r.getString(1).toLowerCase(Locale.ROOT));if(entry!=null){
     if(r.getString(2)!=null)entry.add("style",sanitize(r.getString(2)));
     JsonObject avatar=new JsonObject();avatar.addProperty("borderColor",r.getString(3));avatar.addProperty("borderWidth",r.getInt(4));
     try{JsonObject clientStyle=new JsonParser().parse(r.getString(5)).getAsJsonObject();if(clientStyle.has("avatarColor"))avatar.add("backgroundColor",clientStyle.get("avatarColor"));if(clientStyle.has("borderStyle"))avatar.add("borderStyle",clientStyle.get("borderStyle"));}catch(Exception ignored){}
     entry.add("avatar",avatar);
    }}}
   }
  }
  JsonArray out=new JsonArray();for(JsonObject entry:entries.values())out.add(entry);return result("nametagList",out);
 }
 public static JsonObject result(String action,JsonArray entries){JsonObject result=new JsonObject();result.addProperty("action",action);result.add("entries",entries);return result;}
}

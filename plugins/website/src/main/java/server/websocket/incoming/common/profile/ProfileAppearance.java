package server.websocket.incoming.common.profile;
import java.sql.*;
import java.net.URI;
import com.google.gson.*;
public final class ProfileAppearance {
 public static String validate(String value) {
  if(value==null||value.trim().isEmpty()) return "";
  value=value.trim();
  if(value.matches("#[0-9a-fA-F]{6}"))return value;
  if(value.length()>1500)throw new IllegalArgumentException("Bildadresse zu lang.");
  try{URI u=new URI(value);if(!"https".equalsIgnoreCase(u.getScheme())||u.getHost()==null||u.getUserInfo()!=null)throw new Exception();String p=u.getPath().toLowerCase();if(!(p.endsWith(".gif")||p.endsWith(".png")||p.endsWith(".jpg")||p.endsWith(".jpeg")||p.endsWith(".webp")))throw new Exception();}catch(Exception e){throw new IllegalArgumentException("Bitte eine direkte HTTPS-Bildadresse (GIF, PNG, JPG oder WebP) verwenden.");}
  return value;
 }
 public static JsonObject read(Connection c,int id)throws SQLException {
  JsonObject o=new JsonObject();o.addProperty("borderColor","#666666");o.addProperty("borderWidth",1);o.addProperty("banner","");o.addProperty("avatar","");o.addProperty("textColor","#ffffff");
  try(PreparedStatement p=c.prepareStatement("SELECT banner_url,avatar_url,text_color,border_color,border_width,client_style FROM website_profile_appearance WHERE user_id=?")){p.setInt(1,id);try(ResultSet rs=p.executeQuery()){if(rs.next()){o.addProperty("banner",rs.getString(1));o.addProperty("avatar",rs.getString(2));o.addProperty("textColor",rs.getString(3));o.addProperty("borderColor",rs.getString(4));o.addProperty("borderWidth",rs.getInt(5));try{o.add("clientStyle",new JsonParser().parse(rs.getString(6)));}catch(Exception ignored){o.add("clientStyle",new JsonObject());}}}}return o;
 }
 public static void save(Connection c,int actor,int owner,String banner,String avatar)throws SQLException{save(c,actor,owner,banner,avatar,"#ffffff");}
 public static void save(Connection c,int actor,int owner,String banner,String avatar,String color)throws SQLException{
  save(c,actor,owner,banner,avatar,color,"#666666",1);
 }
 public static void save(Connection c,int actor,int owner,String banner,String avatar,String color,String borderColor,int borderWidth)throws SQLException{
  if(borderColor==null||!borderColor.matches("#[0-9a-fA-F]{6}")||borderWidth<0||borderWidth>10)throw new IllegalArgumentException("Ungueltiger Avatar-Rahmen.");
  if(actor!=owner)throw new IllegalArgumentException("Du kannst nur dein eigenes Profil bearbeiten.");
  banner=validate(banner);avatar=validate(avatar);if(color==null||!color.matches("#[0-9a-fA-F]{6}"))throw new IllegalArgumentException("Ungueltige Schriftfarbe.");
  try(PreparedStatement p=c.prepareStatement("INSERT INTO website_profile_appearance(user_id,banner_url,avatar_url,text_color,border_color,border_width) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE banner_url=VALUES(banner_url),avatar_url=VALUES(avatar_url),text_color=VALUES(text_color),border_color=VALUES(border_color),border_width=VALUES(border_width)")){p.setInt(1,owner);p.setString(2,banner);p.setString(3,avatar);p.setString(4,color);p.setString(5,borderColor);p.setInt(6,borderWidth);p.executeUpdate();}
 }
 public static void saveClientStyle(Connection c,int actor,int owner,JsonObject settings)throws SQLException{
  if(actor!=owner)throw new IllegalArgumentException("Du kannst nur dein eigenes Profil bearbeiten.");
  JsonObject safe=new JsonObject();
  int angle=settings.has("gradientAngle")?settings.get("gradientAngle").getAsInt():135;if(angle<0||angle>360)throw new IllegalArgumentException("Ungültiger Verlaufswinkel.");safe.addProperty("gradientAngle",angle);
  safe.addProperty("showPremium",!settings.has("showPremium")||settings.get("showPremium").getAsBoolean());
  String[][] choices={{"gradient","none","sunset","ocean","forest","rainbow","neon","cosmic","violet","fire","ice","aurora","sunrise","dusk","custom"},{"frameEffect","none","glow","pulse","bounce","shake","rainbow","sparkle"},{"badgeStyle","standard","glow","neon","retro"},{"badgeLayout","grid","list","carousel"},{"badgeHover","standard","glow","zoom","rotate","bounce","pulse","shimmer"},{"buttonStyle","standard","neo","retro","cyber","space"},{"avatarMode","full","head"},{"borderStyle","solid","dashed","dotted","double","none"}};
  for(String[] choice:choices){String value=settings.has(choice[0])?settings.get(choice[0]).getAsString():choice[1];boolean found=false;for(int i=1;i<choice.length;i++)if(choice[i].equals(value))found=true;if(!found)throw new IllegalArgumentException("Unbekannte Profiloption.");safe.addProperty(choice[0],value);}
  for(String key:new String[]{"mainColor","avatarColor","tagColor","gradientStart","gradientEnd"}){String value=settings.has(key)?settings.get(key).getAsString():(key.equals("tagColor")?"#ffffff":key.equals("avatarColor")?"#222222":"#2b2b2b");if(!value.matches("#[0-9a-fA-F]{6}"))throw new IllegalArgumentException("Ungueltige Profilfarbe.");safe.addProperty(key,value);}
  for(String key:new String[]{"opacity","avatarOpacity","bannerOverlay","blur"}){int value=settings.has(key)?settings.get(key).getAsInt():(key.equals("opacity")||key.equals("avatarOpacity")?100:0);if(value<0||value>(key.equals("blur")?20:100))throw new IllegalArgumentException("Ungueltiger Profilwert.");safe.addProperty(key,value);}
  JsonArray tags=new JsonArray();if(settings.has("tags")){JsonArray input=settings.getAsJsonArray("tags");if(input.size()>20)throw new IllegalArgumentException("Maximal 20 Tags.");for(JsonElement tag:input){String value=tag.getAsString().trim();if(value.isEmpty()||value.length()>24)throw new IllegalArgumentException("Tags muessen 1 bis 24 Zeichen haben.");tags.add(new JsonPrimitive(value));}}safe.add("tags",tags);
  JsonObject tagColors=new JsonObject();if(settings.has("tagColors")){JsonObject input=settings.getAsJsonObject("tagColors");for(JsonElement tag:tags){String key=tag.getAsString();if(input.has(key)){String color=input.get(key).getAsString();if(!color.matches("#[0-9a-fA-F]{6}"))throw new IllegalArgumentException("Ungueltige Tag-Farbe.");tagColors.addProperty(key,color);}}}safe.add("tagColors",tagColors);
  try(PreparedStatement p=c.prepareStatement("INSERT INTO website_profile_appearance(user_id,banner_url,avatar_url,text_color,client_style) VALUES(?,'','','#ffffff',?) ON DUPLICATE KEY UPDATE client_style=VALUES(client_style)")){p.setInt(1,owner);p.setString(2,safe.toString());p.executeUpdate();}
 }

}

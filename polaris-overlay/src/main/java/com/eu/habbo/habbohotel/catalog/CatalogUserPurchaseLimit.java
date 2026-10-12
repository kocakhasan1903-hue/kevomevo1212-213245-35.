package com.eu.habbo.habbohotel.catalog;

import com.eu.habbo.Emulator;
import java.sql.*;

/** Optional Polaris-owned cumulative LTD limit; zero preserves the established catalog behavior. */
public final class CatalogUserPurchaseLimit {
    private static volatile boolean available=false;
    private static volatile long checkedAt=0;
    private CatalogUserPurchaseLimit() {}
    public static boolean canPurchase(int catalogItemId,int userId) throws SQLException {
        try(Connection db=Emulator.getDatabase().getDataSource().getConnection()){
            if(System.currentTimeMillis()-checkedAt>60000){
                synchronized(CatalogUserPurchaseLimit.class){
                    if(System.currentTimeMillis()-checkedAt>60000){
                        try(PreparedStatement q=db.prepareStatement("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='catalog_items' AND COLUMN_NAME='limit_per_user'" );ResultSet r=q.executeQuery()){available=r.next();}
                        checkedAt=System.currentTimeMillis();
                    }
                }
            }
            if(!available)return true;
            try(PreparedStatement q=db.prepareStatement("SELECT limit_per_user FROM catalog_items WHERE id=?")){
                q.setInt(1,catalogItemId);try(ResultSet r=q.executeQuery()){
                    if(!r.next())throw new SQLException("Catalog item no longer exists");
                    int maximum=r.getInt(1);if(maximum<=0)return true;
                    try(PreparedStatement count=db.prepareStatement("SELECT COUNT(*) FROM catalog_items_limited WHERE catalog_item_id=? AND user_id=?")){
                        count.setInt(1,catalogItemId);count.setInt(2,userId);try(ResultSet total=count.executeQuery()){total.next();return total.getLong(1)<maximum;}
                    }
                }
            }
        }
    }
}

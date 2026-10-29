package com.frozamina.triplog;

import android.content.*;
import android.database.Cursor;
import android.database.sqlite.*;
import org.json.*;

/** Stable database filename. Migrations are additive and run in SQLiteOpenHelper's transaction. */
public class Store extends SQLiteOpenHelper {
    public Store(Context c) { super(c, "triplog.db", null, 2); }
    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE trips (id TEXT PRIMARY KEY, payload TEXT NOT NULL)");
        db.execSQL("CREATE TABLE templates (id TEXT PRIMARY KEY, payload TEXT NOT NULL)");
        createRevisions(db);
    }
    private void createRevisions(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS revisions (seq INTEGER PRIMARY KEY AUTOINCREMENT, trip_id TEXT NOT NULL, payload TEXT NOT NULL, saved_at INTEGER NOT NULL)");
    }
    @Override public void onUpgrade(SQLiteDatabase db, int oldV, int newV) {
        if(oldV < 2) createRevisions(db);
        // Add explicit migrations here for future versions. Never drop user tables.
    }
    @Override public void onDowngrade(SQLiteDatabase db,int oldV,int newV) { throw new SQLiteException("不支持降级安装，请使用新版 APK"); }
    public synchronized String load() throws JSONException {
        JSONObject out=new JSONObject();out.put("format","triplog");out.put("schemaVersion",2);
        for(String table:new String[]{"trips","templates"}) {
            JSONArray a=new JSONArray();try(Cursor c=getReadableDatabase().rawQuery("SELECT payload FROM "+table,null)) {while(c.moveToNext())a.put(new JSONObject(c.getString(0)));}out.put(table,a);
        }
        return out.toString();
    }
    private void validate(JSONObject obj) throws JSONException {
        if(obj.getString("id").length()<1) throw new JSONException("缺少 ID");
        obj.getString("origin");obj.getString("destination");
        JSONArray legs=obj.getJSONArray("legs"), transfers=obj.getJSONArray("transfers");
        if(legs.length()+transfers.length()>2000)throw new JSONException("段数过多");
    }
    private void put(SQLiteDatabase db,String table,JSONObject o) throws JSONException {
        validate(o);
        ContentValues v=new ContentValues();v.put("id",o.getString("id"));v.put("payload",o.toString());
        if(table.equals("trips")) {
            try(Cursor c=db.rawQuery("SELECT payload FROM trips WHERE id=?",new String[]{o.getString("id")})) {
                if(c.moveToFirst()){ContentValues r=new ContentValues();r.put("trip_id",o.getString("id"));r.put("payload",c.getString(0));r.put("saved_at",System.currentTimeMillis());db.insertOrThrow("revisions",null,r);}
            }
        }
        db.insertWithOnConflict(table,null,v,SQLiteDatabase.CONFLICT_REPLACE);
    }
    public synchronized void save(String table,String json) throws JSONException {
        if(!table.equals("trips")&&!table.equals("templates"))throw new JSONException("未知数据类型");
        SQLiteDatabase db=getWritableDatabase();db.beginTransaction();try{put(db,table,new JSONObject(json));db.setTransactionSuccessful();}finally{db.endTransaction();}
    }
    public synchronized void remove(String table,String id) throws JSONException {
        if(!table.equals("trips")&&!table.equals("templates"))throw new JSONException("未知数据类型");
        SQLiteDatabase db=getWritableDatabase(); db.beginTransaction();try {
            try(Cursor c=db.rawQuery("SELECT payload FROM "+table+" WHERE id=?",new String[]{id})){if(c.moveToFirst()){ContentValues r=new ContentValues();r.put("trip_id",id);r.put("payload",c.getString(0));r.put("saved_at",System.currentTimeMillis());db.insertOrThrow("revisions",null,r);}}
            db.delete(table,"id=?",new String[]{id});db.setTransactionSuccessful();
        }finally{db.endTransaction();}
    }
    public synchronized void restore(String json) throws JSONException {
        JSONObject o=new JSONObject(json);
        if(!o.getString("format").equals("triplog") || o.getInt("schemaVersion")>2)throw new JSONException("备份格式或版本不兼容");
        // Merge by ID, preserve existing records and old revisions. One transaction for the whole import.
        SQLiteDatabase db=getWritableDatabase();db.beginTransaction();try {
            for(String table:new String[]{"trips","templates"}){JSONArray a=o.getJSONArray(table);for(int i=0;i<a.length();i++)put(db,table,a.getJSONObject(i));}
            db.setTransactionSuccessful();
        }finally{db.endTransaction();}
    }
}

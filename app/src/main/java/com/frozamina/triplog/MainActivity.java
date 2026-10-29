package com.frozamina.triplog;

import android.app.*;
import android.os.*;
import android.content.*;
import android.webkit.*;
import android.view.*;
import android.graphics.Color;
import java.io.*;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private WebView web;private Store store;private String pending;private String pendingType;
    @Override public void onCreate(Bundle b) {
        super.onCreate(b);store=new Store(this);
        web=new WebView(this);web.setBackgroundColor(Color.rgb(244,242,237));
        // Respect system bars, including Android 15 edge-to-edge enforcement.
        web.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
        setContentView(web);web.requestApplyInsets();
        WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(false);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return !r.getUrl().toString().startsWith("file:///android_asset/");}
            @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){String u=r.getUrl().toString();if(!u.startsWith("file:///android_asset/"))return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));return null;}
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onJsAlert(WebView v,String u,String m,JsResult r){new AlertDialog.Builder(MainActivity.this).setMessage(m).setPositiveButton("确定",(d,w)->r.confirm()).setOnCancelListener(d->r.cancel()).show();return true;}
            @Override public boolean onJsConfirm(WebView v,String u,String m,JsResult r){new AlertDialog.Builder(MainActivity.this).setMessage(m).setPositiveButton("确定",(d,w)->r.confirm()).setNegativeButton("取消",(d,w)->r.cancel()).setOnCancelListener(d->r.cancel()).show();return true;}
        });
        web.addJavascriptInterface(new Bridge(),"Native");web.loadUrl("file:///android_asset/index.html");
    }
    private String result(Exception e){return e==null?"":e.getMessage();}
    public class Bridge {
        @JavascriptInterface public String load(){try{return store.load();}catch(Exception e){return new JSONObject().toString();}}
        @JavascriptInterface public String save(String table,String json){try{store.save(table,json);return "";}catch(Exception e){return result(e);}}
        @JavascriptInterface public String remove(String table,String id){try{store.remove(table,id);return "";}catch(Exception e){return result(e);}}
        @JavascriptInterface public void exportFile(String content,String type){runOnUiThread(()->{pending=content;pendingType=type;Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.setType(type.equals("png")?"image/png":type.equals("csv")?"text/csv":"application/json");i.addCategory(Intent.CATEGORY_OPENABLE);i.putExtra(Intent.EXTRA_TITLE,"triplog-"+System.currentTimeMillis()+(type.equals("png")?".png":type.equals("csv")?".csv":".json"));startActivityForResult(i,10);});}
        @JavascriptInterface public void importFile(){runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("*/*");i.addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(i,11);});}
    }
    @Override protected void onActivityResult(int req,int res,Intent data){super.onActivityResult(req,res,data);if(res!=RESULT_OK||data==null)return;try{
        if(req==10){if(pending==null)throw new IOException("导出已中断，请重试");try(OutputStream o=getContentResolver().openOutputStream(data.getData())){o.write("png".equals(pendingType)?android.util.Base64.decode(pending,android.util.Base64.DEFAULT):pending.getBytes(StandardCharsets.UTF_8));}pending=null;message("导出完成，请妥善保存文件");}
        if(req==11){ByteArrayOutputStream out=new ByteArrayOutputStream();try(InputStream in=getContentResolver().openInputStream(data.getData())){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){out.write(b,0,n);if(out.size()>20*1024*1024)throw new IOException("备份文件不能超过20MB");}}final String json=out.toString("UTF-8");new AlertDialog.Builder(this).setMessage("合并此备份？相同 ID 的记录会更新，原记录保留在本地修订历史中。建议先导出当前备份。").setNegativeButton("取消",null).setPositiveButton("合并",(d,w)->{try{store.restore(json);web.evaluateJavascript("location.reload()",null);}catch(Exception e){message("导入失败，原数据保留："+e.getMessage());}}).show();}
    }catch(Exception e){message("操作失败："+e.getMessage());}}
    private void message(String s){new AlertDialog.Builder(this).setMessage(s).setPositiveButton("确定",null).show();}
    @Override public void onBackPressed(){web.evaluateJavascript("window.appBack()",null);}
    @Override protected void onPause(){super.onPause();if(web!=null)web.onPause();}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
    @Override protected void onDestroy(){web.destroy();store.close();super.onDestroy();}
}


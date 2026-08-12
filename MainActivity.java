package com.alrifai.app;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;

public class MainActivity extends Activity {
  @Override public void onCreate(Bundle b){
    super.onCreate(b);
    setContentView(R.layout.activity_main);
    WebView w=findViewById(R.id.web);
    WebSettings s=w.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    w.loadUrl("https://shipping.alrifai.com.sa/");
  }
}

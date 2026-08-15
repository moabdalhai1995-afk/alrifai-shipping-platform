package com.alrifai.shipping;

import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import android.app.Activity;

public class MainActivity extends Activity {

    private static final String PLATFORM_URL =
            "https://alrifai-shipping-platform.onrender.com";
    private WebView webView;
    private ProgressBar progressBar;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean pageLoaded;
    private long lastBackPress;

    private final Runnable browserFallback = () -> {
        if (!pageLoaded) {
            Toast.makeText(this,
                    "تعذر التحميل داخل التطبيق، سيتم فتح المنصة في المتصفح",
                    Toast.LENGTH_LONG).show();
            openInBrowser();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);
        WebView.setWebContentsDebuggingEnabled(false);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int progress) {
                progressBar.setProgress(progress);
                progressBar.setVisibility(progress < 100 ? View.VISIBLE : View.GONE);
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                pageLoaded = false;
                progressBar.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageLoaded = true;
                handler.removeCallbacks(browserFallback);
                progressBar.setVisibility(View.GONE);
                view.postDelayed(() -> view.evaluateJavascript(
                        "fetch('/api/me').then(r=>r.json()).then(x=>{" +
                        "if(!x.authenticated && typeof openAuth==='function') openAuth();" +
                        "}).catch(()=>{if(typeof openAuth==='function') openAuth();})",
                        null), 500);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                if (request.isForMainFrame()) {
                    handler.removeCallbacks(browserFallback);
                    openInBrowser();
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view,
                                                    WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equalsIgnoreCase(uri.getScheme()) &&
                        "alrifai-shipping-platform.onrender.com".equalsIgnoreCase(uri.getHost())) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                    Toast.makeText(MainActivity.this,
                            "تعذر فتح الرابط الخارجي", Toast.LENGTH_SHORT).show();
                }
                return true;
            }
        });

        webView.loadUrl(PLATFORM_URL);
        handler.postDelayed(browserFallback, 15000);
    }

    private void openInBrowser() {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(PLATFORM_URL)));
        } catch (Exception ignored) {
            Toast.makeText(this, "تعذر فتح المتصفح", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(browserFallback);
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            long now = System.currentTimeMillis();
            if (now - lastBackPress < 2000) {
                super.onBackPressed();
            } else {
                lastBackPress = now;
                Toast.makeText(this, "اضغط رجوع مرة أخرى لإغلاق التطبيق", Toast.LENGTH_SHORT).show();
            }
        }
    }
}

package com.alrifai.shipping;

import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
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

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

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
                if ("alrifai-shipping-platform.onrender.com".equals(uri.getHost())) {
                    return false;
                }
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
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
            super.onBackPressed();
        }
    }
}

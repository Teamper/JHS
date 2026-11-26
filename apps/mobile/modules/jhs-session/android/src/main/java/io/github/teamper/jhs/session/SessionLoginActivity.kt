package io.github.teamper.jhs.session

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.Toast
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.ProfileStore
import androidx.webkit.WebViewCompat
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import java.io.Serializable
import org.json.JSONTokener

internal data class LoginInput(val site: String, val url: String, val signingIn: Boolean, val privacy: Boolean) : Serializable
internal data class LoginResult(val completed: Boolean, val token: String?)
internal fun profileName(site: String) = "jhs-session-$site"

internal class LoginContract : AppContextActivityResultContract<LoginInput, LoginResult> {
  override fun createIntent(context: Context, input: LoginInput): Intent =
    Intent(context, SessionLoginActivity::class.java).putExtra("login", input)

  override fun parseResult(input: LoginInput, resultCode: Int, intent: Intent?): LoginResult =
    LoginResult(resultCode == Activity.RESULT_OK, intent?.getStringExtra("authorToken"))
}

class SessionLoginActivity : Activity() {
  private var page: WebView? = null

  @Suppress("DEPRECATION", "SetJavaScriptEnabled", "RequiresFeature")
  override fun onCreate(saved: Bundle?) {
    super.onCreate(saved)
    val login = intent.getSerializableExtra("login") as? LoginInput
    val target = login?.let { SessionBoundary.url(it.site, it.url, it.signingIn) }
    if (login == null || target == null) { finish(); return }
    if (login.privacy) window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)

    val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
    ViewCompat.setOnApplyWindowInsetsListener(layout) { view, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
      view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
      insets
    }
    val done = Button(this).apply { text = if (login.signingIn) "完成登录" else "返回 JHS" }
    val cancel = Button(this).apply { text = "取消"; setOnClickListener { finish() } }
    layout.addView(LinearLayout(this).apply { addView(cancel); addView(done) })
    val web = WebView(this)
    WebViewCompat.setProfile(web, profileName(login.site))
    page = web
    web.settings.apply {
      javaScriptEnabled = true
      domStorageEnabled = true
      allowFileAccess = false
      allowContentAccess = false
      allowFileAccessFromFileURLs = false
      allowUniversalAccessFromFileURLs = false
      mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
      setSupportMultipleWindows(false)
      javaScriptCanOpenWindowsAutomatically = false
    }
    ProfileStore.getInstance().getOrCreateProfile(profileName(login.site)).cookieManager
      .setAcceptThirdPartyCookies(web, false)

    var committed = false
    var navigation = 0
    var started: String? = null
    web.webViewClient = object : WebViewClient() {
      private fun blocks(request: WebResourceRequest) = request.isForMainFrame &&
        SessionBoundary.url(login.site, request.url.toString(), login.signingIn) == null

      override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        if (!blocks(request)) return false
        committed = false
        navigation++
        Toast.makeText(this@SessionLoginActivity, "403 · 已阻止离开登录来源", Toast.LENGTH_SHORT).show()
        return true
      }

      override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
        if (blocks(request)) WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden",
          mapOf("Cache-Control" to "no-store"), "403 Forbidden".byteInputStream()) else null

      override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
        started = url
        committed = false
        navigation++
        if (SessionBoundary.url(login.site, url, login.signingIn) == null) view.stopLoading()
      }

      override fun onPageCommitVisible(view: WebView, url: String?) {
        committed = started == url && SessionBoundary.url(login.site, url, login.signingIn) != null
      }
    }
    layout.addView(web, LinearLayout.LayoutParams(-1, 0, 1f))
    setContentView(layout)
    done.setOnClickListener {
      if (!login.signingIn || login.site != "pan123") { complete(login.site, null); return@setOnClickListener }
      val current = web.url
      if (!SessionBoundary.mayReadPanToken(current, started, committed)) { accountRequired(); return@setOnClickListener }
      val version = navigation
      done.isEnabled = false
      web.evaluateJavascript(PAN_TOKEN) { result ->
        if (isFinishing || isDestroyed) return@evaluateJavascript
        done.isEnabled = true
        if (version != navigation || web.url != current) return@evaluateJavascript
        val token = runCatching { JSONTokener(result).nextValue() as? String }.getOrNull()
          ?.takeIf { it.isNotBlank() && it.length <= 8192 && it.none(Char::isWhitespace) }
        if (token == null) accountRequired() else complete(login.site, token)
      }
    }
    web.loadUrl(target.toString())
  }

  private fun accountRequired() =
    Toast.makeText(this, "请先在网页中完成 123 云盘登录", Toast.LENGTH_SHORT).show()

  private fun complete(site: String, token: String?) {
    ProfileStore.getInstance().getOrCreateProfile(profileName(site)).cookieManager.flush()
    setResult(RESULT_OK, Intent().putExtra("authorToken", token))
    finish()
  }

  override fun onDestroy() {
    page?.let { web ->
      (web.parent as? LinearLayout)?.removeView(web)
      web.destroy()
    }
    page = null
    super.onDestroy()
  }

  companion object {
    private const val PAN_TOKEN = "(()=>{try{const u=JSON.parse(localStorage.getItem('userInfo')||'{}');return localStorage.getItem('authorToken')||u.authorToken||u.token||''}catch{return ''}})()"
  }
}

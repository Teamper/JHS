package io.github.teamper.jhs.device

import android.annotation.SuppressLint
import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import expo.modules.kotlin.Promise
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.OutputStreamWriter
import java.security.DigestOutputStream
import java.security.MessageDigest

private const val LOCAL_ORIGIN = "https://localhost"
private const val READ_PATH = "/jhs-read-legacy"
private const val MAX_CHARACTERS = 64 * 1024 * 1024

internal class LegacySnapshotReader(
  private val context: Context,
  private val promise: Promise,
  private val onClose: () -> Unit,
) {
  private val handler = Handler(Looper.getMainLooper())
  private val timeout = Runnable { finish("读取旧片库超时。") }
  private val digest = MessageDigest.getInstance("SHA-256")
  private var webView: WebView? = null
  private var file: File? = null
  private var writer: OutputStreamWriter? = null
  private var transferred = 0
  private var closed = false

  @SuppressLint("SetJavaScriptEnabled")
  fun start() {
    try {
      check(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))
      val view = WebView(context)
      webView = view
      view.settings.apply {
        javaScriptEnabled = true
        domStorageEnabled = true
        allowContentAccess = false
        allowFileAccess = false
      }
      WebViewCompat.addWebMessageListener(view, "jhsLegacy", setOf(LOCAL_ORIGIN)) { _, message, origin, mainFrame, _ ->
        if (!closed && mainFrame && origin.scheme == "https" && origin.host == "localhost" && origin.port == -1) {
          try {
            val data = JSONObject(message.data ?: error("读取结果无效"))
            when (data.getString("kind")) {
              "part" -> append(data.getString("text"))
              "complete" -> finish(null)
              "empty" -> finish(null)
              else -> finish("无法读取旧片库，已保留原数据。")
            }
          } catch (_: Exception) { finish("旧片库读取失败，已保留原数据。") }
        }
      }
      view.webViewClient = object : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = true
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse {
          if (request.isForMainFrame && request.url.toString() == LOCAL_ORIGIN + READ_PATH) {
            return WebResourceResponse("text/html", "utf-8", context.assets.open("jhs-read-legacy.html"))
          }
          return WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", emptyMap(), ByteArrayInputStream(byteArrayOf()))
        }
      }
      handler.postDelayed(timeout, 60_000)
      view.loadUrl(LOCAL_ORIGIN + READ_PATH)
    } catch (_: Exception) { finish("无法启动旧片库读取。") }
  }

  private fun append(chunk: String) {
    transferred += chunk.length
    check(chunk.length <= 131_072 && transferred <= MAX_CHARACTERS)
    if (writer == null) {
      file = File.createTempFile("jhs-migration-", ".json", context.cacheDir)
      writer = OutputStreamWriter(DigestOutputStream(file!!.outputStream(), digest), Charsets.UTF_8)
    }
    writer!!.append(chunk)
  }

  private fun finish(error: String?) {
    if (closed) return
    closed = true
    handler.removeCallbacks(timeout)
    handler.post { webView?.destroy(); webView = null }
    onClose()
    val output = file
    val saved = runCatching { writer?.close() }.isSuccess
    if (error != null || !saved) {
      output?.delete()
      promise.reject("JHS_LEGACY_SNAPSHOT", error ?: "无法保存旧片库副本。", null)
    } else if (output == null) {
      promise.resolve(null)
    } else {
      val checksum = digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
      promise.resolve(mapOf("uri" to Uri.fromFile(output).toString(), "sha256" to checksum))
    }
  }
}

package io.github.teamper.jhs.session

import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.WindowManager
import androidx.webkit.ProfileStore
import androidx.webkit.WebViewFeature
import expo.modules.kotlin.Promise
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InterruptedIOException
import java.util.concurrent.TimeUnit

internal class SessionRequest : Record {
  @Field val requestId: String = ""
  @Field val session: String = ""
  @Field val url: String = ""
  @Field val method: String = "GET"
  @Field val headers: Map<String, String> = emptyMap()
  @Field val body: String? = null
  @Field val limit: Int = 3 * 1024 * 1024
  @Field val timeout: Int = 12_000
  @Field val binary: Boolean = false
}

class JhsSessionModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  private val requests = SessionRequests()
  private var loginOpen = false
  private lateinit var launcher: AppContextActivityResultLauncher<LoginInput, LoginResult>
  private val client = OkHttpClient.Builder().followRedirects(false).followSslRedirects(false)
    .retryOnConnectionFailure(false).connectTimeout(10, TimeUnit.SECONDS).build()

  override fun definition() = ModuleDefinition {
    Name("JhsSession")

    RegisterActivityContracts { launcher = registerForActivityResult(LoginContract()) }
    AsyncFunction("available") { supported() }.runOnQueue(Queues.MAIN)
    AsyncFunction("setPrivacy") { _: Boolean -> Unit }
    AsyncFunction("openLogin") Coroutine { site: String, url: String? ->
      withContext(Dispatchers.Main) { login(site, url) }
    }
    AsyncFunction("request") { options: SessionRequest, promise: Promise ->
      try { request(options, promise) }
      catch (error: CodedException) { promise.reject(error) }
      catch (_: IllegalArgumentException) { promise.reject("INVALID_URL", "请求参数无效。", null) }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("cancel") { id: String -> requests.cancel(id) }.runOnQueue(Queues.MAIN)
    AsyncFunction("clearSession") { site: String, promise: Promise ->
      try { clear(site, promise) }
      catch (error: CodedException) { promise.reject(error) }
    }.runOnQueue(Queues.MAIN)
    OnDestroy { requests.close() }
  }

  private fun supported() = WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)
  private fun requireSupport() {
    if (!supported()) throw CodedException("UNSUPPORTED", "当前 Android WebView 缺少独立会话支持，请更新系统 WebView。", null)
  }

  private fun profile(site: String) = ProfileStore.getInstance().getOrCreateProfile(profileName(site))

  private suspend fun login(site: String, raw: String?): Map<String, Any?> {
    requireSupport()
    val target = SessionBoundary.url(site, raw ?: SessionBoundary.loginUrl(site), raw == null)
      ?: throw CodedException("INVALID_URL", "登录地址不属于所选服务。", null)
    val activity = appContext.currentActivity ?: throw CodedException("UNAVAILABLE", "无法打开登录窗口。", null)
    if (loginOpen || !requests.begin(site)) throw CodedException("ABORTED", "会话窗口正在使用。", null)
    loginOpen = true
    try {
      val privacy = activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0
      val result = launcher.launch(LoginInput(site, target.toString(), raw == null, privacy))
      return mapOf("completed" to result.completed, "token" to result.token)
    } finally {
      loginOpen = false
      requests.end(site)
    }
  }

  private fun clear(site: String, promise: Promise) {
    requireSupport()
    if (SessionBoundary.loginUrl(site) == null) throw CodedException("INVALID_URL", "未知的会话来源。", null)
    if (!requests.begin(site)) throw CodedException("ABORTED", "请先关闭登录窗口。", null)
    try {
      val profile = profile(site)
      val cookies = profile.cookieManager
      profile.webStorage.deleteAllData()
      cookies.removeAllCookies {
        try { cookies.flush(); promise.resolve(null) }
        catch (_: RuntimeException) { promise.reject("OPERATION_FAILED", "清除会话失败，请重试。", null) }
        finally { requests.end(site) }
      }
    } catch (_: RuntimeException) {
      requests.end(site)
      throw CodedException("OPERATION_FAILED", "清除会话失败，请重试。", null)
    }
  }

  private fun request(options: SessionRequest, promise: Promise) {
    requireSupport()
    val site = options.session
    val id = options.requestId
    val url = SessionBoundary.url(site, options.url)
      ?: throw CodedException("INVALID_URL", "会话请求超出授权来源。", null)
    val verb = options.method
    require(id.matches(Regex("[A-Za-z0-9_-]{1,128}")) && verb in methods)
    val limit = options.limit.coerceIn(1, 24 * 1024 * 1024)
    val builder = Request.Builder().url(url).header("User-Agent", "JHS-Mobile/1.0")
    for ((name, value) in options.headers) if (SessionBoundary.allowedHeader(name)) builder.header(name, value)
    val cookies = profile(site).cookieManager
    cookies.getCookie(url.toString())?.let { builder.header("Cookie", it) }
    val body = when {
      verb == "GET" || verb == "HEAD" -> null
      options.body != null || verb in bodyRequired -> (options.body ?: "").toRequestBody()
      else -> null
    }
    val call = client.newCall(builder.method(verb, body).build())
    call.timeout().timeout(options.timeout.coerceIn(1_000, 120_000).toLong(), TimeUnit.MILLISECONDS)
    if (!requests.start(id, site, call) {
        call.cancel()
        main.post { promise.reject("ABORTED", "会话请求已取消。", null) }
      }) throw CodedException("ABORTED", "会话已暂停或请求标识重复。", null)
    call.enqueue(object : Callback {
      override fun onFailure(call: Call, error: IOException) {
        val code = if (error is InterruptedIOException) "TIMEOUT" else "NETWORK_ERROR"
        main.post { requests.finish(id, call) { promise.reject(code, "来源网络请求失败。", null) } }
      }

      override fun onResponse(call: Call, response: Response) {
        try {
          response.use {
            val bytes = readBounded(it, limit)
            val headers = it.headers("Set-Cookie")
            val result = mapOf(
              "status" to it.code, "url" to url.toString(), "headers" to SessionBoundary.responseHeaders(it.headers),
              "body" to if (options.binary) Base64.encodeToString(bytes, Base64.NO_WRAP) else bytes.toString(Charsets.UTF_8)
            )
            main.post { requests.finish(id, call) {
              try {
                for (value in headers) cookies.setCookie(url.toString(), value)
                promise.resolve(result)
              } catch (_: RuntimeException) { promise.reject("NETWORK_ERROR", "会话响应处理失败。", null) }
            } }
          }
        } catch (_: ResponseTooLarge) {
          main.post { requests.finish(id, call) { promise.reject("RESPONSE_TOO_LARGE", "来源响应超过大小限制。", null) } }
        } catch (error: IOException) {
          val code = if (error is InterruptedIOException) "TIMEOUT" else "NETWORK_ERROR"
          main.post { requests.finish(id, call) { promise.reject(code, "来源响应读取失败。", null) } }
        }
      }
    })
  }

  private fun readBounded(response: Response, limit: Int): ByteArray {
    val body = response.body ?: return ByteArray(0)
    if (body.contentLength() > limit) throw ResponseTooLarge()
    val out = ByteArrayOutputStream()
    val buffer = ByteArray(8192)
    body.byteStream().use { input ->
      while (true) {
        val count = input.read(buffer)
        if (count < 0) break
        if (out.size() + count > limit) throw ResponseTooLarge()
        out.write(buffer, 0, count)
      }
    }
    return out.toByteArray()
  }

  private class ResponseTooLarge : IOException()
  companion object {
    private val methods = setOf("GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
    private val bodyRequired = setOf("POST", "PUT", "PATCH")
  }
}

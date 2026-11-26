package io.github.teamper.jhs.session

import java.util.Locale
import okhttp3.Headers
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

internal object SessionBoundary {
  private val protectedHeaders = setOf(
    "cookie", "cookie2", "host", "content-length", "connection", "transfer-encoding",
    "proxy-authorization", "proxy-connection", "upgrade", "te", "trailer"
  )

  fun loginUrl(site: String): String? = when (site) {
    "javdb" -> "https://javdb.com/login"
    "one115" -> "https://f.115.com/"
    "pan123" -> "https://user.123pan.cn/centerlogin".toHttpUrlOrNull()!!.newBuilder()
      .addQueryParameter("redirect_url", "https://yun.123pan.com/?notoken=1")
      .addQueryParameter("source_page", "website").build().toString()
    else -> null
  }

  fun url(site: String, raw: String?, signingIn: Boolean = false): HttpUrl? {
    if (raw == null || !raw.startsWith("https://", ignoreCase = true) || raw.any { it.isWhitespace() || it == '\\' }) return null
    val target = raw.toHttpUrlOrNull() ?: return null
    val authority = raw.substring(8).takeWhile { it !in "/?#" }
    if (!target.isHttps || target.port != 443 || target.username.isNotEmpty() || target.password.isNotEmpty() ||
      authority.isEmpty() || '@' in authority) return null
    val host = target.host
    val allowed = when (site) {
      "javdb" -> host == "javdb.com"
      "one115" -> host == "115.com" || host.endsWith(".115.com")
      "pan123" -> host == "123pan.com" || host.endsWith(".123pan.com") || signingIn && host == "user.123pan.cn"
      else -> false
    }
    return target.takeIf { allowed }
  }

  fun mayReadPanToken(current: String?, started: String?, committed: Boolean): Boolean =
    committed && url("pan123", started)?.host == "yun.123pan.com" && url("pan123", current)?.host == "yun.123pan.com"

  fun allowedHeader(name: String) = name.lowercase(Locale.ROOT) !in protectedHeaders

  fun responseHeaders(headers: Headers): String = headers.newBuilder()
    .removeAll("Set-Cookie").removeAll("Set-Cookie2").build().toString()
}

/** Admission and delivery share a lock so a retired account cannot commit a late result. */
internal class SessionRequests {
  private data class Entry(val site: String, val version: Int, val ticket: Any, val cancel: () -> Unit)
  private val pending = mutableMapOf<String, Entry>()
  private val earlyCancels = linkedSetOf<String>()
  private val versions = mutableMapOf<String, Int>()
  private val paused = mutableSetOf<String>()

  @Synchronized fun start(id: String, site: String, ticket: Any, cancel: () -> Unit): Boolean {
    if (earlyCancels.remove(id) || site in paused || id in pending) return false
    pending[id] = Entry(site, version(site), ticket, cancel)
    return true
  }

  @Synchronized fun begin(site: String): Boolean {
    if (!paused.add(site)) return false
    versions[site] = version(site) + 1
    pending.filterValues { it.site == site }.keys.forEach(::cancel)
    return true
  }

  @Synchronized fun end(site: String) { paused.remove(site) }
  @Synchronized fun version(site: String) = versions[site] ?: 0

  @Synchronized fun finish(id: String, ticket: Any, deliver: () -> Unit) {
    val entry = pending[id] ?: return
    if (entry.ticket !== ticket || entry.version != version(entry.site)) return
    pending.remove(id)
    deliver()
  }

  @Synchronized fun cancel(id: String) {
    val request = pending.remove(id)
    if (request != null) request.cancel()
    else {
      earlyCancels.add(id)
      if (earlyCancels.size > 256) earlyCancels.remove(earlyCancels.first())
    }
  }
  @Synchronized fun close() { pending.keys.toList().forEach(::cancel) }
}

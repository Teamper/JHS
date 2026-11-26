package io.github.teamper.jhs.session

import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import okhttp3.Headers.Companion.headersOf
import org.junit.Assert.*
import org.junit.Test

class SessionBoundaryTest {
  @Test fun acceptsOnlyRequestedSiteAndHttpsPort() {
    for (url in listOf("http://javdb.com/", "https://javdb.com:444/", "https://www.javdb.com/",
      "https://javdb.com.evil.test/", "https://evil.test@javdb.com/", "https://javdb.com\\@evil.test/")) {
      assertNull(url, SessionBoundary.url("javdb", url))
    }
    assertNotNull(SessionBoundary.url("javdb", "https://javdb.com:443/login"))
    assertNotNull(SessionBoundary.url("one115", "https://webapi.115.com/"))
    assertNull(SessionBoundary.url("one115", "https://evil115.com/"))
    assertNull(SessionBoundary.url("pan123", "https://user.123pan.cn/centerlogin"))
    assertNotNull(SessionBoundary.url("pan123", "https://user.123pan.cn/centerlogin", true))
    assertNull(SessionBoundary.url("pan123", "https://not-user.123pan.cn/", true))
  }

  @Test fun stripsHeadersAndValidatesPan123LoginOrigin() {
    assertFalse(SessionBoundary.allowedHeader("CoOkIe"))
    assertFalse(SessionBoundary.allowedHeader("Content-Length"))
    assertFalse(SessionBoundary.allowedHeader("Host"))
    assertTrue(SessionBoundary.allowedHeader("Authorization"))
    val output = SessionBoundary.responseHeaders(headersOf("Set-Cookie", "secret", "Set-Cookie2", "secret", "Location", "/login"))
    assertEquals("Location: /login\n", output)
    val account = "https://yun.123pan.com/?notoken=1"
    assertTrue(SessionBoundary.mayReadPanToken(account, account, true))
    assertFalse(SessionBoundary.mayReadPanToken(account, account, false))
    assertFalse(SessionBoundary.mayReadPanToken("https://user.123pan.cn/", account, true))
    assertFalse(SessionBoundary.mayReadPanToken("https://other.123pan.com/", account, true))
  }

  @Test fun retiresOnlyMatchingSiteAndRejectsLateDelivery() {
    val requests = SessionRequests()
    val old = Any()
    val other = Any()
    val cancelled = CountDownLatch(1)
    val executor = Executors.newSingleThreadExecutor()
    try {
      assertTrue(requests.start("old", "javdb", old) { cancelled.countDown() })
      assertTrue(requests.start("other", "one115", other) { fail("different site") })
      val late = executor.submit {
        assertTrue(cancelled.await(5, TimeUnit.SECONDS))
        requests.finish("old", old) { fail("retired response") }
      }
      assertTrue(requests.begin("javdb"))
      assertFalse(requests.begin("javdb"))
      assertEquals(1, requests.version("javdb"))
      assertFalse(requests.start("new", "javdb", Any()) {})
      requests.finish("other", other) { assertEquals(0, requests.version("one115")) }
      late.get(5, TimeUnit.SECONDS)
      requests.end("javdb")
      val next = Any()
      assertTrue(requests.start("old", "javdb", next) {})
      requests.finish("old", old) { fail("wrong ticket") }
      var delivered = false
      requests.finish("old", next) { delivered = true }
      assertTrue(delivered)
    } finally { executor.shutdownNow() }
  }

  @Test fun cancellationMayArriveBeforeAdmission() {
    val requests = SessionRequests()
    requests.cancel("queued")
    assertFalse(requests.start("queued", "pan123", Any()) { fail("canceled before admission") })
    assertTrue(requests.start("next", "pan123", Any()) {})
  }
}

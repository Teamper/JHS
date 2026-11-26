import ExpoModulesCore
import UIKit
import WebKit

struct SessionRequest: Record {
  @Field var requestId: String = ""
  @Field var session: String = ""
  @Field var url: String = ""
  @Field var method: String = "GET"
  @Field var headers: [String: String] = [:]
  @Field var body: String? = nil
  @Field var limit: Int = 3 * 1024 * 1024
  @Field var timeout: Int = 12_000
  @Field var binary: Bool = false
}

public final class JhsSessionModule: Module {
  private let runtime = SessionRuntime()

  public func definition() -> ModuleDefinition {
    Name("JhsSession")
    AsyncFunction("available") { true }
    AsyncFunction("setPrivacy") { (enabled: Bool, promise: Promise) in
      Task { @MainActor in self.runtime.setPrivacy(enabled); promise.resolve(nil) }
    }
    AsyncFunction("openLogin") { (site: String, url: String?, promise: Promise) in
      Task { @MainActor in
        self.runtime.login(site, url, presenter: self.appContext?.utilities?.currentViewController(), promise: promise)
      }
    }
    AsyncFunction("request") { (options: SessionRequest, promise: Promise) in
      Task { @MainActor in self.runtime.request(options, promise: promise) }
    }
    AsyncFunction("cancel") { (id: String, promise: Promise) in
      Task { @MainActor in self.runtime.cancel(id); promise.resolve(nil) }
    }
    AsyncFunction("clearSession") { (site: String, promise: Promise) in
      Task { @MainActor in self.runtime.clear(site, promise: promise) }
    }
    OnDestroy { [runtime] in Task { @MainActor in runtime.close() } }
  }
}

private final class SessionRuntime: NSObject {
  private final class Pending {
    let site: String
    let version: Int
    let promise: Promise
    var transfer: SessionTransfer?
    init(site: String, version: Int, promise: Promise) { self.site = site; self.version = version; self.promise = promise }
  }

  private var pending: [String: Pending] = [:]
  private var earlyCancels: [String] = []
  private var paused: Set<String> = []
  private var versions: [String: Int] = [:]
  private var loginWindow: SessionLoginController?
  private var shield: UIView?
  private var privacy = false
  private var closed = false

  @MainActor func setPrivacy(_ enabled: Bool) {
    privacy = enabled
    NotificationCenter.default.removeObserver(self)
    if enabled {
      NotificationCenter.default.addObserver(self, selector: #selector(cover), name: UIApplication.willResignActiveNotification, object: nil)
      NotificationCenter.default.addObserver(self, selector: #selector(uncover), name: UIApplication.didBecomeActiveNotification, object: nil)
      if UIApplication.shared.applicationState != .active { cover() }
    } else { uncover() }
  }

  @MainActor @objc private func cover() {
    guard privacy, shield == nil,
      let window = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).flatMap({ $0.windows }).first(where: { $0.isKeyWindow }) else { return }
    let view = UIView(frame: window.bounds)
    view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.backgroundColor = .black
    window.addSubview(view)
    shield = view
  }

  @MainActor @objc private func uncover() { shield?.removeFromSuperview(); shield = nil }

  @MainActor private func begin(_ site: String) -> Bool {
    guard !closed, paused.insert(site).inserted else { return false }
    versions[site, default: 0] += 1
    for id in pending.keys.filter({ pending[$0]?.site == site }) { cancel(id) }
    return true
  }

  @MainActor func cancel(_ id: String) {
    guard let request = pending.removeValue(forKey: id) else {
      earlyCancels.append(id)
      if earlyCancels.count > 256 { earlyCancels.removeFirst() }
      return
    }
    request.transfer?.cancel()
    request.promise.reject("ABORTED", "会话请求已取消。")
  }

  @MainActor func close() {
    closed = true
    for id in Array(pending.keys) { cancel(id) }
    setPrivacy(false)
    loginWindow?.finish(false, nil)
  }

  @MainActor func login(_ site: String, _ raw: String?, presenter: UIViewController?, promise: Promise) {
    let signingIn = raw == nil
    guard let target = SessionBoundary.url(site, raw ?? SessionBoundary.loginURL(site), signingIn: signingIn) else {
      promise.reject("INVALID_URL", "登录地址不属于所选服务。"); return
    }
    guard let presenter else { promise.reject("UNAVAILABLE", "无法打开登录窗口。"); return }
    guard loginWindow == nil, begin(site) else { promise.reject("ABORTED", "会话窗口正在使用。"); return }
    let controller = SessionLoginController(site: site, target: target, signingIn: signingIn, store: SessionBoundary.store(site)) { [weak self] completed, token in
      self?.loginWindow = nil
      self?.paused.remove(site)
      var result: [String: Any] = ["completed": completed]
      if let token { result["token"] = token }
      promise.resolve(result)
    }
    loginWindow = controller
    presenter.present(controller, animated: true)
  }

  @MainActor func clear(_ site: String, promise: Promise) {
    guard SessionBoundary.sites.contains(site) else { promise.reject("INVALID_URL", "未知的会话来源。"); return }
    guard begin(site) else { promise.reject("ABORTED", "请先关闭登录窗口。"); return }
    let store = SessionBoundary.store(site)
    let types = WKWebsiteDataStore.allWebsiteDataTypes()
    if #available(iOS 17.0, *) {
      store.removeData(ofTypes: types, modifiedSince: .distantPast) { [weak self] in
        self?.paused.remove(site); promise.resolve(nil)
      }
    } else {
      store.fetchDataRecords(ofTypes: types) { [weak self] records in
        store.removeData(ofTypes: types, for: records.filter { SessionBoundary.ownsDomain(site, $0.displayName) }) {
          self?.paused.remove(site); promise.resolve(nil)
        }
      }
    }
  }

  @MainActor func request(_ options: SessionRequest, promise: Promise) {
    let site = options.session, id = options.requestId
    guard let url = SessionBoundary.url(site, options.url), SessionBoundary.verbs.contains(options.method),
      id.range(of: "^[A-Za-z0-9_-]{1,128}$", options: .regularExpression) != nil else {
      promise.reject("INVALID_URL", "会话请求超出授权来源或参数无效。"); return
    }
    if let index = earlyCancels.firstIndex(of: id) {
      earlyCancels.remove(at: index)
      promise.reject("ABORTED", "会话请求已取消。"); return
    }
    guard !closed, !paused.contains(site), pending[id] == nil else {
      promise.reject("ABORTED", "会话已暂停或请求标识重复。"); return
    }
    let entry = Pending(site: site, version: versions[site, default: 0], promise: promise)
    pending[id] = entry
    let store = SessionBoundary.store(site).httpCookieStore
    store.getAllCookies { [weak self] cookies in
      guard let self, self.pending[id] === entry else { return }
      var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData,
        timeoutInterval: Double(max(1_000, min(120_000, options.timeout))) / 1_000)
      request.httpMethod = options.method
      request.httpShouldHandleCookies = false
      request.setValue("JHS-Mobile/1.0", forHTTPHeaderField: "User-Agent")
      for (name, value) in options.headers where SessionBoundary.allowedHeader(name) && !value.contains(where: { $0.isNewline }) {
        request.setValue(value, forHTTPHeaderField: name)
      }
      let selected = cookies.filter { SessionBoundary.matches($0, url) }.sorted { $0.path.count > $1.path.count }
      if !selected.isEmpty { request.setValue(selected.map { "\($0.name)=\($0.value)" }.joined(separator: "; "), forHTTPHeaderField: "Cookie") }
      if !["GET", "HEAD"].contains(options.method) { request.httpBody = options.body?.data(using: .utf8) }
      let transfer = SessionTransfer(limit: max(1, min(24 * 1024 * 1024, options.limit))) { [weak self, weak entry] result in
        guard let entry else { return }
        Task { @MainActor in await self?.deliver(result, options: options, entry: entry, url: url, store: store) }
      }
      entry.transfer = transfer
      transfer.start(request)
    }
  }

  @MainActor private func deliver(_ result: SessionTransfer.Result, options: SessionRequest, entry: Pending, url: URL, store: WKHTTPCookieStore) async {
    let id = options.requestId
    guard pending[id] === entry, entry.version == versions[entry.site, default: 0] else { return }
    switch result {
    case .error(let code, let message):
      pending.removeValue(forKey: id)
      entry.promise.reject(code, message)
    case .response(let response, let bytes):
      if let value = response.value(forHTTPHeaderField: "Set-Cookie") {
        let cookies = HTTPCookie.cookies(withResponseHeaderFields: ["Set-Cookie": value], for: url)
        for cookie in cookies where SessionBoundary.ownsDomain(options.session, cookie.domain) && SessionBoundary.matchesDomain(cookie, url) {
          await withCheckedContinuation { (finished: CheckedContinuation<Void, Never>) in
            if let expires = cookie.expiresDate, expires <= Date() {
              store.delete(cookie) { finished.resume() }
            } else {
              store.setCookie(cookie) { finished.resume() }
            }
          }
          guard pending[id] === entry else { return }
        }
      }
      let payload: [String: Any] = ["status": response.statusCode, "url": url.absoluteString,
        "headers": SessionBoundary.responseHeaders(response),
        "body": options.binary ? bytes.base64EncodedString() : String(decoding: bytes, as: UTF8.self)]
      pending.removeValue(forKey: id)
      entry.promise.resolve(payload)
    }
  }
}

import UIKit
import WebKit

final class SessionLoginController: UIViewController, WKNavigationDelegate {
  private let site: String
  private let target: URL
  private let signingIn: Bool
  private let store: WKWebsiteDataStore
  private let completion: (Bool, String?) -> Void
  private var web: WKWebView?
  private var committed = false
  private var navigationVersion = 0
  private var completed = false
  private let status = UILabel()
  private let done = UIButton(type: .system)

  init(site: String, target: URL, signingIn: Bool, store: WKWebsiteDataStore, completion: @escaping (Bool, String?) -> Void) {
    self.site = site
    self.target = target
    self.signingIn = signingIn
    self.store = store
    self.completion = completion
    super.init(nibName: nil, bundle: nil)
    modalPresentationStyle = .fullScreen
    isModalInPresentation = true
  }

  @available(*, unavailable) required init?(coder: NSCoder) { fatalError() }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemBackground
    let cancel = UIButton(type: .system)
    cancel.setTitle("取消", for: .normal)
    cancel.addTarget(self, action: #selector(close), for: .touchUpInside)
    done.setTitle(signingIn ? "完成登录" : "返回 JHS", for: .normal)
    done.addTarget(self, action: #selector(confirm), for: .touchUpInside)
    let header = UIStackView(arrangedSubviews: [cancel, done])
    header.distribution = .fillEqually
    header.heightAnchor.constraint(equalToConstant: 48).isActive = true
    status.numberOfLines = 0
    status.textAlignment = .center
    status.isHidden = true
    let stack = UIStackView(arrangedSubviews: [header, status])
    stack.axis = .vertical
    stack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(stack)
    let area = view.safeAreaLayoutGuide
    NSLayoutConstraint.activate([
      stack.topAnchor.constraint(equalTo: area.topAnchor), stack.bottomAnchor.constraint(equalTo: area.bottomAnchor),
      stack.leadingAnchor.constraint(equalTo: area.leadingAnchor), stack.trailingAnchor.constraint(equalTo: area.trailingAnchor)
    ])
    done.isEnabled = false
    let rule = #"[{"trigger":{"url-filter":"^(http|file|content):"},"action":{"type":"block"}}]"#
    WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "JhsSessionSecureContent", encodedContentRuleList: rule) { [weak self] rules, _ in
      DispatchQueue.main.async {
        guard let self, !self.completed else { return }
        guard let rules else { self.show("无法启用登录窗口的安全规则。"); return }
        let config = WKWebViewConfiguration()
        config.websiteDataStore = self.store
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        config.userContentController.add(rules)
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        self.web = web
        stack.addArrangedSubview(web)
        self.done.isEnabled = true
        web.load(URLRequest(url: self.target))
      }
    }
  }

  func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
               decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    guard let frame = action.targetFrame else { decisionHandler(.cancel); return }
    if frame.isMainFrame && SessionBoundary.url(site, action.request.url?.absoluteString, signingIn: signingIn) == nil {
      block(); decisionHandler(.cancel); return
    }
    decisionHandler(.allow)
  }

  func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
               decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
    if response.isForMainFrame && SessionBoundary.url(site, response.response.url?.absoluteString, signingIn: signingIn) == nil {
      block(); decisionHandler(.cancel); return
    }
    decisionHandler(.allow)
  }

  func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
    committed = false
    navigationVersion += 1
  }

  func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
    committed = SessionBoundary.url(site, webView.url?.absoluteString, signingIn: signingIn) != nil
    status.isHidden = true
  }

  private func block() {
    committed = false
    navigationVersion += 1
    show("403 · 已阻止离开登录来源")
  }

  private func show(_ text: String) { status.text = text; status.isHidden = false }

  @objc private func close() { finish(false, nil) }

  @objc private func confirm() {
    if !signingIn || site != "pan123" { finish(true, nil); return }
    guard let web, committed, let current = web.url,
      SessionBoundary.url(site, current.absoluteString)?.host == "yun.123pan.com" else {
      show("请先在网页中完成 123 云盘登录"); return
    }
    let version = navigationVersion
    done.isEnabled = false
    web.evaluateJavaScript("(()=>{try{const u=JSON.parse(localStorage.getItem('userInfo')||'{}');return localStorage.getItem('authorToken')||u.authorToken||u.token||''}catch{return ''}})()") { [weak self, weak web] value, _ in
      guard let self, !self.completed else { return }
      self.done.isEnabled = true
      guard version == self.navigationVersion, web?.url == current else { return }
      guard let token = value as? String, !token.isEmpty, token.utf8.count <= 8192,
        !token.contains(where: { $0.isWhitespace }) else { self.show("请先在网页中完成 123 云盘登录"); return }
      self.finish(true, token)
    }
  }

  func finish(_ success: Bool, _ token: String?) {
    guard !completed else { return }
    completed = true
    web?.stopLoading()
    web?.navigationDelegate = nil
    dismiss(animated: true) { self.completion(success, token) }
  }
}

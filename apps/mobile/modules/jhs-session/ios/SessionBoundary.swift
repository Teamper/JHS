import Foundation
import WebKit

enum SessionBoundary {
  static let sites = ["javdb", "one115", "pan123"]
  static let verbs: Set<String> = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  private static let protectedHeaders: Set<String> = [
    "cookie", "cookie2", "host", "content-length", "connection", "transfer-encoding",
    "proxy-authorization", "proxy-connection", "upgrade", "te", "trailer"
  ]

  static func loginURL(_ site: String) -> String? {
    switch site {
    case "javdb": return "https://javdb.com/login"
    case "one115": return "https://f.115.com/"
    case "pan123":
      var target = URLComponents(string: "https://user.123pan.cn/centerlogin")!
      target.queryItems = [
        URLQueryItem(name: "redirect_url", value: "https://yun.123pan.com/?notoken=1"),
        URLQueryItem(name: "source_page", value: "website")
      ]
      return target.string
    default: return nil
    }
  }

  static func allowedHost(_ site: String, _ host: String, signingIn: Bool = false) -> Bool {
    switch site {
    case "javdb": return host == "javdb.com"
    case "one115": return host == "115.com" || host.hasSuffix(".115.com")
    case "pan123": return host == "123pan.com" || host.hasSuffix(".123pan.com") || signingIn && host == "user.123pan.cn"
    default: return false
    }
  }

  static func url(_ site: String, _ raw: String?, signingIn: Bool = false) -> URL? {
    guard let raw, raw.lowercased().hasPrefix("https://"), !raw.contains("\\"), !raw.contains(where: { $0.isWhitespace }),
      let parts = URLComponents(string: raw),
      parts.scheme?.lowercased() == "https", parts.port == nil || parts.port == 443,
      parts.user == nil, parts.password == nil, let host = parts.host?.lowercased(),
      allowedHost(site, host, signingIn: signingIn) else { return nil }
    return parts.url
  }

  static func allowedHeader(_ name: String) -> Bool {
    name.range(of: #"^[-A-Za-z0-9!#$%&'*+.^_|~\x60]+$"#, options: .regularExpression) != nil &&
      !protectedHeaders.contains(name.lowercased())
  }

  static func responseHeaders(_ response: HTTPURLResponse) -> String {
    response.allHeaderFields.compactMap { field, value in
      let name = String(describing: field)
      guard !["set-cookie", "set-cookie2"].contains(name.lowercased()) else { return nil }
      let safe = String(describing: value).replacingOccurrences(of: "[\r\n]", with: " ", options: .regularExpression)
      return "\(name): \(safe)"
    }.joined(separator: "\n")
  }

  static func matches(_ cookie: HTTPCookie, _ url: URL) -> Bool {
    guard matchesDomain(cookie, url), cookie.expiresDate.map({ $0 > Date() }) ?? true else { return false }
    let path = URLComponents(url: url, resolvingAgainstBaseURL: false)?.percentEncodedPath ?? "/"
    return path == cookie.path || path.hasPrefix(cookie.path.hasSuffix("/") ? cookie.path : cookie.path + "/")
  }

  static func matchesDomain(_ cookie: HTTPCookie, _ url: URL) -> Bool {
    let domain = cookie.domain.lowercased()
    guard let host = url.host?.lowercased() else { return false }
    return host == domain || domain.hasPrefix(".") && (host == String(domain.dropFirst()) || host.hasSuffix(domain))
  }

  static func ownsDomain(_ site: String, _ domain: String) -> Bool {
    let host = domain.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "."))
    return allowedHost(site, host, signingIn: true) || site == "pan123" && host == "123pan.cn"
  }

  @MainActor static func store(_ site: String) -> WKWebsiteDataStore {
    if #available(iOS 17.0, *), let index = sites.firstIndex(of: site),
      let id = UUID(uuidString: "0AB1CEAF-13C3-47A2-B01E-00000000000\(index + 1)") {
      return WKWebsiteDataStore(forIdentifier: id)
    }
    return .default()
  }
}

import Foundation

// URLSession callbacks run on the main operation queue with the module's admission checks.
final class SessionTransfer: NSObject, URLSessionDataDelegate, @unchecked Sendable {
  enum Result {
    case response(HTTPURLResponse, Data)
    case error(String, String)
  }

  private let maximum: Int
  private let completion: (Result) -> Void
  private var session: URLSession?
  private var data = Data()
  private var response: HTTPURLResponse?

  init(limit: Int, completion: @escaping (Result) -> Void) {
    maximum = limit
    self.completion = completion
  }

  func start(_ request: URLRequest) {
    let config = URLSessionConfiguration.ephemeral
    config.httpShouldSetCookies = false
    config.httpCookieStorage = nil
    config.urlCredentialStorage = nil
    config.urlCache = nil
    config.timeoutIntervalForRequest = request.timeoutInterval
    config.timeoutIntervalForResource = request.timeoutInterval
    let session = URLSession(configuration: config, delegate: self, delegateQueue: .main)
    self.session = session
    session.dataTask(with: request).resume()
  }

  func cancel() { finish(.error("ABORTED", "会话请求已取消。")) }

  private func finish(_ result: Result) {
    guard let session else { return }
    self.session = nil
    session.invalidateAndCancel()
    completion(result)
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                  newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
    completionHandler(nil)
  }

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
                  completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
    if response.expectedContentLength > Int64(maximum) {
      completionHandler(.cancel)
      finish(.error("RESPONSE_TOO_LARGE", "来源响应超过大小限制。"))
      return
    }
    self.response = response as? HTTPURLResponse
    completionHandler(.allow)
  }

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive chunk: Data) {
    guard self.session != nil else { return }
    guard chunk.count <= maximum - data.count else {
      finish(.error("RESPONSE_TOO_LARGE", "来源响应超过大小限制。"))
      return
    }
    data.append(chunk)
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    if let error = error as? URLError {
      finish(.error(error.code == .timedOut ? "TIMEOUT" : "NETWORK_ERROR", "来源网络请求失败。"))
    } else if error == nil, let response {
      finish(.response(response, data))
    } else {
      finish(.error("NETWORK_ERROR", "来源响应读取失败。"))
    }
  }
}

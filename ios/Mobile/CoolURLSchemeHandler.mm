@interface CoolURLSchemeHandler() <WKURLSchemeHandler> {
  NSMutableSet<id<WKURLSchemeTask>> ongoingTasks;
}

- (void) webView:(WKWebView *)webView startURLSchemeTask:(id<WKURLSchemeTask>)urlSchemeTask {
  [ongoingTasks addObject:urlSchemeTask];

  // Get tag from request
  Poco::URI requestUri([urlSchemeTask.request.URL UTF8String]);
  Poco::URI::QueryParameters params = requestUri.getQueryParameters();
  std::string tag;

  for (const auto& it : params) {
    if (it.first == "Tag") {
      tag = it.second;
    }
  }

  // Get path from tag & open a stream
  std::string mediaPath = getDocumentBroker()->getEmbeddedMediaPath(tag);
  std::uintmax_t _size = std::filesystem::file_size(mediaPath);
  NSNumber * size = [NSNumber numberWithUnsignedLongLong:_size];

  // Send preliminary file details  
  URLResponse * response = [URLResponse
    initWithURL:urlSchemeTask.request.URL
    MIMEType:@"video/mp4" // TODO: Get the real mime type here...
    expectedContentLength:size
    textEncodingName:nil
  ];
  [urlSchemeTask didReceiveResponse:response];

  // Send file data, chunked into small amounts (1024 bytes - the actual number here is pretty arbitrary)
  ifstream media(mediaPath, ios_base::in | ios_base::binary);
  char* chunk = new char[1024];

  while (media.good()) {
    media.read(chunk, 1024);
    std::streamsize readSize = media.gcount();
    
    if (![ongoingTasks containsObject:urlSchemeTask]) {
      // The task was cancelled: exit immediately, without calling any further methods as per Apple docs
      media.close();
      return;
    }

    const data = [NSData dataWithBytes:chunk length:readSize];
    [WKURLSchemeTask didReceiveData:data];
  }

  delete[] chunk;
  media.close();

  // Tell the other side that we finished, and remove the ongoing-ness of the task
  [ongoingTasks removeObject:urlSchemeTask];
  [urlSchemeTask didFinish];
}

- (void) webView:(WKWebView *)webView stopURLSchemeTask:(id<WKURLSchemeTask>)urlSchemeTask {
  // Yeet the task from the ongoingTasks
  [ongoingTasks removeObject:urlSchemeTask];
}

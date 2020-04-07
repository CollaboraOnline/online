m4_dnl -*- Mode: HTML -*-x
m4_changequote([,])m4_dnl
m4_dnl# m4_foreachq(x, `item_1, item_2, ..., item_n', stmt)
m4_dnl# quoted list, alternate improved version
m4_define([m4_foreachq],[m4_ifelse([$2],[],[],[m4_pushdef([$1])_$0([$1],[$3],[],$2)m4_popdef([$1])])])m4_dnl
m4_define([_m4_foreachq],[m4_ifelse([$#],[3],[],[m4_define([$1],[$4])$2[]$0([$1],[$2],m4_shift(m4_shift(m4_shift($@))))])])m4_dnl
m4_define(_YEAR_,m4_esyscmd(date +%Y|tr -d '\n'))
<!DOCTYPE html>
<!-- saved from url=(0054)http://leafletjs.com/examples/quick-start-example.html -->
<html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<title>Online Editor</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1.0">

<script>
m4_dnl# Define MOBILEAPP as true if this is either for the iOS app or for the gtk+ "app" testbed
m4_define([MOBILEAPP],[])
m4_ifelse(IOSAPP,[true],[m4_define([MOBILEAPP],[true])])
m4_ifelse(GTKAPP,[true],[m4_define([MOBILEAPP],[true])])
m4_ifelse(ANDROIDAPP,[true],[m4_define([MOBILEAPP],[true])])

m4_ifelse(MOBILEAPP,[],
  // Start listening for Host_PostmessageReady message and save the
  // result for future
  window.WOPIpostMessageReady = false;
  var PostMessageReadyListener = function(e) {
    if (!(e && e.data))
        return;
    var msg = JSON.parse(e.data);
    if (msg.MessageId === 'Host_PostmessageReady') {
      window.WOPIPostmessageReady = true;
      window.removeEventListener('message', PostMessageReadyListener, false);
    }
  };
  window.addEventListener('message', PostMessageReadyListener, false);
)m4_dnl

m4_dnl# For use in conditionals in JS: window.ThisIsAMobileApp, window.ThisIsTheiOSApp,
m4_dnl# and window.ThisIsTheGtkApp

m4_ifelse(MOBILEAPP,[true],
  [   window.ThisIsAMobileApp = true;
   window.open = function (url, windowName, windowFeatures) {
     window.postMobileMessage('HYPERLINK ' + url); /* don't call the 'normal' window.open on mobile at all */
   }
   window.MobileAppName='MOBILEAPPNAME';],
  [   window.ThisIsAMobileApp = false;]
)
m4_ifelse(IOSAPP,[true],
  [   window.ThisIsTheiOSApp = true;
   window.postMobileMessage = function(msg) { window.webkit.messageHandlers.lool.postMessage(msg, '*'); };
   window.postMobileError   = function(msg) { window.webkit.messageHandlers.error.postMessage(msg, '*'); };
   window.postMobileDebug   = function(msg) { window.webkit.messageHandlers.debug.postMessage(msg, '*'); };],
  [   window.ThisIsTheiOSApp = false;]
)
m4_ifelse(GTKAPP,[true],
  [   window.ThisIsTheGtkApp = true;
   window.postMobileMessage = function(msg) { window.webkit.messageHandlers.lool.postMessage(msg, '*'); };
   window.postMobileError   = function(msg) { window.webkit.messageHandlers.error.postMessage(msg, '*'); };
   window.postMobileDebug   = function(msg) { window.webkit.messageHandlers.debug.postMessage(msg, '*'); };],
  [   window.ThisIsTheGtkApp = false;]
)
m4_ifelse(ANDROIDAPP,[true],
  [   window.ThisIsTheAndroidApp = true;
   window.postMobileMessage = function(msg) { window.LOOLMessageHandler.postMobileMessage(msg); };
   window.postMobileError   = function(msg) { window.LOOLMessageHandler.postMobileError(msg); };
   window.postMobileDebug   = function(msg) { window.LOOLMessageHandler.postMobileDebug(msg); };],
  [   window.ThisIsTheAndroidApp = false;]
)

if (window.ThisIsTheiOSApp) {
  window.addEventListener("keydown", function(e) { e.preventDefault(); });
}

var Base64ToArrayBuffer = function(base64Str) {
  var binStr = atob(base64Str);
  var ab = new ArrayBuffer(binStr.length);
  var bv = new Uint8Array(ab);
  for (var i = 0, l = binStr.length; i < l; i++) {
    bv[[i]] = binStr.charCodeAt(i);
  }
  return ab;
}

  window.bundlejsLoaded = false;
  window.fullyLoadedAndReady = false;
  window.addEventListener('load', function() {
    window.fullyLoadedAndReady = true;
  }, false);

</script>

m4_dnl In the debug case, just write all the .css files here
m4_ifelse(DEBUG,[true],
  m4_foreachq([fileCSS],[LOLEAFLET_CSS],[<link rel="stylesheet" href="][m4_ifelse(MOBILEAPP,[],[%SERVICE_ROOT%/loleaflet/%VERSION%/])][fileCSS" />
]),
  [<!-- Dynamically load the bundle.css -->
<script>
var link = document.createElement('link');
link.setAttribute("rel", "stylesheet");
link.setAttribute("type", "text/css");
link.setAttribute("href", '][m4_ifelse(MOBILEAPP,[],[%SERVICE_ROOT%/loleaflet/%VERSION%/])][bundle.css');
document.getElementsByTagName("head")[[0]].appendChild(link);
</script>
])
<!--%BRANDING_CSS%--> <!-- add your logo here -->
m4_ifelse(IOSAPP,[true],
  [<link rel="stylesheet" href="Branding/branding.css">])
m4_ifelse(ANDROIDAPP,[true],
  [<link rel="stylesheet" href="branding.css">])

m4_dnl Handle localization
m4_ifelse(MOBILEAPP,[true],
  [
   m4_ifelse(IOSAPP,[true],
     [],
     [<link rel="localizations" href="l10n/uno-localizations-override.json" type="application/vnd.oftn.l10n+json"/>
      <link rel="localizations" href="l10n/localizations.json" type="application/vnd.oftn.l10n+json"/>
      <link rel="localizations" href="l10n/locore-localizations.json" type="application/vnd.oftn.l10n+json"/>
      <link rel="localizations" href="l10n/help-localizations.json" type="application/vnd.oftn.l10n+json"/>
      <link rel="localizations" href="l10n/uno-localizations.json" type="application/vnd.oftn.l10n+json"/>])],
  [<link rel="localizations" href="%SERVICE_ROOT%/loleaflet/%VERSION%/l10n/uno-localizations-override.json" type="application/vnd.oftn.l10n+json"/>
   <link rel="localizations" href="%SERVICE_ROOT%/loleaflet/%VERSION%/l10n/localizations.json" type="application/vnd.oftn.l10n+json"/>
   <link rel="localizations" href="%SERVICE_ROOT%/loleaflet/%VERSION%/l10n/locore-localizations.json" type="application/vnd.oftn.l10n+json"/>
   <link rel="localizations" href="%SERVICE_ROOT%/loleaflet/%VERSION%/l10n/help-localizations.json" type="application/vnd.oftn.l10n+json"/>
   <link rel="localizations" href="%SERVICE_ROOT%/loleaflet/%VERSION%/l10n/uno-localizations.json" type="application/vnd.oftn.l10n+json"/>]
)m4_dnl
</head>

  <body style="user-select: none;">
    <!--The "controls" div holds map controls such as the Zoom button and
        it's separated from the map in order to have the controls on the top
        of the page all the time.

        The "document-container" div is the actual display of the document, is
        what the user sees and it should be no larger than the screen size.

        The "map" div is the actual document and it has the document's size
        and width, this being inside the smaller "document-container" will
        cause the content to overflow, creating scrollbars -->

     <nav class="main-nav" role="navigation">
       <!-- Mobile menu toggle button (hamburger/x icon) -->
       <input id="main-menu-state" type="checkbox" style="display: none"/>
       <ul id="main-menu" class="sm sm-simple lo-menu readonly"></ul>
       <div id="document-titlebar">
         <div class="document-title">
           <input id="document-name-input" type="text" disabled="true" style="display: none"/>
         </div>
       </div>
     </nav>

     <table id="toolbar-wrapper">
     <tr>
       <td id="toolbar-logo"></td>
       <td id="toolbar-up"></td>
       <td id="toolbar-hamburger">
         <label class="main-menu-btn" for="main-menu-state">
           <span class="main-menu-btn-icon" id="main-menu-btn-icon"></span>
         </label>
       </td>
     </tr>
     <tr>
       <td colspan="3" id="formulabar" style="display: none"></td>
     </tr>
    </table>

    <!--%DOCUMENT_SIGNING_DIV%-->
    <script>
      window.documentSigningURL = '%DOCUMENT_SIGNING_URL%';
    </script>

    <input id="insertgraphic" type="file" style="position: fixed; top: -100em">
    <input id="selectbackground" type="file" style="position: fixed; top: -100em">

    <div id="closebuttonwrapper">
      <div class="closebuttonimage" id="closebutton"></div>
    </div>

    <div id="spreadsheet-row-column-frame" class="readonly"></div>

    <div id="document-container" class="readonly">
      <div id="map"></div>
    </div>

    <div id="spreadsheet-toolbar" style="display: none"></div>

    <div id="presentation-controls-wrapper" class="readonly">
      <div id="slide-sorter"></div>
      <div id="presentation-toolbar" style="display: none"></div>
    </div>

    <div id="sidebar-dock-wrapper">
      <div id="sidebar-panel"></div>
    </div>

    <div id="mobile-edit-button" style="display: none">
      <div id="mobile-edit-button-image"></div>
    </div>

    <div id="toolbar-down" style="display: none"></div>
    <div id="toolbar-search" style="display: none"></div>
    <div id="mobile-wizard" style="display: none">
      <div id="mobile-wizard-tabs"></div>
      <table id="mobile-wizard-titlebar" width="100%">
        <tr>
          <td id="mobile-wizard-back"></td>
          <td id="mobile-wizard-title" class="ui-widget"></td>
        </tr>
      </table>
      <div id="mobile-wizard-content"></div>
    </div>

    <!-- Remove if you don't want the About dialog -->
    <div id="about-dialog" style="display:none; text-align: center; user-select: text">
      <h1 id="product-name">LibreOffice Online</h1>
      <div id="product-logo"></div>
      <hr/>
      <p id="product-string"></p>
      <h3>LOOLWSD</h3>
      <div id="loolwsd-version"></div>
      <div id="loolwsd-id"></div>
      <h3>LOKit</h3>
      <div id="lokit-version"></div>
      <div id="os-name" style="text-align:center"><label>%OS_INFO%</label></div>
      <p>Copyright © _YEAR_, VENDOR.</p>
    </div>

    <script>
m4_ifelse(MOBILEAPP,[true],
     [window.host = '';
      window.serviceRoot = '';
      window.accessToken = '';
      window.accessTokenTTL = '';
      window.accessHeader = '';
      window.loleafletLogging = 'true';
      window.outOfFocusTimeoutSecs = 1000000;
      window.idleTimeoutSecs = 1000000;
      window.reuseCookies = '';
      window.protocolDebug = false;
      window.frameAncestors = '';
      window.tileSize = 256;],
     [window.host = '%HOST%';
      window.serviceRoot = '%SERVICE_ROOT%';
      window.accessToken = '%ACCESS_TOKEN%';
      window.accessTokenTTL = '%ACCESS_TOKEN_TTL%';
      window.accessHeader = '%ACCESS_HEADER%';
      window.loleafletLogging = '%LOLEAFLET_LOGGING%';
      window.outOfFocusTimeoutSecs = %OUT_OF_FOCUS_TIMEOUT_SECS%;
      window.idleTimeoutSecs = %IDLE_TIMEOUT_SECS%;
      window.reuseCookies = '%REUSE_COOKIES%';
      window.protocolDebug = %PROTOCOL_DEBUG%;
      window.frameAncestors = '%FRAME_ANCESTORS%';
      window.tileSize = 256;])
m4_syscmd([cat ]GLOBAL_JS)m4_dnl

<!-- Dynamically load the appropriate *-mobile.css, *-tablet.css or *-desktop.css -->
var link = document.createElement('link');
link.setAttribute("rel", "stylesheet");
link.setAttribute("type", "text/css");
var brandingLink = document.createElement('link');
brandingLink.setAttribute("rel", "stylesheet");
brandingLink.setAttribute("type", "text/css");
if (window.mode.isMobile()) {
    [link.setAttribute("href", ']m4_ifelse(MOBILEAPP,[],[%SERVICE_ROOT%/loleaflet/%VERSION%/])[device-mobile.css');]
    [brandingLink.setAttribute("href", ']m4_ifelse(MOBILEAPP,[],[%SERVICE_ROOT%/loleaflet/%VERSION%/])m4_ifelse(IOSAPP,[true],[Branding/])[branding-mobile.css');]
} else if (window.mode.isTablet()) {
    [link.setAttribute("href", ']m4_ifelse(MOBILEAPP,[],[%SERVICE_ROOT%/loleaflet/%VERSION%/])[device-tablet.css');]
    [brandingLink.setAttribute("href", ']m4_ifelse(MOBILEAPP,[],[%SERVICE_ROOT%/loleaflet/%VERSION%/])m4_ifelse(IOSAPP,[true],[Branding/])[branding-tablet.css');]
} else {
    [link.setAttribute("href", ']m4_ifelse(MOBILEAPP,[],[%SERVICE_ROOT%/loleaflet/%VERSION%/])[device-desktop.css');]
    [brandingLink.setAttribute("href", ']m4_ifelse(MOBILEAPP,[],[%SERVICE_ROOT%/loleaflet/%VERSION%/])[branding-desktop.css');]
}
document.getElementsByTagName("head")[[0]].appendChild(link);
document.getElementsByTagName("head")[[0]].appendChild(brandingLink);
</script>

m4_ifelse(MOBILEAPP,[true],
  m4_ifelse(DEBUG,[true],m4_foreachq([fileJS],[LOLEAFLET_JS],
  [    <script src="fileJS" defer></script>
  ]),
  [    <script src="bundle.js" defer></script>
  ]),
  m4_ifelse(DEBUG,[true],m4_foreachq([fileJS],[LOLEAFLET_JS],
  [    <script src="%SERVICE_ROOT%/loleaflet/%VERSION%/fileJS" defer></script>
  ]),
  [    <script src="%SERVICE_ROOT%/loleaflet/%VERSION%/bundle.js" defer></script>
  ])
)m4_dnl
    <!--%BRANDING_JS%--> <!-- logo onclick handler -->
</body></html>

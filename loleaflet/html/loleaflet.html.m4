dnl -*- Mode: HTML -*-x
changequote([,])dnl
dnl# foreachq(x, `item_1, item_2, ..., item_n', stmt)
dnl# quoted list, alternate improved version
define([foreachq],[ifelse([$2],[],[],[pushdef([$1])_$0([$1],[$3],[],$2)popdef([$1])])])dnl
define([_foreachq],[ifelse([$#],[3],[],[define([$1],[$4])$2[]$0([$1],[$2],shift(shift(shift($@))))])])dnl
define(_YEAR_,esyscmd(date +%Y|tr -d '\n'))
<!DOCTYPE html>
<!-- saved from url=(0054)http://leafletjs.com/examples/quick-start-example.html -->
<html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<title>Online Editor</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<script>
dnl# Define MOBILEAPP as true if this is either for the iOS app or for the gtk+ "app" testbed
define([MOBILEAPP],[])
ifelse(IOSAPP,[true],[define([MOBILEAPP],[true])])
ifelse(GTKAPP,[true],[define([MOBILEAPP],[true])])

ifelse(MOBILEAPP,[],
  // Start listening for Host_PostmessageReady message and save the
  // result for future
  window.WOPIpostMessageReady = false;
  var PostMessageReadyListener = function(e) {
    var msg = JSON.parse(e.data);
    if (msg.MessageId === 'Host_PostmessageReady') {
      window.WOPIPostmessageReady = true;
      window.removeEventListener('message', PostMessageReadyListener, false);
    }
  };
  window.addEventListener('message', PostMessageReadyListener, false);
)dnl

var Base64ToArrayBuffer = function(base64Str) {
  var binStr = atob(base64Str);
  var ab = new ArrayBuffer(binStr.length);
  var bv = new Uint8Array(ab);
  for (var i = 0, l = binStr.length; i < l; i++) {
    bv[[i]] = binStr.charCodeAt(i);
  }
  return ab;
}
</script>

ifelse(MOBILEAPP,[true],
  ifelse(DEBUG,[true],
    foreachq([fileCSS],[LOLEAFLET_CSS],[<link rel="stylesheet" href="fileCSS" />
  ]),
    [<link rel="stylesheet" href="bundle.css" />
  ]),
  ifelse(DEBUG,[true],
    foreachq([fileCSS],[LOLEAFLET_CSS],[<link rel="stylesheet" href="%SERVICE_ROOT%/loleaflet/%VERSION%/fileCSS" />
  ]),
    [<link rel="stylesheet" href="%SERVICE_ROOT%/loleaflet/%VERSION%/bundle.css" />
  ])dnl
)dnl
<!--%BRANDING_CSS%--> <!-- add your logo here -->
ifelse(MOBILEAPP,[true],
  [<link rel="localizations" href="l10n/uno-localizations-override.json" type="application/vnd.oftn.l10n+json"/>
   <link rel="localizations" href="l10n/localizations.json" type="application/vnd.oftn.l10n+json"/>
   <link rel="localizations" href="l10n/locore-localizations.json" type="application/vnd.oftn.l10n+json"/>
   <link rel="localizations" href="l10n/help-localizations.json" type="application/vnd.oftn.l10n+json"/>
   <link rel="localizations" href="l10n/uno-localizations.json" type="application/vnd.oftn.l10n+json"/>],
  [<link rel="localizations" href="%SERVICE_ROOT%/loleaflet/%VERSION%/l10n/uno-localizations-override.json" type="application/vnd.oftn.l10n+json"/>
   <link rel="localizations" href="%SERVICE_ROOT%/loleaflet/%VERSION%/l10n/localizations.json" type="application/vnd.oftn.l10n+json"/>
   <link rel="localizations" href="%SERVICE_ROOT%/loleaflet/%VERSION%/l10n/locore-localizations.json" type="application/vnd.oftn.l10n+json"/>
   <link rel="localizations" href="%SERVICE_ROOT%/loleaflet/%VERSION%/l10n/help-localizations.json" type="application/vnd.oftn.l10n+json"/>
   <link rel="localizations" href="%SERVICE_ROOT%/loleaflet/%VERSION%/l10n/uno-localizations.json" type="application/vnd.oftn.l10n+json"/>]
)dnl
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
           <span class="main-menu-btn-icon"></span>
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

    <div id="mobile-edit-button" style="display: none">
      <div id="mobile-edit-button-image"></div>
    </div>

    <div id="toolbar-down" style="display: none"></div>

    <!-- Remove if you don't want the About dialog -->
    <div id="about-dialog" style="display:none; text-align: center; user-select: text">
      <h1 id="product-name">LibreOffice Online</h1>
      <hr/>
      <p id="product-string"></p>
      <h3>LOOLWSD</h3>
      <div id="loolwsd-version"></div>
      <h3>LOKit</h3>
      <div id="lokit-version"></div>
      <p>Copyright _YEAR_, Collabora Productivity Limited.</p>
    </div>

    <script>
ifelse(MOBILEAPP,[true],
     [window.host = '';
      window.serviceRoot = '';
      window.accessToken = '';
      window.accessTokenTTL = '';
      window.accessHeader = '';
      window.loleafletLogging = 'true';
      window.outOfFocusTimeoutSecs = 1000000;
      window.idleTimeoutSecs = 1000000;
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
      window.tileSize = 256;])
    </script>
  <script>

dnl# For use in conditionals in JS: window.ThisIsAMobileApp, window.ThisIsTheiOSApp,
dnl# and window.ThisIsTheGtkApp
ifelse(MOBILEAPP,[true],
  [window.ThisIsAMobileApp = true;
   window.MobileAppName='MOBILEAPPNAME'],
  [window.ThisIsAMobileApp = false;]
)
ifelse(IOSAPP,[true],
  [window.ThisIsTheiOSApp = true;],
  [window.ThisIsTheiOSApp = false;]
)
ifelse(GTKAPP,[true],
  [window.ThisIsTheGtkApp = true;],
  [window.ThisIsTheGtkApp = false;]
)
  </script>

ifelse(MOBILEAPP,[true],
  ifelse(DEBUG,[true],foreachq([fileJS],[LOLEAFLET_JS],
  [    <script src="fileJS"></script>
  ]),
  [    <script src="bundle.js"></script>
  ]),
  ifelse(DEBUG,[true],foreachq([fileJS],[LOLEAFLET_JS],
  [    <script src="%SERVICE_ROOT%/loleaflet/%VERSION%/fileJS"></script>
  ]),
  [    <script src="%SERVICE_ROOT%/loleaflet/%VERSION%/bundle.js"></script>
  ])
)dnl
    <!--%BRANDING_JS%--> <!-- logo onclick handler -->
</body></html>

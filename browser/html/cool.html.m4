m4_dnl -*- Mode: HTML -*-x
m4_changequote([,])m4_dnl
m4_dnl# m4_foreachq(x, `item_1, item_2, ..., item_n', stmt)
m4_dnl# quoted list, alternate improved version
m4_define([m4_foreachq],[m4_ifelse([$2],[],[],[m4_pushdef([$1])_$0([$1],[$3],[],$2)m4_popdef([$1])])])m4_dnl
m4_define([_m4_foreachq],[m4_ifelse([$#],[3],[],[m4_define([$1],[$4])$2[]$0([$1],[$2],m4_shift(m4_shift(m4_shift($@))))])])m4_dnl
m4_define(_YEAR_,m4_esyscmd(date +%Y|tr -d '\n'))
<!DOCTYPE html>
<!-- saved from url=(0054)http://leafletjs.com/examples/quick-start-example.html -->
m4_ifelse(IOSAPP,[true],
<!-- Related to issue #5841: the iOS app sets the base text direction via the "dir" parameter -->
<html dir=""><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" data-theme="%UI_THEME%">
,
<html %UI_RTL_SETTINGS%><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
)m4_dnl
<title>Online Editor</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0 minimum-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="previewImg" content="data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAyMDAgMjAwJz4KICAgPGNpcmNsZSB0cmFuc2Zvcm09J3JvdGF0ZSgwKScgdHJhbnNmb3JtLW9yaWdpbj0nY2VudGVyJyBmaWxsPSdub25lJyBzdHJva2U9JyNCNkI2QjYnIHN0cm9rZS13aWR0aD0nMTUnIHN0cm9rZS1saW5lY2FwPSdyb3VuZCcgc3Ryb2tlLWRhc2hhcnJheT0nMjMwIDEwMDAnIHN0cm9rZS1kYXNob2Zmc2V0PScwJyBjeD0nMTAwJyBjeT0nMTAwJyByPSc3MCc+CiAgICAgPGFuaW1hdGVUcmFuc2Zvcm0KICAgICAgICAgYXR0cmlidXRlTmFtZT0ndHJhbnNmb3JtJwogICAgICAgICB0eXBlPSdyb3RhdGUnCiAgICAgICAgIGZyb209JzAnCiAgICAgICAgIHRvPSczNjAnCiAgICAgICAgIGR1cj0nMicKICAgICAgICAgcmVwZWF0Q291bnQ9J2luZGVmaW5pdGUnPgogICAgICA8L2FuaW1hdGVUcmFuc2Zvcm0+CiAgIDwvY2lyY2xlPgo8L3N2Zz4=">
<meta name="previewSmile" content="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjRweCIgdmlld0JveD0iMCAtOTYwIDk2MCA5NjAiIHdpZHRoPSIyNHB4IiBmaWxsPSIjNWY2MzY4Ij48cGF0aCBkPSJtNDI0LTI5NiAyODItMjgyLTU2LTU2LTIyNiAyMjYtMTE0LTExNC01NiA1NiAxNzAgMTcwWm01NiAyMTZxLTgzIDAtMTU2LTMxLjVUMTk3LTE5N3EtNTQtNTQtODUuNS0xMjdUODAtNDgwcTAtODMgMzEuNS0xNTZUMTk3LTc2M3E1NC01NCAxMjctODUuNVQ0ODAtODgwcTgzIDAgMTU2IDMxLjVUNzYzLTc2M3E1NCA1NCA4NS41IDEyN1Q4ODAtNDgwcTAgODMtMzEuNSAxNTZUNzYzLTE5N3EtNTQgNTQtMTI3IDg1LjVUNDgwLTgwWm0wLTgwcTEzNCAwIDIyNy05M3Q5My0yMjdxMC0xMzQtOTMtMjI3dC0yMjctOTNxLTEzNCAwLTIyNyA5M3QtOTMgMjI3cTAgMTM0IDkzIDIyN3QyMjcgOTNabTAtMzIwWiIvPjwvc3ZnPg==">

m4_dnl# Define MOBILEAPP as true if this is either for the iOS app or for the gtk+ "app" testbed
m4_define([MOBILEAPP],[])
m4_ifelse(IOSAPP,[true],[m4_define([MOBILEAPP],[true])])
m4_ifelse(GTKAPP,[true],[m4_define([MOBILEAPP],[true])])
m4_ifelse(ANDROIDAPP,[true],[m4_define([MOBILEAPP],[true])])

m4_dnl# FIXME: This is temporary and not what we actually eventually want.
m4_dnl# What we really want is not a separate HTML file (produced with M4 conditionals on the below
m4_dnl# EMSCRIPTENAPP) for a "WASM app". What we want is that the same cool.html page adapts on demand to
m4_dnl# instead run locally using WASM, if the connection to the COOL server breaks. (And then
m4_dnl# re-connects to the COOL server when possible.)

m4_ifelse(EMSCRIPTENAPP,[true],[m4_define([MOBILEAPP],[true])])

m4_ifelse(MOBILEAPP, [true],
[
  <input type="hidden" id="init-app-type" value="mobile" />
  <input type="hidden" id="init-help-file" value="m4_syscmd([cat html/cool-help.html | sed 's/"/\&quot;/g'])" />
],
[
  <input type="hidden" id="init-welcome-url" value="%WELCOME_URL%" />
  <input type="hidden" id="init-feedback-url" value="%FEEDBACK_URL%" />
  <input type="hidden" id="init-buy-product-url" value="%BUYPRODUCT_URL%" />
  <input type="hidden" id="init-app-type" value="browser" />
  <input type="hidden" id="init-css-vars" value="<!--%CSS_VARIABLES%-->" />
]
)

<input type="hidden" id="init-uri-prefix" value="m4_ifelse(MOBILEAPP, [], [%SERVICE_ROOT%/browser/%VERSION%/])" />
<input type="hidden" id="init-branding-name" value="%BRANDING_THEME%" />

m4_dnl# For use in conditionals in JS:
m4_ifelse(IOSAPP, [true], [<input type="hidden" id="init-mobile-app-os-type" value="IOS" />])
m4_ifelse(GTKAPP, [true], [<input type="hidden" id="init-mobile-app-os-type" value="GTK" />])
m4_ifelse(ANDROIDAPP, [true], [<input type="hidden" id="init-mobile-app-os-type" value="ANDROID" />])
m4_ifelse(EMSCRIPTENAPP, [true], [<input type="hidden" id="init-mobile-app-os-type" value="EMSCRIPTEN" />])

m4_ifelse(EMSCRIPTENAPP, [true], [<script type="text/javascript" src="online.js"></script>])

m4_ifelse(BUNDLE,[],
  <!-- Using individual CSS files -->
  m4_foreachq([fileCSS],[COOL_CSS],[<link rel="stylesheet" href="][m4_ifelse(MOBILEAPP,[],[%SERVICE_ROOT%/browser/%VERSION%/])][fileCSS" />
]),
[<link rel="stylesheet" href="][m4_ifelse(MOBILEAPP,[],[%SERVICE_ROOT%/browser/%VERSION%/])][bundle.css" />])

<!--%BRANDING_CSS%--> <!-- add your logo here -->
m4_ifelse(IOSAPP,[true],
  [<link rel="stylesheet" href="Branding/branding.css">])
m4_ifelse(ANDROIDAPP,[true],
  [<link rel="stylesheet" href="branding.css">])
m4_ifelse(EMSCRIPTENAPP,[true],
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
  [<link rel="localizations" href="%SERVICE_ROOT%/browser/%VERSION%/l10n/uno-localizations-override.json" type="application/vnd.oftn.l10n+json"/>
   <link rel="localizations" href="%SERVICE_ROOT%/browser/%VERSION%/l10n/localizations.json" type="application/vnd.oftn.l10n+json"/>
   <link rel="localizations" href="%SERVICE_ROOT%/browser/%VERSION%/l10n/locore-localizations.json" type="application/vnd.oftn.l10n+json"/>
   <link rel="localizations" href="%SERVICE_ROOT%/browser/%VERSION%/l10n/help-localizations.json" type="application/vnd.oftn.l10n+json"/>
   <link rel="localizations" href="%SERVICE_ROOT%/browser/%VERSION%/l10n/uno-localizations.json" type="application/vnd.oftn.l10n+json"/>]
)m4_dnl
</head>

  <body>
    <!--The "controls" div holds map controls such as the Zoom button and
        it's separated from the map in order to have the controls on the top
        of the page all the time.

        The "document-container" div is the actual display of the document, is
        what the user sees and it should be no larger than the screen size.

        The "map" div is the actual document and it has the document's size
        and width, this being inside the smaller "document-container" will
        cause the content to overflow, creating scrollbars -->

    <dialog id="content-keeper">
      <nav class="main-nav" role="navigation">
        <!-- Mobile menu toggle button (hamburger/x icon) -->
        <input id="main-menu-state" type="checkbox" />
        <ul id="main-menu" class="sm sm-simple lo-menu readonly"></ul>
        <div id="document-titlebar">
          <div class="document-title">
            <!-- visuallyhidden: hide it visually but keep it available to screen reader and other assistive technology -->
            <label class="visuallyhidden" for="document-name-input" aria-hidden="false">Document name</label>
            <input id="document-name-input" type="text" spellcheck="false" disabled="true" />
            <div id="document-name-input-loading-bar"></div>
            <progress id="document-name-input-progress-bar" class="progress-bar" value="0" max="99"></progress>
          </div>
        </div>

        <div id="userListHeader">
          <div id="followingChipBackground">
            <div id="followingChip"></div>
          </div>
          <div id="userListSummaryBackground"><button id="userListSummary"></button></div>
        </div>
        <div id="closebuttonwrapperseparator"></div>
        <div id="closebuttonwrapper">
          <div class="closebuttonimage" id="closebutton"></div>
        </div>
      </nav>

      <div id="toolbar-wrapper" role="toolbar" aria-orientation="horizontal">
          <div id="toolbar-row" class="toolbar-row">
            <div id="toolbar-logo"></div>
            <div id="toolbar-mobile-back" class="editmode-off"></div>
            <div class="jsdialog ui-spacer"></div>
            <div id="toolbar-up"></div>
            <div id="toolbar-hamburger">
              <label class="main-menu-btn" for="main-menu-state">
                <span class="main-menu-btn-icon" id="main-menu-btn-icon"></span>
              </label>
            </div>
          </div>
        <div colspan="4" id="formulabar"></div>
        <progress id="mobile-progress-bar" class="progress-bar" value="0" max="99"></progress>
      </div>

      <input id="insertgraphic" aria-labelledby="menu-insertgraphic" type="file" accept="image/*">
      <input id="selectbackground" aria-labelledby="menu-selectbackground" type="file" accept="image/*">
    </dialog>

    <div id="main-document-content">
      <div id="presentation-controls-wrapper" class="readonly">
        <div id="slide-sorter"></div>
        <div id="presentation-toolbar"></div>
      </div>
      <div id="document-container" class="readonly" dir="ltr">
        <div id="map"></div>
      </div>
      <div id="sidebar-dock-wrapper">
        <div id="sidebar-panel"></div>
      </div>
    </div>

    <div id="spreadsheet-toolbar"></div>

    <div id="mobile-edit-button">
      <div id="mobile-edit-button-image"></div>
    </div>

    <div id="toolbar-down"></div>
    <div id="toolbar-search"></div>
    <div id="mobile-wizard">
      <div id="mobile-wizard-tabs"></div>
      <table id="mobile-wizard-titlebar" class="mobile-wizard-titlebar" width="100%">
        <tr>
          <td id="mobile-wizard-back" class="mobile-wizard-back"></td>
          <td id="mobile-wizard-title" class="mobile-wizard-title ui-widget"></td>
        </tr>
      </table>
      <div id="mobile-wizard-content"></div>
    </div>

    <!-- Remove if you don't want the About dialog -->
    <dialog>
      <div id="about-dialog" tabIndex="0">
        <div id="about-dialog-header">
          <fig id="integrator-logo"></fig>
          <h1 id="product-name">Collabora Online</h1>
        </div>
        <hr/>
        <div id="about-dialog-container">
          <div id="about-dialog-logos">
            <fig id="product-logo"></fig>
            <fig id="lokit-logo"></fig>
          </div>
          <div id="about-dialog-info-container">
            <div id="about-dialog-info">
              <div id="coolwsd-version-label"></div>
              <div class="about-dialog-info-div"><div id="coolwsd-version" dir="ltr"></div></div>
              <div class="spacer"></div>
              <div id="lokit-version-label"></div>
              <div class="about-dialog-info-div"><div id="lokit-version" dir="ltr"></div></div>
              m4_ifelse(MOBILEAPP,[],[<div id="served-by"><span id="served-by-label"></span>&nbsp;<span id="os-info"></span>&nbsp;<wbr><span id="coolwsd-id"></span></div>],[<p></p>])
              <div id="slow-proxy"></div>
              m4_ifelse(DEBUG,[true],[<div id="js-dialog">JSDialogs: <a href="#">View widgets</a></div>])
              <div id="routeToken"></div>
              <div id="timeZone"></div>
              m4_ifelse(MOBILEAPP,[],[<div id="wopi-host-id">%WOPI_HOST_ID%</div>],[<p></p>])
              <p class="about-dialog-info-div"><span dir="ltr">Copyright © _YEAR_, VENDOR.</span></p>
            </div>
          </div>
        </div>
      </div>
    </dialog>

m4_ifelse(MOBILEAPP, [true],
     [
      <input type="hidden" id="initial-variables"
      m4_ifelse(EMSCRIPTENAPP, [true],
        [
          data-access-token='%ACCESS_TOKEN%'
          data-access-token-ttl='%ACCESS_TOKEN_TTL%'
          data-access-header='%ACCESS_HEADER%'
        ]
      )
      data-mobile-app-name='MOBILEAPPNAME'
      />
      ],
     [
      <input type="hidden" id="initial-variables"
      data-host = "%HOST%"
      data-service-root = "%SERVICE_ROOT%"
      data-hexify-url = "%HEXIFY_URL%"
      data-version-path = "%VERSION%"
      data-access-token = "%ACCESS_TOKEN%"
      data-access-token-ttl = "%ACCESS_TOKEN_TTL%"
      data-access-header = "%ACCESS_HEADER%"
      data-post-message-origin-ext = "%POSTMESSAGE_ORIGIN%"
      data-cool-logging = "%BROWSER_LOGGING%"
      data-coolwsd-version = "%COOLWSD_VERSION%"
      data-enable-welcome-message = "%ENABLE_WELCOME_MSG%"
      data-auto-show-welcome = "%AUTO_SHOW_WELCOME%"
      data-auto-show-feedback = "%AUTO_SHOW_FEEDBACK%"
      data-allow-update-notification = "%ENABLE_UPDATE_NOTIFICATION%"
      data-user-interface-mode = "%USER_INTERFACE_MODE%"
      data-use-integration-theme = "%USE_INTEGRATION_THEME%"
      data-enable-macros-execution = "%ENABLE_MACROS_EXECUTION%"
      data-enable-accessibility = "%ENABLE_ACCESSIBILITY%"
      data-out-of-focus-timeout-secs = "%OUT_OF_FOCUS_TIMEOUT_SECS%"
      data-idle-timeout-secs = "%IDLE_TIMEOUT_SECS%"
      data-protocol-debug = "%PROTOCOL_DEBUG%"
      data-enable-debug = "%ENABLE_DEBUG%"
      data-frame-ancestors = "%FRAME_ANCESTORS%"
      data-socket-proxy = "%SOCKET_PROXY%"
      data-ui-defaults = "%UI_DEFAULTS%"
      data-check-file-info-override = "%CHECK_FILE_INFO_OVERRIDE%"
      data-deepl-enabled = "%DEEPL_ENABLED%"
      data-zotero-enabled = "%ZOTERO_ENABLED%"
      data-saved-ui-state = "%SAVED_UI_STATE%"
      data-wasm-enabled = "%WASM_ENABLED%"
      data-indirection-url = "%INDIRECTION_URL%"
      data-geolocation-setup = "%GEOLOCATION_SETUP%"
      />
    ])

m4_dnl This is GLOBAL_JS:
m4_ifelse(MOBILEAPP, [true],
  [<script type="text/javascript" src="global.js"></script>],
  [<script type="text/javascript" src="%SERVICE_ROOT%/browser/%VERSION%/global.js"></script>]
)

m4_ifelse(MOBILEAPP,[true],
  <!-- This is for a mobile app so the script files are in the same folder -->
  m4_ifelse(BUNDLE, [], m4_foreachq([fileJS], [m4_include(COOL_JS.m4)], [<script src="fileJS" defer></script>]), [<script src="bundle.js" defer></script>]),
  m4_ifelse(BUNDLE, [], m4_foreachq([fileJS], [m4_include(COOL_JS.m4)],
        [<script src="%SERVICE_ROOT%/browser/%VERSION%/fileJS" defer></script>
        ]), [<script src="%SERVICE_ROOT%/browser/%VERSION%/bundle.js" defer></script>
        ])
)m4_dnl

m4_ifelse(MOBILEAPP, [true], [<script src="m4_ifelse(IOSAPP, [true], [Branding/])branding.js"></script>],
        [<!--%BRANDING_JS%--> <!-- logo onclick handler -->])
</body></html>

MAKEFLAGS = --no-builtin-rules
CTAGS = ctags
BUILT_SOURCES = node_modules

L10N_PO = $(wildcard $(srcdir)/po/*.po)
IS_BUNDLE = $(if $(filter true,$(ENABLE_BUNDLE)),true,)
IS_SEPARATE = $(if $(filter false,$(ENABLE_BUNDLE)),true,)

DIST_FOLDER ?= $(builddir)/dist
TYPESCRIPT_JS_DIR = $(builddir)/typescript_js

export NODE_PATH=$(abs_builddir)/node_module

if !ENABLE_MOBILEAPP
L10N_JSON = $(patsubst $(srcdir)/po/%.po,$(DIST_FOLDER)/l10n/%.json,$(L10N_PO))
else
L10N_IOS_ALL_JS = $(DIST_FOLDER)/l10n-all.js
L10N_JSON = $(L10N_IOS_ALL_JS)

$(L10N_IOS_ALL_JS) : $(wildcard $(srcdir)/po/ui-*.po) $(shell find $(srcdir)/l10n -name '*.*') $(srcdir)/util/create-l10n-all-js.pl
	for F in $(wildcard $(srcdir)/po/ui-*.po); do \
		$(srcdir)/util/po2json.py $$F -o $$F.json; \
	done
	@mkdir -p $(dir $@)
	perl $(srcdir)/util/create-l10n-all-js.pl >$@
	for F in $(wildcard $(srcdir)/po/ui-*.po); do \
		rm $$F.json; \
	done
endif

MOCHA_DIR = $(srcdir)/mocha_tests
MOCHA_TS_FILES = $(wildcard $(MOCHA_DIR)/*.ts)
MOCHA_TS_JS_FILES := $(MOCHA_TS_FILES:.ts=.js)
$(MOCHA_TS_JS_FILES): %.js: %.ts
	$(builddir)/node_modules/typescript/bin/tsc $< --outfile $@ --module none --lib dom,es2016 --target ES5

JQUERY_LIGHTNESS_IMAGE_PATH = $(srcdir)/images/jquery-ui-lightness
JQUERY_LIGHTNESS_IMAGES = $(wildcard $(JQUERY_LIGHTNESS_IMAGE_PATH)/*.png)
JQUERY_LIGHTNESS_DIST_IMAGES = $(patsubst $(JQUERY_LIGHTNESS_IMAGE_PATH)/%.png,$(DIST_FOLDER)/images/%.png,$(JQUERY_LIGHTNESS_IMAGES))

JQUERY_MINIFIED_IMAGE_PATH = node_modules/jquery-ui/themes/base/images
JQUERY_MINIFIED_IMAGES = $(wildcard $(JQUERY_MINIFIED_IMAGE_PATH)/*.png)
JQUERY_MINIFIED_DIST_IMAGES = $(patsubst $(JQUERY_MINIFIED_IMAGE_PATH)/%.png,$(DIST_FOLDER)/images/%.png,$(JQUERY_MINIFIED_IMAGES))

COOL_IMAGES_SRC = $(shell find $(srcdir)/images -name '*.*')
COOL_IMAGES_DST = $(patsubst $(srcdir)/%,$(DIST_FOLDER)/%,$(COOL_IMAGES_SRC))
COOL_IMAGES_CUSTOM_SRC = $(shell if test -n "$(CUSTOM_ICONS_DIRECTORY)"; then find $(CUSTOM_ICONS_DIRECTORY) -name '*.*'; fi)
COOL_IMAGES_CUSTOM_DST = $(patsubst $(CUSTOM_ICONS_DIRECTORY)/%,$(DIST_FOLDER)/images/%,$(COOL_IMAGES_CUSTOM_SRC))
COOL_L10N_SRC = $(shell find $(srcdir)/l10n -name '*.*')
if !ENABLE_MOBILEAPP
COOL_L10N_DST =  $(patsubst $(srcdir)/l10n/%,$(DIST_FOLDER)/l10n/%,$(COOL_L10N_SRC))
endif

COOL_HTML_SRC = $(shell find $(srcdir)/html -name '*.html')
COOL_HTML_DST = $(patsubst $(srcdir)/html/%.html,$(DIST_FOLDER)/%.html,$(COOL_HTML_SRC))

if ENABLE_WELCOME_MESSAGE
COOL_WELCOME_SRC = $(shell find $(srcdir)/welcome -name '*')
COOL_WELCOME_DST = $(patsubst $(srcdir)/welcome/%,$(DIST_FOLDER)/welcome/%,$(COOL_WELCOME_SRC))
endif

COOL_ADMIN_SRC = $(shell find $(srcdir)/admin -name '*.html' -or -name '*.css' -or -name '*.ttf' -or -name 'OFL.txt' -or -name '*.svg')
COOL_ADMIN_ALL = $(shell find $(srcdir)/admin -name '*')
COOL_ADMIN_DST = $(patsubst $(srcdir)/admin/%,$(DIST_FOLDER)/admin/%,$(COOL_ADMIN_SRC))

define file_target
$(1): $(2)
	@mkdir -p $$(dir $$@)
	@if test -z '$(ENABLE_BROWSERSYNC)'; then \
		`cp $$< $$@`; \
	else \
		`ln -sf ../$$< $$@`; \
	fi

endef

define file_targets
$(foreach file,$(1),$(call file_target,\
	$(DIST_FOLDER)/$(notdir $(file)),\
	$(file)))
endef

define npm_source
	for package in $(1); do \
		npm pack $${package}; \
		fname=$$(ls *.tgz); \
		pdir=$${fname%%.tgz}; \
		mkdir -p $${pdir}; \
		tar -xzf $${fname} -C $${pdir} --strip-components=1; \
		rm $${fname}; \
	done
endef

COOL_ADMIN_TS =\
	admin/src/ModalDialogCreator.ts

COOL_ADMIN_TS_JS = $(patsubst %.ts,$(TYPESCRIPT_JS_DIR)/%.js,$(COOL_ADMIN_TS))

COOL_ADMIN_JS =\
	admin/src/Base.js \
	admin/src/Admin.js \
	admin/src/AdminSocketBase.js \
	admin/src/Util.js \
	admin/src/AdminSocketOverview.js \
	admin/src/AdminSocketAnalytics.js \
	admin/src/AdminSocketSettings.js \
	admin/src/AdminSocketHistory.js \
	admin/src/AdminSocketLog.js

NODE_MODULES_SRC =\
	autolinker@3.14.1 \
	json-js@1.1.2 \
	select2@4.0.13 \
	vex-js@4.1.0 \
	l10n-for-node@0.0.1 \
	@braintree/sanitize-url@6.0.0

COOL_CSS_LST =\
	$(builddir)/node_modules/select2/dist/css/select2.css \
	$(srcdir)/css/w2ui-1.5.rc1.css \
	$(srcdir)/css/leaflet.css \
	$(srcdir)/css/leaflet-spinner.css \
	$(srcdir)/css/selectionMarkers.css \
	$(srcdir)/css/color-palette.css \
	$(srcdir)/css/cool.css \
	$(srcdir)/css/toolbar.css \
	$(srcdir)/css/partsPreviewControl.css \
	$(srcdir)/css/searchControl.css \
	$(srcdir)/css/impress.css \
	$(srcdir)/css/impress-mobile.css \
	$(srcdir)/css/spreadsheet.css \
	$(srcdir)/css/writer-mobile.css \
	$(srcdir)/css/writer.css \
	$(srcdir)/css/editor.css \
	$(srcdir)/css/iframedialog.css \
	$(builddir)/node_modules/jquery-contextmenu/dist/jquery.contextMenu.css \
	$(builddir)/node_modules/vex-js/dist/css/vex.css \
	$(builddir)/node_modules/vex-js/dist/css/vex-theme-plain.css \
	$(builddir)/node_modules/vex-js/dist/css/vex-theme-bottom-right-corner.css \
	$(builddir)/node_modules/smartmenus/dist/css/sm-core-css.css \
	$(builddir)/node_modules/smartmenus/dist/css/sm-simple/sm-simple.css \
	$(srcdir)/css/welcome.css \
	$(srcdir)/css/menubar.css \
	$(srcdir)/css/mobilewizard.css \
	$(srcdir)/css/jsdialogs.css \
	$(srcdir)/css/btns.css \
	$(srcdir)/css/notebookbar.css \
	$(srcdir)/css/jssidebar.css \
	$(srcdir)/css/override-vex.css \
	$(srcdir)/css/override-smartmenus.css \
	$(srcdir)/css/jquery-ui-lightness.css \
	$(srcdir)/css/infobar.css

COOL_CSS = $(filter %,$(COOL_CSS_LST))

COOL_CSS_DST = $(foreach file,$(COOL_CSS),$(DIST_FOLDER)/$(notdir $(file)))
COOL_CSS_M4 = $(strip $(foreach file,$(COOL_CSS),$(notdir $(file))))

$(eval $(call file_targets,$(COOL_CSS)))

NODE_MODULES_JS =\
	$(if $(IS_SEPARATE),node_modules/hammerjs/hammer.js,node_modules/hammerjs/hammer.min.js) \
	node_modules/jquery/dist/jquery.js \
	node_modules/jquery-mousewheel/jquery.mousewheel.js \
	node_modules/jquery-contextmenu/dist/jquery.contextMenu.js \
	node_modules/jquery-ui/dist/jquery-ui.js \
	$(shell find node_modules/jquery-ui/ui/i18n -name '*.js') \
	node_modules/smartmenus/dist/jquery.smartmenus.js \
	node_modules/pako/dist/pako_inflate.es5.js \
	node_modules/fzstd/umd/index.js

COOL_LIBS_JS =\
	ResizeObserverPolyfill.js \
	Autolinker.js \
	json2.js \
	select2.js \
	vex.combined.js \
	sanitize-url.js

if !ENABLE_MOBILEAPP
COOL_LIBS_JS +=\
	l10n.js
endif

COOL_LIBS_JS +=\
	w2ui-1.5.rc1.js \
	viamapi-client.js

NODE_MODULES_JS_SRC = $(patsubst %.js,$(builddir)/%.js,$(NODE_MODULES_JS))
NODE_MODULES_JS_DST = $(patsubst %.js,$(DIST_FOLDER)/%.js,$(NODE_MODULES_JS))

COOL_LIBS_JS_SRC = $(patsubst %.js,$(srcdir)/js/%.js,$(COOL_LIBS_JS))
COOL_LIBS_JS_DST = $(patsubst %.js,$(DIST_FOLDER)/%.js,$(COOL_LIBS_JS))

# the ordering of this is delicate to get JS initialization right,
# this list includes both Javascript and Typescript generated files
# in a rather precise order.
COOL_JS_LST =\
	src/docstate.js \
	src/Leaflet.js \
	src/errormessages.js \
	src/unocommands.js \
	src/UNO/Key.js \
	src/core/Log.js \
	src/core/Util.js \
	src/core/LOUtil.js \
	src/core/Rectangle.ts \
	src/core/Class.js \
	src/core/Events.js \
	src/core/Socket.js \
	src/core/Matrix.js \
	src/geometry/Point.ts \
	src/geometry/Bounds.ts \
	src/geometry/Transformation.ts \
	src/dom/DomUtil.js src/geo/LatLng.js \
	src/geo/LatLngBounds.js \
	src/geo/projection/Projection.LonLat.js \
	src/geo/crs/CRS.js \
	src/geo/crs/CRS.Simple.js \
	src/control/IFrameDialog.js \
	src/map/Map.js \
	src/control/Control.IdleHandler.ts \
	src/map/Clipboard.js \
	src/layer/tile/SheetSwitch.ts \
	src/layer/Layer.js \
	src/layer/tile/SheetGeometry.ts \
	src/layer/tile/CanvasSectionProps.js \
	src/layer/tile/CanvasSectionContainer.ts \
	src/layer/tile/CommentSection.ts \
	src/layer/tile/CommentListSection.ts \
	src/layer/tile/TilesSection.ts \
	src/layer/tile/AutoFillMarkerSection.ts \
	src/layer/vector/CEventsHandler.ts \
	src/layer/vector/CPointSet.ts \
	src/layer/vector/CPath.ts \
	src/layer/vector/CLineUtil.ts \
	src/layer/vector/CPolyline.ts \
	src/layer/vector/CPolyUtil.ts \
	src/layer/vector/CPolygon.ts \
	src/layer/vector/CRectangle.ts \
	src/layer/vector/CSplitterLine.ts \
	src/layer/marker/Cursor.ts \
	src/layer/vector/CanvasOverlay.ts \
	src/layer/tile/ScrollSection.ts \
	src/layer/tile/CanvasTileLayer.js \
	src/layer/vector/CDarkOverlay.ts \
	src/layer/SplitPanesContext.ts \
	src/layer/CalcSplitPanesContext.ts \
	src/layer/tile/TileLayer.TableOverlay.js \
	src/layer/tile/WriterTileLayer.js \
	src/layer/tile/ImpressTileLayer.js \
	src/layer/tile/CalcTileLayer.js \
	src/layer/tile/ContentControlSection.ts \
	src/layer/BackgroundColor.js \
	src/layer/ImageOverlay.js \
	src/layer/marker/ProgressOverlay.js \
	src/layer/marker/TextInput.js \
	src/layer/marker/Icon.js \
	src/layer/marker/Icon.Default.js \
	src/layer/marker/Marker.js \
	src/layer/marker/DivIcon.js \
	src/layer/Popup.js \
	src/layer/Layer.Popup.js \
	src/layer/marker/Marker.Popup.js \
	src/layer/LayerGroup.js \
	src/layer/FeatureGroup.js \
	src/layer/vector/Renderer.js \
	src/layer/vector/Path.js \
	src/layer/vector/Path.Popup.js \
	src/geometry/LineUtil.js \
	src/layer/vector/Polyline.js \
	src/geometry/PolyUtil.js \
	src/layer/vector/Polygon.js \
	src/layer/vector/Rectangle.js \
	src/layer/vector/CircleMarker.js \
	src/layer/vector/Circle.js \
	src/layer/vector/SVG.js \
	src/layer/vector/SplitPanesRenderer.js \
	src/layer/vector/SplitPanesSVG.js \
	src/layer/vector/Path.Transform.SVG.js \
	src/core/Handler.js \
	src/layer/vector/SVGGroup.js \
	src/layer/vector/Path.Drag.Transform.js \
	src/layer/vector/Path.Drag.js \
	src/layer/vector/Path.Transform.Util.js \
	src/layer/vector/Path.Transform.js \
	src/layer/vector/SVG.VML.js \
	src/layer/vector/Path.Transform.SVG.VML.js \
	src/layer/vector/Canvas.js \
	src/layer/vector/Path.Transform.Canvas.js \
	src/layer/FormFieldButtonLayer.js \
	src/dom/DomEvent.js \
	src/dom/Draggable.js \
	src/map/handler/Map.Drag.js \
	src/map/handler/Map.Scroll.js \
	src/map/handler/Map.DoubleClickZoom.js \
	src/dom/DomEvent.Pointer.js \
	src/map/handler/Map.TouchGesture.js \
	src/map/handler/Map.Keyboard.js \
	src/map/handler/Map.Welcome.js \
	src/map/handler/Map.Feedback.js \
	src/map/handler/Map.Infobar.js \
	src/dom/DomEvent.MultiClick.js \
	src/map/handler/Map.Mouse.js \
	src/map/handler/Map.Print.js \
	src/map/handler/Map.SlideShow.js \
	src/map/handler/Map.FileInserter.js \
	src/map/handler/Map.StateChanges.js \
	src/map/handler/Map.WOPI.js \
	src/layer/marker/Marker.Drag.js \
	src/control/Control.Toolbar.js \
	src/control/Control.Command.js \
	src/control/Control.js \
	src/control/Control.PartsPreview.js \
	src/control/Control.GroupBase.ts \
	src/control/Control.CornerGroup.ts \
	src/control/Control.RowGroup.ts \
	src/control/Control.ColumnGroup.ts \
	src/control/Control.CornerHeader.ts \
	src/control/Control.Header.ts \
	src/control/Control.ColumnHeader.ts \
	src/control/Control.RowHeader.ts \
	src/control/Control.DocumentRepair.js \
	src/control/Control.DownloadProgress.js \
	src/control/Control.ContextMenu.js \
	src/control/Control.Menubar.js \
	src/control/Control.Tabs.js \
	src/control/Control.Permission.js \
	src/control/Control.Selection.js \
	src/control/Control.LokDialog.js \
	src/control/Control.AlertDialog.js \
	src/control/ColorPicker.js \
	src/control/jsdialog/Widget.LanguageSelector.js \
	src/control/jsdialog/Widget.MultilineEdit.js \
	src/control/jsdialog/Widget.TreeView.js \
	src/control/Control.JSDialog.js \
	src/control/Control.JSDialogBuilder.js \
	src/control/Control.MobileWizardBuilder.js \
	src/control/Control.MobileWizardWindow.js \
	src/control/Control.MobileWizard.js \
	src/control/Control.MobileWizardPopup.js \
	src/control/Control.LanguageDialog.js \
	src/control/Control.Attribution.js \
	src/control/Control.MobileSlide.js \
	src/control/Control.Scale.js \
	src/control/Control.StatusBar.js \
	src/control/Control.SearchBar.js \
	src/control/Control.MobileTopBar.js \
	src/control/Control.MobileBottomBar.js \
	src/control/Control.UserList.js \
	src/control/Control.FormulaBar.js \
	src/control/Control.FormulaBarJSDialog.js \
	src/control/Control.SheetsBar.js \
	src/control/Control.PresentationBar.js \
	src/control/Control.SigningBar.js \
	src/control/Control.TopToolbar.js \
	src/control/Control.UIManager.js \
	src/control/Control.DocumentNameInput.js \
	src/control/Control.Notebookbar.js \
	src/control/Control.NotebookbarWriter.js \
	src/control/Control.NotebookbarCalc.js \
	src/control/Control.NotebookbarImpress.js \
	src/control/Control.NotebookbarDraw.js \
	src/control/Control.NotebookbarBuilder.js \
	src/control/Control.Layers.js \
	src/control/Control.Sidebar.js \
	src/control/Control.Mention.js \
	src/control/Control.Zotero.js \
	src/control/Search.js \
	src/control/Permission.js \
	src/control/Toolbar.js \
	src/control/Signing.js \
	src/control/Parts.js \
	src/control/Scroll.js \
	src/control/Styles.js \
	src/control/Ruler.js \
	src/dom/PosAnimation.js \
	src/map/anim/Map.PanAnimation.js \
	src/dom/PosAnimation.Timer.js \
	src/control/Control.Scroll.Annotation.js \
	src/main.js

COOL_JS_WEBORDER = $(filter %,$(COOL_JS_LST))

COOL_JS_SRC = $(filter %.js,$(COOL_JS_WEBORDER))
COOL_TS_SRC = $(filter %.ts,$(COOL_JS_WEBORDER))

# beware these are not helpfully ordered
COOL_TS_JS_DST = $(patsubst src/%.ts,$(DIST_FOLDER)/src/%.js,$(COOL_TS_SRC))
COOL_JS_DST = $(patsubst src/%.js,$(DIST_FOLDER)/src/%.js,$(COOL_JS_SRC)) $(COOL_TS_JS_DST)
# should be no lingering / obsolete files:
COOL_ASSERT_INTERSECT = $(filter $(COOL_JS_SRC), $(patsubst %.ts,%.js,$(COOL_TS_SRC)))

COMMA := ,
EMPTY :=
SPACE := $(EMPTY) $(EMPTY)
COOL_VERSION = $(shell cd $(srcdir) && git log -1 --pretty=format:"%h")
INTERMEDIATE_DIR ?= $(if $(IS_SEPARATE),$(abs_builddir)/debug,$(abs_builddir)/release)

EXTRA_DIST = $(shell find . -type f -not -path './.git/*' -not -path './node_modules/*' | sed 's/.\///')

define bundle_cool
	$(if $(IS_SEPARATE),\
		@touch $@,
		@m4 -PE -DIOSAPP=$(ENABLE_IOSAPP) \
			-DGTKAPP=$(ENABLE_GTKAPP) \
			-DANDROIDAPP=$(ENABLE_ANDROIDAPP) \
			-DMOBILEAPPNAME="$(APP_NAME)" \
			-DVERSION=$(COOL_VERSION) \
			-DCOPYRIGHT=$(srcdir)/src/copyright.js \
			-DCOOL_JS=$(subst $(SPACE),$(COMMA),$(patsubst src/%.ts,$(DIST_FOLDER)/src/%.js,$(COOL_JS_WEBORDER))) \
			$(srcdir)/cool-src.js.m4 > $@)
endef

define prereq_cool
	$(if $(IS_SEPARATE),$(COOL_JS_DST),$(COOL_JS_SRC))
endef

define bundle_css
	$(if $(IS_SEPARATE),\
		@touch $@,\
		@echo "Uglify cool css files..."
		@$(NODE) node_modules/uglifycss/uglifycss $(COOL_CSS) > $@)
endef

define prereq_css
	$(if $(IS_SEPARATE),$(COOL_CSS_DST),$(COOL_CSS))
endef

define bundle_all
	$(if $(IS_SEPARATE),\
		@touch $@,\
		@echo "Uglify cool js files..."
		@m4 -PE -DL10N_IOS_ALL_JS=$(L10N_IOS_ALL_JS) \
			-DNODE_MODULES_JS=$(subst $(SPACE),$(COMMA),$(NODE_MODULES_JS)) \
			-DCOOL_LIBS_JS=$(subst $(SPACE),$(COMMA),$(COOL_LIBS_JS_SRC)) \
			-DCOOL_JS=$(INTERMEDIATE_DIR)/cool-src.js \
			$(srcdir)/bundle.js.m4 > $(INTERMEDIATE_DIR)/bundle.js
		@$(NODE) node_modules/uglify-js/bin/uglifyjs \
			-O max_line_len=100 \
			$(INTERMEDIATE_DIR)/bundle.js \
			--output $@)
endef

define prereq_all
	$(if $(IS_SEPARATE),$(NODE_MODULES_JS_DST) $(COOL_LIBS_JS_DST),\
		$(NODE_MODULES_JS_SRC) $(COOL_LIBS_JS_SRC))
endef

define global_file
	$(if $(IS_SEPARATE),
		@cp $< $@,
		@echo "Uglify global.js file..."
		@$(NODE) node_modules/uglify-js/bin/uglifyjs $< --output $@)
endef

.PHONY: build-cool

all-local: build-cool

if !ENABLE_MOBILEAPP
ADMIN_BUNDLE = $(DIST_FOLDER)/admin-bundle.js
endif

if ENABLE_WASM
$(DIST_FOLDER)/online%: $(abs_top_builddir)/wasm/online%
	@mkdir -p $(dir $@)
	@cp $< $@

$(DIST_FOLDER)/soffice%: $(abs_top_builddir)/wasm/soffice%
	@mkdir -p $(dir $@)
	@cp $< $@

WASM_FILES= \
	$(DIST_FOLDER)/online.data \
	$(DIST_FOLDER)/online.js \
	$(DIST_FOLDER)/online.wasm \
	$(DIST_FOLDER)/online.wasm.debug.wasm \
	$(DIST_FOLDER)/online.worker.js \
	$(DIST_FOLDER)/soffice.data \
	$(DIST_FOLDER)/soffice.data.js.metadata
endif

$(TYPESCRIPT_JS_DIR)/%.js: $(srcdir)/%.ts
	@mkdir -p $(dir $@)
	$(builddir)/node_modules/typescript/bin/tsc --outFile $@ $<

build-cool: \
	$(COOL_L10N_DST) \
	$(L10N_JSON) \
	$(SRC_TS_JS_DST) \
	$(COOL_IMAGES_DST) \
	$(COOL_IMAGES_CUSTOM_DST) \
	$(JQUERY_LIGHTNESS_DIST_IMAGES) \
	$(JQUERY_MINIFIED_DIST_IMAGES) \
	$(ADMIN_BUNDLE) \
	$(DIST_FOLDER)/bundle.css \
	$(DIST_FOLDER)/device-mobile.css \
	$(DIST_FOLDER)/device-tablet.css \
	$(DIST_FOLDER)/device-desktop.css \
	$(DIST_FOLDER)/bundle.js \
	$(DIST_FOLDER)/cool.html \
	$(WASM_FILES)
	@echo "build cool completed"
if ENABLE_ANDROIDAPP
	@if test -d "$(APP_BRANDING_DIR)" ; then cp -a "$(APP_BRANDING_DIR)/branding.css" "$(APP_BRANDING_DIR)/branding.js" $(DIST_FOLDER)/ ; else touch $(DIST_FOLDER)/branding.css ; fi
	@if test -d "$(APP_BRANDING_DIR)" ; then cp -a "$(APP_BRANDING_DIR)"/images/*.svg $(DIST_FOLDER)/images/ ; fi
	@if test -d "$(APP_BRANDING_DIR)" ; then cp -a "$(APP_BRANDING_DIR)/images/toolbar-bg-logo.svg" $(DIST_FOLDER)/images/toolbar-bg.svg ; fi
	@echo
	@echo "JS, HTML and CSS has been updated (android/lib/src/main/assets/dist)."
endif

if ENABLE_CYPRESS
	cp -a  "$(srcdir)/../cypress_test/data/multiuser/cypress-multiuser.html" "$(DIST_FOLDER)/cypress-multiuser.html"
	@echo "Added HTML file for multiuser tests"
endif

$(DIST_FOLDER)/admin-bundle.js: $(COOL_ADMIN_DST) \
	$(INTERMEDIATE_DIR)/admin-src.js
	@NODE_PATH=$(abs_builddir)/node_modules:$(INTERMEDIATE_DIR) $(NODE) node_modules/browserify/bin/cmd.js -g browserify-css $(if $(IS_SEPARATE),--debug,-g uglifyify) -o $@ $(srcdir)/admin/main-admin.js

$(INTERMEDIATE_DIR)/admin-src.js: $(COOL_ADMIN_TS_JS) $(COOL_ADMIN_JS)
	@mkdir -p $(dir $@)
	@echo "Checking for admin JS errors..."
	@$(NODE) node_modules/eslint/bin/eslint.js --resolve-plugins-relative-to $(abs_builddir) --ignore-path $(srcdir)/.eslintignore --config $(srcdir)/.eslintrc --no-eslintrc $(srcdir)/admin/src
	@awk 'FNR == 1 {print ""} 1' $(COOL_ADMIN_TS_JS) $(patsubst %.js,$(srcdir)/%.js,$(COOL_ADMIN_JS)) > $@

$(INTERMEDIATE_DIR)/cool-src.js: tscompile.done $(call prereq_cool) $(COOL_JS_DST)
	@mkdir -p $(dir $@)
	$(abs_top_srcdir)/scripts/unocommands.py --check $(abs_top_srcdir)
	@printf "Checking for obsolete JS build intermediates in this makefile... "
	@if ! test "z$(COOL_ASSERT_INTERSECT)" == "z"; then echo; echo "Error: please remove obsolete files:"; echo "$(COOL_ASSERT_INTERSECT)"; exit 1; else echo "clean"; fi
	@echo "Checking for cool JS errors..."
	@$(NODE) node_modules/eslint/bin/eslint.js $(srcdir)/src --resolve-plugins-relative-to $(abs_builddir) \
		$(srcdir)/js --ignore-path $(srcdir)/.eslintignore --no-eslintrc --config $(srcdir)/.eslintrc
	@echo "Bundling cool..."
	$(call bundle_cool)

$(DIST_FOLDER)/bundle.css: $(call prereq_css)
	@mkdir -p $(dir $@)
	@echo "Checking for CSS errors..."
	@$(NODE) node_modules/stylelint/bin/stylelint.js --config $(srcdir)/.stylelintrc.json $(srcdir)/css/*.css
	$(call bundle_css)

$(DIST_FOLDER)/bundle.js: $(INTERMEDIATE_DIR)/cool-src.js $(call prereq_all)
	@mkdir -p $(dir $@)
	$(call bundle_all)

$(DIST_FOLDER)/global.js: $(srcdir)/js/global.js
	@mkdir -p $(dir $@)
	$(call global_file)

$(DIST_FOLDER)/cool.html: $(srcdir)/html/cool.html.m4 \
	$(COOL_HTML_DST) \
	$(COOL_WELCOME_DST) \
	$(DIST_FOLDER)/bundle.css \
	$(DIST_FOLDER)/global.js \
	$(DIST_FOLDER)/bundle.js
	@echo "Generating cool.html..."
	m4 -PE -DBUNDLE=$(IS_BUNDLE) \
		-DIOSAPP=$(ENABLE_IOSAPP) \
		-DGTKAPP=$(ENABLE_GTKAPP) \
		-DDEBUG=$(ENABLE_DEBUG) \
		-DANDROIDAPP=$(ENABLE_ANDROIDAPP) \
		-DEMSCRIPTENAPP=$(ENABLE_EMSCRIPTENAPP) \
		-DMOBILEAPPNAME="$(APP_NAME)" \
		-DCOOL_CSS="$(subst $(SPACE),$(COMMA),$(COOL_CSS_M4))" \
		-DGLOBAL_JS="$(DIST_FOLDER)/global.js" \
		-DCOOL_JS="$(subst $(SPACE),$(COMMA),$(NODE_MODULES_JS) \
		$(COOL_LIBS_JS) \
		$(patsubst %.ts,%.js,$(COOL_JS_WEBORDER)))" \
		-DVENDOR="$(VENDOR)" \
		$(srcdir)/html/cool.html.m4 > $@

node_modules: package.json archived-packages
	@npm install
	@touch node_modules

$(DIST_FOLDER)/device-%.css: $(srcdir)/css/device-%.css
	@mkdir -p $(dir $@)
	@if test -z '$(ENABLE_BROWSERSYNC)'; then \
		$(NODE) node_modules/uglifycss/uglifycss $< > $@ ; \
	else \
		ln -sf $(abs_srcdir)/$< $@ ; \
	fi

$(DIST_FOLDER)/plugins/%.js: $(srcdir)/plugins/%.js
	@mkdir -p $(dir $@)
	@if test -z '$(ENABLE_BROWSERSYNC)'; then \
		`cp $< $@`; \
	else \
		`ln -sf $(abs_srcdir)/$< $@`; \
	fi

$(DIST_FOLDER)/images/%: $(CUSTOM_ICONS_DIRECTORY)/%
	@mkdir -p $(dir $@)
	@cp $< $@

$(DIST_FOLDER)/images/%: $(srcdir)/images/%
	@mkdir -p $(dir $@)
	@cp $< $@

$(DIST_FOLDER)/%.html: $(srcdir)/html/%.html
	@mkdir -p $(dir $@)
	@if test -z '$(ENABLE_BROWSERSYNC)'; then \
		`cp $< $@`; \
	else \
		`ln -sf $(abs_srcdir)/$< $@`; \
	fi

if ENABLE_WELCOME_MESSAGE
$(DIST_FOLDER)/welcome/%: $(srcdir)/welcome/%
	@mkdir -p $(dir $@)
	@if test -z '$(ENABLE_BROWSERSYNC)'; then \
		`cp $< $@`; \
	else \
		`ln -sf $(abs_srcdir)/$< $@`; \
	fi
endif

if ENABLE_DEBUG
SourceMap=--allowJs true --sourceMap true --inlineSources true
endif

tscompile.done: $(COOL_JS_SRC) $(COOL_TS_SRC)
	$(builddir)/node_modules/typescript/bin/tsc --typeRoots $(builddir)/node_modules/@types --outDir $(DIST_FOLDER)/src --rootDir $(srcdir)/src --checkJs false --project $(srcdir)/tsconfig.json $(SourceMap)
	@touch $@

$(COOL_TS_JS_DST): tscompile.done
	@:

$(DIST_FOLDER)/src/%.js: $(srcdir)/src/%.js
	@mkdir -p $(dir $@)
	@if test -z '$(ENABLE_BROWSERSYNC)'; then \
		`cp $< $@`; \
	else \
		`echo $< $@`; \
		`ln -sf $(abs_srcdir)/$< $@`; \
	fi

$(DIST_FOLDER)/%.js: $(srcdir)/js/%.js
	@mkdir -p $(dir $@)
	@if test -z '$(ENABLE_BROWSERSYNC)'; then \
		`cp $< $@`; \
	else \
		`ln -sf $(abs_srcdir)/$< $@`; \
	fi

$(DIST_FOLDER)/node_modules/%.js: $(builddir)/node_modules/%.js
	@mkdir -p $(dir $@)
	@cp $< $@

$(DIST_FOLDER)/$(JQUERY_LIGHTNESS_IMAGE_PATH)/%.png: $(JQUERY_LIGHTNESS_IMAGE_PATH)/%.png
	@mkdir -p $(dir $@)
	@cp $< $@

$(DIST_FOLDER)/images/%.png: $(JQUERY_LIGHTNESS_IMAGE_PATH)/%.png
	@mkdir -p $(dir $@)
	@cp $< $@

$(DIST_FOLDER)/$(JQUERY_MINIFIED_IMAGE_PATH)/%.png: $(JQUERY_MINIFIED_IMAGE_PATH)/%.png
	@mkdir -p $(dir $@)
	@cp $< $@

$(DIST_FOLDER)/images/%.png: $(JQUERY_MINIFIED_IMAGE_PATH)/%.png
	@mkdir -p $(dir $@)
	@cp $< $@

$(DIST_FOLDER)/l10n/%: $(srcdir)/l10n/%
	@mkdir -p $(dir $@)
	@cp $< $@

$(DIST_FOLDER)/l10n/%.json: $(srcdir)/po/%.po
	@$(srcdir)/util/po2json.py --quiet $< -o $@

$(DIST_FOLDER)/admin/%: $(srcdir)/admin/%
	@mkdir -p $(dir $@)
	@cp $< $@

install-data-hook:
	mkdir -p $(DESTDIR)$(pkgdatadir)/browser; \
	cp -a dist/ $(DESTDIR)$(pkgdatadir)/browser/;

libs:
	@mkdir -p $(abs_srcdir)/libs
	@cd $(abs_srcdir)/libs \
	&& $(call npm_source,$(NODE_MODULES_SRC))

pot:
	xgettext --from-code=UTF-8 --language=JavaScript --keyword=_ --output=po/templates/cool-ui.pot \
		admin/admin.strings.js \
		admin/src/AdminSocketAnalytics.js \
		admin/src/AdminSocketBase.js \
		admin/src/AdminSocketOverview.js \
		admin/src/AdminSocketSettings.js \
		admin/src/Util.js \
		js/w2ui-1.5.rc1.js \
		src/control/ColorPicker.js \
		src/control/Control.AlertDialog.js \
		src/control/Control.Command.js \
		src/control/Control.ContextMenu.js \
		src/control/Control.DocumentNameInput.js \
		src/control/Control.DocumentRepair.js \
		src/control/Control.DownloadProgress.js \
		src/control/Control.FormulaBar.js \
		src/control/Control.FormulaBarJSDialog.js \
		src/control/Control.JSDialogBuilder.js \
		src/control/Control.LanguageDialog.js \
		src/control/Control.Menubar.js \
		src/control/Control.MobileBottomBar.js \
		src/control/Control.MobileTopBar.js \
		src/control/Control.MobileWizardBuilder.js \
		src/control/Control.MobileWizardWindow.js \
		src/control/Control.MobileWizard.js \
		src/control/Control.MobileWizardPopup.js \
		src/control/Control.Notebookbar.js \
		src/control/Control.NotebookbarBuilder.js \
		src/control/Control.NotebookbarCalc.js \
		src/control/Control.NotebookbarDraw.js \
		src/control/Control.NotebookbarImpress.js \
		src/control/Control.NotebookbarWriter.js \
		src/control/Control.PartsPreview.js \
		src/control/Control.PresentationBar.js \
		src/control/Control.Scroll.Annotation.js \
		src/control/Control.SearchBar.js \
		src/control/Control.SheetsBar.js \
		src/control/Control.StatusBar.js \
		src/control/Control.Tabs.js \
		src/control/Control.Toolbar.js \
		src/control/Control.TopToolbar.js \
		src/control/Control.UserList.js \
		src/control/Control.Zotero.js \
		src/control/Parts.js \
		src/control/Permission.js \
		src/control/Ruler.js \
		src/control/Signing.js \
		src/control/Toolbar.js \
		src/core/Socket.js \
		src/errormessages.js \
		src/layer/tile/CanvasTileLayer.js \
		src/layer/tile/CommentListSection.ts \
		src/layer/tile/CommentSection.ts \
		src/main.js \
		src/map/Clipboard.js \
		src/map/Map.js \
		src/map/handler/Map.Feedback.js \
		src/map/handler/Map.FileInserter.js \
		src/map/handler/Map.Keyboard.js \
		src/map/handler/Map.WOPI.js

	html2po --pot --input=html/cool-help.html --output=po/templates/cool-help.pot --duplicates=merge
	html2po --pot --input=welcome/welcome.html --output=po/templates/welcome.pot --duplicates=merge
	$(srcdir)/util/appendwelcome.py po/templates/welcome.pot po/templates/cool-ui.pot
	rm po/templates/welcome.pot
	msguniq -w 78 -t UTF-8 po/templates/cool-ui.pot > po/templates/cool-ui.pot.new; mv po/templates/cool-ui.pot.new po/templates/cool-ui.pot

l10n: pot
	for i in po/ui-*.po; do pot2po --input=po/templates/cool-ui.pot --template=$$i --output=$$i.new; mv $$i.new $$i;done
	for i in po/help-*.po; do pot2po --input=po/templates/cool-help.pot --template=$$i --output=$$i.new; mv $$i.new $$i;done

clean-local:
	@rm -rf $(DIST_FOLDER)
	@rm -rf $(INTERMEDIATE_DIR)
	@rm -rf node_modules
	@rm -f $(abs_srcdir)/jsconfig.json
	@rm -f $(abs_srcdir)/admin/jsconfig.json

CLEANFILES = tscompile.done $(INTERMEDIATE_DIR)/cool-src.js $(DIST_FOLDER)/bundle.css $(DIST_FOLDER)/bundle.js $(INTERMEDIATE_DIR)/cool-src.js

ctags:
	@$(CTAGS) --language-force=JavaScript $(COOL_JS_SRC) $(srcdir)/js/global.js

$(abs_srcdir)/jsconfig.json:
	@printf "{\n \
	\"compilerOptions\" : {},\n \
	\"include\" : [\"src/**/*\", \"js/**/*\"],\n \
	\"exclude\" : [\"node_modules\", \"admin/**/*\"]\n}" > $@

$(abs_srcdir)/admin/jsconfig.json:
	@printf "{\n \
	\"compilerOptions\" : {},\n \
	\"include\" : [\"./**/*\"],\n \
	\"exclude\" : [\"node_modules\"]\n}" > $@

jsconfig: $(abs_srcdir)/jsconfig.json $(abs_srcdir)/admin/jsconfig.json

build-tests: $(MOCHA_TS_JS_FILES)
	@echo "Build of mocha test finished."

MOCHA_TEST_LOG = "`pwd`/mocha.log"
check-local: $(MOCHA_TS_JS_FILES)
	@echo "Running mocha tests..."
	@echo > ${MOCHA_TEST_LOG}
	@if npm test 2> ${MOCHA_TEST_LOG} 1>&2; then \
		echo "Mocha tests finished successfully. Results in ${MOCHA_TEST_LOG}"; \
	else \
		cat ${MOCHA_TEST_LOG}; \
		exit 1; \
	fi

SSL_FLAG = `xmllint --xpath 'string(/config/ssl/enable)' $(abs_top_builddir)/coolwsd.xml`

# the delay (in milliseconds) between each emulated key stroke for each view
typing_speed=100
# The duration of the typing (in milliseconds)
typing_duration=30000
# By default 6 views are spawned in the document.
single_view="false"
# --inspect flag for the first view. Ideally should be used with single_view=true
node_inspect="false"
# Record tile stats and dump it into the file "test/tilestats.txt"
# Pipe it with | grep "tilestats"
record_stats="true"
perf-test:
	@echo "Running perf tests..."
	@mkdir -p $(abs_top_builddir)/test/data
	@if [ ! -f $(abs_top_srcdir)/test/data/perf-test-edit.odt -o "`md5sum <$(abs_top_srcdir)/test/data/perf-test.odt`" != "`md5sum <$(abs_top_srcdir)/test/data/perf-test-edit.odt`" ]; then \
		echo 'Making fresh copy of the perf-test-edit.odt document'; \
		cp $(abs_top_srcdir)/test/data/perf-test.odt $(abs_top_builddir)/test/data/perf-test-edit.odt; \
	fi
	$(NODE) $(abs_srcdir)/test/bootstrap.js $(SSL_FLAG) $(abs_top_builddir) $(abs_srcdir) $(typing_speed) $(single_view) $(typing_duration) $(node_inspect) ${record_stats}
# for now - unwinding ts and js deps for different targets is a real pain.
.NOTPARALLEL:

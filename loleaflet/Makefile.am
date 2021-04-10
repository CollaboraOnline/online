MAKEFLAGS = --no-builtin-rules
CTAGS = ctags

L10N_PO = $(wildcard $(srcdir)/po/*.po)
BUNDLE ?= $(if $(filter true,$(ENABLE_DEBUG)),DEBUG,RELEASE)
IS_DEBUG = $(if $(filter DEBUG,$(BUNDLE)),true,)

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

DIRECTORY_TS = $(srcdir)/src/layer/tile $(srcdir)/src/control # Add ts directories here.
SRC_TS_ALL := $(foreach dir, $(DIRECTORY_TS), $(wildcard $(dir)/*.ts))
SRC_TS_JS_FILES := $(SRC_TS_ALL:.ts=.js)

$(SRC_TS_ALL:.ts=.js): $(SRC_TS_ALL:.ts=.ts)
	$(builddir)/node_modules/typescript/bin/tsc $(@:.js=.ts) --outfile $@ --module none --lib dom,es2016 --target ES5

MOCHA_DIR = $(srcdir)/mocha_tests
MOCHA_TS_FILES = $(wildcard $(MOCHA_DIR)/*.ts)
MOCHA_TS_JS_FILES := $(MOCHA_TS_FILES:.ts=.js)
$(MOCHA_TS_JS_FILES): %.js: %.ts
	$(builddir)/node_modules/typescript/bin/tsc $< --outfile $@ --module none --lib dom,es2016 --target ES5

SRC_TS = $(srcdir)/src/layer/vector/CanvasOverlay.ts
SRC_TS_JS = $(srcdir)/src/layer/vector/CanvasOverlay.js
SRC_TS_JS_DST = $(patsubst $(srcdir)/%.js,$(DIST_FOLDER)/%.js,$(SRC_TS_JS_FILES)) $(DIST_FOLDER)/src/layer/vector/CanvasOverlay.js

$(srcdir)/src/layer/vector/CanvasOverlay.js: $(srcdir)/src/layer/vector/*.ts $(srcdir)/src/layer/marker/*.ts
	$(builddir)/node_modules/typescript/bin/tsc $(srcdir)/src/layer/vector/CanvasOverlay.ts --outfile $(srcdir)/src/layer/vector/CanvasOverlay.js --module none --lib dom,es2016 --target ES5

JQUERY_LIGHTNESS_IMAGE_PATH = $(srcdir)/images/jquery-ui-lightness
JQUERY_LIGHTNESS_IMAGES = $(wildcard $(JQUERY_LIGHTNESS_IMAGE_PATH)/*.png)
JQUERY_LIGHTNESS_DIST_IMAGES = $(patsubst $(JQUERY_LIGHTNESS_IMAGE_PATH)/%.png,$(DIST_FOLDER)/images/%.png,$(JQUERY_LIGHTNESS_IMAGES))

JQUERY_MINIFIED_IMAGE_PATH = node_modules/jquery-ui-dist/images
JQUERY_MINIFIED_IMAGES = $(wildcard $(JQUERY_MINIFIED_IMAGE_PATH)/*.png)
JQUERY_MINIFIED_DIST_IMAGES = $(patsubst $(JQUERY_MINIFIED_IMAGE_PATH)/%.png,$(DIST_FOLDER)/images/%.png,$(JQUERY_MINIFIED_IMAGES))

LOLEAFLET_IMAGES_SRC = $(shell find $(srcdir)/images -name '*.*')
LOLEAFLET_IMAGES_DST = $(patsubst $(srcdir)/%,$(DIST_FOLDER)/%,$(LOLEAFLET_IMAGES_SRC))
LOLEAFLET_IMAGES_CUSTOM_SRC = $(shell find $(CUSTOM_ICONS_DIRECTORY) -name '*.*')
LOLEAFLET_IMAGES_CUSTOM_DST = $(patsubst $(CUSTOM_ICONS_DIRECTORY)/%,$(DIST_FOLDER)/images/%,$(LOLEAFLET_IMAGES_CUSTOM_SRC))

LOLEAFLET_L10N_SRC = $(shell find $(srcdir)/l10n -name '*.*')
if !ENABLE_MOBILEAPP
LOLEAFLET_L10N_DST =  $(patsubst $(srcdir)/l10n/%,$(DIST_FOLDER)/l10n/%,$(LOLEAFLET_L10N_SRC))
endif

LOLEAFLET_HTML_SRC = $(shell find $(srcdir)/html -name '*.html')
LOLEAFLET_HTML_DST = $(patsubst $(srcdir)/html/%.html,$(DIST_FOLDER)/%.html,$(LOLEAFLET_HTML_SRC))

LOLEAFLET_WELCOME_SRC = $(shell find $(srcdir)/welcome -name '*.html')
LOLEAFLET_WELCOME_DST = $(patsubst $(srcdir)/welcome/%.html,$(DIST_FOLDER)/welcome/%.html,$(LOLEAFLET_WELCOME_SRC))

LOLEAFLET_ADMIN_SRC = $(shell find $(srcdir)/admin -name '*.html' -or -name '*.css' -or -name '*.ttf' -or -name 'OFL.txt' -or -name '*.svg')
LOLEAFLET_ADMIN_ALL = $(shell find $(srcdir)/admin -name '*')
LOLEAFLET_ADMIN_DST = $(patsubst $(srcdir)/admin/%,$(DIST_FOLDER)/admin/%,$(LOLEAFLET_ADMIN_SRC))

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

LOLEAFLET_ADMIN_TS =\
	admin/src/ModalDialogCreator.ts

LOLEAFLET_ADMIN_TS_JS = $(patsubst %.ts,$(TYPESCRIPT_JS_DIR)/%.js,$(LOLEAFLET_ADMIN_TS))

LOLEAFLET_ADMIN_JS =\
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
	@braintree/sanitize-url@4.0.1

LOLEAFLET_CSS =\
	$(builddir)/node_modules/select2/dist/css/select2.css \
	$(srcdir)/css/w2ui-1.5.rc1.css \
	$(srcdir)/css/leaflet.css \
	$(srcdir)/css/leaflet-spinner.css \
	$(srcdir)/css/selectionMarkers.css \
	$(srcdir)/css/loleaflet.css \
	$(srcdir)/css/toolbar.css \
	$(srcdir)/css/toolbar-mobile.css \
	$(srcdir)/css/partsPreviewControl.css \
	$(srcdir)/css/sidebar.css \
	$(srcdir)/css/searchControl.css \
	$(srcdir)/css/impress.css \
	$(srcdir)/css/impress-mobile.css \
	$(srcdir)/css/spreadsheet.css \
	$(srcdir)/css/writer.css \
	$(srcdir)/css/writer-mobile.css \
	$(srcdir)/css/editor.css \
	$(builddir)/node_modules/jquery-contextmenu/dist/jquery.contextMenu.css \
	$(builddir)/node_modules/vex-js/dist/css/vex.css \
	$(builddir)/node_modules/vex-js/dist/css/vex-theme-plain.css \
	$(builddir)/node_modules/vex-js/dist/css/vex-theme-bottom-right-corner.css \
	$(builddir)/node_modules/smartmenus/dist/css/sm-core-css.css \
	$(builddir)/node_modules/smartmenus/dist/css/sm-simple/sm-simple.css \
	$(srcdir)/css/menubar.css \
	$(srcdir)/css/mobilewizard.css \
	$(srcdir)/css/jsdialogs.css \
	$(srcdir)/css/btns.css \
	$(srcdir)/css/notebookbar.css \
	$(srcdir)/css/override-vex.css \
	$(srcdir)/css/jquery-ui-lightness.css

LOLEAFLET_CSS_DST = $(foreach file,$(LOLEAFLET_CSS),$(DIST_FOLDER)/$(notdir $(file)))
LOLEAFLET_CSS_M4 = $(strip $(foreach file,$(LOLEAFLET_CSS),$(notdir $(file))))

$(eval $(call file_targets,$(LOLEAFLET_CSS)))

NODE_MODULES_JS =\
	$(if $(IS_DEBUG),node_modules/hammerjs/hammer.js,node_modules/hammerjs/hammer.min.js) \
	node_modules/jquery/dist/jquery.js \
	node_modules/jquery-mousewheel/jquery.mousewheel.js \
	node_modules/jquery-contextmenu/dist/jquery.contextMenu.js \
	node_modules/jquery-ui-dist/jquery-ui.js \
	node_modules/smartmenus/dist/jquery.smartmenus.js

LOLEAFLET_LIBS_JS =\
	Autolinker.js \
	json2.js \
	select2.js \
	vex.combined.js \
	sanitize-url.js

if !ENABLE_MOBILEAPP
LOLEAFLET_LIBS_JS +=\
	l10n.js
endif

LOLEAFLET_LIBS_JS +=\
	w2ui-1.5.rc1.js

NODE_MODULES_JS_SRC = $(patsubst %.js,$(builddir)/%.js,$(NODE_MODULES_JS))
NODE_MODULES_JS_DST = $(patsubst %.js,$(DIST_FOLDER)/%.js,$(NODE_MODULES_JS))

LOLEAFLET_LIBS_JS_SRC = $(patsubst %.js,$(srcdir)/js/%.js,$(LOLEAFLET_LIBS_JS))
LOLEAFLET_LIBS_JS_DST = $(patsubst %.js,$(DIST_FOLDER)/%.js,$(LOLEAFLET_LIBS_JS))

LOLEAFLET_JS =\
	src/Leaflet.js \
	src/errormessages.js \
	src/unocommands.js \
	src/viamapi-client.js \
	src/core/Log.js \
	src/core/Util.js \
	src/core/LOUtil.js \
	src/core/Class.js \
	src/core/Events.js \
	src/core/Socket.js \
	src/core/Matrix.js \
	src/geometry/Point.js \
	src/geometry/Bounds.js \
	src/geometry/Transformation.js \
	src/dom/DomUtil.js src/geo/LatLng.js \
	src/geo/LatLngBounds.js \
	src/geo/projection/Projection.LonLat.js \
	src/geo/crs/CRS.js \
	src/geo/crs/CRS.Simple.js \
	src/map/Map.js \
	src/map/Clipboard.js \
	src/layer/Layer.js \
	src/layer/tile/CanvasSectionProps.js \
	src/layer/tile/CanvasSectionContainer.js \
	src/layer/tile/TilesSection.js \
	src/layer/tile/ScrollSection.js \
	src/layer/vector/CanvasOverlay.js \
	src/layer/tile/GridLayer.js \
	src/layer/tile/TileLayer.js \
	src/layer/tile/CanvasTileLayer.js \
	src/layer/SplitPanesContext.js \
	src/layer/tile/TileLayer.TableOverlay.js \
	src/layer/ObjectFocusDarkOverlay.js \
	src/layer/tile/WriterTileLayer.js \
	src/layer/tile/ImpressTileLayer.js \
	src/layer/tile/CalcTileLayer.js \
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
	src/layer/CalcGridLines.js \
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
	src/map/handler/Map.BoxZoom.js \
	src/map/handler/Map.Keyboard.js \
	src/dom/DomEvent.MultiClick.js \
	src/map/handler/Map.Mouse.js \
	src/map/handler/Map.Print.js \
	src/map/handler/Map.SlideShow.js \
	src/map/handler/Map.FileInserter.js \
	src/map/handler/Map.StateChanges.js \
	src/map/handler/Map.WOPI.js \
	src/layer/marker/Marker.Drag.js \
	src/control/Control.Toolbar.js \
	src/control/Control.js \
	src/control/Control.PartsPreview.js \
	src/control/Control.GroupBase.js \
	src/control/Control.CornerGroup.js \
	src/control/Control.RowGroup.js \
	src/control/Control.ColumnGroup.js \
	src/control/Control.CornerHeader.js \
	src/control/Control.Header.js \
	src/control/Control.ColumnHeader.js \
	src/control/Control.RowHeader.js \
	src/control/Control.DocumentRepair.js \
	src/control/Control.DownloadProgress.js \
	src/control/Control.ContextMenu.js \
	src/control/Control.Menubar.js \
	src/control/Control.Tabs.js \
	src/control/Control.Permission.js \
	src/control/Control.Selection.js \
	src/control/Control.LokDialog.js \
	src/control/Control.AlertDialog.js \
	src/control/Control.Infobar.js src/control/ColorPicker.js \
	src/control/Control.JSDialog.js \
	src/control/Control.JSDialogBuilder.js \
	src/control/Control.MobileWizardBuilder.js \
	src/control/Control.MobileWizard.js \
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
	src/control/Control.AutofilterDropdown.js \
	src/control/Control.Layers.js \
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
	src/layer/AnnotationManagerBase.js \
	src/layer/AnnotationManager.js \
	src/layer/AnnotationManagerImpress.js \
	src/control/Control.Scroll.Annotation.js \
	src/layer/marker/Annotation.js \
	src/layer/marker/DivOverlay.js \
	src/main.js

LOLEAFLET_JS_SRC = $(shell find $(srcdir)/src -name '*.js')
LOLEAFLET_JS_DST = $(patsubst $(srcdir)/src/%.js,$(DIST_FOLDER)/src/%.js,$(LOLEAFLET_JS_SRC))

COMMA := ,
EMPTY :=
SPACE := $(EMPTY) $(EMPTY)
LOLEAFLET_VERSION = $(shell cd $(srcdir) && git log -1 --pretty=format:"%h")
INTERMEDIATE_DIR ?= $(if $(IS_DEBUG),$(abs_builddir)/debug,$(abs_builddir)/release)

EXTRA_DIST = $(shell find . -type f -not -path './.git/*' | sed 's/.\///')

define bundle_loleaflet
	$(if $(IS_DEBUG),\
		@touch $@,
		@m4 -PE -DIOSAPP=$(ENABLE_IOSAPP) \
			-DGTKAPP=$(ENABLE_GTKAPP) \
			-DANDROIDAPP=$(ENABLE_ANDROIDAPP) \
			-DMOBILEAPPNAME="$(APP_NAME)" \
			-DVERSION=$(LOLEAFLET_VERSION) \
			-DCOPYRIGHT=$(srcdir)/src/copyright.js \
			-DLOLEAFLET_JS=$(subst $(SPACE),$(COMMA),$(patsubst %.js,$(srcdir)/%.js,$(LOLEAFLET_JS))) \
			$(srcdir)/loleaflet-src.js.m4 > $@)
endef

define prereq_loleaflet
	$(if $(IS_DEBUG),$(LOLEAFLET_JS_DST),$(LOLEAFLET_JS_SRC))
endef

define bundle_css
	$(if $(IS_DEBUG),\
		@touch $@,\
		@echo "Uglify loleaflet css files..."
		@$(NODE) node_modules/uglifycss/uglifycss $(LOLEAFLET_CSS) > $@)
endef

define prereq_css
	$(if $(IS_DEBUG),$(LOLEAFLET_CSS_DST),$(LOLEAFLET_CSS))
endef

define bundle_all
	$(if $(IS_DEBUG),\
		@touch $@,\
		@echo "Uglify loleaflet js files..."
		@m4 -PE -DL10N_IOS_ALL_JS=$(L10N_IOS_ALL_JS) \
			-DNODE_MODULES_JS=$(subst $(SPACE),$(COMMA),$(NODE_MODULES_JS)) \
			-DLOLEAFLET_LIBS_JS=$(subst $(SPACE),$(COMMA),$(LOLEAFLET_LIBS_JS_SRC)) \
			-DLOLEAFLET_JS=$(INTERMEDIATE_DIR)/loleaflet-src.js \
			$(srcdir)/bundle.js.m4 > $(INTERMEDIATE_DIR)/bundle.js
		@$(NODE) node_modules/uglify-js/bin/uglifyjs \
			$(INTERMEDIATE_DIR)/bundle.js \
			--output $@)
endef

define prereq_all
	$(if $(IS_DEBUG),$(NODE_MODULES_JS_DST) $(LOLEAFLET_LIBS_JS_DST),\
		$(NODE_MODULES_JS_SRC) $(LOLEAFLET_LIBS_JS_SRC))
endef

define global_file
	$(if $(IS_DEBUG),
		@cp $< $@,
		@echo "Uglify global.js file..."
		@$(NODE) node_modules/uglify-js/bin/uglifyjs $< --output $@)
endef

.PHONY: build-loleaflet

all-local: build-loleaflet

if !ENABLE_MOBILEAPP
ADMIN_BUNDLE = $(DIST_FOLDER)/admin-bundle.js
endif

$(TYPESCRIPT_JS_DIR)/%.js: $(srcdir)/%.ts
	@mkdir -p $(dir $@)
	$(builddir)/node_modules/typescript/bin/tsc --outFile $@ $<

build-loleaflet: \
	$(LOLEAFLET_L10N_DST) \
	$(L10N_JSON) \
	$(SRC_TS_JS_DST) \
	$(LOLEAFLET_IMAGES_DST) \
	$(LOLEAFLET_IMAGES_CUSTOM_DST) \
	$(JQUERY_LIGHTNESS_DIST_IMAGES) \
	$(JQUERY_MINIFIED_DIST_IMAGES) \
	$(ADMIN_BUNDLE) \
	$(DIST_FOLDER)/bundle.css \
	$(DIST_FOLDER)/device-mobile.css \
	$(DIST_FOLDER)/device-tablet.css \
	$(DIST_FOLDER)/device-desktop.css \
	$(DIST_FOLDER)/bundle.js \
	$(DIST_FOLDER)/loleaflet.html
	@echo "build loleaflet completed"
if ENABLE_ANDROIDAPP
	@if test -d "$(APP_BRANDING_DIR)" ; then cp -a "$(APP_BRANDING_DIR)/branding.css" "$(APP_BRANDING_DIR)/branding.js" $(DIST_FOLDER)/ ; else touch $(DIST_FOLDER)/branding.css ; fi
	@if test -d "$(APP_BRANDING_DIR)" ; then cp -a "$(APP_BRANDING_DIR)"/images/*.svg $(DIST_FOLDER)/images/ ; fi
	@if test -d "$(APP_BRANDING_DIR)" ; then cp -a "$(APP_BRANDING_DIR)/images/toolbar-bg-logo.svg" $(DIST_FOLDER)/images/toolbar-bg.svg ; fi
	@echo
	@echo "JS, HTML and CSS has been updated (android/lib/src/main/assets/dist)."
endif

$(DIST_FOLDER)/admin-bundle.js: $(LOLEAFLET_ADMIN_DST) \
	$(INTERMEDIATE_DIR)/admin-src.js
	@NODE_PATH=$(abs_builddir)/node_modules:$(INTERMEDIATE_DIR) $(NODE) node_modules/browserify/bin/cmd.js -g browserify-css $(if $(IS_DEBUG),--debug,-g uglifyify) -o $@ $(srcdir)/admin/main-admin.js

$(INTERMEDIATE_DIR)/admin-src.js: $(LOLEAFLET_ADMIN_TS_JS) $(LOLEAFLET_ADMIN_JS)
	@mkdir -p $(dir $@)
	@echo "Checking for admin JS errors..."
	@$(NODE) node_modules/eslint/bin/eslint.js $(srcdir)/admin/src --ignore-path $(srcdir)/.eslintignore --config $(srcdir)/.eslintrc
	@awk 'FNR == 1 {print ""} 1' $(LOLEAFLET_ADMIN_TS_JS) $(patsubst %.js,$(srcdir)/%.js,$(LOLEAFLET_ADMIN_JS)) > $@

$(INTERMEDIATE_DIR)/loleaflet-src.js: $(call prereq_loleaflet)
	@mkdir -p $(dir $@)
	$(abs_top_srcdir)/scripts/unocommands.py --check $(abs_top_srcdir)
	@echo "Checking for loleaflet JS errors..."
	@$(NODE) node_modules/eslint/bin/eslint.js $(srcdir)/src \
		$(srcdir)/js --ignore-path $(srcdir)/.eslintignore --config $(srcdir)/.eslintrc
	$(call bundle_loleaflet)

$(DIST_FOLDER)/bundle.css: $(call prereq_css)
	@mkdir -p $(dir $@)
	@echo "Checking for CSS errors..."
	@$(NODE) node_modules/stylelint/bin/stylelint.js --config $(srcdir)/.stylelintrc.json $(srcdir)/css/*.css
	$(call bundle_css)

$(DIST_FOLDER)/bundle.js: $(INTERMEDIATE_DIR)/loleaflet-src.js $(call prereq_all)
	@mkdir -p $(dir $@)
	$(call bundle_all)

$(DIST_FOLDER)/global.js: $(srcdir)/js/global.js
	@mkdir -p $(dir $@)
	$(call global_file)

$(DIST_FOLDER)/loleaflet.html: $(srcdir)/html/loleaflet.html.m4 \
	$(LOLEAFLET_HTML_DST) \
	$(LOLEAFLET_WELCOME_DST) \
	$(DIST_FOLDER)/bundle.css \
	$(DIST_FOLDER)/global.js \
	$(DIST_FOLDER)/bundle.js
	@echo "Generating loleaflet.html..."
	@m4 -PE -DDEBUG=$(IS_DEBUG) \
		-DIOSAPP=$(ENABLE_IOSAPP) \
		-DGTKAPP=$(ENABLE_GTKAPP) \
		-DANDROIDAPP=$(ENABLE_ANDROIDAPP) \
		-DMOBILEAPPNAME="$(APP_NAME)" \
		-DLOLEAFLET_CSS="$(subst $(SPACE),$(COMMA),$(LOLEAFLET_CSS_M4))" \
		-DGLOBAL_JS="$(DIST_FOLDER)/global.js" \
		-DLOLEAFLET_JS="$(subst $(SPACE),$(COMMA),$(NODE_MODULES_JS) \
		$(LOLEAFLET_LIBS_JS) \
		$(LOLEAFLET_JS))" \
		-DVENDOR="$(VENDOR)" \
		$(srcdir)/html/loleaflet.html.m4 > $@

node_modules: package.json archived-packages
	@npm install
	@touch node_modules

Makefile: $(srcdir)/Makefile.in $(top_builddir)/config.status node_modules
	@case '$?' in \
	 *config.status*) \
	  cd $(top_builddir) && $(MAKE) $(AM_MAKEFLAGS) am--refresh;; \
	 *) \
	  cd $(top_builddir) && $(SHELL) ./config.status $(subdir)/$@;; \
	esac;

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

$(DIST_FOLDER)/welcome/%.html: $(srcdir)/welcome/%.html
	@mkdir -p $(dir $@)
	@if test -z '$(ENABLE_BROWSERSYNC)'; then \
		`cp $< $@`; \
	else \
		`ln -sf $(abs_srcdir)/$< $@`; \
	fi

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
	mkdir -p $(DESTDIR)$(pkgdatadir)/loleaflet; \
	cp -ar dist/ $(DESTDIR)$(pkgdatadir)/loleaflet/;

libs:
	@mkdir -p $(abs_srcdir)/libs
	@cd $(abs_srcdir)/libs \
	&& $(call npm_source,$(NODE_MODULES_SRC))

pot:
	xgettext --from-code=UTF-8 --keyword=_ --output=po/templates/loleaflet-ui.pot \
		admin/admin.strings.js \
		admin/src/AdminSocketAnalytics.js \
		admin/src/AdminSocketBase.js \
		admin/src/AdminSocketOverview.js \
		admin/src/AdminSocketSettings.js \
		admin/src/Util.js \
		src/control/ColorPicker.js \
		src/control/Control.AlertDialog.js \
		src/control/Control.ContextMenu.js \
		src/control/Control.DocumentRepair.js \
		src/control/Control.DownloadProgress.js \
		src/control/Control.FormulaBar.js \
		src/control/Control.JSDialog.js \
		src/control/Control.MobileWizardBuilder.js \
		src/control/Control.JSDialogBuilder.js \
		src/control/Control.LanguageDialog.js \
		src/control/Control.Menubar.js \
		src/control/Control.MobileBottomBar.js \
		src/control/Control.MobileTopBar.js \
		src/control/Control.MobileWizard.js \
		src/control/Control.PresentationBar.js \
		src/control/Control.Scroll.Annotation.js \
		src/control/Control.SearchBar.js \
		src/control/Control.SheetsBar.js \
		src/control/Control.SigningBar.js \
		src/control/Control.StatusBar.js \
		src/control/Control.Tabs.js \
		src/control/Control.Toolbar.js \
		src/control/Control.TopToolbar.js \
		src/control/Control.UserList.js \
		src/control/Control.UIManager.js \
		src/control/Control.DocumentNameInput.js \
		src/control/Control.Notebookbar.js \
		src/control/Control.NotebookbarWriter.js \
		src/control/Control.NotebookbarCalc.js \
		src/control/Control.NotebookbarImpress.js \
		src/control/Control.NotebookbarDraw.js \
		src/control/Control.NotebookbarBuilder.js \
		src/control/Control.AutofilterDropdown.js \
		src/control/Parts.js \
		src/control/Permission.js \
		src/control/Ruler.js \
		src/control/Signing.js \
		src/control/Toolbar.js \
		src/core/Socket.js \
		src/errormessages.js \
		src/layer/marker/Annotation.js \
		src/layer/marker/TextInput.js \
		src/layer/tile/CalcTileLayer.js \
		src/layer/tile/CanvasTileLayer.js \
		src/layer/tile/ImpressTileLayer.js \
		src/layer/tile/TileLayer.js \
		src/layer/tile/WriterTileLayer.js \
		src/map/Clipboard.js \
		src/map/Map.js \
		src/map/handler/Map.FileInserter.js \
		src/map/handler/Map.WOPI.js

	html2po --pot --input=html/loleaflet-help.html --output=po/templates/loleaflet-help.pot --duplicates=merge

	html2po --pot --input=descriptions/google-play.html --output=po/templates/descriptions.pot --duplicates=merge --keepcomments

l10n: pot
	for i in po/ui-*.po; do pot2po --input=po/templates/loleaflet-ui.pot --template=$$i --output=$$i.new; mv $$i.new $$i;done
	for i in po/help-*.po; do pot2po --input=po/templates/loleaflet-help.pot --template=$$i --output=$$i.new; mv $$i.new $$i;done

clean-local:
	@rm -rf $(DIST_FOLDER)
	@rm -rf $(INTERMEDIATE_DIR)
	@rm -rf node_modules
	@rm -f $(abs_srcdir)/jsconfig.json
	@rm -f $(abs_srcdir)/admin/jsconfig.json

CLEANFILES = tscompile.done $(INTERMEDIATE_DIR)/loleaflet-src.js $(DIST_FOLDER)/bundle.css $(DIST_FOLDER)/bundle.js $(INTERMEDIATE_DIR)/loleaflet-src.js

ctags:
	@$(CTAGS) --language-force=JavaScript $(LOLEAFLET_JS_SRC) $(srcdir)/js/global.js

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

check: $(MOCHA_TS_JS_FILES)
	@echo "Running mocha tests..."
	npm test

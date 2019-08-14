# Version number of the bundled 'draw' thing
DRAW_VERSION=0.2.4

L10N_PO = $(wildcard $(srcdir)/po/*.po)

if !ENABLE_MOBILEAPP
L10N_JSON = $(patsubst $(srcdir)/po/%.po,$(builddir)/dist/l10n/%.json,$(L10N_PO))
endif

if ENABLE_IOSAPP
L10N_IOS_ALL_JS = $(builddir)/dist/l10n-all.js
L10N_JSON = $(L10N_IOS_ALL_JS)

$(L10N_IOS_ALL_JS) : $(wildcard $(srcdir)/po/ui-*.po) $(shell find $(srcdir)/l10n -name '*.*')
	for F in $(wildcard $(srcdir)/po/ui-*.po); do \
		$(srcdir)/util/po2json.py $$F -o $$F.json; \
	done
	@mkdir -p $(dir $@)
	perl $(srcdir)/util/create-l10n-all-js.pl >$@
	for F in $(wildcard $(srcdir)/po/ui-*.po); do \
		rm $$F.json; \
	done
endif

JQUERY_LIGHTNESS_IMAGE_PATH = node_modules/jquery-ui/themes/ui-lightness/images
JQUERY_LIGHTNESS_IMAGES = $(wildcard $(JQUERY_LIGHTNESS_IMAGE_PATH)/*.png)
JQUERY_LIGHTNESS_DIST_IMAGES = $(patsubst $(JQUERY_LIGHTNESS_IMAGE_PATH)/%.png,$(builddir)/dist/images/%.png,$(JQUERY_LIGHTNESS_IMAGES))

JQUERY_MINIFIED_IMAGE_PATH = node_modules/jquery-ui/themes/base/minified/images
JQUERY_MINIFIED_IMAGES = $(wildcard $(JQUERY_MINIFIED_IMAGE_PATH)/*.png)
JQUERY_MINIFIED_DIST_IMAGES = $(patsubst $(JQUERY_MINIFIED_IMAGE_PATH)/%.png,$(builddir)/dist/images/%.png,$(JQUERY_MINIFIED_IMAGES))

LOLEAFLET_IMAGES_SRC = $(shell find $(srcdir)/images -name '*.*')
LOLEAFLET_IMAGES_DST = $(patsubst $(srcdir)/%,$(builddir)/dist/%,$(LOLEAFLET_IMAGES_SRC))

LOLEAFLET_L10N_SRC = $(shell find $(srcdir)/l10n -name '*.*')
if !ENABLE_IOSAPP
LOLEAFLET_L10N_DST =  $(patsubst $(srcdir)/l10n/%,$(builddir)/dist/l10n/%,$(LOLEAFLET_L10N_SRC))
endif

LOLEAFLET_DRAW_JS_SRC = $(shell find $(srcdir)/plugins/draw-$(DRAW_VERSION)/src -name '*.js')
LOLEAFLET_DRAW_JS_DST = $(patsubst $(srcdir)/plugins/%.js,$(builddir)/dist/plugins/%.js,$(LOLEAFLET_DRAW_JS_SRC))

LOLEAFLET_PATH_JS_SRC = $(shell find $(srcdir)/plugins/path-transform/src -name '*.js')
LOLEAFLET_PATH_JS_DST = $(patsubst $(srcdir)/plugins/%.js,$(builddir)/dist/plugins/%.js,$(LOLEAFLET_PATH_JS_SRC))

LOLEAFLET_DRAW_CSS_SRC = $(shell find $(srcdir)/plugins/draw-$(DRAW_VERSION)/dist -name '*.css')

LOLEAFLET_HTML_SRC = $(shell find $(srcdir)/html -name '*.html')
LOLEAFLET_HTML_DST = $(patsubst $(srcdir)/html/%.html,$(builddir)/dist/%.html,$(LOLEAFLET_HTML_SRC))

LOLEAFLET_ADMIN_SRC = $(shell find $(srcdir)/admin -name '*.html')
LOLEAFLET_ADMIN_ALL = $(shell find $(srcdir)/admin -name '*')
LOLEAFLET_ADMIN_DST = $(patsubst $(srcdir)/admin/%,$(builddir)/dist/admin/%,$(LOLEAFLET_ADMIN_SRC))

define file_target
$(1): $(2)
	@cp $$< $$@

endef

define file_targets
$(foreach file,$(1),$(call file_target,\
	$(builddir)/dist/$(notdir $(file)),\
	$(file)))
endef

LOLEAFLET_CSS =\
	$(builddir)/node_modules/select2/dist/css/select2.css \
	$(srcdir)/css/w2ui-1.5.rc1.css \
	$(srcdir)/css/leaflet.css \
	$(srcdir)/css/selectionMarkers.css \
	$(srcdir)/css/loleaflet.css \
	$(srcdir)/css/toolbar.css \
	$(srcdir)/css/partsPreviewControl.css \
	$(srcdir)/css/sidebar.css \
	$(srcdir)/css/scrollBar.css \
	$(srcdir)/css/searchControl.css \
	$(srcdir)/css/spreadsheet.css \
	$(srcdir)/css/editor.css \
	$(srcdir)/css/jquery.mCustomScrollbar.css \
	$(srcdir)/plugins/draw-$(DRAW_VERSION)/dist/leaflet.draw.css \
	$(builddir)/node_modules/jquery-contextmenu/dist/jquery.contextMenu.css \
	$(builddir)/node_modules/vex-js/css/vex.css \
	$(builddir)/node_modules/vex-js/css/vex-theme-plain.css \
	$(builddir)/node_modules/vex-js/css/vex-theme-bottom-right-corner.css \
	$(builddir)/node_modules/smartmenus/dist/css/sm-core-css.css \
	$(builddir)/node_modules/smartmenus/dist/css/sm-simple/sm-simple.css \
	$(srcdir)/css/menubar.css \
	$(builddir)/node_modules/jquery-ui/themes/ui-lightness/jquery-ui.css

LOLEAFLET_CSS_DST = $(foreach file,$(LOLEAFLET_CSS),$(builddir)/dist/$(notdir $(file)))
LOLEAFLET_CSS_M4 = $(strip $(foreach file,$(LOLEAFLET_CSS),$(notdir $(file))))

$(eval $(call file_targets,$(LOLEAFLET_CSS)))

NODE_MODULES_JS =\
	node_modules/hammerjs/hammer.min.js \
	node_modules/jquery/dist/jquery.js \
	node_modules/jquery-mousewheel/jquery.mousewheel.js \
	node_modules/jquery-contextmenu/dist/jquery.contextMenu.js \
	node_modules/jquery-ui/jquery-ui.js \
	node_modules/smartmenus/dist/jquery.smartmenus.js \
	node_modules/timeago/jquery.timeago.js \
	node_modules/timeago.js/dist/timeago.min.js \
	node_modules/timeago.js/dist/timeago.locales.min.js \
	node_modules/autolinker/dist/Autolinker.js \
	node_modules/json-js/json2.js \
	node_modules/select2/dist/js/select2.js \
	node_modules/vex-js/js/vex.js \
	node_modules/vex-js/js/vex.dialog.js \
	node_modules/@braintree/sanitize-url/dist.js

if !ENABLE_MOBILEAPP
NODE_MODULES_JS +=\
	node_modules/l10n-for-node/l10n.js
endif

NODE_MODULES_JS_SRC = $(patsubst %.js,$(builddir)/%.js,$(NODE_MODULES_JS))
NODE_MODULES_JS_DST = $(patsubst %.js,$(builddir)/dist/%.js,$(NODE_MODULES_JS))

LOLEAFLET_JS = $(strip $(shell NODE_PATH=$(abs_builddir)/node_modules $(NODE) -e "try {console.log(require('$(1)').getFiles().join(' '))} catch(e) {}"))
LOPLUGIN_JS = $(strip $(shell NODE_PATH=$(abs_builddir)/node_modules $(NODE) -e "try {console.log(require('$(1)').deps.join(' '))} catch(e) {}"))

PLUGINS_JS =\
	jquery.mCustomScrollbar.js \
	w2ui-1.5.rc1.js \
	toolbar.js \
	main.js

PLUGINS_JS_SRC = $(shell find $(srcdir)/js -name '*.js')
PLUGINS_JS_DST = $(patsubst $(srcdir)/js/%.js,$(builddir)/dist/%.js,$(PLUGINS_JS_SRC))

LOLEAFLET_JS_SRC = $(shell find $(srcdir)/src -name '*.js')
LOLEAFLET_JS_DST = $(patsubst $(srcdir)/src/%.js,$(builddir)/dist/src/%.js,$(LOLEAFLET_JS_SRC))

COMMA := ,
EMPTY :=
SPACE := $(EMPTY) $(EMPTY)
LOLEAFLET_VERSION = $(shell cd $(srcdir) && git log -1 --pretty=format:"%h")
LOLEAFLET_PREFIX := $(if $(ENABLE_DEBUG),$(abs_builddir),$(abs_builddir)/build)

EXTRA_DIST = $(shell find . -type f -not -path './.git/*' | sed 's/.\///')

all-local:
	$(abs_top_srcdir)/scripts/unocommands.py --check $(abs_top_srcdir)
	@$(MAKE) node_modules
	@$(MAKE) build-loleaflet

if !ENABLE_MOBILEAPP
ADMIN_BUNDLE = $(builddir)/dist/admin-bundle.js
endif

build-loleaflet: | $(LOLEAFLET_L10N_DST) \
	$(L10N_JSON) \
	$(LOLEAFLET_IMAGES_DST) \
	$(JQUERY_LIGHTNESS_DIST_IMAGES) \
	$(JQUERY_MINIFIED_DIST_IMAGES) \
	$(LOLEAFLET_PREFIX)/dist/loleaflet-src.js \
	$(ADMIN_BUNDLE) \
	$(builddir)/dist/bundle.css \
	$(builddir)/dist/bundle.js \
	$(builddir)/dist/loleaflet.html
	@echo "build loleaflet completed"
if ENABLE_ANDROIDAPP
	@rm -rf $(abs_top_srcdir)/android/lib/src/main/assets/dist
	@cp -a $(builddir)/dist $(abs_top_srcdir)/android/lib/src/main/assets/
	@if test -d "$(APP_BRANDING_DIR)" ; then cp -a "$(APP_BRANDING_DIR)/branding.css" "$(APP_BRANDING_DIR)/branding.js" $(abs_top_srcdir)/android/lib/src/main/assets/dist/ ; else touch $(abs_top_srcdir)/android/lib/src/main/assets/dist/branding.css ; fi
	@if test -d "$(APP_BRANDING_DIR)" ; then cp -a "$(APP_BRANDING_DIR)"/*.svg $(abs_top_srcdir)/android/lib/src/main/assets/dist/images/ ; fi
	@if test -d "$(APP_BRANDING_DIR)" ; then cp -a "$(APP_BRANDING_DIR)/toolbar-bg-logo.svg" $(abs_top_srcdir)/android/lib/src/main/assets/dist/images/toolbar-bg.svg ; fi
	@echo
	@echo "Copied JS, HTML and CSS to the Android project (android/lib/src/main/assets/dist)."
	@echo
	@echo "  Now you need to build the actual .apk from Android Studio:"
	@echo "  Just open the 'android' subdir as a project there and build."
	@echo
endif

$(builddir)/dist/admin-bundle.js: $(LOLEAFLET_ADMIN_DST) \
	$(LOLEAFLET_PREFIX)/dist/admin-src.js
	@NODE_PATH=$(abs_builddir)/node_modules:$(LOLEAFLET_PREFIX)/dist $(NODE) node_modules/browserify/bin/cmd.js -g browserify-css $(if $(ENABLE_DEBUG),--debug,-g uglifyify) -o $@ $(srcdir)/admin/main-admin.js

$(LOLEAFLET_PREFIX)/dist/admin-src.js: $(LOLEAFLET_ADMIN_ALL)
	@echo "Checking for admin JS errors..."
	@NODE_PATH=$(abs_builddir)/node_modules $(NODE) node_modules/eslint/bin/eslint.js $(srcdir)/admin/src --ignore-path $(srcdir)/.eslintignore --config $(srcdir)/.eslintrc
	@awk 'FNR == 1 {print ""} 1' $(patsubst %.js,$(srcdir)/%.js,$(call LOLEAFLET_JS,$(srcdir)/admin/build/build.js)) > $@

if ENABLE_DEBUG
$(LOLEAFLET_PREFIX)/dist/loleaflet-src.js: $(LOLEAFLET_JS_DST) $(LOLEAFLET_DRAW_JS_DST) $(LOLEAFLET_PATH_JS_DST) $(PLUGINS_JS_DST)
	@echo "Checking for loleaflet JS errors..."
	@NODE_PATH=$(abs_builddir)/node_modules $(NODE) node_modules/eslint/bin/eslint.js $(srcdir)/src \
		$(srcdir)/plugins/draw-$(DRAW_VERSION)/src \
		$(srcdir)/plugins/path-transform/src \
		$(srcdir)/js --ignore-path $(srcdir)/.eslintignore --config $(srcdir)/.eslintrc
	@touch $@

$(builddir)/dist/bundle.css: $(LOLEAFLET_CSS_DST)
	@touch $@

$(builddir)/dist/bundle.js: $(NODE_MODULES_JS_DST) \
	$(LOLEAFLET_PREFIX)/dist/loleaflet-src.js \
	$(builddir)/dist/global.js \
	$(builddir)/dist/w2ui-1.5.rc1.js \
	$(builddir)/dist/toolbar.js \
	$(builddir)/dist/main.js
	@touch $@
else
$(LOLEAFLET_PREFIX)/dist/loleaflet-src.js: $(LOLEAFLET_JS_SRC)
	@mkdir -p $(dir $@)
	@echo "Checking for loleaflet JS errors..."
	@NODE_PATH=$(abs_builddir)/node_modules $(NODE) node_modules/eslint/bin/eslint.js $(srcdir)/src \
		$(srcdir)/plugins/draw-$(DRAW_VERSION)/src \
		$(srcdir)/plugins/path-transform/src \
		$(srcdir)/js --ignore-path $(srcdir)/.eslintignore --config $(srcdir)/.eslintrc
	@(cat $(srcdir)/src/copyright.js | sed 's/{VERSION}/$(LOLEAFLET_VERSION)/' - \
		&& echo "(function (window, document, undefined) {" \
		&& awk 'FNR == 1 {print ""} 1' \
		$(patsubst %.js,$(srcdir)/%.js,$(call LOLEAFLET_JS,$(srcdir)/build/build.js)) \
		$(patsubst %.js,$(srcdir)/plugins/draw-$(DRAW_VERSION)/%.js,$(call LOLEAFLET_JS,$(srcdir)/plugins/draw-$(DRAW_VERSION)/build/build.js)) \
		$(patsubst %.js,$(srcdir)/plugins/path-transform/%.js,$(call LOPLUGIN_JS,$(srcdir)/plugins/path-transform/build/deps.js)) \
		&& echo "}(window, document));") > $@

$(builddir)/dist/bundle.css: $(LOLEAFLET_CSS)
	@echo "Uglify loleaflet css files..."
	@NODE_PATH=$(abs_builddir)/node_modules $(NODE) node_modules/uglifycss/uglifycss $(LOLEAFLET_CSS) > $@

$(builddir)/dist/global.js: $(srcdir)/js/global.js
	@echo "Uglify global.js file..."
	@NODE_PATH=$(abs_builddir)/node_modules $(NODE) node_modules/uglify-js/bin/uglifyjs $< --output $@

$(builddir)/dist/bundle.js: $(NODE_MODULES_JS_SRC) \
	$(LOLEAFLET_PREFIX)/dist/loleaflet-src.js \
	$(builddir)/dist/global.js \
	$(srcdir)/js/jquery.mCustomScrollbar.js \
	$(srcdir)/js/w2ui-1.5.rc1.js \
	$(srcdir)/js/toolbar.js \
	$(srcdir)/js/main.js
	@echo "Uglify loleaflet js files..."
	NODE_PATH=$(abs_builddir)/node_modules $(NODE) node_modules/uglify-js/bin/uglifyjs \
		$(L10N_IOS_ALL_JS) \
		$(NODE_MODULES_JS) \
		$(srcdir)/js/jquery.mCustomScrollbar.js \
		$(srcdir)/js/w2ui-1.5.rc1.js \
		$(builddir)/build/dist/loleaflet-src.js \
		$(srcdir)/js/toolbar.js \
		$(srcdir)/js/main.js \
		--source-map --output $@
endif

$(builddir)/dist/loleaflet.html: $(srcdir)/html/loleaflet.html.m4 $(LOLEAFLET_HTML_DST) \
	$(builddir)/dist/bundle.css $(builddir)/dist/bundle.js
	@echo "Generating loleaflet.html..."
	@m4 -E -DDEBUG=$(ENABLE_DEBUG) \
		-DIOSAPP=$(ENABLE_IOSAPP) \
		-DGTKAPP=$(ENABLE_GTKAPP) \
		-DANDROIDAPP=$(ENABLE_ANDROIDAPP) \
		-DMOBILEAPPNAME="$(APP_NAME)" \
		-DLOLEAFLET_CSS="$(subst $(SPACE),$(COMMA),$(LOLEAFLET_CSS_M4))" \
		-DBUNDLE_CSS="$(abs_builddir)/dist/bundle.css" \
		-DGLOBAL_JS="$(abs_builddir)/dist/global.js" \
		-DLOLEAFLET_JS="$(subst $(SPACE),$(COMMA),$(NODE_MODULES_JS) \
		$(call LOLEAFLET_JS,$(srcdir)/build/build.js) \
		$(patsubst %.js,plugins/draw-$(DRAW_VERSION)/%.js,$(call LOLEAFLET_JS,$(srcdir)/plugins/draw-$(DRAW_VERSION)/build/build.js)) \
		$(patsubst %.js,plugins/path-transform/%.js,$(call LOPLUGIN_JS,$(srcdir)/plugins/path-transform/build/deps.js)) \
		$(PLUGINS_JS))" \
		$(srcdir)/html/loleaflet.html.m4 > $@

node_modules: npm-shrinkwrap.json
	@npm install
	@touch node_modules

$(builddir)/dist/plugins/%.js: $(srcdir)/plugins/%.js
	@mkdir -p $(dir $@)
	@cp $< $@

$(builddir)/dist/images/%: $(srcdir)/images/%
	@mkdir -p $(dir $@)
	@cp $< $@

$(builddir)/dist/%.html: $(srcdir)/html/%.html
	@mkdir -p $(dir $@)
	@cp $< $@

$(builddir)/dist/src/%.js: $(srcdir)/src/%.js
	@mkdir -p $(dir $@)
	@cp $< $@

$(builddir)/dist/%.js: $(srcdir)/js/%.js
	@mkdir -p $(dir $@)
	@cp $< $@

$(builddir)/dist/node_modules/%.js: $(builddir)/node_modules/%.js
	@mkdir -p $(dir $@)
	@cp $< $@

$(builddir)/dist/$(JQUERY_LIGHTNESS_IMAGE_PATH)/%.png: $(JQUERY_LIGHTNESS_IMAGE_PATH)/%.png
	@mkdir -p $(dir $@)
	@cp $< $@

$(builddir)/dist/images/%.png: $(JQUERY_LIGHTNESS_IMAGE_PATH)/%.png
	@mkdir -p $(dir $@)
	@cp $< $@

$(builddir)/dist/$(JQUERY_MINIFIED_IMAGE_PATH)/%.png: $(JQUERY_MINIFIED_IMAGE_PATH)/%.png
	@mkdir -p $(dir $@)
	@cp $< $@

$(builddir)/dist/images/%.png: $(JQUERY_MINIFIED_IMAGE_PATH)/%.png
	@mkdir -p $(dir $@)
	@cp $< $@

$(builddir)/dist/l10n/%: $(srcdir)/l10n/%
	@mkdir -p $(dir $@)
	@cp $< $@

$(builddir)/dist/l10n/%.json: $(srcdir)/po/%.po
	@$(srcdir)/util/po2json.py $< -o $@

$(builddir)/dist/admin/%: $(srcdir)/admin/%
	@mkdir -p $(dir $@)
	@cp $< $@

install-data-hook:
	mkdir -p $(DESTDIR)$(pkgdatadir)/loleaflet; \
	cp -ar dist/ $(DESTDIR)$(pkgdatadir)/loleaflet/;

pot:
	xgettext --from-code=UTF-8 --keyword=_ --output=po/templates/loleaflet-ui.pot \
		admin/admin.strings.js \
		admin/src/AdminSocketAnalytics.js \
		admin/src/AdminSocketBase.js \
		admin/src/AdminSocketOverview.js \
		admin/src/AdminSocketSettings.js \
		admin/src/Util.js \
		js/toolbar.js \
		src/control/Control.AlertDialog.js \
		src/control/Control.ContextMenu.js \
		src/control/Control.DocumentRepair.js \
		src/control/Control.Menubar.js \
		src/control/Control.Scroll.Annotation.js \
		src/control/Control.Tabs.js \
		src/control/Signing.js \
		src/control/Ruler.js \
		src/control/Toolbar.js \
		src/core/Socket.js \
		src/errormessages.js \
		src/layer/marker/Annotation.js \
		src/layer/tile/TileLayer.js \
		src/layer/tile/TileLayer.TableOverlay.js \
		src/map/Map.js \
		src/map/handler/Map.FileInserter.js \
		src/map/handler/Map.WOPI.js

	html2po --pot --input=html/loleaflet-help.html --output=po/templates/loleaflet-help.pot --duplicates=merge

l10n: pot
	for i in po/ui-*.po; do pot2po --input=po/templates/loleaflet-ui.pot --template=$$i --output=$$i.new; mv $$i.new $$i;done
	for i in po/help-*.po; do pot2po --input=po/templates/loleaflet-help.pot --template=$$i --output=$$i.new; mv $$i.new $$i;done

clean-local:
	rm -rf node_modules
	rm -rf $(builddir)/dist
	rm -rf $(builddir)/build/dist

spec/data/load-test:
	if [ ! -d spec/data/load_test ]; then \
		mkdir -p spec/data/load_test; \
		for i in $$(seq 1 125); \
		do \
			cp spec/data/eval.odt spec/data/load_test/eval$$i.odt; \
			cp spec/data/eval.odp spec/data/load_test/eval$$i.odp; \
			cp spec/data/eval.ods spec/data/load_test/eval$$i.ods; \
			cp spec/data/eval.odg spec/data/load_test/eval$$i.odg; \
		done; \
	fi

load-test: spec/data/load-test
	rm -rf load_test_out; \
	mkdir load_test_out; \
	for i in $$(seq 1 20); \
	do \
		node_modules/.bin/mocha spec/headlessLoadTest.js > load_test_out/$$i.out 2>&1 & \
	done;

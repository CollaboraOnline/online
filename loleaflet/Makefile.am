# Version number of loleaflet, no need to be in sync with the loolwsd
# one, but do please follow the same even/odd convention for the third
# ("micro") part: Between releases odd, even for releases (no other
# changes inbetween).

# Version number of the bundled 'draw' thing
DRAW_VERSION=0.2.4

MINIFY=false

L10N_PO = $(wildcard po/*.po)
L10N_JSON = $(patsubst po/%.po,dist/l10n/%.json,$(L10N_PO))

L10N_STYLES_PO = $(wildcard po/styles/*.po)
L10N_STYLES_JSON = $(patsubst po/styles/%.po,dist/l10n/styles/%.json,$(L10N_STYLES_PO))

EXTRA_DIST = $(shell git ls-files)

all-local: node_modules $(L10N_JSON) $(L10N_STYLES_JSON)
	rm -rf dist/plugins/draw-$(DRAW_VERSION) && mkdir -p dist/plugins/draw-$(DRAW_VERSION)
	cd plugins/draw-$(DRAW_VERSION) && jake build && cp -ar dist ../../dist/plugins/draw-$(DRAW_VERSION)
	jake build debug=$(ENABLE_DEBUG) minify=$(MINIFY)

node_modules: npm-shrinkwrap.json
	npm install
	touch node_modules

dist/l10n/%.json: po/%.po
	@util/po2json.py $< -o $@

dist/l10n/styles:
	@mkdir -p $@

dist/l10n/styles/%.json: po/styles/%.po dist/l10n/styles
	@util/po2json.py $< -o $@

install-data-hook:
	mkdir -p $(DESTDIR)$(pkgdatadir)/loleaflet; \
	cp -ar dist/ $(DESTDIR)$(pkgdatadir)/loleaflet/;

dist-hook:
	chmod u+w $(distdir)/dist

	mkdir -p $(distdir)/dist/node_modules/jquery-ui/themes/ui-lightness/images/
	cp -a node_modules/jquery-ui/themes/ui-lightness/images/ui-bg_highlight-soft_100_eeeeee_1x100.png $(distdir)/dist/node_modules/jquery-ui/themes/ui-lightness/images/

pot:
	xgettext --from-code=UTF-8 --keyword=_ --output=po/templates/loleaflet-ui.pot \
		admin.strings.js \
		evol.colorpicker.strings.js \
		unocommands.js \
		dist/errormessages.js \
		dist/toolbar/toolbar.js \
		src/admin/AdminSocketBase.js \
		src/admin/AdminSocketOverview.js \
		src/admin/AdminSocketSettings.js \
		src/admin/Util.js \
		src/control/Control.CharacterMap.js \
		src/control/Control.ColumnHeader.js \
		src/control/Control.ContextMenu.js \
		src/control/Control.DocumentRepair.js \
		src/control/Control.Menubar.js \
		src/control/Control.MetricInput.js \
		src/control/Control.RowHeader.js \
		src/control/Control.Scroll.Annotation.js \
		src/control/Control.Tabs.js \
		src/control/Toolbar.js \
		src/core/Socket.js \
		src/layer/marker/Annotation.js \
		src/layer/tile/TileLayer.js \
		src/map/Map.js \
		src/map/handler/Map.FileInserter.js

	html2po --pot --input=dist/loleaflet-help.html --output=po/templates/loleaflet-help.pot --duplicates=merge

l10n: pot
	for i in po/ui-*.po; do pot2po --input=po/templates/loleaflet-ui.pot --template=$$i --output=$$i.new; mv $$i.new $$i;done
	for i in po/help-*.po; do pot2po --input=po/templates/loleaflet-help.pot --template=$$i --output=$$i.new; mv $$i.new $$i;done

clean-local:
	rm -rf node_modules
	cd dist && rm -f bundle.js bundle.js.map admin-bundle.js admin-bundle.js.map
	cd plugins/draw-$(DRAW_VERSION) && rm -f dist/*.js

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

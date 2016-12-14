# Version number of loleaflet, no need to be in sync with the loolwsd
# one, but do please follow the same even/odd convention for the third
# ("micro") part: Between releases odd, even for releases (no other
# changes inbetween).

VERSION=2.0.1+

# Version number of the bundled 'draw' thing
DRAW_VERSION=0.2.4

MINIFY=false

.PHONY: build
build: node_modules
	rm -rf dist/plugins/draw-$(DRAW_VERSION) && mkdir -p dist/plugins/draw-$(DRAW_VERSION)
	cd plugins/draw-$(DRAW_VERSION) && jake build && cp -ar dist ../../dist/plugins/draw-$(DRAW_VERSION)
	jake build debug=$(ENABLE_DEBUG) minify=$(MINIFY)

node_modules: npm-shrinkwrap.json
	npm install
	touch node_modules

.PHONY: build-l10n
build-l10n:
	mkdir -p dist/l10n/styles

	util/po2json.py --quiet po/*.po
	mv po/*.json dist/l10n/
	util/po2json.py --quiet po/styles/*.po
	mv po/styles/*.json dist/l10n/styles/

all-local: build

.PHONY: dist
dist: MINIFY=true
dist: all build-l10n
	rm -rf loleaflet-$(VERSION)
	mkdir loleaflet-$(VERSION)
	cp -ar dist loleaflet-$(VERSION)
	mkdir -p loleaflet-$(VERSION)/dist/node_modules/jquery-ui/themes/ui-lightness/images/
	cp -a node_modules/jquery-ui/themes/ui-lightness/images/ui-bg_highlight-soft_100_eeeeee_1x100.png loleaflet-$(VERSION)/dist/node_modules/jquery-ui/themes/ui-lightness/images/
	tar cfz loleaflet-$(VERSION).tar.gz loleaflet-$(VERSION)
	rm -rf loleaflet-$(VERSION)

pot:
	xgettext --from-code=UTF-8 --keyword=_ --output=po/templates/loleaflet-ui.pot \
		admin.strings.js \
		evol.colorpicker.strings.js \
		unocommands.js \
		dist/errormessages.js \
		dist/toolbar/toolbar.js \
		src/admin/AdminSocketBase.js \
		src/admin/AdminSocketOverview.js \
		src/admin/Util.js \
		src/control/Control.CharacterMap.js \
		src/control/Control.ColumnHeader.js \
		src/control/Control.DocumentRepair.js \
		src/control/Control.Menubar.js \
		src/control/Control.RowHeader.js \
		src/control/Control.Tabs.js \
		src/control/Toolbar.js \
		src/core/Socket.js \
		src/map/Map.js \
		src/map/handler/Map.FileInserter.js

	html2po --pot --input=dist/loleaflet-help.html --output=po/templates/loleaflet-help.pot

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

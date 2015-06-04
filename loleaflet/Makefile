# Version number of loleaflet, no need to be in sync with the loolwsd one

VERSION=1.0.10

# Version number of the bundled 'draw' thing
DRAW_VERSION=0.2.4

all:
	jake build
	cd plugins/draw-$(DRAW_VERSION) && jake build

.PHONY: dist
dist: all
	rm -rf loleaflet-$(VERSION)
	mkdir loleaflet-$(VERSION)
	cp README loleaflet-$(VERSION)
	tar cf - dist plugins/draw-$(DRAW_VERSION)/dist debug/document src/scrollbar | (cd loleaflet-$(VERSION) && tar xf -)
	tar cfz loleaflet-$(VERSION).tar.gz loleaflet-$(VERSION)
	rm -rf loleaflet-$(VERSION)

loleaflet.spec: loleaflet.spec.in
	sed -e 's/@PACKAGE_VERSION@/$(VERSION)/g' <loleaflet.spec.in >loleaflet.spec

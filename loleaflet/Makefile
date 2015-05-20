# Version number of loleaflet, no need to be in sync with the loolwsd one

VERSION=1.0.0

# Version number of the bundled 'draw' thing
DRAW_VERSION=0.2.4

all:
	jake build
	cd plugins/draw-$(DRAW_VERSION) && jake build

.PHONY: dist
dist:
	git archive --prefix=loleaflet-$(VERSION)/ HEAD | gzip >loleaflet-$(VERSION).tar.gz

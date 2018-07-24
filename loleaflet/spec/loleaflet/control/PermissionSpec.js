/* -*- js-indent-level: 8 -*- */
describe('Permissions', function () {
	this.timeout(10000);
	var map;

	before(function () {
		var htmlPath = window.location.pathname;
		var dir = htmlPath.substring(0, htmlPath.lastIndexOf('/'));
		var fileURL = 'file://' + dir + '/data/eval.odt';
		// initialize the map and load the document
		map = L.map('map', {
			server: 'wss://localhost:9980',
			doc: fileURL,
			edit: false,
			readOnly: false
		});

		map.on('scrollto', function (e) {
			map.scrollTop(e.y);
			map.scrollLeft(e.x);
		});
	});

	afterEach(function () {
		map.off('statusindicator');
	});

	after(function () {
		map.remove();
	});

	describe('Load the document', function () {
		it('Initialize the tile layer', function (done) {
			map.on('statusindicator', function (e) {
				if (e.statusType === 'loleafletloaded') {
					done();
				}
			});
		});
	});

	describe('ReadOnly', function () {
		it('Set permission to "readonly"', function (done) {
			map.once('updatepermission', function (e) {
				expect(e.perm).to.be('readonly');
				done();
			});
			map.setPermission('readonly');
		});

		it('Dragging is enabled', function () {
			expect(map.dragging.enabled()).to.be(true);
		});

		it('Selection is disabled', function () {
			expect(map.isSelectionEnabled()).to.be(false);
		});

		it('Current permission is "readonly"', function () {
			expect(map.getPermission()).to.be('readonly');
		});
	});

	describe('View', function () {
		it('Set permission to "view"', function (done) {
			map.once('updatepermission', function (e) {
				expect(e.perm).to.be('view');
				done();
			});
			map.setPermission('view');
		});

		it('Dragging is enabled', function () {
			expect(map.dragging.enabled()).to.be(true);
		});

		it('Selection is disabled', function () {
			expect(map.isSelectionEnabled()).to.be(false);
		});

		it('Current permission is "view"', function () {
			expect(map.getPermission()).to.be('view');
		});

		it('Click to switch to "edit"', function (done) {
			map.once('updatepermission', function (e) {
				expect(e.perm).to.be('edit');
				done();
			});

			// simulate a click
			var latlng = map.unproject(new L.Point(1, 1));
			var events = ['mousedown', 'mouseup'];
			for (var i = 0; i < events.length; i++) {
				map.fire(events[i], {
					latlng: latlng,
					layerPoint: map.latLngToLayerPoint(latlng),
					containerPoint: map.latLngToContainerPoint(latlng),
					originalEvent: {button:0}
				});
			}
		});

		it('Current permission is "edit"', function () {
			expect(map.getPermission()).to.be('edit');
		});
    });

	describe('Edit', function () {
		it('Sets permission to "edit"', function (done) {
			map.once('updatepermission', function (e) {
				expect(e.perm).to.be('edit');
				done();
			});
			map.setPermission('edit');
		});

		it('Dragging is disabled', function () {
			expect(map.dragging.enabled()).to.be(false);
		});

		it('Selection is enabled', function () {
			expect(map.isSelectionEnabled()).to.be(true);
		});

		it('Current permission is "edit"', function () {
			expect(map.getPermission()).to.be('edit');
		});
    });
});

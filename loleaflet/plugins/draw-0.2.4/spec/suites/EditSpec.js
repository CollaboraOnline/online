describe("L.Edit", function () {
	var map;

	beforeEach(function () {
		map = new L.Map(document.createElement('div')).setView([0, 0], 15);
	});

	describe("L.Edit.Marker", function () {
		var marker;

		beforeEach(function () {
			marker = new L.Marker(new L.LatLng(1, 2)).addTo(map);
			marker.editing.enable();
		});

		it("Is activated correctly when editing.enable() is called.", function () {});
	});

	describe("L.Edit.Circle", function () {
		var circle;

		beforeEach(function () {
			circle = new L.Circle(new L.LatLng(1, 2), 5).addTo(map);
			circle.editing.enable();
		});

		it("Is activated correctly when editing.enable() is called.", function () {});

		it("Moves the circle to the correct latlng", function () {
			var newLatLng = new L.LatLng(3, 5);

			circle.editing._move(newLatLng);
			expect(circle.getLatLng()).to.eql(newLatLng);
		});
	});

	describe("L.Edit.Poly", function () {
		var edit,
			drawnItems,
			poly;

		beforeEach(function () {
			drawnItems = new L.FeatureGroup().addTo(map);
			edit = new L.EditToolbar.Edit(map, {
				featureGroup: drawnItems,
				selectedPathOptions: L.EditToolbar.prototype.options.edit.selectedPathOptions
			});
			poly = new L.Polyline(L.latLng(41, -87), L.latLng(42, -88));
		});

		it("Should change the style of the polyline during editing mode.", function () {
			var originalOptions = L.extend({}, poly.options);

			drawnItems.addLayer(poly);
			edit.enable();

			expect(poly.editing.enabled()).to.equal(true);
			expect(poly.options).not.to.eql(originalOptions);
		});

		it("Should revert to original styles when editing is toggled.", function () {
			var originalOptions = L.extend({maintainColor: false }, poly.options);

			drawnItems.addLayer(poly);
			edit.enable();
			edit.disable();

			expect(poly.options).to.eql(originalOptions);
		});
	});
});
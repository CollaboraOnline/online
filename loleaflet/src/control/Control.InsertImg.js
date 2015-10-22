/*
 * L.Control.InsertImg
 */

L.Control.InsertImg = L.Control.extend({
	onAdd: function (map) {
        this._insertImg = L.DomUtil.create('input', 'leaflet-control-insertimage leaflet-bar');
		this._insertImg.type = 'file';
		L.DomEvent['on'](this._insertImg, 'change', this._onChange, this);
		return this._insertImg;
	},

	_onChange: function () {
		if ('files' in this._insertImg) {
			for (var i = 0; i < this._insertImg.files.length; i++) {
				var file = this._insertImg.files[i];
				this._map.insertFile(file);
			}
		}
	}
});

L.control.insertImg = function (options) {
	return new L.Control.InsertImg(options);
};

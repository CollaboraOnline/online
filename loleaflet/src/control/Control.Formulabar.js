/*
 * L.Control.FormulaBar
 */

L.Control.FormulaBar = L.Control.extend({
	onAdd: function (map) {
		this._formulaBar = L.DomUtil.create('input', 'leaflet-control-formulabar leaflet-bar');
		this._formulaBar.type = 'text';
		L.DomEvent.on(this._formulaBar, 'keyup', this._onInput, this);
		map.on('cellformula', this._onFormulaChange, this);
		return this._formulaBar;
	},

	_onInput: function () {
		this._map.cellEnterString(this._formulaBar.value);
	},

	_onFormulaChange: function (e) {
		if (document.activeElement !== this._formulaBar) {
			// if the user is not writing
			this._formulaBar.value = e.formula;
		}
	}
});

L.control.formulaBar = function (options) {
	return new L.Control.FormulaBar(options);
};

/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.FormulaBarJSDialog
 */

/* global _UNO */
L.Control.FormulaBarJSDialog = L.Control.extend({
	container: null,
	builder: null,

	onAdd: function (map) {
		this.map = map;

		this.map.on('formulabar', this.onFormulaBar, this);
		this.map.on('jsdialogupdate', this.onJSUpdate, this);
		this.map.on('jsdialogaction', this.onJSAction, this);

		this.builder = new L.control.jsDialogBuilder(
			{
				mobileWizard: this,
				map: this.map,
				cssClass: 'formulabar jsdialog',
				callback: this.callback.bind(this)
			});
	},

	onRemove: function() {
		this.map.off('formulabar', this.onFormulaBar, this);
		this.map.off('jsdialogupdate', this.onJSUpdate, this);
		this.map.off('jsdialogaction', this.onJSAction, this);
	},

	createFormulabar: function(text) {
		var data = [
			{
				type: 'toolbox',
				children: [
					// on mobile we show buttons on the top bar
					(!window.mode.isMobile()) ? (
						{
							id: 'cancel',
							type: 'toolitem',
							command: '.uno:Cancel',
							text: _UNO('.uno:Cancel', 'spreadsheet')
						}
					) : {},
					{
						id: 'sc_input_window',
						type: 'multilineedit',
						text: text ? text : '',
						rawKeyEvents: true
					}
				]
			}
		];

		var wrapper = document.getElementById('calc-inputbar-wrapper');
		wrapper.style.display = 'block';

		var parent = document.getElementById('calc-inputbar');
		parent.innerHTML = '';
		this.container = L.DomUtil.create('div', 'inputbar_container', parent);
		this.container.style.width = '100%';

		this.builder.build(this.container, data);
	},

	callback: function(objectType, eventType, object, data, builder) {
		// in the core we have DrawingArea not TextView
		if (object.id.indexOf('sc_input_window') === 0)
			objectType = 'drawingarea';

		builder._defaultCallbackHandler(objectType, eventType, object, data, builder);
	},

	onFormulaBar: function(e) {
		var data = e.data;
		if (data.jsontype !== 'formulabar')
			return;

		console.warn('formulabar: old style formulabar full update - to fix in core');
		return;
	},

	onJSUpdate: function (e) {
		var data = e.data;
		if (data.jsontype !== 'formulabar')
			return;

		console.warn('formulabar: old style formulabar update - to fix in core');
		return;
	},

	onJSAction: function (e) {
		var data = e.data;

		if (data.jsontype !== 'formulabar')
			return;

		if (!this.builder)
			return;

		this.builder.setWindowId(data.id);

		if (this.container)
			this.builder.executeAction(this.container, data.data);
		else
			this.createFormulabar(data.data.text);
	},
});

L.control.formulaBarJSDialog = function (options) {
	return new L.Control.FormulaBarJSDialog(options);
};

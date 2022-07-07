/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.FormulaBarJSDialog
 */

/* global _ _UNO UNOKey */
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
					{
						id: 'functiondialog',
						type: 'toolitem',
						text: _('Function Wizard'),
						command: '.uno:FunctionDialog'
					},
					(!window.mode.isMobile()) ? (
						{
							id: 'autosummenu:AutoSumMenu',
							type: 'menubutton',
							command: '.uno:AutoSumMenu'
						}
					) : {},
					{
						id: 'startformula',
						type: 'customtoolitem',
						text: _('Formula'),
					},
					// on mobile we show other buttons on the top bar
					(!window.mode.isMobile()) ? (
						{
							id: 'acceptformula',
							type: 'customtoolitem',
							text: _('Accept'),
							visible: false
						}
					) : {},
					(!window.mode.isMobile()) ? (
						{
							id: 'cancelformula',
							type: 'customtoolitem',
							text: _UNO('.uno:Cancel', 'spreadsheet'),
							visible: false
						}
					) : {},
					{
						id: 'sc_input_window',
						type: 'multilineedit',
						text: text ? text : '',
						rawKeyEvents: true
					},
					{
						id: 'expand',
						type: 'pushbutton',
						text: '',
						symbol: 'SPIN_DOWN',
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

	toggleMultiLine: function(input) {
		if (L.DomUtil.hasClass(input, 'expanded')) {
			L.DomUtil.removeClass(input, 'expanded');
			L.DomUtil.removeClass(L.DomUtil.get('calc-inputbar-wrapper'), 'expanded');
			this.onJSUpdate({
				data: {
					jsontype: 'formulabar',
					id: this.builder.windowId,
					'control_id': 'expand',
					control: {
						id: 'expand',
						type: 'pushbutton',
						text: '',
						symbol: 'SPIN_DOWN'
					}
				}
			});
		} else {
			L.DomUtil.addClass(input, 'expanded');
			L.DomUtil.addClass(L.DomUtil.get('calc-inputbar-wrapper'), 'expanded');
			this.onJSUpdate({
				data: {
					jsontype: 'formulabar',
					id: this.builder.windowId,
					'control_id': 'expand',
					control: {
						id: 'expand',
						type: 'pushbutton',
						text: '',
						symbol: 'SPIN_UP'
					}
				}
			});
		}
	},

	callback: function(objectType, eventType, object, data, builder) {
		if (object.id === 'expand') {
			var input = document.getElementById('sc_input_window');
			if (input)
				this.toggleMultiLine(input);
			return;
		}

		// in the core we have DrawingArea not TextView
		if (object.id.indexOf('sc_input_window') === 0) {
			objectType = 'drawingarea';
			if (eventType === 'keypress' && data === UNOKey.RETURN || data === UNOKey.ESCAPE)
				builder.map.focus();
		}

		builder._defaultCallbackHandler(objectType, eventType, object, data, builder);
	},

	focus: function() {
		setTimeout(function() {
			var input = document.getElementById('sc_input_window');
			if (input && document.activeElement !== input)
				input.focus();
		}, 0);
	},

	blur: function() {
		var input = document.getElementById('sc_input_window');
		if (input)
			input.blur();
	},

	hasFocus: function() {
		var input = document.getElementById('sc_input_window');
		return document.activeElement === input;
	},

	show: function(action) {
		this.showButton(action, true);
	},

	hide: function(action) {
		this.showButton(action, false);
	},

	showButton: function(action, show) {
		this.onJSAction(
			{
				data: {
					jsontype: 'formulabar',
					id: this.builder.windowId,
					data: {
						'control_id': action,
						'action_type': show ? 'show' : 'hide'
					}
				}
			});
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

		if (!this.container)
			return;

		var control = this.container.querySelector('[id=\'' + data.control.id + '\']');
		if (!control) {
			window.app.console.warn('jsdialogupdate: not found control with id: "' + data.control.id + '"');
			return;
		}

		var parent = control.parentNode;
		if (!parent)
			return;

		control.style.visibility = 'hidden';
		var temporaryParent = L.DomUtil.create('div');
		this.builder.build(temporaryParent, [data.control], false);
		parent.insertBefore(temporaryParent.firstChild, control.nextSibling);
		L.DomUtil.remove(control);
	},

	onJSAction: function (e) {
		var data = e.data;

		if (data.jsontype !== 'formulabar')
			return;

		if (!this.builder)
			return;

		this.builder.setWindowId(data.id);

		if (this.container) {
			var keepInputFocus = data.data && data.data.control_id === 'sc_input_window'
				&& this.hasFocus();

			this.builder.executeAction(this.container, data.data);

			if (keepInputFocus)
				this.focus();
		} else
			this.createFormulabar(data.data.text);
	},
});

L.control.formulaBarJSDialog = function (options) {
	return new L.Control.FormulaBarJSDialog(options);
};

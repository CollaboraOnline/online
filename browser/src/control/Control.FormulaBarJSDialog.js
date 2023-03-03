/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.FormulaBarJSDialog
 */

/* global _ _UNO UNOKey */
L.Control.FormulaBarJSDialog = L.Control.extend({
	container: null,
	builder: null,
	dirty: true, // if we should allow to update based on servers setText

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
		if (!window.mode.isMobile()) {
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
						{
							id: 'autosummenu:AutoSumMenu',
							type: 'menubutton',
							command: '.uno:AutoSumMenu'
						},
						{
							id: 'startformula',
							type: 'customtoolitem',
							text: _('Formula'),
						},
						{
							// on mobile we show other buttons on the top bar
							id: 'acceptformula',
							type: 'customtoolitem',
							text: _('Accept'),
							visible: false
						},
						{
							id: 'cancelformula',
							type: 'customtoolitem',
							text: _UNO('.uno:Cancel', 'spreadsheet'),
							visible: false
						},
						{
							id: 'sc_input_window',
							type: 'multilineedit',
							text: text ? text : '',
							rawKeyEvents: window.mode.isDesktop() ? true : undefined,
							useTextInput: window.mode.isDesktop() ? undefined : true
						},
						{
							id: 'expand',
							type: 'pushbutton',
							text: '',
							symbol: 'SPIN_DOWN',
						}]
				}];
		} else {
			var data = [
				{
					type: 'toolbox',
					children: [
						{
							id: 'functiondialog',
							type: 'toolitem',
							text: _('Function Wizard'),
							command: '.uno:FunctionDialog'
						}, {
							id: 'sc_input_window',
							type: 'multilineedit',
							text: text ? text : '',
							rawKeyEvents: undefined,
							useTextInput: true
						},
						{
							id: 'expand',
							type: 'pushbutton',
							text: '',
							symbol: 'SPIN_DOWN',
						}]
				}];
		}

		var wrapper = document.getElementById('calc-inputbar-wrapper');
		wrapper.style.display = 'block';

		var parent = document.getElementById('calc-inputbar');
		parent.innerHTML = '';
		this.container = L.DomUtil.create('div', 'inputbar_container', parent);
		this.container.style.width = '100%';

		this.builder.build(this.container, data);

		var inputField = this.getInputField();
		inputField.setAttribute('autocapitalize', 'off');
		inputField.setAttribute('autocorrect', 'off');
		inputField.setAttribute('autocomplete', 'off');
		inputField.setAttribute('spellcheck', 'false');
	},

	toggleMultiLine: function(input) {
		if (L.DomUtil.hasClass(input, 'expanded')) {
			L.DomUtil.removeClass(input, 'expanded');
			L.DomUtil.removeClass(L.DomUtil.get('calc-inputbar-wrapper'), 'expanded');
			L.DomUtil.removeClass(L.DomUtil.get('formulabar'), 'expanded');
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
			L.DomUtil.addClass(L.DomUtil.get('formulabar'), 'expanded');
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
			var input = this.getInputField();
			if (input)
				this.toggleMultiLine(input);
			return;
		}

		// in the core we have DrawingArea not TextView
		if (object.id.indexOf('sc_input_window') === 0) {
			objectType = 'drawingarea';
			if (eventType === 'keypress' && data === UNOKey.RETURN || data === UNOKey.ESCAPE)
				builder.map.focus();
			else if (eventType === 'grab_focus')
				builder.map.onFormulaBarFocus();
		}

		builder._defaultCallbackHandler(objectType, eventType, object, data, builder);
	},

	focus: function() {
		var that = this;
		setTimeout(function() {
			var input = that.getInputField();
			if (input && document.activeElement !== input)
				input.focus();
		}, 0);
	},

	blur: function() {
		if (!window.mode.isDesktop()) {
			var textInput = this.map && this.map._textInput;
			if (textInput && textInput._isComposing)
				textInput._abortComposition();
		}

		var input = this.getInputField();
		if (input)
			input.blur();
	},

	hasFocus: function() {
		var input = this.getInputField();
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

	getControl: function(controlId) {
		if (!this.container)
			return;

		var control = this.container.querySelector('[id=\'' + controlId + '\']');
		if (!control)
			window.app.console.warn('formulabar update: not found control with id: "' + controlId + '"');

		return control;
	},

	getInputField: function() {
		return this.getControl('sc_input_window');
	},

	getValue: function() {
		var control = this.getInputField();
		if (!control)
			return;

		return this.map._textInput._preSpaceChar + control.value + this.map._textInput._postSpaceChar;
	},

	setValue: function(newValue) {
		var control = this.getInputField();
		if (!control)
			return;

		control.value = newValue;
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

		var control = this.getControl(data.control.id);
		if (!control)
			return;

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

		var innerData = data ? data.data : null;

		if (this.container) {
			var messageForInputField = innerData && innerData.control_id === 'sc_input_window';
			var isSetTextMessage = innerData && innerData.action_type === 'setText';
			var keepInputFocus = messageForInputField && this.hasFocus();
			var textInput = this.map._textInput;

			// on desktop we display what we get from the server
			// on touch devices we allow to type into the field directly, so we cannot update always
			var allowUpdate = window.mode.isDesktop()
				|| !this.hasFocus() || (this.hasFocus() && this.dirty);

			if (!allowUpdate && messageForInputField && isSetTextMessage)
				return;

			this.dirty = false;

			this.builder.executeAction(this.container, innerData);

			if (!window.mode.isDesktop() && messageForInputField && this.hasFocus()) {
				var newContent = textInput.getValueAsCodePoints().slice(1, -1);
				textInput.setupLastContent(newContent);
			}

			if (keepInputFocus)
				this.focus();
		} else
			this.createFormulabar(innerData.text);
	},
});

L.control.formulaBarJSDialog = function (options) {
	return new L.Control.FormulaBarJSDialog(options);
};

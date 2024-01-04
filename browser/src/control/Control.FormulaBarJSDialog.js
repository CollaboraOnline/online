/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * L.Control.FormulaBarJSDialog - implementation of formulabar edit field
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
		if (!window.mode.isMobile()) {
			var data = [
				{
					id: 'formulabar-toolbox',
					type: 'toolbox',
					children: [
						{
							id: 'functiondialog',
							type: 'toolitem',
							text: _('Function Wizard'),
							command: '.uno:FunctionDialog'
						},
						{
							id: 'AutoSumMenu:AutoSumMenu',
							type: 'menubutton',
							class: 'AutoSumMenu',
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
							type: 'formulabaredit',
							text: text ? text : ''
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
							type: 'formulabaredit',
							text: text ? text : ''
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
			else if (eventType === 'grab_focus') {
				this.focusField();
				builder.map.onFormulaBarFocus();
			}
		}

		builder._defaultCallbackHandler(objectType, eventType, object, data, builder);
	},

	focusField: function() {
		L.DomUtil.addClass(this.getInputField(), 'focused');
	},

	blurField: function() {
		L.DomUtil.removeClass(this.getInputField(), 'focused');
	},

	enable: function() {
		var input = this.getInputField();
		if (!input)
			return;

		input.enable();
	},

	disable: function() {
		var input = this.getInputField();
		if (!input)
			return;

		input.disable();
	},

	hasFocus: function() {
		var input = this.getInputField();
		if (!input)
			return false;
		return L.DomUtil.hasClass(input, 'focused');
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
			var isGrabFocusMessage = innerData && innerData.action_type === 'grab_focus';

			if (messageForInputField && isGrabFocusMessage) {
				this.focusField();
				return;
			}

			if (messageForInputField && isSetTextMessage) {
				var customEditArea = this.getInputField();
				if (customEditArea) {
					var selection = innerData.selection.split(';');
					customEditArea.setText(innerData.text, selection);
				}
				return;
			}

			this.builder.executeAction(this.container, innerData);
		} else
			this.createFormulabar(innerData.text);
	},
});

L.control.formulaBarJSDialog = function (options) {
	return new L.Control.FormulaBarJSDialog(options);
};

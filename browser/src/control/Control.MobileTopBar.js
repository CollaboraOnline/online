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
 * L.Control.SearchBar
 */

/* global $ _UNO _ app */
L.Control.MobileTopBar = L.Control.extend({

	options: {
		doctype: 'text'
	},

	initialize: function (docType) {
		L.setOptions(this, {docType: docType});
	},

	onAdd: function (map) {
		this.map = map;
		this.parentContainer = document.getElementById('toolbar-up');
		L.DomUtil.addClass(this.parentContainer, 'ui-toolbar');

		this.builder = new L.control.jsDialogBuilder(
			{
				mobileWizard: this,
				map: this.map,
				cssClass: 'jsdialog',
				noLabelsForUnoButtons: true
			});

		this.create();

		map.on('updatepermission', this.onUpdatePermission, this);
		map.on('commandstatechanged', this.onCommandStateChanged, this);
	},

	getToolItems: function(docType) {
		var isReadOnlyMode = app.map ? app.map.isReadOnlyMode() : true;
		var canUserWrite = !app.isReadOnly();

		if (docType == 'text') {
			return [
				{type: 'toolitem',  id: 'undo', text: _UNO('.uno:Undo'), command: '.uno:Undo', enabled: false},
				{type: 'toolitem',  id: 'redo', text: _UNO('.uno:Redo'), command: '.uno:Redo', enabled: false},
				{type: 'spacer', id: 'before-PermissionMode'},
				{
					type: 'container',
					id: 'permissionmode-container',
					children: [
						{type: 'htmlcontent', id: 'PermissionMode', htmlId: 'permissionmode', text: '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp', isReadOnlyMode: isReadOnlyMode, canUserWrite: canUserWrite, visible: false},
						{type: 'spacer', id: 'after-PermissionMode', visible: false},
					],
					vertical: false,
				},
				{type: 'customtoolitem',  id: 'mobile_wizard', command: 'mobile_wizard'},
				{type: 'customtoolitem',  id: 'insertion_mobile_wizard', command: 'insertion_mobile_wizard'},
				{type: 'customtoolitem',  id: 'comment_wizard', command: 'comment_wizard', w2icon: 'viewcomments'},
				{type: 'menubutton', id: 'userlist:UsersListMenu', visible: false},
			];
		} else if (docType == 'spreadsheet') {
			return [
				{type: 'toolitem',  id: 'undo', text: _UNO('.uno:Undo'), command: '.uno:Undo', enabled: false},
				{type: 'toolitem',  id: 'redo', text: _UNO('.uno:Redo'), command: '.uno:Redo', enabled: false},
				{type: 'customtoolitem', visible: false, id: 'acceptformula', command: 'acceptformula', text: _('Accept')},
				{type: 'customtoolitem', visible: false, id: 'cancelformula', command: 'cancelformula', text: _('Cancel')},
				{type: 'spacer'},
				{type: 'customtoolitem',  id: 'mobile_wizard', command: 'mobile_wizard'},
				{type: 'customtoolitem',  id: 'insertion_mobile_wizard', command: 'insertion_mobile_wizard'},
				{type: 'customtoolitem',  id: 'comment_wizard', command: 'comment_wizard', w2icon: 'viewcomments'},
				{type: 'menubutton', id: 'userlist:UsersListMenu', visible: false},
			];
		} else if (docType == 'presentation') {
			return [
				{type: 'toolitem',  id: 'undo', text: _UNO('.uno:Undo'), command: '.uno:Undo', enabled: false},
				{type: 'toolitem',  id: 'redo', text: _UNO('.uno:Redo'), command: '.uno:Redo', enabled: false},
				{type: 'spacer'},
				{type: 'customtoolitem',  id: 'mobile_wizard', command: 'mobile_wizard'},
				{type: 'customtoolitem',  id: 'insertion_mobile_wizard', command: 'insertion_mobile_wizard'},
				{type: 'customtoolitem',  id: 'comment_wizard', command: 'comment_wizard', w2icon: 'viewcomments'},
				{type: 'customtoolitem', id: 'fullscreen-' + docType, text: _UNO('.uno:FullScreen', docType)},
				{type: 'menubutton', id: 'userlist:UsersListMenu', visible: false},
			];
		} else if (docType == 'drawing') {
			return [
				{type: 'toolitem',  id: 'undo', text: _UNO('.uno:Undo'), command: '.uno:Undo', enabled: false},
				{type: 'toolitem',  id: 'redo', text: _UNO('.uno:Redo'), command: '.uno:Redo', enabled: false},
				{type: 'spacer'},
				{type: 'customtoolitem',  id: 'mobile_wizard', command: 'mobile_wizard'},
				{type: 'customtoolitem',  id: 'insertion_mobile_wizard', command: 'insertion_mobile_wizard'},
				{type: 'customtoolitem',  id: 'comment_wizard', command: 'comment_wizard', w2icon: 'viewcomments'},
				{type: 'menubutton', id: 'userlist:UsersListMenu', visible: false},
			];
		}
	},

	create: function() {
		var items = this.getToolItems(this.options.docType);
		this.builder.build(this.parentContainer, items);
	},

	showItem(command, show) {
		this.builder.executeAction(this.parentContainer, {
			'control_id': command,
			'action_type': show ? 'show' : 'hide'
		});
	},

	enableItem(command, enable) {
		this.builder.executeAction(this.parentContainer, {
			'control_id': command,
			'action_type': enable ? 'enable' : 'disable'
		});
	},

	onUpdatePermission: function(e) {
		var toolbarButtons = ['next', 'prev', 'mobile_wizard', 'insertion_mobile_wizard', 'comment_wizard'];
		// Handle permission mode as diffrent case because it's not part of `toolbar-up` element
		var PermissionMode = document.getElementById('PermissionMode');
		if (e.perm === 'edit') {
			toolbarButtons.forEach((id) => {
				this.enableItem(id, true);
			});
			PermissionMode.style.display = 'none';
		} else {
			toolbarButtons.forEach((id) => {
				this.enableItem(id, false);
			});
			this.enableItem('comment_wizard', true);
			if ($('#mobile-edit-button').is(':hidden')) {
				PermissionMode.style.display = 'block';
			}
		}
	},

	onCommandStateChanged: function(e) {
		var commandName = e.commandName;
		var state = e.state;

		if (this.map.isEditMode() && (state === 'enabled' || state === 'disabled')) {
			var id = window.unoCmdToToolbarId(commandName);

			if (state === 'enabled') {
				this.enableItem(id, true);
			} else {
				//this.uncheck(id);
				this.enableItem(id, false);
			}
		}
	},
});

L.control.mobileTopBar = function (docType) {
	return new L.Control.MobileTopBar(docType);
};

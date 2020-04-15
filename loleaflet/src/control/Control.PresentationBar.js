/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.PresentationBar
 */

/* global $ w2ui _ _UNO vex */
L.Control.PresentationBar = L.Control.extend({
	options: {
		shownavigation: true
	},

	onAdd: function (map) {
		this.map = map;
		this.create();

		map.on('wopiprops', this.onWopiProps, this);
		map.on('doclayerinit', this.onDocLayerInit, this);
		map.on('updatepermission', this.onUpdatePermission, this);
	},

	create: function() {
		var that = this;
		var toolbar = $('#presentation-toolbar');
		toolbar.w2toolbar({
			name: 'presentation-toolbar',
			tooltip: 'bottom',
			hidden: true,
			items: [
				{type: 'html',  id: 'left'},
				{type: 'button',  id: 'presentation', img: 'presentation', hidden:true, hint: _('Fullscreen presentation')},
				{type: 'break', id: 'presentationbreak', hidden:true},
				{type: 'button',  id: 'insertpage', img: 'insertpage', hint: _UNO('.uno:TaskPaneInsertPage', 'presentation')},
				{type: 'button',  id: 'duplicatepage', img: 'duplicatepage', hint: _UNO('.uno:DuplicateSlide', 'presentation')},
				{type: 'button',  id: 'deletepage', img: 'deletepage', hint: _UNO('.uno:DeleteSlide', 'presentation')},
				{type: 'html',  id: 'right'}
			],
			onClick: function (e) {
				that.onClick(e, e.target);
				window.hideTooltip(this, e.target);
			}
		});
		toolbar.bind('touchstart', function() {
			w2ui['presentation-toolbar'].touchStarted = true;
		});
	},

	onDelete: function(e) {
		if (e !== false) {
			this.map.deletePage();
		}
	},

	onClick: function(e, id, item) {
		if ('presentation-toolbar' in w2ui && w2ui['presentation-toolbar'].get(id) !== null) {
			var toolbar = w2ui['presentation-toolbar'];
			item = toolbar.get(id);
		}

		// In the iOS app we don't want clicking on the toolbar to pop up the keyboard.
		if (!window.ThisIsTheiOSApp && id !== 'zoomin' && id !== 'zoomout' && id !== 'mobile_wizard' && id !== 'insertion_mobile_wizard') {
			this.map.focus(this.map.canAcceptKeyboardInput()); // Maintain same keyboard state.
		}

		if (item.disabled) {
			return;
		}

		if ((id === 'presentation') && this.map.getDocType() === 'presentation') {
			this.map.fire('fullscreen');
		}
		else if (id === 'insertpage') {
			this.map.insertPage();
		}
		else if (id === 'duplicatepage') {
			this.map.duplicatePage();
		}
		else if (id === 'deletepage') {
			vex.dialog.confirm({
				message: _('Are you sure you want to delete this page?'),
				buttons: [
					$.extend({}, vex.dialog.buttons.YES, { text: _('OK') }),
					$.extend({}, vex.dialog.buttons.NO, { text: _('Cancel') })
				],
				callback: this.onDelete.bind(this)
			});
		}
	},

	onWopiProps: function(e) {
		if (e.HideExportOption) {
			w2ui['presentation-toolbar'].hide('presentation', 'presentationbreak');
		}
	},

	onDocLayerInit: function() {
		var docType = this.map.getDocType();
		switch (docType) {
		case 'presentation':
			var presentationToolbar = w2ui['presentation-toolbar'];
			if (!this.map['wopi'].HideExportOption && presentationToolbar) {
				presentationToolbar.show('presentation', 'presentationbreak');
			}

			// FALLTHROUGH intended
		case 'drawing':
			if (!window.mode.isMobile()) {
				$('#presentation-toolbar').show();
			}
		}
	},

	onUpdatePermission: function(e) {
		var presentationButtons = ['insertpage', 'duplicatepage', 'deletepage'];
		var that = this;

		if (e.perm === 'edit') {
			var toolbar = w2ui['presentation-toolbar'];
			if (toolbar) {
				presentationButtons.forEach(function(id) {
					toolbar.enable(id);
				});
			}

			if (toolbar) {
				presentationButtons.forEach(function(id) {
					if (id === 'deletepage') {
						var itemState = that.map['stateChangeHandler'].getItemValue('.uno:DeletePage');
					} else if (id === 'insertpage') {
						itemState = that.map['stateChangeHandler'].getItemValue('.uno:InsertPage');
					} else if (id === 'duplicatepage') {
						itemState = that.map['stateChangeHandler'].getItemValue('.uno:DuplicatePage');
					} else {
						itemState = 'enabled';
					}

					if (itemState === 'enabled') {
						toolbar.enable(id);
					} else {
						toolbar.disable(id);
					}
				});
			}
		} else {
			toolbar = w2ui['presentation-toolbar'];
			if (toolbar) {
				presentationButtons.forEach(function(id) {
					toolbar.disable(id);
				});
			}
		}
	},
});

L.control.presentationBar = function (options) {
	return new L.Control.PresentationBar(options);
};

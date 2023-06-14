/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.PresentationBar
 */

/* global $ w2ui _ _UNO */
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
		map.on('commandstatechanged', this.onCommandStateChanged, this);

		if (this.map.getDocType() === 'presentation') {
			this.map.on('updateparts', this.onSlideHideToggle, this);
			this.map.on('toggleslidehide', this.onSlideHideToggle, this);
		}
	},

	create: function() {
		var that = this;
		var toolbar = $('#presentation-toolbar');
		toolbar.w2toolbar({
			name: 'presentation-toolbar',
			hidden: true,
			items: [
				{type: 'html',  id: 'left'},
				{type: 'button',  id: 'presentation', img: 'presentation', hidden:true, hint: this._getItemUnoName('presentation')},
				{type: 'break', id: 'presentationbreak', hidden:true},
				{type: 'button',  id: 'insertpage', img: 'insertpage', hint: this._getItemUnoName('insertpage')},
				{type: 'button',  id: 'duplicatepage', img: 'duplicatepage', hint: this._getItemUnoName('duplicatepage')},
				{type: 'button',  id: 'deletepage', img: 'deletepage', hint: this._getItemUnoName('deletepage')},
				{type: 'button', id: 'showslide', img: 'showslide', hidden: that.map.getDocType() !== 'presentation', hint: _UNO('.uno:ShowSlide', 'presentation')},
				{type: 'button', id: 'hideslide', img: 'hideslide', hidden: that.map.getDocType() !== 'presentation', hint: _UNO('.uno:HideSlide', 'presentation')},
				{type: 'html',  id: 'right'}
			],
			onClick: function (e) {
				that.onClick(e, e.target);
				window.hideTooltip(this, e.target);
			}
		});

		this.map.uiManager.enableTooltip(toolbar);

		if (this.map.getDocType() === 'drawing')
			w2ui['presentation-toolbar'].disable('presentation');

		toolbar.bind('touchstart', function() {
			w2ui['presentation-toolbar'].touchStarted = true;
		});
	},

	_getItemUnoName: function(id) {
		var docType = this.map.getDocType();
		switch (id) {
		case 'presentation':
			return docType === 'presentation' ? _('Fullscreen presentation') : '';
		case 'insertpage':
			return docType === 'presentation' ? _UNO('.uno:TaskPaneInsertPage', 'presentation') : _UNO('.uno:InsertPage', 'presentation');
		case 'duplicatepage':
			return docType === 'presentation' ? _UNO('.uno:DuplicateSlide', 'presentation') : _UNO('.uno:DuplicatePage', 'presentation');
		case 'deletepage':
			return docType === 'presentation' ? _UNO('.uno:DeleteSlide', 'presentation') : _UNO('.uno:DeletePage', 'presentation');
		}
		return '';
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
			this.map.dispatch('deletepage');
		}
		else if (id === 'showslide') {
			this.map.showSlide();
		}
		else if (id === 'hideslide') {
			this.map.hideSlide();
		}
	},

	onWopiProps: function(e) {
		if (e.HideExportOption) {
			w2ui['presentation-toolbar'].hide('presentation', 'presentationbreak');
		}
	},

	onDocLayerInit: function() {
		var presentationToolbar = w2ui['presentation-toolbar'];
		if (!this.map['wopi'].HideExportOption && presentationToolbar && this._map.getDocType() !== 'drawing') {
			presentationToolbar.show('presentation', 'presentationbreak');
		}

		if (!window.mode.isMobile()) {
			$('#presentation-toolbar').show();
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

	onCommandStateChanged: function(e) {
		var commandName = e.commandName;
		var state = e.state;

		if (this.map.isEditMode() && (state === 'enabled' || state === 'disabled')) {
			var id = window.unoCmdToToolbarId(commandName);

			if (id === 'deletepage' || id === 'insertpage' || id === 'duplicatepage') {
				var toolbar = w2ui['presentation-toolbar'];

				if (state === 'enabled') {
					toolbar.enable(id);
				} else {
					toolbar.uncheck(id);
					toolbar.disable(id);
				}
			}
		}
	},

	onSlideHideToggle: function() {
		if (this.map.getDocType() !== 'presentation')
			return;


		if (!this.map._docLayer.isHiddenSlide(this.map.getCurrentPartNumber()))
			w2ui['presentation-toolbar'].hide('showslide');

		else
		w2ui['presentation-toolbar'].show('showslide');

		if (this.map._docLayer.isHiddenSlide(this.map.getCurrentPartNumber()))
			w2ui['presentation-toolbar'].hide('hideslide');
		else
		w2ui['presentation-toolbar'].show('hideslide');
	},
});

L.control.presentationBar = function (options) {
	return new L.Control.PresentationBar(options);
};

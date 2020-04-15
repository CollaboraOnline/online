/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.SheetsBar
 */

/* global $ w2ui _ */
L.Control.SheetsBar = L.Control.extend({
	options: {
		shownavigation: true
	},

	onAdd: function (map) {
		this.map = map;
		this.create();

		map.on('doclayerinit', this.onDocLayerInit, this);
		map.on('updatepermission', this.onUpdatePermission, this);
	},

	create: function() {
		var that = this;
		var toolbar = $('#spreadsheet-toolbar');
		toolbar.w2toolbar({
			name: 'spreadsheet-toolbar',
			tooltip: 'bottom',
			hidden: true,
			items: [
				{type: 'button',  hidden: !this.options.shownavigation, id: 'firstrecord',  img: 'firstrecord', hint: _('First sheet')},
				{type: 'button',  hidden: !this.options.shownavigation, id: 'prevrecord',  img: 'prevrecord', hint: _('Previous sheet')},
				{type: 'button',  hidden: !this.options.shownavigation, id: 'nextrecord',  img: 'nextrecord', hint: _('Next sheet')},
				{type: 'button',  hidden: !this.options.shownavigation, id: 'lastrecord',  img: 'lastrecord', hint: _('Last sheet')},
				{type: 'button',  id: 'insertsheet', img: 'insertsheet', hint: _('Insert sheet')}
			],
			onClick: function (e) {
				that.onClick(e, e.target);
				window.hideTooltip(this, e.target);
			}
		});
		toolbar.bind('touchstart', function(e) {
			w2ui['spreadsheet-toolbar'].touchStarted = true;
			var touchEvent = e.originalEvent;
			if (touchEvent && touchEvent.touches.length > 1) {
				L.DomEvent.preventDefault(e);
			}
		});
		toolbar.show();
	},

	onClick: function(e, id, item) {
		if ('spreadsheet-toolbar' in w2ui && w2ui['spreadsheet-toolbar'].get(id) !== null) {
			var toolbar = w2ui['spreadsheet-toolbar'];
			item = toolbar.get(id);
		}

		// In the iOS app we don't want clicking on the toolbar to pop up the keyboard.
		if (!window.ThisIsTheiOSApp && id !== 'zoomin' && id !== 'zoomout' && id !== 'mobile_wizard' && id !== 'insertion_mobile_wizard') {
			this.map.focus(this.map.canAcceptKeyboardInput()); // Maintain same keyboard state.
		}

		if (item.disabled) {
			return;
		}

		if (id === 'insertsheet') {
			var nPos = $('#spreadsheet-tab-scroll')[0].childElementCount;
			this.map.insertPage(nPos);
			this.map.insertPage.scrollToEnd = true;
		}
		else if (id === 'firstrecord') {
			$('#spreadsheet-tab-scroll').scrollLeft(0);
		}
		// TODO: We should get visible tab's width instead of 60px
		else if (id === 'nextrecord') {
			$('#spreadsheet-tab-scroll').scrollLeft($('#spreadsheet-tab-scroll').scrollLeft() + 60);
		}
		else if (id === 'prevrecord') {
			$('#spreadsheet-tab-scroll').scrollLeft($('#spreadsheet-tab-scroll').scrollLeft() - 30);
		}
		else if (id === 'lastrecord') {
			// Set a very high value, so that scroll is set to the maximum possible value internally.
			// https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollLeft
			L.DomUtil.get('spreadsheet-tab-scroll').scrollLeft = 100000;
		}
	},

	onDocLayerInit: function() {
		var docType = this.map.getDocType();
		if (docType == 'spreadsheet') {
			if (!window.mode.isMobile()) {
				$('#spreadsheet-toolbar').show();
			}

			var toolbar = w2ui['spreadsheet-toolbar'];
			if (toolbar)
				toolbar.resize();
		}
	},

	onUpdatePermission: function(e) {
		var spreadsheetButtons = ['insertsheet'];
		var toolbar = w2ui.formulabar;

		if (e.perm === 'edit') {
			toolbar = w2ui['spreadsheet-toolbar'];
			if (toolbar) {
				spreadsheetButtons.forEach(function(id) {
					toolbar.enable(id);
				});
			}
		} else {
			toolbar = w2ui['spreadsheet-toolbar'];
			if (toolbar) {
				spreadsheetButtons.forEach(function(id) {
					toolbar.disable(id);
				});
			}
		}
	},
});

L.control.sheetsBar = function (options) {
	return new L.Control.SheetsBar(options);
};

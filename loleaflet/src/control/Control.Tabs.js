/*
 * L.Control.Tabs is used to switch sheets in Calc
 */

/* global $ vex _ map */
L.Control.Tabs = L.Control.extend({
	onAdd: function(map) {
		map.on('updatepermission', this._onUpdatePermission, this);
		this._initialized = false;
	},

	_onUpdatePermission: function(e) {
		if (this._map.getDocType() !== 'spreadsheet') {
			return;
		}

		if (!this._initialized) {
			this._initialize();
		}
		setTimeout(function() {
			$('.spreadsheet-tab').contextMenu(e.perm === 'edit');
		}, 1000);
	},

	_initialize: function () {
		this._initialized = true;
		this._tabsInitialized = false;
		this._spreadsheetTabs = {};
		var docContainer = map.options.documentContainer;
		this._tabsCont = L.DomUtil.create('div', 'spreadsheet-tabs-container', docContainer.parentElement);

		$.contextMenu({
			selector: '.spreadsheet-tab',
			className: 'loleaflet-font',
			callback: function(key, options) {
				var nPos = parseInt(options.$trigger.attr('id').split('spreadsheet-tab')[1]);

				if (key === 'insertsheetbefore') {
					map.insertPage(nPos);
				}
				if (key === 'insertsheetafter') {
					map.insertPage(nPos + 1);
				}
			},
			items: {
				'insertsheetbefore': {name: _('Insert sheet before this')},
				'insertsheetafter': {name: _('Insert sheet after this')},
				'deletesheet': {name: _('Delete sheet'),
						callback: function(key, options) {
							var nPos = parseInt(options.$trigger.attr('id').split('spreadsheet-tab')[1]);
							vex.dialog.confirm({
								message: _('Are you sure you want to delete sheet, %sheet% ?').replace('%sheet%', options.$trigger.text()),
								callback: function(data) {
									if (data) {
										map.deletePage(nPos);
									}
								}
							});
						}
				 },
				'renamesheet': {name: _('Rename sheet'),
							callback: function(key, options) {
								var nPos = parseInt(options.$trigger.attr('id').split('spreadsheet-tab')[1]);
								vex.dialog.open({
									message: _('Enter new sheet name'),
									input: '<input name="sheetname" type="text" required />',
									callback: function(data) {
										map.renamePage(data.sheetname, nPos);
									}
								});
							}}
			},
			zIndex: 1000
		});

		map.on('updateparts', this._updateDisabled, this);
	},

	_updateDisabled: function (e) {
		var parts = e.parts;
		var selectedPart = e.selectedPart;
		var docType = e.docType;
		if (docType === 'text') {
			return;
		}
		if (docType === 'spreadsheet') {
			if (!this._tabsInitialized) {
				// make room for the preview
				var docContainer = this._map.options.documentContainer;
				L.DomUtil.addClass(docContainer, 'spreadsheet-document');
				setTimeout(L.bind(function () {
					this._map.invalidateSize();
					$('.scroll-container').mCustomScrollbar('update');
					$('.scroll-container').mCustomScrollbar('scrollTo', [0, 0]);
				}, this), 100);
				this._tabsInitialized = true;
			}
			if ('partNames' in e) {
				while (this._tabsCont.firstChild) {
					this._tabsCont.removeChild(this._tabsCont.firstChild);
				}
				var ssTabScroll = L.DomUtil.create('div', 'spreadsheet-tab-scroll', this._tabsCont);
				ssTabScroll.id = 'spreadsheet-tab-scroll';

				for (var i = 0; i < parts; i++) {
					var id = 'spreadsheet-tab' + i;
					var tab = L.DomUtil.create('div', 'spreadsheet-tab', ssTabScroll);
					tab.innerHTML = e.partNames[i];
					tab.id = id;

					L.DomEvent
						.on(tab, 'click', L.DomEvent.stopPropagation)
						.on(tab, 'click', L.DomEvent.stop)
						.on(tab, 'click', this._setPart, this)
						.on(tab, 'click', this._refocusOnMap, this);
					this._spreadsheetTabs[id] = tab;
				}
			}
			for (var key in this._spreadsheetTabs) {
				var part =  parseInt(key.match(/\d+/g)[0]);
				L.DomUtil.removeClass(this._spreadsheetTabs[key], 'spreadsheet-tab-selected');
				if (part === selectedPart) {
					L.DomUtil.addClass(this._spreadsheetTabs[key], 'spreadsheet-tab-selected');
				}
			}
		}
	},

	_setPart: function (e) {
		var part =  e.target.id.match(/\d+/g)[0];
		if (part !== null) {
			this._map.setPart(parseInt(part));
		}
	}
});

L.control.tabs = function (options) {
	return new L.Control.Tabs(options);
};

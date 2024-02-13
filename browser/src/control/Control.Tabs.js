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
 * L.Control.Tabs is used to switch sheets in Calc
 */

/* global $ _ _UNO Hammer cool */
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
		}, 100);

		if (window.mode.isMobile()) {
			if (e.perm === 'edit') {
				document.getElementById('spreadsheet-toolbar').style.display = 'block';
			}
			else {
				document.getElementById('spreadsheet-toolbar').style.display = 'none';
			}
		}
	},

	_initialize: function () {
		this._initialized = true;
		this._tabsInitialized = false;
		this._spreadsheetTabs = {};
		this._tabForContextMenu = 0;
		var map = this._map;
		var tableCell = document.getElementById('tb_spreadsheet-toolbar_right');
		tableCell.style.verticalAlign = 'middle';
		this._tabsCont = L.DomUtil.create('div', 'spreadsheet-tabs-container', tableCell);
		var that = this;
		function areTabsMultiple() {
			var numItems = $('.spreadsheet-tab').length;
			if (numItems === 1) {
				return false;
			}
			return true;
		}

		this._menuItem = {
			'insertsheetbefore': {name: _('Insert sheet before this'),
				callback: (this._insertSheetBefore).bind(this)
			},
			'insertsheetafter': {name: _('Insert sheet after this'),
				callback: (this._insertSheetAfter).bind(this)
			},
			'.uno:Remove': {
				name: _UNO('.uno:Remove', 'spreadsheet', true),
				callback: (this._deleteSheet).bind(this),
				visible: areTabsMultiple
			},
			'.uno:Name': {name: _UNO('.uno:RenameTable', 'spreadsheet', true),
				callback: (this._renameSheet).bind(this)
			},
			'.uno:Protect': {
				name: _UNO('.uno:Protect', 'spreadsheet', true),
				callback: (this._protectSheet).bind(this),
			},
			'.uno:Show': {
				name: _UNO('.uno:Show', 'spreadsheet', true),
				callback: (this._showSheet).bind(this),
				visible: function() {
					return that._map.hasAnyHiddenPart();
				}
			},
			'.uno:Hide': {
				name: _UNO('.uno:Hide', 'spreadsheet', true),
				callback: (this._hideSheet).bind(this),
				visible: areTabsMultiple
			},
			'movesheetleft': {
				name: _('Move Sheet Left'),
				callback: (this._moveSheetLeft).bind(this),
				visible: areTabsMultiple
			},
			'movesheetright': {
				name: _('Move Sheet Right'),
				callback: (this._moveSheetRight).bind(this),
				visible: areTabsMultiple
			},
		};

		if (!window.mode.isMobile()) {

			// no blacklisting available for this context menu so only add when needed
			this._menuItem['.uno:Move'] = {
				name: _UNO('.uno:Move', 'spreadsheet', true),
				callback: (this._moveOrCopySheet).bind(this),
				visible: areTabsMultiple
			};

			this._menuItem['.uno:CopyTab'] = {
				name: _('Copy Sheet...'),
				callback: function() {this._map.sendUnoCommand('.uno:Move');}.bind(this),
				visible: function() {
					return !areTabsMultiple();
				}
			};
			    if (!this._map.isReadOnlyMode() || window.mode.isTablet()) {
				L.installContextMenu({
					selector: '.spreadsheet-tab',
					className: 'cool-font',
					items: this._menuItem,
					zIndex: 1000
				});
			}
		}

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
				this._tabsInitialized = true;
			}

			// Save scroll position
			var horizScrollPos = 0;
			var scrollDiv = L.DomUtil.get('spreadsheet-tab-scroll');
			if (scrollDiv) {
				horizScrollPos = scrollDiv.scrollLeft;
			}

			if ('partNames' in e) {
				while (this._tabsCont.firstChild) {
					this._tabsCont.removeChild(this._tabsCont.firstChild);
				}
				var ssTabScroll = L.DomUtil.create('div', 'spreadsheet-tab-scroll', this._tabsCont);
				ssTabScroll.id = 'spreadsheet-tab-scroll';
				if (!window.mode.isMobile())
					ssTabScroll.style.overflow = 'hidden';

				this._tabsCont.style.display = 'grid';

				var menuItemMobile = {};
				Object.assign(menuItemMobile,
					{
						'insertsheetbefore' : this._menuItem['insertsheetbefore'],
						'insertsheetafter'  :   this._menuItem['insertsheetafter'],
						'Name' : this._menuItem['.uno:Name'],
					}
				);
				if (this._map.hasAnyHiddenPart()) {
					Object.assign(menuItemMobile, {
						'Show' : this._menuItem['.uno:Show'],
					});
				}
				if (this._map.getNumberOfVisibleParts() !== 1) {
					Object.assign(menuItemMobile,
						{
							'Remove': this._menuItem['.uno:Remove'],
							'Hide': this._menuItem['.uno:Hide'],
							'movesheetleft': this._menuItem['movesheetleft'],
							'movesheetright': this._menuItem['movesheetright'],
						}
					);
				}

				if (window.mode.isMobile()) {
					var menuData = L.Control.JSDialogBuilder.getMenuStructureForMobileWizard(menuItemMobile, true, '');
				}

				for (var i = 0; i < parts; i++) {
					if (e.hiddenParts.indexOf(i) !== -1)
						continue;

					// create a drop zone indicator for the sheet tab
					// put the indicator on the left of the tab
					var dropZoneIndicator = L.DomUtil.create('div', 'tab-drop-area', ssTabScroll);
					dropZoneIndicator.id = 'drop-zone-' + i;
					var id = 'spreadsheet-tab' + i;
					var tab = L.DomUtil.create('button', 'spreadsheet-tab', ssTabScroll);
					if (window.mode.isMobile() || window.mode.isTablet()) {
						(new Hammer(tab, {recognizers: [[Hammer.Press]]}))
							.on('press', function (j) {
								return function(e) {
									this._tabForContextMenu = j;
									if (!this._map.isReadOnlyMode()) {
										if (window.mode.isMobile()) {
											window.contextMenuWizard = true;
											this._map.fire('mobilewizard', {data: menuData});
										} else {
											$(e.target).trigger('contextmenu');
                                        }
									}
								};
							}(i).bind(this));
					}

					if (i === selectedPart) {
						horizScrollPos = tab.offsetLeft;
					}

					if (!window.mode.isMobile()) {
						L.DomEvent.on(tab, 'dblclick', function(j) {
							return function() {
								// window.app.console.err('Double clicked ' + j);
								this._tabForContextMenu = j;
								this._renameSheet();
							};
						}(i).bind(this));
						L.DomEvent.on(tab, 'contextmenu', function(j) {
							return function() {
								this._tabForContextMenu = j;
							};
						}(i).bind(this));
					}

					tab.textContent = e.partNames[i];
					tab.id = id;

					L.DomEvent
						.on(tab, 'click', L.DomEvent.stopPropagation)
						.on(tab, 'click', L.DomEvent.stop)
						.on(tab, 'click', this._setPart, this)
						.on(tab, 'click', this._map.focus, this._map);
					this._addDnDHandlers(tab);
					this._spreadsheetTabs[id] = tab;
				}

				// add an additional dropZoneIndicator for the last sheet tab
				// put the indicator on the right of the last tab
				var dropZoneIndicatorForTheLastTab = L.DomUtil.create('div', 'tab-drop-area', ssTabScroll);
				dropZoneIndicatorForTheLastTab.id = 'drop-zone-end';

				// create drop zone container for the last drop zone indicator
				// when a tab is over this container, dropZoneIndicatorForTheLastTab will be shown
				var dropZoneEndContainer = L.DomUtil.create('div', '', ssTabScroll);
				dropZoneEndContainer.id = 'drop-zone-end-container';
				this._addDnDHandlers(dropZoneEndContainer);
				dropZoneEndContainer.setAttribute('draggable', false);
			}
			for (var key in this._spreadsheetTabs) {
				var part =  parseInt(key.match(/\d+/g)[0]);
				L.DomUtil.removeClass(this._spreadsheetTabs[key], 'spreadsheet-tab-selected');
				if (part === selectedPart) {
					// close auto filter popups on sheet tab selected
					this._map.fire('closeAutoFilterDialog');
					L.DomUtil.addClass(this._spreadsheetTabs[key], 'spreadsheet-tab-selected');
				}
			}

			// Restore horizontal scroll position
			scrollDiv = L.DomUtil.get('spreadsheet-tab-scroll');
			if (scrollDiv) {
				if (this._map.insertPage && this._map.insertPage.scrollToEnd) {
					this._map.insertPage.scrollToEnd = false;
					scrollDiv.scrollLeft = scrollDiv.scrollWidth;
				}
				else {
					scrollDiv.scrollLeft = horizScrollPos;
				}
			}
		}
	},

	_addDnDHandlers: function(element) {
		if (!this._map.isReadOnlyMode()) {
			element.setAttribute('draggable', true);
			element.addEventListener('dragstart', this._handleDragStart.bind(this), false);
			element.addEventListener('dragenter', this._handleDragEnter, false);
			element.addEventListener('dragover', this._handleDragOver, false);
			element.addEventListener('dragleave', this._handleDragLeave, false);
			element.addEventListener('drop', this._handleDrop.bind(this), false);
			element.addEventListener('dragend', this._handleDragEnd, false);
		}
	},

	// Set the part by index. Return true if cancelled.
	_setPartIndex: function(index) {
		if (cool.Comment.isAnyEdit()) {
			cool.CommentSection.showCommentEditingWarning();
			return true;
		}

		this._map._docLayer._clearReferences();
		this._map.setPart(index, /*external:*/ false, /*calledFromSetPartHandler:*/ true);
	},

	_setPart: function (e) {
		var part =  e.target.id.match(/\d+/g)[0];
		if (part !== null) {
			this._setPartIndex(parseInt(part));
		}
	},

	//selected sheet is moved to new index
	_moveSheet: function (newIndex) {
		this._map.sendUnoCommand('.uno:Move?Copy:bool=false&UseCurrentDocument:bool=true&Index=' + newIndex);
	},

	_moveOrCopySheet: function () {
		var contextMenuTab = this._tabForContextMenu;
		this._map.sendUnoCommand('.uno:Move?FromContextMenu:bool=true&MoveOrCopySheetDialog:bool=true&ContextMenuIndex=' + contextMenuTab);
	},

	_moveSheetLR: function (contextMenuTab, newIndex) {
		if (contextMenuTab !== undefined && contextMenuTab >= 0)
			this._map.sendUnoCommand('.uno:Move?Copy:bool=false&UseCurrentDocument:bool=true&FromContextMenu:bool=true&ContextMenuIndex=' + contextMenuTab + '&Index=' + newIndex);
	},

	_moveSheetLeft: function () {
		//core handles sheet with 1 base indexing
		// 0 index means last sheet
		var contextMenuTab = this._tabForContextMenu;
		if (contextMenuTab <= 0) return;

		// core handles the decreasing of contextMenuTab by 1
		// so, no need to do it here (for the second parameter)
		this._moveSheetLR(contextMenuTab, contextMenuTab);
	},

	_moveSheetRight: function () {
		var contextMenuTab = this._tabForContextMenu;

		/*
		Why there is '+3' ?
		- core handles sheet with 1 base indexing, add +1.
		- since we move right, add +1.
		- on the core side, there is a -1 for this value,
		so we add +1 again.
		*/
		this._moveSheetLR(contextMenuTab, contextMenuTab + 3);
	},

	_insertSheetBefore: function() {
		this._map.insertPage(this._tabForContextMenu);
	},

	_insertSheetAfter: function() {
		this._map.insertPage(this._tabForContextMenu + 1);
	},

	_deleteSheet: function() {
		var nPos = this._tabForContextMenu;
		var message = _('Are you sure you want to delete sheet, %sheet%?').replace('%sheet%', $('#spreadsheet-tab' + this._tabForContextMenu).text());

		this._map.uiManager.showInfoModal('delete-sheet-modal', '', message, '', _('OK'), function() {
			this._map.deletePage(nPos);
		}.bind(this), true, 'delete-sheet-modal-response');
	},

	_renameSheet: function() {
		var map = this._map;
		var nPos = this._tabForContextMenu;
		var tabName = $('#spreadsheet-tab' + this._tabForContextMenu).text();
		this._map.uiManager.showInputModal('rename-calc-sheet', _('Rename sheet'), _('Enter new sheet name'), tabName, _('OK'),
			function (value) {
				map.renamePage(value, nPos);
			});
	},

	// Trigger sheet protection. It seems that it does it for the current sheet
	// so we select it first.
	_protectSheet: function() {
		if (!this._setPartIndex(this._tabForContextMenu)) {
			this._map.sendUnoCommand('.uno:Protect');
		}
	},

	_showSheet: function() {
		this._map.showPage();
	},

	_hideSheet: function() {
		this._map.hidePage(this._tabForContextMenu);
	},

	_handleDragStart: function(e) {
		this._setPart(e);
		e.dataTransfer.effectAllowed = 'move';
	},

	_handleDragEnter: function() {

	},

	_handleDragOver: function(e) {
		if (e.preventDefault) {
			e.preventDefault();
		}

		// By default we move when dragging, but can
		// support duplication with ctrl in the future.
		e.dataTransfer.dropEffect = 'move';

		e.target.previousElementSibling.classList.add('tab-drop-area-active');

		return false;
	},

	_handleDragLeave: function (e) {
		e.target.previousElementSibling.classList.remove('tab-drop-area-active');
	},

	_handleDrop: function(e) {
		if (e.stopPropagation) {
			e.stopPropagation();
		}

		e.target.previousElementSibling.classList.remove('tab-drop-area-active');
		var targetIndex = this._map._docLayer._partNames.indexOf(e.target.innerText);
		this._moveSheet(targetIndex + 1); // drop to left side of the tab
	},

	_handleDragEnd: function (e) {
		e.target.previousElementSibling.classList.remove('tab-drop-area-active');
	}
});

L.control.tabs = function (options) {
	return new L.Control.Tabs(options);
};

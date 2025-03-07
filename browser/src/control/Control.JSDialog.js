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
 * L.Control.JSDialog - class which creates and updates dialogs, popups, snackbar
 */

/* global JSDialog Hammer app _ */
L.Control.JSDialog = L.Control.extend({
	options: {},
	dialogs: {},
	draggingObject: null,

	onAdd: function (map) {
		this.map = map;

		this.map.on('jsdialog', this.onJSDialog, this);
		this.map.on('jsdialogupdate', this.onJSUpdate, this);
		this.map.on('jsdialogaction', this.onJSAction, this);
		this.map.on('zoomend', this.onZoomEnd, this);
		this.map.on('closealldialogs', this.onCloseAll, this);
		this.map.on('closeAutoFilterDialog', this.closePopupsOnTabChange, this);
	},

	onRemove: function() {
		this.map.off('jsdialog', this.onJSDialog, this);
		this.map.off('jsdialogupdate', this.onJSUpdate, this);
		this.map.off('jsdialogaction', this.onJSAction, this);
		this.map.off('zoomend', this.onZoomEnd, this);
		this.map.off('closealldialogs', this.onCloseAll, this);
		this.map.off('closeAutoFilterDialog', this.closePopupsOnTabChange, this);
	},

	hasDialogOpened: function() {
		var dialogs = this.dialogs;
		return Object.keys(dialogs)
			.filter(function (key) {
				return key != 'snackbar' && dialogs[key].isDropdown !== true;
			})
			.length > 0;
	},

	hasDropdownOpened: function() {
		return Object.values(this.dialogs)
			.filter(function (dialog) { return dialog.isDropdown === true; })
			.length > 0;
	},

	hasSnackbarOpened: function() {
		return Object.keys(this.dialogs)
			.filter(function (key) { return key == 'snackbar'; })
			.length > 0;
	},

	clearDialog: function(id) {
		var builder = this.dialogs[id].builder;

		L.DomUtil.remove(this.dialogs[id].container);

		if (this.dialogs[id].overlay && !this.dialogs[id].isSubmenu)
			L.DomUtil.remove(this.dialogs[id].overlay);

		delete this.dialogs[id];

		return builder;
	},

	close: function(id, sendCloseEvent) {
		if (id !== undefined && this.dialogs[id]) {
			if (!sendCloseEvent && this.dialogs[id].overlay && !this.dialogs[id].isSubmenu)
				L.DomUtil.remove(this.dialogs[id].overlay);

			if (this.dialogs[id].timeoutId)
				clearTimeout(this.dialogs[id].timeoutId);

			if (this.dialogs[id].isPopup)
				this.closePopover(id, sendCloseEvent);
			else
				this.closeDialog(id, sendCloseEvent);
		}
	},

	closeAll: function(leaveSnackbar) {
		var dialogs = Object.keys(this.dialogs);
		for (var i = 0; i < dialogs.length; i++) {
			if (leaveSnackbar && dialogs[i] && dialogs[i] === 'snackbar')
				continue;

			this.close(dialogs[i], app.idleHandler._active);
		}
	},

	closeAllDropdowns: function() {
		var dialogs = Object.values(this.dialogs);
		for (var i = 0; i < dialogs.length; i++) {
			if (dialogs[i] && !dialogs[i].isDropdown)
				continue;

			this.close(dialogs[i].id, false);
		}
	},

	closeDialog: function(id, sendCloseEvent) {
		if (id === undefined || !this.dialogs[id]) {
			console.warn('missing dialog data');
			return;
		}

		this.focusToLastElement(id);

		var builder = this.clearDialog(id);
		if (sendCloseEvent !== false && builder)
			builder.callback('dialog', 'close', {id: '__DIALOG__'}, null, builder);
	},

	// sendCloseEvent means that we only send a command to the server
	// we want to kill HTML popup when we receive feedback from the server
	closePopover: function(id, sendCloseEvent) {
		if (id === undefined || !this.dialogs[id]) {
			console.warn('missing popover data');
			return;
		}

		var clickToClose = this.dialogs[id].clickToClose;
		var builder = this.dialogs[id].builder;

		if (sendCloseEvent) {
			// first try to close the dropdown if exists
			if (clickToClose && typeof clickToClose.closeDropdown === 'function')
				clickToClose.closeDropdown();
			if (clickToClose && L.DomUtil.hasClass(clickToClose, 'menubutton'))
				clickToClose.click();
			else if (builder)
				builder.callback('popover', 'close', {id: '__POPOVER__'}, null, builder);
			else
				console.warn('closePopover: no builder');
		}
		else {
			// Need to change focus to last element before we clear the current dialog
			this.focusToLastElement(id);
			this.clearDialog(id);
			return;
		}

		this.focusToLastElement(id);
	},

	onCloseAll: function() {
		this.closeAll(/*leaveSnackbar*/ true);
		// should also close all dropdowns on close all dialogs
		this.closeAllDropdowns();
	},

	focusToLastElement: function(id) {
		try {
			this.dialogs[id].lastFocusedElement.focus();
		}
		catch (error) {
			this.map.focus();
		}
	},

	setTabs: function() {
		console.error('setTabs: not implemented in dialogs.');
	},

	selectedTab: function() {
		// nothing to do here
	},

	_getDefaultButtonId: function(widgets) {
		for (var i in widgets) {
			if (widgets[i].type === 'pushbutton' || widgets[i].type === 'okbutton') {
				if (widgets[i].has_default === true)
					return widgets[i].id;
			}

			if (widgets[i].children) {
				var found = this._getDefaultButtonId(widgets[i].children);
				if (found)
					return found;
			}
		}

		return null;
	},

	fadeOutDialog: function(instance) {
		if (instance.id && this.dialogs[instance.id]) {
			var container = this.dialogs[instance.id].container;
			L.DomUtil.addClass(container, 'fadeout');
			container.onanimationend = function() { instance.that.close(instance.id, false); };
			// be sure it will be removed
			setTimeout(function() { instance.that.close(instance.id, false); }, 700);
		}
	},

	getOrCreateOverlay: function(instance) {
		// Submenu is created inside the same overlay as parent dropdown
		if (instance.isDropdown && instance.isSubmenu) {
			instance.overlay = document.body.querySelector('.jsdialog-overlay');
			return;
		}

		// Dialogue overlay which will allow automatic positioning and cancellation of the dialogue if cancellable.
		var overlay = L.DomUtil.get(instance.id + '-overlay');
		if (!overlay) {

			if (instance.noOverlay)
				return;

			overlay = L.DomUtil.create('div', 'jsdialog-overlay ' + (instance.cancellable && !instance.hasOverlay ? 'cancellable' : ''), instance.containerParent);
			overlay.id = instance.id + '-overlay';
			if (instance.cancellable) {
				// dropdowns are online-only components, don't exist in core
				var hasToNotifyServer = !instance.isDropdown;
				overlay.onclick = function () { this.close(instance.id, hasToNotifyServer); }.bind(this);
			}
		}
		instance.overlay = overlay;
	},

	isOnlyChild: function(instance) {
		const isMenu = instance.children && instance.children.length
			&& instance.children[0].id === '__MENU__';
		const isOnlyChild = instance.children && instance.children.length &&
			instance.children[0].children && instance.children[0].children.length === 1;
		return isMenu || isOnlyChild;
	},

	createContainer: function(instance, documentFragment) {
		// it has to be form to handle default button
		instance.container = L.DomUtil.create('div', 'jsdialog-window', documentFragment);
		instance.container.id = instance.id;

		instance.form = L.DomUtil.create('form', 'jsdialog-container ui-dialog ui-widget-content lokdialog_container', instance.container);
		instance.form.setAttribute('role', 'dialog');
		instance.form.setAttribute('aria-labelledby', instance.title);
		instance.form.setAttribute('autocomplete', 'off');
		// Prevent overlay from getting the click, except if we want click to dismiss
		// Like in the case of the inactivity message.
		// https://github.com/CollaboraOnline/online/issues/7403
		if (!instance.clickToDismiss) {
			instance.container.onclick = function(e) { e.stopPropagation(); };
		}

		if (instance.collapsed && (instance.collapsed === 'true' || instance.collapsed === true))
			L.DomUtil.addClass(instance.container, 'collapsed');

		// prevent from reloading
		instance.form.addEventListener('submit', function (event) { event.preventDefault(); });

		instance.defaultButtonId = this._getDefaultButtonId(instance.children);

		if (this.isOnlyChild(instance))
			instance.isOnlyChild = true;

		// it has to be first button in the form
		var defaultButton = L.DomUtil.createWithId('button', 'default-button', instance.form);
		defaultButton.style.display = 'none';
		defaultButton.onclick = function() {
			if (instance.defaultButtonId) {
				var button = instance.form.querySelector('#' + instance.defaultButtonId);
				if (button)
					button.click();
			}
		};

		if (instance.haveTitlebar) {
			instance.titlebar = L.DomUtil.create('div', 'ui-dialog-titlebar ui-corner-all ui-widget-header ui-helper-clearfix', instance.form);
			var title = L.DomUtil.create('h2', 'ui-dialog-title', instance.titlebar);
			title.innerText = instance.title;
			instance.titleCloseButton = L.DomUtil.create('button', 'ui-button ui-corner-all ui-widget ui-button-icon-only ui-dialog-titlebar-close', instance.titlebar);
			instance.titleCloseButton.setAttribute('aria-label', _('Close dialog'));
			instance.titleCloseButton.tabIndex = '0';
			L.DomUtil.create('span', 'ui-button-icon ui-icon ui-icon-closethick', instance.titleCloseButton);
		}

		if (instance.isModalPopUp || instance.isDocumentAreaPopup || instance.isSnackbar)
			L.DomUtil.addClass(instance.container, 'modalpopup');

		if (instance.isModalPopUp && !instance.popupParent) // Special case for menu popups (they are also modal dialogues).
			instance.overlay.classList.add('dimmed');

		if (instance.isSnackbar) {
			L.DomUtil.addClass(instance.container, 'snackbar');
			L.DomUtil.addClass(instance.form, 'snackbar');
		}

		instance.content = L.DomUtil.create('div', 'jsdialog lokdialog ui-dialog-content ui-widget-content' + (instance.isOnlyChild ? ' one-child-popup' : ''), instance.form);

		this.dialogs[instance.id] = {};
	},

	createDialog: function(instance) {
		instance.builder = new L.control.jsDialogBuilder(
			{
				windowId: instance.id,
				mobileWizard: this,
				map: this.map,
				cssClass: 'jsdialog' + (instance.isAutoPopup ? ' autofilter' : '') + (instance.isOnlyChild ? ' one-child-popup' : ''),
				callback: instance.callback
			});

		instance.builder.build(instance.content, [instance]);
		instance.builder.setContainer(instance.content);
		var primaryBtn = instance.content.querySelector('#' + instance.defaultButtonId);
		if (primaryBtn)
			L.DomUtil.addClass(primaryBtn, 'button-primary');
	},

	addFocusHandler: function(instance) {
		var failedToFindFocus = function() {
			if (document.getElementById(instance.init_focus_id))
				document.getElementById(instance.init_focus_id).focus();
			else {
				app.console.error('There is no focusable element in the modal. Either focusId should be given or modal should have a response button.');
				instance.that.close(instance.id, true);
				instance.that.map.focus();
			}
		};

		JSDialog.MakeFocusCycle(instance.container, failedToFindFocus);
	},

	addHandlers: function(instance) {
		var onInput = function(ev) {
			if (ev.isFirst)
				instance.that.draggingObject = instance.that.dialogs[instance.id];

			if (ev.isFinal && instance.that.draggingObject
				&& instance.that.draggingObject.translateX
				&& instance.that.draggingObject.translateY) {
				instance.that.draggingObject.startX = instance.that.draggingObject.translateX;
				instance.that.draggingObject.startY = instance.that.draggingObject.translateY;
				instance.that.draggingObject.translateX = 0;
				instance.that.draggingObject.translateY = 0;
				instance.that.draggingObject = null;
			}
		};

		if (instance.haveTitlebar) {
			instance.titleCloseButton.onclick = function() {
				instance.that.close(instance.id, true);
			};
		}

		if (instance.nonModal) {
			instance.titleCloseButton.onclick = function() {
				var newestDialog = Math.max.apply(null,
					Object.keys(instance.that.dialogs).map(function(i) { return parseInt(i);}));
				if (newestDialog > parseInt(instance.id))
					return;

				instance.that.closeDialog(instance.id, true);
			};

			var hammerTitlebar = new Hammer(instance.titlebar);
			hammerTitlebar.add(new Hammer.Pan({ threshold: 20, pointers: 0 }));

			hammerTitlebar.on('panstart', this.onPan.bind(this));
			hammerTitlebar.on('panmove', this.onPan.bind(this));
			hammerTitlebar.on('hammer.input', onInput);
		}

		var popupParent = instance.popupParent ? L.DomUtil.get(instance.popupParent) : null;

		this.addFocusHandler(instance); // Loop focus for all dialogues.

		var clickToCloseId = instance.clickToClose
			? instance.clickToClose.replaceAll(' ', '') : null;
		if (clickToCloseId && clickToCloseId.indexOf('.uno:') === 0)
			clickToCloseId = clickToCloseId.substr('.uno:'.length);

		var clickToCloseElement = null;
		if (clickToCloseId && popupParent) {
			clickToCloseElement = popupParent.querySelector('[id=\'' + clickToCloseId + '\']');
			// we avoid duplicated ids in unotoolbuttons - try with class
			if (!clickToCloseElement)
				clickToCloseElement = popupParent.querySelector('.uno' + clickToCloseId);
			// might be treeview entry
			if (!clickToCloseElement)
				instance.clickToCloseText = instance.clickToClose;
		} else if (clickToCloseId) {
			// fallback
			clickToCloseElement = L.DomUtil.get(clickToCloseId);
		}
		instance.clickToClose = clickToCloseElement;

		// setup initial focus and helper elements for closing popup
		var initialFocusElement = JSDialog.GetFocusableElements(instance.container);

		if (instance.canHaveFocus && initialFocusElement && initialFocusElement.length)
			initialFocusElement[0].focus();

		// pass the current instance and get the tabcontrol object if it exist
		// this will only search in current instance and not in whole document
		const tabControlWidget = this.findTabControl(instance);

		let focusWidget, firstFocusableElement ;

		if (tabControlWidget) {
			// get DOM element of tabControl from current instance
			focusWidget = instance.content.querySelector('[id="' + tabControlWidget.id + '"]');
			firstFocusableElement = JSDialog.GetFocusableElements(focusWidget);

		} else {
			// will directly set element of focusable element based on init focus id
			// If init_id is not defined, select the first focusable element from the container
			firstFocusableElement = instance.init_focus_id ? instance.container.querySelector('[id=\'' + instance.init_focus_id + '\']') : JSDialog.GetFocusableElements(instance.container);
		}

		if (firstFocusableElement && document.activeElement !== firstFocusableElement && instance.canHaveFocus) {
			// for tab control case we have more then 1 element that can be focusable so select the first tab for the list
			firstFocusableElement = firstFocusableElement.length > 0 ? firstFocusableElement[0] : firstFocusableElement;
			firstFocusableElement.focus();
		}
		else
			console.error('cannot get focus for widget: "' + instance.init_focus_id + '"');

		if (instance.isDropdown && instance.isSubmenu) {
			instance.container.addEventListener('mouseleave', function () {
				instance.builder.callback('combobox', 'hidedropdown', {id: instance.id}, null, instance.builder);
			});
		}
	},

	 findTabControl: function(obj) {
		if (obj.type === 'tabcontrol') {
			// this return the main tabcontrol object
			return obj;
		}
		if (obj.children && obj.children.length > 0) {
			for (let child of obj.children) {
				const result = this.findTabControl(child); // Recursively search in children
				if (result) return result; // If found, return the tabcontrol
			}
		}
		return null; // Return null if tabcontrol is not found
	},

	/// if you use updatePos - instance param is bound automatically
	setPosition: function(instance, updatedPos) {
		var calculated = false;
		var isRTL = document.documentElement.dir === 'rtl';

		if (instance.isSnackbar) {
			calculated = true;
			instance.posx = window.innerWidth/2 - instance.form.offsetWidth/2;
			instance.posy = window.innerHeight - instance.form.offsetHeight - 40;
		} else if (instance.nonModal || instance.popupParent) {
			// in case of toolbox we want to create popup positioned by toolitem not toolbox
			if (updatedPos) {
				calculated = true;
				instance.posx = updatedPos.x;
				instance.posy = updatedPos.y;
			}
			var parent = L.DomUtil.get(instance.popupParent);

			if (instance.clickToCloseId && parent) {
				var childButton = parent.querySelector('[id=\'' + instance.clickToCloseId + '\']');
				if (childButton)
					parent = childButton;
			} else if (instance.clickToCloseText && parent) { // treeview entry for context menu
				var treeNodes = parent.querySelectorAll('span.ui-treeview-cell-text');
				if (treeNodes && treeNodes.length) {
					treeNodes = Array.from(treeNodes);
					parent = treeNodes.find((value) => { return value.innerText == instance.clickToCloseText; });
				}
			}

			if (!parent && instance.popupParent === '_POPOVER_') {
				// popup was trigerred not by toolbar or menu button, probably on tile area
				if (instance.isAutoPopup) {
					// we are already done
					return;
				}
				else {
					console.warn('other popup than autofilter in the document area');
				}
			}

			if (parent) {
				calculated = true;
				instance.posx = parent.getBoundingClientRect().left;
				instance.posy = parent.getBoundingClientRect().bottom;

				if (instance.popupAnchor && instance.popupAnchor.indexOf('top') >= 0)
					instance.posy = parent.getBoundingClientRect().top;

				instance.container.style.minWidth = parent.getBoundingClientRect().width + 'px';

				if (isRTL)
					instance.posx = window.innerWidth - instance.posx;

				if (instance.popupAnchor && instance.popupAnchor.indexOf('end') >= 0)
					instance.posx += (isRTL ? 0 : 1) * (parent.clientWidth) - 15;

				if (instance.content.clientWidth > window.innerWidth)
					instance.container.style.maxWidth = (window.innerWidth - instance.posx - 20) + 'px';
				else if (instance.posx + instance.content.clientWidth > window.innerWidth)
					instance.posx -= instance.posx + instance.content.clientWidth + 10 - window.innerWidth;

				if (instance.content.clientHeight > window.innerHeight)
					instance.container.style.maxHeight = (window.innerHeight - instance.posy - 20) + 'px';
				else if (instance.posy + instance.content.clientHeight > window.innerHeight)
					instance.posy -= instance.posy + instance.content.clientHeight + 10 - window.innerHeight;
			}
			else {
				var height = instance.form.getBoundingClientRect().height;
				if (instance.posy + height > instance.containerParent.getBoundingClientRect().height) {
					calculated = true;
					var newTopPosition = instance.posy - height;
					if (newTopPosition < 0)
						newTopPosition = 0;
					instance.posy = newTopPosition;
				}

				var width = instance.form.getBoundingClientRect().width;
				if (isRTL)
					width = width * -1;

				if (instance.posx + width > instance.containerParent.getBoundingClientRect().width) {
					calculated = true;
					var newLeftPosition = instance.posx - width;
					if (newLeftPosition < 0)
						newLeftPosition = 0;
					instance.posx = newLeftPosition;
				}
			}
		}

		var positionNotSet = !instance.container.style || !instance.container.style.marginInlineStart;
		if (calculated || positionNotSet)
			this.setNewPosition(instance.container, instance.posx, instance.posy);
	},

	centerDialogPosition: function (instance) {
		var isRTL = document.documentElement.dir === 'rtl';
		var height = instance.form.getBoundingClientRect().height;
		var width = instance.form.getBoundingClientRect().width;
		instance.startX = instance.posx = (window.innerWidth - (isRTL ? (-1 * width) : width)) / 2;
		instance.startY = instance.posy = (window.innerHeight - height) / 2;
		instance.updatePos({x: instance.posx, y: instance.posy});
	},

	parentAutofilter : null,

	calculateAutoFilterPosition: function(instance) {
		// this is autofilter popup

		// RTL mode: only difference is when file is RTL not UI
		// var isViewRTL = document.documentElement.dir === 'rtl';
		var isSpreadsheetRTL = this.map._docLayer.isCalcRTL();

		var scale = this.map.zoomToFactor(this.map.getZoom());
		var origin = this.map.getPixelOrigin();
		var panePos = this.map._getMapPanePos();

		var offsetX = isSpreadsheetRTL ? 0 : app.sectionContainer.getSectionWithName(L.CSections.RowHeader.name).size[0];
		var offsetY = app.sectionContainer.getSectionWithName(L.CSections.ColumnHeader.name).size[1];

		if (this.isChildAutoFilter(instance)) {
			this.calculateSubmenuAutoFilterPosition(instance, this.parentAutofilter);
			return;
		}
		this.parentAutofilter = instance.form;
		const devicePixelRatio = app.dpiScale;
		// Convert the server-provided px values to screen coordinates
		instance.posx = instance.posx / devicePixelRatio;
		instance.posy = instance.posy / devicePixelRatio;
		var left = parseInt(instance.posx) * scale;
		var top = parseInt(instance.posy) * scale;

		var splitPanesContext = this.map.getSplitPanesContext();
		var splitPos = new L.Point(0, 0);

		if (splitPanesContext)
			splitPos = splitPanesContext.getSplitPos();

		var newLeft = left + panePos.x - origin.x;
		if (left >= splitPos.x && newLeft >= 0)
			left = newLeft;

		var newTop = top + panePos.y - origin.y;
		if (top >= splitPos.y && newTop >= 0)
			top = newTop;

		if (isSpreadsheetRTL)
			left = this.map._size.x - left;

		var canvasEl = this.map._docLayer._canvas.getBoundingClientRect();

		instance.posx = left + offsetX + canvasEl.left; // adding canvasEl.left in case we change sidebar to left of the screen
		// make margin from canvas top and not from window top
		instance.posy = top + offsetY + canvasEl.top;

		this.updateAutoPopPosition(instance.container, instance.posx, instance.posy);
	},

	isChildAutoFilter: function(instance) {
		// JSON structure suggests that if children array's first element has id='menu' and widgetType = 'treelistbox' then it will definitely be a child autofilter popup
		var rootChild = instance.children[0];
		if (rootChild) {
			var firstWidget = rootChild.children[0];
			return firstWidget ? (firstWidget.id === 'menu' && firstWidget.type === 'treelistbox') : false;
		}
		return false;
	},

	calculateSubmenuAutoFilterPosition: function(instance, parentAutofilter) {
		var parentAutofilter = parentAutofilter.getBoundingClientRect();
		instance.posx = parentAutofilter.right;
		instance.posy = parentAutofilter.top;

		// set margin start for child popup in rtl mode
		var isSpreadsheetRTL = this.map._docLayer.isCalcRTL();
		if (isSpreadsheetRTL) {
			var rtlPosx = parentAutofilter.left - instance.form.getBoundingClientRect().width;
			instance.posx = rtlPosx < 0 ? 0 : rtlPosx;
		}
		// set posx of instance (submenufilter) based on window width
		var width = instance.content.clientWidth;
		if (instance.posx + width > window.innerWidth)
			instance.posx -= instance.posx + width - window.innerWidth;

		// submenu filter popup should not go below toolbar element. Adjust height according to window height and bottom toolbar element so it will not overlap with each other
		var height = instance.form.getBoundingClientRect().height;
		if (instance.posy + height > window.innerHeight)
			instance.posy = window.innerHeight - height;

		this.updateAutoPopPosition(instance.container, instance.posx, instance.posy);
	},

	closePopupsOnTabChange: function() {
		//this.dialogs is an object
		var dialogKeys = Object.keys(this.dialogs);

		for (var i = 0; i < dialogKeys.length; i++) {
			var autoFilterDialogId = dialogKeys[i];
			var dialog = this.dialogs[autoFilterDialogId];

			// Check if the current dialog has the isAutoPopup (Autofilter or AutoPopup) property set to true
			if (dialog.isAutoPopup) {
				// Call this.close(key, true) for the current dialog
				this.close(autoFilterDialogId, true);
			}
		}
	},

	getAutoPopupParentContainer(instance) {
		// Parent container will
		if (instance.isAutofilter || instance.isAutoCompletePopup || !instance.isDocumentAreaPopup)
			return document.body
		return document.getElementById('document-container');
	},

	onJSDialog: function(e) {
		/*
			Dialog types:
				* Modal (isModalPopUp = true): non-movable + overlay + dimmed background.
				* Nonmodal: movable + no dim + no overlay (user can interact with the document).
				* Popup (Non-dialog) (isDocumentAreaPopup = true): overlay + no dim.
		*/

		// We will pass this here and there, so we can split the code into smaller functions.
		// Then we will save this into this.dialogs[].
		var instance = e.data;

		// Save last focused element, we will set the focus back to this element after this popup is closed.
		if (!this.dialogs[instance.id] || !this.dialogs[instance.id].lastFocusedElement) // Avoid to reset while updates.
			instance.lastFocusedElement = document.activeElement;

		instance.callback = e.callback;
		instance.isSnackbar = e.data.type === 'snackbar';
		instance.isDropdown = e.data.type === 'dropdown';
		instance.isModalPopUp = e.data.type === 'modalpopup' || instance.isDropdown;
		instance.snackbarTimeout = e.data.timeout;
		instance.isOnlyChild = false;
		instance.that = this;
		instance.startX = e.data.posx;
		instance.startY = e.data.posy;
		instance.updatePos = null;
		instance.canHaveFocus = !instance.isSnackbar && instance.id !== 'busypopup' && !instance.isAutoCompletePopup;
		instance.isDocumentAreaPopup = instance.popupParent === '_POPOVER_' && instance.posx !== undefined && instance.posy !== undefined;
		instance.isPopup = instance.isModalPopUp || instance.isDocumentAreaPopup || instance.isSnackbar;
		instance.isAutoPopup = instance.isDocumentAreaPopup && this.map._docLayer.isCalc();
		instance.isAutofilter = instance.isAutoPopup && !instance.isAutoFillPreviewTooltip && !instance.isAutoCompletePopup;// separate the autofilter case
		instance.containerParent = this.getAutoPopupParentContainer(instance);
		instance.haveTitlebar = (!instance.isModalPopUp && !instance.isSnackbar) || (instance.hasClose && instance.title && instance.title !== '');
		instance.nonModal = !instance.isModalPopUp && !instance.isDocumentAreaPopup && !instance.isSnackbar;

		// Make a better seperation between popups and modals.
		if (instance.isDocumentAreaPopup)
			instance.isModalPopUp = false;

		// Check.
		if (instance.popupParent === '_POPOVER_' && (instance.posx === undefined || instance.posy === undefined))
			console.error('There is a POPOVER dialogue without position information.');

		if (instance.action === 'fadeout')
		{
			this.fadeOutDialog(instance);
		}
		else if (instance.action === 'close')
		{
			this.close(instance.id, false);

			// Manage focus
			var dialogs = Object.keys(this.dialogs);
			if (dialogs.length) {
				var lastKey = dialogs[dialogs.length - 1];
				var container = this.dialogs[lastKey].container;
				if (container)
					container.focus();
				var initialFocusElement = JSDialog.GetFocusableElements(container);
				if (initialFocusElement && initialFocusElement.length)
					initialFocusElement[0].focus();
			} else {
				this.map.focus();
			}
		}
		else {
			// There is no action, so we create a new dialogue.
			if (instance.isModalPopUp || instance.isDocumentAreaPopup)
				this.getOrCreateOverlay(instance);

			if (this.dialogs[instance.id]) {
				instance.posx = this.dialogs[instance.id].startX;
				instance.posy = this.dialogs[instance.id].startY;
				var toRemove = this.dialogs[instance.id].container;
				L.DomUtil.remove(toRemove);
			}

			// We show some dialogs such as Macro Security Warning Dialog and Text Import Dialog (csv)
			// They are displayed before the document is loaded
			// Spinning should be happening until the 1st interaction with the user
			// which is the dialog opening in this case
			if (this.map)
				this.map._progressBar.end();

			const dialogDomParent = instance.overlay ? instance.overlay: instance.containerParent;
			const documentFragment = new DocumentFragment(); // do not modify dom yet

			this.createContainer(instance, documentFragment);
			this.createDialog(instance);

			// FIXME: remove this auto-bound instance so it will be clear what is passed
			instance.updatePos = this.setPosition.bind(this, instance);

			app.appendLayoutingTask(() => {
				// dialog built - add to DOM now
				const existingNode = dialogDomParent.querySelector('[id="' + instance.container.id + '"]');
				if (existingNode)
					existingNode.replaceWith(instance.container);
				else
					dialogDomParent.append(instance.container);

				// do in task to apply correct focus when already shown
				this.addHandlers(instance);

				// Special case for nonModal dialogues. Core side doesn't send their initial coordinates. We need to center them.
				if (instance.nonModal && !(instance.startX && instance.startY)) {
					this.centerDialogPosition(instance);
				} else {
					instance.updatePos();
				}

				// AutoPopup  will calculate popup position for Autofilter Popup
				if (instance.isAutofilter && !instance.isAutoFillPreviewTooltip)
					this.calculateAutoFilterPosition(instance);
				else if (instance.isAutoFillPreviewTooltip || instance.isAutoCompletePopup){
					this.updateAutoPopPosition(instance.container, instance.posx, instance.posy);
				}
			});

			this.dialogs[instance.id] = instance;

			if (instance.isSnackbar && instance.snackbarTimeout > 0) {
				instance.timeoutId = setTimeout(function () { app.map.uiManager.closeSnackbar(); }, instance.snackbarTimeout);
			}

			app.scheduleLayouting();
		}
	},

	onJSUpdate: function (e) {
		var data = e.data;

		if (data.jsontype !== 'dialog' && data.jsontype !== 'popup')
			return;

		var dialog = this.dialogs[data.id] ? this.dialogs[data.id].container : null;
		if (!dialog)
			return;

		var builder = new L.control.jsDialogBuilder({windowId: data.id,
			mobileWizard: this,
			map: this.map,
			cssClass: 'jsdialog',
			callback: e.callback
		});

		builder.updateWidget(dialog, data.control);

		var dialogInfo = this.dialogs[data.id];
		if (dialogInfo.isDocumentAreaPopup) {
			// In case of AutocompletePopup's update data would have posx, posy
			dialogInfo.updatePos(new L.Point(data.posx, data.posy));
		}

		// FIXME: remove 100 ms magic timing, drawing areas should request dialog position update
		//        when they receive payload with bigger content
		setTimeout(function () { dialogInfo.updatePos(); }, 100);
	},

	onJSAction: function (e) {
		var data = e.data;
		var innerData = data.data;

		if (data.jsontype === 'formulabar' && innerData && innerData.separator)
			app.calc.decimalSeparator = innerData.separator;

		if (data.jsontype !== 'dialog' && data.jsontype !== 'popup')
			return;

		var dialog = this.dialogs[data.id];
		if (!dialog)
			return;

		var builder = dialog.builder;
		if (!builder)
			return;

		var dialogContainer = dialog.container;
		if (!dialogContainer)
			return;

		// focus on element outside view will move viewarea leaving blank space on the bottom
		if (innerData.action_type === 'grab_focus') {
			var control = dialogContainer.querySelector('[id=\'' + innerData.control_id + '\']');
			var controlPosition = control ? control.getBoundingClientRect() : null;
			if (controlPosition && (controlPosition.bottom > window.innerHeight ||
				controlPosition.right > window.innerWidth)) {
				this.centerDialogPosition(dialog); // will center it
			}
		}

		builder.executeAction(dialogContainer, innerData);
	},

	_clamp: function(value, min, max) {
		return Math.min(Math.max(value, min), max);
	},

	onPan: function (ev) {
		const target = this.draggingObject;
		if (target) {
			const isRTL = document.documentElement.dir === 'rtl';

			const dialogBounds = target.form.getBoundingClientRect();
			const width = dialogBounds.width;
			const height = dialogBounds.height;

			const startX = target.startX ? target.startX : 0;
			const startY = target.startY ? target.startY : 0;

			let newX = startX + ev.deltaX * (isRTL ? -1 : 1);
			let newY = startY + ev.deltaY;

			// We want to allow dragging the dialog offscreen iff it also drags another part of the dialog onscreen
			if (newX < 0 && newX + width < window.innerWidth) {
				newX = Math.min(0, window.innerWidth - width);
			}

			if (newX + width > window.innerWidth && newX > 0) {
				newX = Math.max(window.innerWidth - width, 0);
			}

			// Happily for us, jsdialogs scroll in the y direction if the screen is too small anyway which lets us not worry about the title bar going fully offscreen
			newY = this._clamp(newY, 0, window.innerHeight - height);

			target.translateX = newX;
			target.translateY = newY;

			this.setNewPosition(target.container, newX, newY);
		}
	},

	updateAutoPopPosition: function (target, newX, newY) {
		var width = target.getBoundingClientRect().width;
		var dialogBottom = newY + target.getBoundingClientRect().height;
		var windowBottom = window.innerHeight;
		if (newX + width > window.innerWidth)
			newX = window.innerWidth - width;

		// at this point we have un updated potion of autofilter instance.
		// so to handle overlapping case of autofilter and toolbar we need some complex calculation
		if (dialogBottom > windowBottom)
			newY = newY - (dialogBottom - windowBottom + 10);

		this.setNewPosition(target, newX, newY);
	},

	setNewPosition(target, newX, newY) {
		target.style.marginInlineStart = newX + 'px';
		target.style.marginTop = newY + 'px';
	},

	handleKeyEvent: function (event) {
		var keyCode = event.keyCode;

		switch (keyCode) {
		case 27:
			// ESC
			var dialogKeys = Object.keys(this.dialogs);
			if (dialogKeys.length) {
				var lastKey = dialogKeys[dialogKeys.length - 1];
				var sendCloseToServer = this.dialogs[lastKey].isDropdown !== true;
				this.close(lastKey, sendCloseToServer);
				return true;
			}
		}

		return false;
	},

	onZoomEnd: function () {
		var dialogs = Object.keys(this.dialogs);
		if (dialogs.length) {
			var lastKey = dialogs[dialogs.length - 1];
			var dialogInfo = this.dialogs[lastKey];
			if (dialogInfo.isPopup) {
				this.close(lastKey, true);
				this.map.focus();
			}
		}

	}
});

L.control.jsDialog = function (options) {
	return new L.Control.JSDialog(options);
};

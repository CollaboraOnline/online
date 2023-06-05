/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.JSDialog
 */

/* global Hammer app _ */
L.Control.JSDialog = L.Control.extend({
	options: {
		snackbarTimeout: 10000
	},
	dialogs: {},
	draggingObject: null,

	onAdd: function (map) {
		this.map = map;

		this.map.on('jsdialog', this.onJSDialog, this);
		this.map.on('jsdialogupdate', this.onJSUpdate, this);
		this.map.on('jsdialogaction', this.onJSAction, this);
		this.map.on('zoomend', this.onZoomEnd, this);
	},

	onRemove: function() {
		this.map.off('jsdialog', this.onJSDialog, this);
		this.map.off('jsdialogupdate', this.onJSUpdate, this);
		this.map.off('jsdialogaction', this.onJSAction, this);
		this.map.off('zoomend', this.onZoomEnd, this);
	},

	hasDialogOpened: function() {
		return Object.keys(this.dialogs).length > 0;
	},

	clearDialog: function(id) {
		var builder = this.dialogs[id].builder;

		L.DomUtil.remove(this.dialogs[id].container);

		if (this.dialogs[id].overlay)
			L.DomUtil.remove(this.dialogs[id].overlay);

		delete this.dialogs[id];

		return builder;
	},

	close: function(id, sendCloseEvent) {
		if (id && this.dialogs[id]) {
			if (!sendCloseEvent && this.dialogs[id].overlay)
				L.DomUtil.remove(this.dialogs[id].overlay);

			if (this.dialogs[id].isPopup)
				this.closePopover(id, sendCloseEvent);
			else
				this.closeDialog(id, sendCloseEvent);
		}
	},

	closeAll: function() {
		var dialogs = Object.keys(this.dialogs);
		for (var i = 0; i < dialogs.length; i++)
			this.close(dialogs[i], true);
	},

	closeDialog: function(id, sendCloseEvent) {
		if (!id || !this.dialogs[id]) {
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
		if (!id || !this.dialogs[id]) {
			console.warn('missing popover data');
			return;
		}

		var clickToClose = this.dialogs[id].clickToClose;
		var builder = this.dialogs[id].builder;

		if (sendCloseEvent) {
			var isDropdownToolItem =
				clickToClose && L.DomUtil.hasClass(clickToClose, 'has-dropdown');

			// try to toggle the dropdown first
			if (isDropdownToolItem) {
				var dropdownArrow = clickToClose.querySelector('.arrowbackground');
				dropdownArrow.click();
			}

			if (clickToClose && !isDropdownToolItem && L.DomUtil.hasClass(clickToClose, 'menubutton'))
				clickToClose.click();
			else if (builder)
				builder.callback('popover', 'close', {id: '__POPOVER__'}, null, builder);
			else
				console.warn('closePopover: no builder');
		}
		else {
			this.clearDialog(id);
		}

		this.focusToLastElement(id);
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
		// Dialogue overlay which will allow automatic positioning and cancellation of the dialogue if cancellable.
		var overlay = L.DomUtil.get(instance.id + '-overlay');
		if (!overlay) {
			overlay = L.DomUtil.create('div', 'jsdialog-overlay ' + (instance.cancellable && !instance.hasOverlay ? 'cancellable' : ''), instance.containerParent);
			overlay.id = instance.id + '-overlay';
			if (instance.cancellable)
				overlay.onclick = function () { this.close(instance.id, true); }.bind(this);
		}
		instance.overlay = overlay;
	},

	createContainer: function(instance, parentContainer) {
		// it has to be form to handle default button
		instance.container = L.DomUtil.create('div', 'jsdialog-window', parentContainer);
		instance.container.setAttribute('role', 'dialog');
		instance.container.id = instance.id;

		instance.form = L.DomUtil.create('form', 'jsdialog-container ui-dialog ui-widget-content lokdialog_container', instance.container);

		// Prevent overlay from getting the click.
		instance.container.onclick = function(e) { e.stopPropagation(); };

		if (instance.collapsed && (instance.collapsed === 'true' || instance.collapsed === true))
			L.DomUtil.addClass(instance.container, 'collapsed');

		// prevent from reloading
		instance.form.addEventListener('submit', function (event) { event.preventDefault(); });

		instance.defaultButtonId = this._getDefaultButtonId(instance.children);

		if (instance.children && instance.children.length &&
			instance.children[0].children && instance.children[0].children.length === 1)
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
			var title = L.DomUtil.create('span', 'ui-dialog-title', instance.titlebar);
			title.innerText = instance.title;
			instance.titleCloseButton = L.DomUtil.create('button', 'ui-button ui-corner-all ui-widget ui-button-icon-only ui-dialog-titlebar-close', instance.titlebar);
			instance.titleCloseButton.setAttribute('aria-label', _('Close dialog'));
			instance.titleCloseButton.tabIndex = '-1';
			L.DomUtil.create('span', 'ui-button-icon ui-icon ui-icon-closethick', instance.titleCloseButton);
		}

		if (instance.isModalPopUp || instance.isDocumentAreaPopup)
			L.DomUtil.addClass(instance.container, 'modalpopup');

		if (instance.isModalPopUp && !instance.popupParent) // Special case for menu popups (they are also modal dialogues).
			instance.overlay.classList.add('dimmed');

		if (instance.isSnackbar) {
			L.DomUtil.addClass(instance.container, 'snackbar');
			L.DomUtil.addClass(instance.form, 'snackbar');
		}

		instance.content = L.DomUtil.create('div', 'lokdialog ui-dialog-content ui-widget-content', instance.form);

		this.dialogs[instance.id] = {};
	},

	createDialog: function(instance) {
		instance.builder = new L.control.jsDialogBuilder(
			{
				windowId: instance.id,
				mobileWizard: this,
				map: this.map,
				cssClass: 'jsdialog' + (instance.isAutofilter ? ' autofilter' : '') + (instance.isOnlyChild ? ' one-child-popup' : ''),
				callback: instance.callback
			});

		instance.builder.build(instance.content, [instance]);
		var primaryBtn = instance.content.querySelector('#' + instance.defaultButtonId);
		if (primaryBtn)
			L.DomUtil.addClass(primaryBtn, 'button-primary');
	},

	getFocusableElements: function(widget) {
		var ret = widget.querySelectorAll('[tabIndex="0"]:not(.jsdialog-begin-marker, .jsdialog-end-marker):not([disabled]):not(.hidden)');
		if (!ret)
			ret = widget.querySelectorAll('input:not([disabled]):not(.hidden)');
		if (!ret)
			ret = widget.querySelectorAll('textarea:not([disabled]):not(.hidden)');
		if (!ret)
			ret = widget.querySelectorAll('select:not([disabled]):not(.hidden)');
		if (!ret)
			ret = widget.querySelectorAll('button:not([disabled]):not(.hidden)');
		return ret;
	},

	addFocusHandler: function(instance) {
		// loop using tab key
		var beginMarker = L.DomUtil.create('div', 'jsdialog autofilter jsdialog-begin-marker');
		var endMarker = L.DomUtil.create('div', 'jsdialog autofilter jsdialog-end-marker');

		beginMarker.tabIndex = 0;
		endMarker.tabIndex = 0;

		instance.container.insertBefore(beginMarker, instance.container.firstChild);
		instance.container.appendChild(endMarker);

		instance.container.addEventListener('focusin', function(event) {
			if (event.target == endMarker) {
				var firstFocusElement = instance.that.getFocusableElements(instance.container);
				if (firstFocusElement && firstFocusElement.length) {
					firstFocusElement[0].focus();
					return;
				}
			} else if (event.target == beginMarker) {
				var focusables = instance.that.getFocusableElements(instance.container);
				var lastFocusElement = focusables.length ? focusables[focusables.length - 1] : null;
				if (lastFocusElement) {
					lastFocusElement.focus();
					return;
				}
			}

			if (event.target == endMarker || event.target == beginMarker) {
				if (document.getElementById(instance.init_focus_id))
					document.getElementById(instance.init_focus_id).focus();
				else {
					app.console.error('There is no focusable element in the modal. Either focusId should be given or modal should have a response button.');
					instance.that.close(instance.id, true);
					instance.that.map.focus();
				}
			}
		});
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

		var clickToCloseId = instance.clickToClose;
		if (clickToCloseId && clickToCloseId.indexOf('.uno:') === 0)
			clickToCloseId = clickToCloseId.substr('.uno:'.length);

		var clickToCloseElement = null;
		if (clickToCloseId && popupParent) {
			clickToCloseElement = popupParent.querySelector('[id=\'' + clickToCloseId + '\']');
			// we avoid duplicated ids in unotoolbuttons - try with class
			if (!clickToCloseElement)
				clickToCloseElement = popupParent.querySelector('.uno' + clickToCloseId);
		} else if (clickToCloseId) {
			// fallback
			clickToCloseElement = L.DomUtil.get(clickToCloseId);
		}
		instance.clickToClose = clickToCloseElement;

		// setup initial focus and helper elements for closing popup
		var initialFocusElement = this.getFocusableElements(instance.container);

		if (instance.canHaveFocus && initialFocusElement && initialFocusElement.length)
			initialFocusElement[0].focus();

		var focusWidget = instance.init_focus_id ? instance.container.querySelector('[id=\'' + instance.init_focus_id + '\']') : null;
		if (focusWidget)
			focusWidget.focus();
		if (focusWidget && document.activeElement !== focusWidget) {
			var firstFocusable = this.getFocusableElements(focusWidget);
			if (firstFocusable && firstFocusable.length)
				firstFocusable[0].focus();
			else
				console.error('cannot get focus for widget: "' + instance.init_focus_id + '"');
		}
	},

	setPosition: function(instance, updatedPos) {
		var calculated = false;
		var isRTL = document.documentElement.dir === 'rtl';

		if (instance.nonModal || instance.popupParent) {
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
			}

			if (!parent && instance.popupParent === '_POPOVER_') {
				// popup was trigerred not by toolbar or menu button, probably on tile area
				if (instance.isAutofilter) {
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
				instance.posy = parent.getBoundingClientRect().bottom + 5;

				if (isRTL)
					instance.posx = window.innerWidth - instance.posx;

				if (instance.posx + instance.content.clientWidth > window.innerWidth)
					instance.posx -= instance.posx + instance.content.clientWidth + 10 - window.innerWidth;
				if (instance.posy + instance.content.clientHeight > window.innerHeight)
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
		} else if (instance.isSnackbar) {
			calculated = true;
			instance.posx = window.innerWidth/2 - instance.form.offsetWidth/2;
			instance.posy = window.innerHeight - instance.form.offsetHeight - 40;
		}

		var positionNotSet = !instance.container.style || !instance.container.style.marginInlineStart;
		if (calculated || positionNotSet)
			this.updatePosition(instance.container, instance.posx, instance.posy);
	},

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

		instance.posx = left + offsetX;
		instance.posy = top + offsetY;

		var width = instance.form.getBoundingClientRect().width;
		if (instance.posx + width > window.innerWidth)
			instance.posx = window.innerWidth - width;

		this.updatePosition(instance.container, instance.posx, instance.posy);
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
		instance.isModalPopUp = e.data.type === 'modalpopup' || instance.isSnackbar;
		instance.isOnlyChild = false;
		instance.that = this;
		instance.startX = e.data.posx;
		instance.startY = e.data.posy;
		instance.updatePos = null;
		instance.canHaveFocus = !instance.isSnackbar && instance.id !== 'busypopup' && !instance.isMention;
		instance.isDocumentAreaPopup = instance.popupParent === '_POPOVER_' && instance.posx !== undefined && instance.posy !== undefined;
		instance.isPopUp = instance.isModalPopUp || instance.isDocumentAreaPopup;
		instance.containerParent = instance.isDocumentAreaPopup ? document.getElementById('document-container'): document.body;
		instance.isAutofilter = instance.isDocumentAreaPopup && this.map._docLayer.isCalc();
		instance.haveTitlebar = !instance.isModalPopUp || (instance.hasClose && instance.title && instance.title !== '');
		instance.nonModal = !instance.isModalPopUp && !instance.isDocumentAreaPopup;

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
				container.focus();
				var initialFocusElement = this.getFocusableElements(container);
				if (initialFocusElement && initialFocusElement.length)
					initialFocusElement[0].focus();
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
			this.map._progressBar.end();

			this.createContainer(instance, instance.overlay ? instance.overlay: instance.containerParent);
			this.createDialog(instance);
			this.addHandlers(instance);

			// Special case for nonModal dialogues. Core side doesn't send their initial coordinates. We need to center them.
			if (instance.nonModal) {
				var isRTL = document.documentElement.dir === 'rtl';
				var height = instance.form.getBoundingClientRect().height;
				var width = instance.form.getBoundingClientRect().width;
				instance.startX = instance.posx = (window.innerWidth - (isRTL ? (-1 * width) : width)) / 2;
				instance.startY = instance.posy = (window.innerHeight - height) / 2;
			}

			instance.updatePos = this.setPosition.bind(this, instance);
			instance.updatePos();

			if (instance.isAutofilter)
				this.calculateAutoFilterPosition(instance);

			this.dialogs[instance.id] = instance;

			if (instance.isSnackbar) {
				setTimeout(function () { instance.that.closePopover(instance.id, false); }, this.options.snackbarTimeout);
			}
		}
	},

	onJSUpdate: function (e) {
		var data = e.data;

		if (data.jsontype !== 'dialog' && data.jsontype !== 'popup')
			return;

		var dialog = this.dialogs[data.id] ? this.dialogs[data.id].container : null;
		if (!dialog)
			return;

		var control = dialog.querySelector('[id=\'' + data.control.id + '\']');
		if (!control) {
			window.app.console.warn('jsdialogupdate: not found control with id: "' + data.control.id + '"');
			return;
		}

		var parent = control.parentNode;
		if (!parent)
			return;

		var scrollTop = control.scrollTop;
		var focusedElement = document.activeElement;
		var focusedElementInDialog = focusedElement ? dialog.querySelector('[id=\'' + focusedElement.id + '\']') : null;
		var focusedId = focusedElementInDialog ? focusedElementInDialog.id : null;

		control.style.visibility = 'hidden';
		var builder = new L.control.jsDialogBuilder({windowId: data.id,
			mobileWizard: this,
			map: this.map,
			cssClass: 'jsdialog',
			callback: e.callback
		});

		var temporaryParent = L.DomUtil.create('div');
		builder.build(temporaryParent, [data.control], false);
		parent.insertBefore(temporaryParent.firstChild, control.nextSibling);
		var backupGridSpan = control.style.gridColumn;
		L.DomUtil.remove(control);

		var newControl = dialog.querySelector('[id=\'' + data.control.id + '\']');
		if (newControl) {
			newControl.scrollTop = scrollTop;
			newControl.style.gridColumn = backupGridSpan;
		}

		if (data.control.has_default === true && (data.control.type === 'pushbutton' || data.control.type === 'okbutton'))
			L.DomUtil.addClass(newControl, 'button-primary');

		if (focusedId) {
			var found = dialog.querySelector('[id=\'' + focusedId + '\']');
			if (found)
				found.focus();
		}

		var dialogInfo = this.dialogs[data.id];
		if (dialogInfo.isDocumentAreaPopup) {
			dialogInfo.updatePos(false, new L.Point(data.posx, data.posy));
		}

		setTimeout(function () { dialogInfo.updatePos(); }, 100);
	},

	onJSAction: function (e) {
		var data = e.data;

		if (data.jsontype !== 'dialog' && data.jsontype !== 'popup')
			return;

		var builder = this.dialogs[data.id] ? this.dialogs[data.id].builder : null;
		if (!builder)
			return;

		var dialog = this.dialogs[data.id] ? this.dialogs[data.id].container : null;
		if (!dialog)
			return;

		builder.executeAction(dialog, data.data);
	},

	onPan: function (ev) {
		var target = this.draggingObject;
		if (target) {
			var isRTL = document.documentElement.dir === 'rtl';

			var startX = target.startX ? target.startX : 0;
			var startY = target.startY ? target.startY : 0;

			var newX = startX + ev.deltaX * (isRTL ? -1 : 1);
			var newY = startY + ev.deltaY;

			// Don't allow to put dialog outside the view
			if (!(newX < 0 || newY < 0
				|| newX > window.innerWidth - target.offsetWidth/2
				|| newY > window.innerHeight - target.offsetHeight/2)) {
				target.translateX = newX;
				target.translateY = newY;

				this.updatePosition(target.container, newX, newY);
			}
		}
	},

	updatePosition: function (target, newX, newY) {
		target.style.marginInlineStart = newX + 'px';
		target.style.marginTop = newY + 'px';
	},

	handleKeyEvent: function (event) {
		var keyCode = event.keyCode;

		switch (keyCode) {
		case 27:
			// ESC
			var dialogs = Object.keys(this.dialogs);
			if (dialogs.length) {
				var lastKey = dialogs[dialogs.length - 1];
				this.close(lastKey, true);
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

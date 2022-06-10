/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.JSDialog
 */

/* global Hammer */
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
	},

	onRemove: function() {
		this.map.off('jsdialog', this.onJSDialog, this);
		this.map.off('jsdialogupdate', this.onJSUpdate, this);
		this.map.off('jsdialogaction', this.onJSAction, this);
	},

	hasDialogOpened: function() {
		return Object.keys(this.dialogs).length > 0;
	},

	clearDialog: function(id) {
		var builder = this.dialogs[id].builder;

		L.DomUtil.remove(this.dialogs[id].container);
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

	closeDialog: function(id, sendCloseEvent) {
		var builder = this.clearDialog(id);
		if (sendCloseEvent !== false)
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
			this.map.focus();
		}
	},

	setTabs: function(tabs, builder) {
		var dialog = this.dialogs[builder.windowId.toString()];
		if (dialog) {
			var tabsContainer = dialog.tabs;

			while (tabsContainer.firstChild)
				tabsContainer.removeChild(tabsContainer.firstChild);

			tabsContainer.appendChild(tabs);
		}
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

	onJSDialog: function(e) {
		var that = this;
		var posX = 0;
		var posY = 0;
		var data = e.data;
		var callback = e.callback;
		var isSnackbar = data.type === 'snackbar';
		var isModalPopup = data.type === 'modalpopup' || isSnackbar;
		var canHaveFocus = !isSnackbar && data.id !== 'busypopup';
		var focusWidgetId = data.init_focus_id;

		if (data.action === 'fadeout')
		{
			if (data.id && this.dialogs[data.id]) {
				var container = this.dialogs[data.id].container;
				L.DomUtil.addClass(container, 'fadeout');
				container.onanimationend = function() { that.close(data.id); };
				// be sure it will be removed
				setTimeout(function() { that.close(data.id); }, 700);
			}
			return;
		}
		else if (data.action === 'close')
		{
			this.close(data.id, false);
			return;
		}

		var toRemove = null;
		if (this.dialogs[data.id]) {
			posX = this.dialogs[data.id].startX;
			posY = this.dialogs[data.id].startY;
			toRemove = this.dialogs[data.id].container;
		}

		// it has to be form to handle default button
		container = L.DomUtil.create('form', 'jsdialog-container ui-dialog ui-widget-content lokdialog_container', document.body);
		container.id = data.id;
		container.style.visibility = 'hidden';
		if (data.collapsed && (data.collapsed === 'true' || data.collapsed === true))
			L.DomUtil.addClass(container, 'collapsed');
		// prevent from reloading
		container.addEventListener('submit', function (event) { event.preventDefault(); });

		var defaultButtonId = this._getDefaultButtonId(data.children);

		// it has to be first button in the form
		var defaultButton = L.DomUtil.createWithId('button', 'default-button', container);
		defaultButton.style.display = 'none';
		defaultButton.onclick = function() {
			if (defaultButtonId) {
				var button = container.querySelector('#' + defaultButtonId);
				if (button)
					button.click();
			}
		};

		if (!isModalPopup) {
			var titlebar = L.DomUtil.create('div', 'ui-dialog-titlebar ui-corner-all ui-widget-header ui-helper-clearfix', container);
			var title = L.DomUtil.create('span', 'ui-dialog-title', titlebar);
			title.innerText = data.title;
			var button = L.DomUtil.create('button', 'ui-button ui-corner-all ui-widget ui-button-icon-only ui-dialog-titlebar-close', titlebar);
			L.DomUtil.create('span', 'ui-button-icon ui-icon ui-icon-closethick', button);
		} else {
			L.DomUtil.addClass(container, 'modalpopup');
			if (isSnackbar)
				L.DomUtil.addClass(container, 'snackbar');
		}

		var tabs = L.DomUtil.create('div', 'jsdialog-tabs', container);
		var content = L.DomUtil.create('div', 'lokdialog ui-dialog-content ui-widget-content', container);

		// required to exist before builder was launched (for setTabs)
		this.dialogs[data.id] = {
			tabs: tabs
		};

		var builder = new L.control.jsDialogBuilder({windowId: data.id, mobileWizard: this, map: this.map, cssClass: 'jsdialog', callback: callback});

		if (isModalPopup && !isSnackbar) {
			var existingOverlay = L.DomUtil.get(data.id + '-overlay');
			if (!existingOverlay) {
				var overlay = L.DomUtil.create('div', builder.options.cssClass + ' jsdialog-overlay ' + (data.cancellable ? 'cancellable' : ''), document.body);
				overlay.id = data.id + '-overlay';
				if (data.cancellable)
					overlay.onclick = function () { that.closePopover(data.id, true); };
			}
		}

		builder.build(content, [data]);

		// We show some dialogs such as Macro Security Warning Dialog and Text Import Dialog (csv)
		// They are displayed before the document is loaded
		// Spinning should be happening until the 1st interaction with the user
		// which is the dialog opening in this case
		this.map._progressBar.end();


		var onInput = function(ev) {
			if (ev.isFirst)
				that.draggingObject = that.dialogs[data.id];

			if (ev.isFinal && that.draggingObject
				&& that.draggingObject.translateX
				&& that.draggingObject.translateY) {
				that.draggingObject.startX = that.draggingObject.translateX;
				that.draggingObject.startY = that.draggingObject.translateY;
				that.draggingObject.translateX = 0;
				that.draggingObject.translateY = 0;
				that.draggingObject = null;
			}
		};

		if (!isModalPopup) {
			button.onclick = function() {
				that.closeDialog(data.id, true);
			};

			var hammerTitlebar = new Hammer(titlebar);
			hammerTitlebar.add(new Hammer.Pan({ threshold: 20, pointers: 0 }));

			hammerTitlebar.on('panstart', this.onPan.bind(this));
			hammerTitlebar.on('panmove', this.onPan.bind(this));
			hammerTitlebar.on('hammer.input', onInput);
		}

		var clickToCloseId = data.clickToClose;
		if (clickToCloseId && clickToCloseId.indexOf('.uno:') === 0)
			clickToCloseId = clickToCloseId.substr('.uno:'.length);

		var popupParent = data.popupParent ? L.DomUtil.get(data.popupParent) : null;

		var setupPosition = function(force) {
			if (isModalPopup && data.popupParent) {
				// in case of toolbox we want to create popup positioned by toolitem not toolbox
				var parent = L.DomUtil.get(data.popupParent);

				if (clickToCloseId && parent) {
					var childButton = parent.querySelector('[id=\'' + clickToCloseId + '\']');
					if (childButton)
						parent = childButton;
				}

				if (!parent && data.popupParent === '_POPOVER_') {
					// popup was trigerred not by toolbar or menu button, probably on tile area
					// example: validity listbox
					parent = document.querySelector('.spreadsheet-drop-down-marker');
				}

				if (parent) {
					posX = parent.getBoundingClientRect().left;
					posY = parent.getBoundingClientRect().bottom + 5;

					if (posX + content.clientWidth > window.innerWidth)
						posX -= posX + content.clientWidth + 10 - window.innerWidth;
					if (posY + content.clientHeight > window.innerHeight)
						posY -= posY + content.clientHeight + 10 - window.innerHeight;
				}
			} else if (isSnackbar) {
				posX = window.innerWidth/2 - container.offsetWidth/2;
				posY = window.innerHeight - container.offsetHeight - 40;
			} else if (force || (posX === 0 && posY === 0)) {
				posX = window.innerWidth/2 - container.offsetWidth/2;
				posY = window.innerHeight/2 - container.offsetHeight/2;
			}
		};

		setupPosition();
		this.updatePosition(container, posX, posY);

		if (isModalPopup) {
			// close when focus goes out using 'tab' key
			var beginMarker = L.DomUtil.create('div', 'jsdialog autofilter jsdialog-begin-marker');
			var endMarker = L.DomUtil.create('div', 'jsdialog autofilter jsdialog-end-marker');

			beginMarker.tabIndex = 0;
			endMarker.tabIndex = 0;

			container.addEventListener('focusin', function(event) {
				if (event.target == beginMarker || event.target == endMarker) {
					that.close(data.id, true);
					that.map.focus();
				}
			});
		}

		// after some updates, eg. drawing areas window can be bigger than initially
		// update possition according to that with small delay

		var that = this;
		var initialPositionSetup = function (force) {
			setupPosition(force);
			that.updatePosition(container, posX, posY);
			container.style.visibility = '';

			// setup initial focus and helper elements for closing popup
			var initialFocusElement =
				container.querySelector('[tabIndex="0"]:not(.jsdialog-begin-marker)');

			if (isModalPopup) {
				container.insertBefore(beginMarker, container.firstChild);
				container.appendChild(endMarker);
			}

			if (canHaveFocus)
				initialFocusElement.focus();

			if (toRemove)
				L.DomUtil.remove(toRemove);
			var focusWidget = focusWidgetId ?
				container.querySelector('[id=\'' + focusWidgetId + '\']') : null;
			if (focusWidget)
				focusWidget.focus();
			if (focusWidget && document.activeElement !== focusWidget)
				console.error('cannot get focus for widget: "' + focusWidgetId + '"');
		};

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

		this.dialogs[data.id] = {
			container: container,
			builder: builder,
			tabs: tabs,
			startX: posX,
			startY: posY,
			clickToClose: clickToCloseElement,
			overlay: overlay,
			isPopup: isModalPopup,
			invalidated: false,
			setupPosFunc: initialPositionSetup
		};

		setTimeout(initialPositionSetup, 200);

		if (isSnackbar) {
			setTimeout(function () { that.closePopover(data.id, false); }, this.options.snackbarTimeout);
		}
	},

	onJSUpdate: function (e) {
		var data = e.data;

		if (data.jsontype !== 'dialog')
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
			cssClass: 'jsdialog'});

		var temporaryParent = L.DomUtil.create('div');
		builder.build(temporaryParent, [data.control], false);
		parent.insertBefore(temporaryParent.firstChild, control.nextSibling);
		L.DomUtil.remove(control);

		var newControl = dialog.querySelector('[id=\'' + data.control.id + '\']');
		if (newControl)
			newControl.scrollTop = scrollTop;

		if (focusedId)
			dialog.querySelector('[id=\'' + focusedId + '\']').focus();

		var dialogInfo = this.dialogs[data.id];
		if (!dialogInfo.invalidated && dialogInfo.setupPosFunc) {
			setTimeout(function () { dialogInfo.setupPosFunc(true); }, 100);
			dialogInfo.invalidated = true;
		}
	},

	onJSAction: function (e) {
		var data = e.data;

		if (data.jsontype !== 'dialog')
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
			var startX = target.startX ? target.startX : 0;
			var startY = target.startY ? target.startY : 0;

			var newX = startX + ev.deltaX;
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
		target.style.marginLeft = newX + 'px';
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
				this.map.focus();
				return true;
			}
		}

		return false;
	}
});

L.control.jsDialog = function (options) {
	return new L.Control.JSDialog(options);
};

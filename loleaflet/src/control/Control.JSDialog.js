/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.JSDialog
 */

/* global Hammer */
L.Control.JSDialog = L.Control.extend({
	dialogs: {},
	draggingObject: null,

	onAdd: function (map) {
		this.map = map;

		this.map.on('jsdialog', this.onJSDialog, this);
		this.map.on('jsdialogupdate', this.onJSUpdate, this);
	},

	onRemove: function() {
		this.map.off('jsdialog', this.onJSDialog, this);
		this.map.off('jsdialogupdate', this.onJSUpdate, this);
	},

	onJSDialog: function(e) {
		var posX = 0;
		var posY = 0;
		var data = e.data;

		if (this.dialogs[data.id]) {
			posX = this.dialogs[data.id].startX;
			posY = this.dialogs[data.id].startY;
			L.DomUtil.remove(this.dialogs[data.id]);
		}

		if (data.action === 'close')
		{
			if (data.id && this.dialogs[data.id])
				L.DomUtil.remove(this.dialogs[data.id]);
			return;
		}

		var container = L.DomUtil.create('div', 'jsdialog-container ui-dialog ui-widget-content lokdialog_container', document.body);
		container.id = data.id;
		this.dialogs[data.id] = container;
		if (data.collapsed && (data.collapsed === 'true' || data.collapsed === true))
			L.DomUtil.addClass(container, 'collapsed');

		var titlebar = L.DomUtil.create('div', 'ui-dialog-titlebar ui-corner-all ui-widget-header ui-helper-clearfix', container);
		var title = L.DomUtil.create('span', 'ui-dialog-title', titlebar);
		title.innerText = data.title;
		var button = L.DomUtil.create('button', 'ui-button ui-corner-all ui-widget ui-button-icon-only ui-dialog-titlebar-close', titlebar);
		L.DomUtil.create('span', 'ui-button-icon ui-icon ui-icon-closethick', button);

		var content = L.DomUtil.create('div', 'lokdialog ui-dialog-content ui-widget-content', container);

		var builder = new L.control.jsDialogBuilder({windowId: data.id, mobileWizard: this, map: this.map, cssClass: 'jsdialog'});
		builder.build(content, [data]);

		var that = this;
		button.onclick = function() {
			L.DomUtil.remove(that.dialogs[data.id]);
			that.dialogs[data.id] = undefined;
			builder.callback('dialog', 'close', {id: '__DIALOG__'}, null, builder);
		};

		var onInput = function(ev) {
			if (ev.isFirst)
				that.draggingObject = container;

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

		var hammerTitlebar = new Hammer(titlebar);
		hammerTitlebar.add(new Hammer.Pan({ threshold: 20, pointers: 0 }));

		hammerTitlebar.on('panstart', this.onPan.bind(this));
		hammerTitlebar.on('panmove', this.onPan.bind(this));
		hammerTitlebar.on('hammer.input', onInput);

		if (window.mode.isTablet()) {
			var hammerContent = new Hammer(content);
			hammerContent.add(new Hammer.Pan({ threshold: 20, pointers: 0 }));

			hammerContent.on('panstart', this.onPan.bind(this));
			hammerContent.on('panmove', this.onPan.bind(this));
			hammerContent.on('hammer.input', onInput);
		}

		if (posX === 0 && posY === 0) {
			posX = window.innerWidth/2 - container.offsetWidth/2;
			posY = window.innerHeight/2 - container.offsetHeight/2;
		}

		container.startX = posX;
		container.startY = posY;
		this.updatePosition(container, posX, posY);
	},

	onJSUpdate: function (e) {
		var data = e.data;
		var dialog = this.dialogs[data.id];
		if (!dialog)
			return;

		var control = dialog.querySelector('#' + data.control.id);
		if (!control)
			return;

		var parent = control.parentNode;
		if (!parent)
			return;

		control.style.visibility = 'hidden';
		var builder = new L.control.jsDialogBuilder({windowId: data.id,
			mobileWizard: this,
			map: this.map,
			cssClass: 'jsdialog'});

		builder.build(parent, [data.control], false);
		L.DomUtil.remove(control);
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

				this.updatePosition(target, newX, newY);
			}
		}
	},

	updatePosition: function (target, newX, newY) {
		target.style.marginLeft = newX + 'px';
		target.style.marginTop = newY + 'px';
	}
});

L.control.jsDialog = function (options) {
	return new L.Control.JSDialog(options);
};

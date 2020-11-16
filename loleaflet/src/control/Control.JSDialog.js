/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.JSDialog
 */

/* global */
L.Control.JSDialog = L.Control.extend({
	dialogs: {},

	onAdd: function (map) {
		this.map = map;

		this.map.on('jsdialog', this.onJSDialog, this);
	},

	onRemove: function() {
		this.map.off('jsdialog', this.onJSDialog, this);
	},

	onJSDialog: function(data) {
		if (this.dialogs[data.id])
			L.DomUtil.remove(this.dialogs[data.id]);

		if (data.action === 'close')
			return;

		var left = 100;
		var top = 100;

		var container = L.DomUtil.create('div', 'jsdialog-container ui-dialog ui-widget-content lokdialog_container', document.body);
		this.dialogs[data.id] = container;

		L.DomUtil.setStyle(container, 'margin-left', left + 'px');
		L.DomUtil.setStyle(container, 'margin-top', top + 'px');

		var titlebar = L.DomUtil.create('div', 'ui-dialog-titlebar ui-corner-all ui-widget-header ui-helper-clearfix', container);
		var title = L.DomUtil.create('span', 'ui-dialog-title', titlebar);
		title.innerText = 'title';
		var button = L.DomUtil.create('button', 'ui-dialog-titlebar-close', titlebar);
		L.DomUtil.create('button', 'ui-button-icon ui-icon ui-icon-closethick', button);

		var content = L.DomUtil.create('div', 'lokdialog ui-dialog-content ui-widget-content', container);

		var builder = new L.control.notebookbarBuilder({windowId: data.id, mobileWizard: this, map: this.map, cssClass: 'jsdialog'});
		builder.build(content, [data]);
	},
});

L.control.jsDialog = function (options) {
	return new L.Control.JSDialog(options);
};
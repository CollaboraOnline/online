/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.Sidebar
 */

/* global $ */
L.Control.Sidebar = L.Control.extend({

	container: null,
	builder: null,

	onAdd: function (map) {
		this.map = map;

		this.builder = new L.control.jsDialogBuilder({mobileWizard: this, map: map, cssClass: 'jsdialog sidebar'});
		this.container = L.DomUtil.create('div', 'sidebar-container', $('#sidebar-panel').get(0));

		this.map.on('sidebar', this.onSidebar, this);
		this.map.on('jsdialogupdate', this.onJSUpdate, this);
		this.map.on('jsdialogaction', this.onJSAction, this);
	},

	onRemove: function() {
		this.map.off('sidebar');
		this.map.off('jsdialogupdate', this.onJSUpdate, this);
		this.map.off('jsdialogaction', this.onJSAction, this);
	},

	onJSUpdate: function (e) {
		var data = e.data;

		if (data.jsontype !== 'sidebar')
			return;

		if (!this.container)
			return;

		var control = this.container.querySelector('#' + data.control.id);
		if (!control) {
			console.warn('jsdialogupdate: not found control with id: "' + data.control.id + '"');
			return;
		}

		var parent = control.parentNode;
		if (!parent)
			return;

		if (!this.builder)
			return;

		var scrollTop = control.scrollTop;
		control.style.visibility = 'hidden';

		var temporaryParent = L.DomUtil.create('div');
		this.builder.build(temporaryParent, [data.control], false);
		parent.insertBefore(temporaryParent.firstChild, control.nextSibling);
		L.DomUtil.remove(control);

		var newControl = this.container.querySelector('#' + data.control.id);
		if (newControl)
			newControl.scrollTop = scrollTop;
	},

	onJSAction: function (e) {
		var data = e.data;

		if (data.jsontype !== 'sidebar')
			return;

		if (!this.builder)
			return;

		if (!this.container)
			return;

		this.builder.executeAction(this.container, data.data);
	},

	onSidebar: function(data) {
		var sidebarWidth = 335;

		this.builder.setWindowId(data.data.id);
		$(this.container).empty();

		if (data.data.action === 'close') {
			$('#sidebar-dock-wrapper').hide();
			$('#sidebar-dock-wrapper').width(0);
			this.map.options.documentContainer.style.right = '0px';
			this.map._onResize();
			this.map.dialog._resizeCalcInputBar(0);

			if (!this.map.editorHasFocus()) {
				this.map.fire('editorgotfocus');
				this.map.focus();
			}

			$('#document-container').addClass('sidebar-closed');

			if (window.initSidebarState)
				this.map.uiManager.setSavedState('ShowSidebar', false);
		} else {
			if (data.data.children && data.data.children.length && data.data.children[0].type !== 'deck')
				data.data.children.splice(0, 1);

			if ($('#sidebar-dock-wrapper').width() != sidebarWidth) {
				$('#sidebar-dock-wrapper').show();
				$('#sidebar-dock-wrapper').width(sidebarWidth);
				this.map.options.documentContainer.style.right = sidebarWidth + 'px';
				this.map._onResize();
				this.map.dialog._resizeCalcInputBar(sidebarWidth);
			}

			this.builder.build(this.container, [data.data]);

			$('#document-container').removeClass('sidebar-closed');

			if (window.initSidebarState)
				this.map.uiManager.setSavedState('ShowSidebar', true);
		}
	},

	setTabs: function(/*tabs*/) {
	},

	selectedTab: function() {
		// implement in child classes
	},
});

L.control.sidebar = function (options) {
	return new L.Control.Sidebar(options);
};
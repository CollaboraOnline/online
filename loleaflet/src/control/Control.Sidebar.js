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

	closeSidebar: function() {
		$('#sidebar-dock-wrapper').hide();
		this.map._onResize();
		this.map.dialog._resizeCalcInputBar(0);

		if (!this.map.editorHasFocus()) {
			this.map.fire('editorgotfocus');
			this.map.focus();
		}

		if (window.initSidebarState)
			this.map.uiManager.setSavedState('ShowSidebar', false);
	},

	onJSUpdate: function (e) {
		var data = e.data;

		if (data.jsontype !== 'sidebar')
			return;

		if (!this.container)
			return;

		var control = this.container.querySelector('[id=\'' + data.control.id + '\']');
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

		var newControl = this.container.querySelector('[id=\'' + data.control.id + '\']');
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
		var sidebarData = data.data;
		this.builder.setWindowId(sidebarData.id);
		$(this.container).empty();

		if (sidebarData.action === 'close') {
			this.closeSidebar();
		} else if (sidebarData.children) {
			for (var i = sidebarData.children.length - 1; i >= 0; i--) {
				if (sidebarData.children[i].type !== 'deck' || sidebarData.children[i].visible === false)
					sidebarData.children.splice(i, 1);
			}

			if (sidebarData.children.length) {
				var wrapper = document.getElementById('sidebar-dock-wrapper');

				wrapper.style.maxHeight = document.getElementById('document-container').getBoundingClientRect().height + 'px';
				if (wrapper.style.display === 'none')
					$('#sidebar-dock-wrapper').show();

				var sidebarWidth = wrapper.getBoundingClientRect().width;
				this.map.dialog._resizeCalcInputBar(sidebarWidth);

				this.builder.build(this.container, [sidebarData]);

				if (window.initSidebarState)
					this.map.uiManager.setSavedState('ShowSidebar', true);
			} else {
				this.closeSidebar();
			}
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
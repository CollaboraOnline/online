/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.SearchBar
 */

/* global $ w2ui _UNO _ app */
L.Control.MobileTopBar = L.Control.extend({

	options: {
		doctype: 'text'
	},

	initialize: function (docType) {
		L.setOptions(this, {docType: docType});
	},

	onAdd: function (map) {
		this.map = map;
		this.create();

		map.on('updatepermission', this.onUpdatePermission, this);
		map.on('commandstatechanged', this.onCommandStateChanged, this);
	},

	getToolItems: function(docType) {
		if (docType == 'text') {
			return [
				{type: 'button',  id: 'undo',  img: 'undo', hint: _UNO('.uno:Undo'), uno: 'Undo', disabled: true},
				{type: 'button',  id: 'redo',  img: 'redo', hint: _UNO('.uno:Redo'), uno: 'Redo', disabled: true},
				{type: 'spacer', id: 'before-PermissionMode'},
				{type: 'html', id: 'PermissionMode', html:'<div id="PermissionMode" class="cool-font  status-readonly-mode" ""style="padding: 3px 10px;"> ' + _('Read-only') + '</div>', hidden: true},
				{type: 'spacer', id: 'after-PermissionMode', hidden: true},
				{type: 'button',  id: 'mobile_wizard', img: 'mobile_wizard', disabled: true},
				{type: 'button',  id: 'insertion_mobile_wizard', img: 'insertion_mobile_wizard', disabled: true},
				{type: 'button',  id: 'comment_wizard', img: 'viewcomments'},
				{type: 'drop', id: 'userlist', img: 'users', hidden: true, html: L.control.createUserListWidget()},
			];
		} else if (docType == 'spreadsheet') {
			return [
				{type: 'button',  id: 'undo',  img: 'undo', hint: _UNO('.uno:Undo'), uno: 'Undo', disabled: true},
				{type: 'button',  id: 'redo',  img: 'redo', hint: _UNO('.uno:Redo'), uno: 'Redo', disabled: true},
				{type: 'button', hidden: true, id: 'acceptformula',  img: 'ok', hint: _('Accept')},
				{type: 'button', hidden: true, id: 'cancelformula',  img: 'cancel', hint: _('Cancel')},
				{type: 'spacer'},
				{type: 'button',  id: 'mobile_wizard', img: 'mobile_wizard', disabled: true},
				{type: 'button',  id: 'insertion_mobile_wizard', img: 'insertion_mobile_wizard', disabled: true},
				{type: 'button',  id: 'comment_wizard', img: 'viewcomments'},
				{type: 'drop', id: 'userlist', img: 'users', hidden: true, html: L.control.createUserListWidget()},
			];
		} else if (docType == 'presentation') {
			return [
				{type: 'button',  id: 'undo',  img: 'undo', hint: _UNO('.uno:Undo'), uno: 'Undo', disabled: true},
				{type: 'button',  id: 'redo',  img: 'redo', hint: _UNO('.uno:Redo'), uno: 'Redo', disabled: true},
				{type: 'spacer'},
				{type: 'button',  id: 'mobile_wizard', img: 'mobile_wizard', disabled: true},
				{type: 'button',  id: 'insertion_mobile_wizard', img: 'insertion_mobile_wizard', disabled: true},
				{type: 'button',  id: 'comment_wizard', img: 'viewcomments'},
				{type: 'button', id: 'fullscreen-' + docType, img: 'fullscreen-presentation', hint: _UNO('.uno:FullScreen', docType)},
				{type: 'drop', id: 'userlist', img: 'users', hidden: true, html: L.control.createUserListWidget()},
			];
		} else if (docType == 'drawing') {
			return [
				{type: 'button',  id: 'undo',  img: 'undo', hint: _UNO('.uno:Undo'), uno: 'Undo', disabled: true},
				{type: 'button',  id: 'redo',  img: 'redo', hint: _UNO('.uno:Redo'), uno: 'Redo', disabled: true},
				{type: 'spacer'},
				{type: 'button',  id: 'mobile_wizard', img: 'mobile_wizard', disabled: true},
				{type: 'button',  id: 'insertion_mobile_wizard', img: 'insertion_mobile_wizard', disabled: true},
				{type: 'button',  id: 'comment_wizard', img: 'viewcomments'},
				{type: 'drop', id: 'userlist', img: 'users', hidden: true, html: L.control.createUserListWidget()},
			];
		}
	},

	create: function() {
		var toolItems = this.getToolItems(this.options.docType);
		var that = this;

		var toolbar = $('#toolbar-up');
		toolbar.w2toolbar({
			name: 'actionbar',
			items: toolItems,
			onClick: function (e) {
				that.onClick(e, e.target);
				window.hideTooltip(this, e.target);
			}
		});

		this.map.uiManager.enableTooltip(toolbar);

		toolbar.bind('touchstart', function(e) {
			w2ui['actionbar'].touchStarted = true;
			var touchEvent = e.originalEvent;
			if (touchEvent && touchEvent.touches.length > 1) {
				L.DomEvent.preventDefault(e);
			}
		});
	},

	onClick: function(e, id, item) {
		if ('actionbar' in w2ui && w2ui['actionbar'].get(id) !== null) {
			var toolbar = w2ui['actionbar'];
			item = toolbar.get(id);
		}

		// In the iOS app we don't want clicking on the toolbar to pop up the keyboard.
		if (!window.ThisIsTheiOSApp && id !== 'zoomin' && id !== 'zoomout' && id !== 'mobile_wizard' && id !== 'insertion_mobile_wizard') {
			this.map.focus(this.map.canAcceptKeyboardInput()); // Maintain same keyboard state.
		}

		if (item.disabled) {
			return;
		}

		if (item.uno) {
			if (item.unosheet && this.map.getDocType() === 'spreadsheet') {
				this.map.toggleCommandState(item.unosheet);
			}
			else {
				this.map.toggleCommandState(window.getUNOCommand(item.uno));
			}
		}
		else if (id === 'cancelformula') {
			this.map.dispatch('cancelformula');
		}
		else if (id === 'acceptformula') {
			this.map.dispatch('acceptformula');
		}
		else if (id === 'comment_wizard') {
			if (window.commentWizard) {
				window.commentWizard = false;
				app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).removeHighlighters();
				this.map.fire('closemobilewizard');
				toolbar.uncheck(id);
			}
			else {
				if (window.insertionMobileWizard)
					this.onClick(null, 'insertion_mobile_wizard');
				else if (window.mobileWizard)
					this.onClick(null, 'mobile_wizard');
				window.commentWizard = true;
				var menuData =this.map._docLayer.getCommentWizardStructure();
				this.map.fire('mobilewizard', {data: menuData});
				toolbar.check(id);
			}
		}
		else if (id === 'fullscreen-drawing') {
			if (item.checked) {
				toolbar.uncheck(id);
			}
			else {
				toolbar.check(id);
			}
			L.toggleFullScreen();
		}
		else if (id === 'fullscreen-presentation') {
			// Call global onClick handler
			window.onClick(e, id, item);
		}
		else if (id === 'mobile_wizard') {
			if (window.mobileWizard) {
				window.mobileWizard = false;
				this.map.sendUnoCommand('.uno:SidebarHide');
				this.map.fire('closemobilewizard');
				toolbar.uncheck(id);
			}
			else {
				if (window.insertionMobileWizard)
					this.onClick(null, 'insertion_mobile_wizard');
				else if (window.commentWizard)
					this.onClick(null, 'comment_wizard');
				window.mobileWizard = true;
				this.map.sendUnoCommand('.uno:SidebarShow');
				this.map.fire('showwizardsidebar');
				toolbar.check(id);
			}
		}
		else if (id === 'insertion_mobile_wizard') {
			if (window.insertionMobileWizard) {
				window.insertionMobileWizard = false;
				this.map.fire('closemobilewizard');
				toolbar.uncheck(id);
			}
			else {
				if (window.mobileWizard)
					this.onClick(null, 'mobile_wizard');
				else if (window.commentWizard)
					this.onClick(null, 'comment_wizard');
				window.insertionMobileWizard = true;
				menuData = this.map.menubar.generateInsertMenuStructure();
				this.map.fire('mobilewizard', {data: menuData});
				toolbar.check(id);
			}
		}
		else if (id === 'userlist') {
			this.map.fire('openuserlist');
		}
	},

	onUpdatePermission: function(e) {
		var toolbar;
		var toolbarDownButtons = ['next', 'prev', 'mobile_wizard', 'insertion_mobile_wizard', 'comment_wizard'];
		if (e.perm === 'edit') {
			toolbar = w2ui['actionbar'];
			if (toolbar) {
				toolbarDownButtons.forEach(function(id) {
					toolbar.enable(id);
				});
				toolbar.hide('PermissionMode');
				toolbar.hide('after-PermissionMode');
				$('#tb_actionbar_item_before-PermissionMode').width('');
			}
		} else {
			toolbar = w2ui['actionbar'];
			if (toolbar) {
				toolbarDownButtons.forEach(function(id) {
					toolbar.disable(id);
				});
				toolbar.enable('comment_wizard');
				toolbar.show('PermissionMode');
				toolbar.show('after-PermissionMode');
				$('#tb_actionbar_item_before-PermissionMode').width('50%');
				$('#tb_actionbar_item_after-PermissionMode').width('50%');
			}
		}
	},

	onCommandStateChanged: function(e) {
		var commandName = e.commandName;
		var state = e.state;

		if (this.map.isEditMode() && (state === 'enabled' || state === 'disabled')) {
			var id = window.unoCmdToToolbarId(commandName);
			var toolbar = w2ui['actionbar'];

			if (state === 'enabled') {
				toolbar.enable(id);
			} else {
				toolbar.uncheck(id);
				toolbar.disable(id);
			}
		}
	},
});

L.control.mobileTopBar = function (docType) {
	return new L.Control.MobileTopBar(docType);
};

/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.SearchBar
 */

/* global $ w2ui _ _UNO */
L.Control.SearchBar = L.Control.extend({

	onAdd: function (map) {
		this.map = map;
		this.create();
	},

	create: function() {
		var that = this;
		var toolbar = $('#toolbar-search');
		toolbar.w2toolbar({
			name: 'searchbar',
			tooltip: 'top',
			items: [
				{
					type: 'html', id: 'search',
					html: '<div id="search-input-group" style="padding: 3px 10px;" class="loleaflet-font">' +
						'    <label for="search-input">Search:</label>' +
						'    <input size="10" id="search-input"' +
						'style="padding: 3px; border-radius: 2px; border: 1px solid silver"/>' +
						'</div>'
				},
				{type: 'button', id: 'searchprev', img: 'prev', hint: _UNO('.uno:UpSearch'), disabled: true},
				{type: 'button', id: 'searchnext', img: 'next', hint: _UNO('.uno:DownSearch'), disabled: true},
				{type: 'button', id: 'cancelsearch', img: 'cancel', hint: _('Clear the search field'), hidden: true},
				{type: 'html', id: 'left'},
				{type: 'button', id: 'hidesearchbar', img: 'unfold', hint: _('Hide the search bar')}
			],
			onClick: function (e) {
				that.onClick(e, e.target, e.item, e.subItem);
			},
			onRefresh: function () {
				window.setupSearchInput();
			}
		});

		toolbar.bind('touchstart', function(e) {
			w2ui['searchbar'].touchStarted = true;
			var touchEvent = e.originalEvent;
			if (touchEvent && touchEvent.touches.length > 1) {
				L.DomEvent.preventDefault(e);
			}
		});

		$(w2ui.searchbar.box).find('.w2ui-scroll-left, .w2ui-scroll-right').hide();
		w2ui.searchbar.on('resize', function(target, e) {
			e.isCancelled = true;
		});
	},

	onClick: function(e, id, item) {
		if (w2ui['searchbar'].get(id) !== null) {
			var toolbar = w2ui['searchbar'];
			item = toolbar.get(id);
		}

		// In the iOS app we don't want clicking on the toolbar to pop up the keyboard.
		if (!window.ThisIsTheiOSApp && id !== 'zoomin' && id !== 'zoomout' && id !== 'mobile_wizard' && id !== 'insertion_mobile_wizard') {
			this.map.focus(this.map.canAcceptKeyboardInput()); // Maintain same keyboard state.
		}

		if (item.disabled) {
			return;
		}

		if (id === 'searchprev') {
			this.map.search(L.DomUtil.get('search-input').value, true);
		}
		else if (id === 'searchnext') {
			this.map.search(L.DomUtil.get('search-input').value);
		}
		else if (id === 'cancelsearch') {
			this._cancelSearch();
		}
		else if (id === 'hidesearchbar') {
			$('#toolbar-search').hide();
			if (this.map._permission === 'edit')
				$('#toolbar-down').show();
			/** show edit button if only we are able to edit but in readonly mode */
			if (window.docPermission  === 'edit' && this.map._permission === 'readonly')
				$('#mobile-edit-button').show();
		}
	},

	_cancelSearch: function() {
		var toolbar = window.mode.isMobile() ? w2ui['searchbar'] : w2ui['actionbar'];
		var searchInput = L.DomUtil.get('search-input');
		this.map.resetSelection();
		toolbar.hide('cancelsearch');
		toolbar.disable('searchprev');
		toolbar.disable('searchnext');
		searchInput.value = '';
		if (window.mode.isMobile()) {
			searchInput.focus();
			// odd, but on mobile we need to invoke it twice
			toolbar.hide('cancelsearch');
		}

		this.map._onGotFocus();
	}
});

L.control.searchBar = function () {
	return new L.Control.SearchBar();
};

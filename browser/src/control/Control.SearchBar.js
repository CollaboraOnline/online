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
			items: [
				{type: 'button', id: 'hidesearchbar', img: 'unfold', hint: _('Hide the search bar')},
				{
					type: 'html', id: 'search',
					html: '<div id="search-input-group" style="padding: 3px 10px;" class="cool-font">' +
						'    <label for="search-input">Search:</label>' +
						'    <input size="10" id="search-input"' +
						'style="padding: 2px; border-radius: var(--border-radius); border: 1px solid var(--color-border)"/>' +
						'</div>'
				},
				{type: 'button', id: 'searchprev', img: 'prev', hint: _UNO('.uno:UpSearch'), disabled: true},
				{type: 'button', id: 'searchnext', img: 'next', hint: _UNO('.uno:DownSearch'), disabled: true},
				{type: 'button', id: 'cancelsearch', img: 'cancel', hint: _('Clear the search field'), hidden: true},
				{type: 'html', id: 'left'}
			],
			onClick: function (e) {
				that.onClick(e, e.target, e.item, e.subItem);
			},
			onRefresh: function () {
				window.setupSearchInput();
			}
		});
		this.map.uiManager.enableTooltip(toolbar);

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

		this.map.preventKeyboardPopup(id);

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
			this.map.cancelSearch();
		}
		else if (id === 'hidesearchbar') {
			$('#toolbar-search').hide();
			if (this.map.isEditMode())
				$('#toolbar-down').show();
			/** show edit button if only we are able to edit but in readonly mode */
			if (this.map.canUserWrite() && this.map.isReadOnlyMode())
				$('#mobile-edit-button').show();
		}
	}
});

L.control.searchBar = function () {
	return new L.Control.SearchBar();
};

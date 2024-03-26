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
 * JSDialog.ScrollableBar - helper for creating toolbars with scrolling left/right
 */

/* global JSDialog $ */

declare var JSDialog: any;

function createScrollButtons(parent: Element, scrollable: Element) {
	const left = L.DomUtil.create('div', 'w2ui-scroll-left', parent);
	const right = L.DomUtil.create('div', 'w2ui-scroll-right', parent);

	$(left).click(function () {
		const scroll = $(scrollable).scrollLeft() - 300;
		$(scrollable).animate({ scrollLeft: scroll }, 300);
		setTimeout(function () {
			$(window).resize();
		}, 350);
	});

	$(right).click(function () {
		const scroll = $(scrollable).scrollLeft() + 300;
		$(scrollable).animate({ scrollLeft: scroll }, 300);
		setTimeout(function () {
			$(window).resize();
		}, 350);
	});
}

function setupResizeHandler(container: Element, scrollable: Element) {
	const handler = function () {
		const rootContainer = $(scrollable).children('div').get(0);

		if ($(rootContainer).outerWidth() > $(window).width()) {
			// we have overflowed content
			const direction = this._RTL ? -1 : 1;
			if (direction * $(scrollable).scrollLeft() > 0) {
				if (this._RTL) $(container).find('.w2ui-scroll-right').show();
				else $(container).find('.w2ui-scroll-left').show();
			} else if (this._RTL) $(container).find('.w2ui-scroll-right').hide();
			else $(container).find('.w2ui-scroll-left').hide();

			if (
				direction * $(scrollable).scrollLeft() <
				$(rootContainer).outerWidth() - $(window).width() - 1
			) {
				if (this._RTL) $(container).find('.w2ui-scroll-left').show();
				else $(container).find('.w2ui-scroll-right').show();
			} else if (this._RTL) $(container).find('.w2ui-scroll-left').hide();
			else $(container).find('.w2ui-scroll-right').hide();
		} else {
			$(container).find('.w2ui-scroll-left').hide();
			$(container).find('.w2ui-scroll-right').hide();
		}
	}.bind(this);

	$(window).resize(handler);
	$(scrollable).scroll(handler);
}

JSDialog.MakeScrollable = function (parent: Element, scrollable: Element) {
	L.DomUtil.addClass(scrollable, 'ui-scrollable-content');
	createScrollButtons(parent, scrollable);
	setupResizeHandler(parent, scrollable);
};

JSDialog.RefreshScrollables = function () {
	$(window).resize();
};

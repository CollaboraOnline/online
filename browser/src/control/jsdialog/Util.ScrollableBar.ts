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
	L.DomUtil.addClass(scrollable, 'ui-scroll-wrapper');

	const left = L.DomUtil.create('div', 'ui-scroll-left', parent);
	const right = L.DomUtil.create('div', 'ui-scroll-right', parent);

	JSDialog.AddOnClick(left, () => {
		const scroll = $(scrollable).scrollLeft() - 300;
		$(scrollable).animate({ scrollLeft: scroll }, 300);
		setTimeout(function () {
			JSDialog.RefreshScrollables();
		}, 350);
	});

	JSDialog.AddOnClick(right, () => {
		const scroll = $(scrollable).scrollLeft() + 300;
		$(scrollable).animate({ scrollLeft: scroll }, 300);
		setTimeout(function () {
			JSDialog.RefreshScrollables();
		}, 350);
	});
}

function showArrow(arrow: HTMLElement, show: boolean) {
	if (show) arrow.style.setProperty('display', 'block');
	else arrow.style.setProperty('display', 'none');
}

function setupResizeHandler(container: Element, scrollable: Element) {
	const left = container.querySelector('.ui-scroll-left') as HTMLElement;
	const right = container.querySelector('.ui-scroll-right') as HTMLElement;
	const handler = function () {
		const rootContainer = scrollable.querySelector('div');
		if (!rootContainer) return;

		if (rootContainer.scrollWidth > window.innerWidth) {
			// we have overflowed content
			const direction = this._RTL ? -1 : 1;
			if (direction * scrollable.scrollLeft > 0) {
				if (this._RTL) showArrow(right, true);
				else showArrow(left, true);
			} else if (this._RTL) showArrow(right, false);
			else showArrow(left, false);

			if (
				direction * scrollable.scrollLeft <
				rootContainer.scrollWidth - window.innerWidth - 1
			) {
				if (this._RTL) showArrow(left, true);
				else showArrow(right, true);
			} else if (this._RTL) showArrow(left, false);
			else showArrow(right, false);
		} else {
			showArrow(left, false);
			showArrow(right, false);
		}
	}.bind(this);

	window.addEventListener('resize', handler);
	window.addEventListener('scroll', handler);
}

JSDialog.MakeScrollable = function (parent: Element, scrollable: Element) {
	L.DomUtil.addClass(scrollable, 'ui-scrollable-content');
	createScrollButtons(parent, scrollable);
	setupResizeHandler(parent, scrollable);
};

JSDialog.RefreshScrollables = function () {
	window.dispatchEvent(new Event('resize'));
};

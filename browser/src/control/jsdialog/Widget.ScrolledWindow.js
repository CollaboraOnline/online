/* -*- js-indent-level: 8 -*- */
/*
 * JSDialog.ScrolledWindow - container with scrollbars
 *
 * Example JSON:
 * {
 *     id: 'id',
 *     type: 'scrollwindow',
 *     vertical: {
 * 	       policy: always,
 *         lower: 0,
 *         upper: 5,
 *         page_size: 4
 *     },
 *     horizontal: {
 * 	       policy: always,
 *         lower: 0,
 *         upper: 5,
 *         page_size: 4
 *     },
 *     children: [...]
 * }
 *
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

/* global JSDialog */

function _scrolledWindowControl(parentContainer, data, builder) {
	var scrollwindow = L.DomUtil.create('div', builder.options.cssClass + ' ui-scrollwindow', parentContainer);
	if (data.id)
		scrollwindow.id = data.id;

	var content = L.DomUtil.create('div', builder.options.cssClass + ' ui-scrollwindow-content', scrollwindow);

	builder.build(content, data.children, false);

	if (!data.vertical && !data.horizontal)
		return false;

	var noVertical = data.vertical.policy === 'never';
	if (noVertical)
		scrollwindow.style.overflowY = 'hidden';
	if (data.vertical.policy === 'always')
		scrollwindow.style.overflowY = 'scroll';

	var noHorizontal = data.horizontal.policy === 'never';
	if (noHorizontal)
		scrollwindow.style.overflowX = 'hidden';
	if (data.horizontal.policy === 'always')
		scrollwindow.style.overflowX = 'scroll';

	var realContentHeight = content.clientHeight;
	var realContentWidth = content.clientWidth;

	var margin = 15;

	var verticalSteps = (data.vertical.upper - data.vertical.lower - data.vertical.page_size) * 10;
	if (verticalSteps < 0 || noVertical)
		verticalSteps = 0;

	var horizontalSteps = (data.horizontal.upper - data.horizontal.lower - data.horizontal.page_size) * 10;
	if (horizontalSteps < 0 || noHorizontal)
		horizontalSteps = 0;

	var timeoutLimit = 2;
	var updateSize = function () {
		realContentHeight = content.clientHeight;
		realContentWidth = content.clientWidth;
		if (realContentHeight === 0 || realContentWidth === 0) {
			if (timeoutLimit--)
				setTimeout(updateSize, 100);
			return;
		}

		if (!noVertical) {
			content.style.height = (realContentHeight + verticalSteps) + 'px';
			scrollwindow.style.height = (realContentHeight + margin) + 'px';
		}
		if (!noHorizontal) {
			content.style.width = (realContentWidth + horizontalSteps) + 'px';
			scrollwindow.style.width = (realContentWidth + margin) + 'px';
		}

		content.scrollTop = data.vertical.value * 10;
		content.scrollLeft = data.horizontal.value * 10;

		content.style.margin = content.scrollTop + 'px ' + margin + 'px ' + margin + 'px ' + content.scrollLeft + 'px';
	};

	if (data.user_managed_scrolling !== false)
		setTimeout(updateSize, 0);

	var sendTimer = null;

	if ((!noVertical && verticalSteps) || (!noHorizontal && horizontalSteps)) {
		scrollwindow.addEventListener('scroll', function () {
			// keep content at the same place on the screen
			var scrollTop = scrollwindow.scrollTop;
			var scrollLeft = scrollwindow.scrollLeft;

			if (data.user_managed_scrolling !== false) {
				content.style.margin = scrollTop + 'px ' + margin + 'px ' + margin + 'px ' + scrollLeft + 'px';
				content.style.height = (realContentHeight - scrollTop + verticalSteps) + 'px';
				content.style.width = (realContentWidth - scrollLeft + horizontalSteps) + 'px';
			}

			if (sendTimer)
				clearTimeout(sendTimer);
			sendTimer = setTimeout(function () {
				builder.callback('scrolledwindow', 'scrollv', scrollwindow, Math.round(scrollTop / 10), builder);
				builder.callback('scrolledwindow', 'scrollh', scrollwindow, Math.round(scrollLeft / 10), builder); }, 50);
		});
	}

	return false;
}

JSDialog.scrolledWindow = function (parentContainer, data, builder) {
	var buildInnerData = _scrolledWindowControl(parentContainer, data, builder);
	return buildInnerData;
};

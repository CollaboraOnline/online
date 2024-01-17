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
 */

/* global JSDialog */

function _hasDrawingAreaInside(children) {
	if (!children)
		return false;

	for (var i in children) {
		if (children[i].type === 'drawingarea')
			return true;
		if (_hasDrawingAreaInside(children[i].children))
			return true;
	}

	return false;
}

function _scrolledWindowControl(parentContainer, data, builder) {
	var scrollwindow = L.DomUtil.create('div', builder.options.cssClass + ' ui-scrollwindow', parentContainer);
	if (data.id)
		scrollwindow.id = data.id;

	// drawing areas inside scrollwindows should be not cropped so we add special class
	if (_hasDrawingAreaInside(data.children))
		L.DomUtil.addClass(scrollwindow, 'has-ui-drawing-area');

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

	var rowHeight = 0;
	
	var timeoutLimit = 2;
	var updateSize = function () {
		realContentHeight = content.clientHeight;
		realContentWidth = content.clientWidth;
		if (realContentHeight === 0 || realContentWidth === 0) {
			if (timeoutLimit--)
				setTimeout(updateSize, 100);
			return;
		}
		
		if (!noVertical && data.vertical.upper > 0) {
			if (rowHeight == 0) {
				// determine the height a row
				rowHeight = content.clientHeight / Math.min(data.vertical.upper, data.vertical.page_size);
				// the content height might not include a new row being added, take it into account with the -1
				if (!Number.isInteger(rowHeight)) {
					rowHeight = content.clientHeight / (Math.min(data.vertical.upper, data.vertical.page_size) - 1);
				}
			}
			var viewHeight = data.vertical.page_size * rowHeight;
			var totalContentHeight = (data.vertical.upper -1) * rowHeight;

			if (totalContentHeight != scrollwindow.scrollHeight) {
				// only if view has changed
				var marginTop = data.vertical.value * rowHeight;

				content.style.marginBlockStart = marginTop + 'px';
				content.style.height = (totalContentHeight - marginTop) + 'px';
				scrollwindow.style.height = viewHeight + 'px';
				scrollwindow.scrollTop = marginTop;
			}
		}
		if (!noHorizontal) {
			content.style.width = (realContentWidth + horizontalSteps) + 'px';
			scrollwindow.style.width = (realContentWidth + margin) + 'px';
		}

		content.scrollLeft = data.horizontal.value * 10;
		content.style.marginInlineEnd = margin + 'px';
		content.style.marginInlineStart = content.scrollLeft + 'px';
	};

	if (data.user_managed_scrolling !== false) {
		setTimeout(updateSize, 0);

		var resizeObserver = new ResizeObserver(function () {
			updateSize();
		});
		resizeObserver.observe(content);
	}

	var sendTimer = null;
	if ((!noVertical && verticalSteps) || (!noHorizontal && horizontalSteps)) {
		scrollwindow.addEventListener('scroll', function() {
			if (data.user_managed_scrolling !== false) {
				var viewHeight = data.vertical.page_size * rowHeight;
				var totalContentHeight = Math.max((data.vertical.upper - 1) * rowHeight, viewHeight);
				var marginTop = Math.round(scrollwindow.scrollTop / rowHeight) * rowHeight;
	
				content.style.marginBlockStart = marginTop + 'px';
				content.style.height = (totalContentHeight - marginTop) + 'px';
				content.style.width = (realContentWidth - scrollwindow.scrollLeft + horizontalSteps) + 'px';
				content.style.marginInlineStart = scrollwindow.scrollLeft + 'px';
			}

			if (sendTimer)
				clearTimeout(sendTimer);
			sendTimer = setTimeout(function () {
				builder.callback('scrolledwindow', 'scrollv', scrollwindow, Math.round(scrollwindow.scrollTop / rowHeight), builder);
				builder.callback('scrolledwindow', 'scrollh', scrollwindow, Math.round(scrollwindow.scrollLeft / 10), builder); }, 50);
		});
	}

	return false;
}

JSDialog.scrolledWindow = function (parentContainer, data, builder) {
	var buildInnerData = _scrolledWindowControl(parentContainer, data, builder);
	return buildInnerData;
};

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
 * Util.HTMLContent - widgets created from plain HTML
 */

declare var JSDialog: any;

interface HtmlContentJson {
	id: string;
	type: 'htmlcontent';
	htmlId: string;
	closeCallback: EventListenerOrEventListenerObject;
}

var getHtmlFromId = function (
	id: string,
	closeCallback: EventListenerOrEventListenerObject,
) {
	if (id === 'iconset')
		return (window as any).getConditionalFormatMenuHtml('iconsetoverlay', true);
	else if (id === 'scaleset')
		return (window as any).getConditionalColorScaleMenuHtml(
			'iconsetoverlay',
			true,
		);
	else if (id === 'databarset')
		return (window as any).getConditionalDataBarMenuHtml(
			'iconsetoverlay',
			true,
		);
	else if (id === 'inserttablepopup')
		return (window as any).getInsertTablePopupHtml();
	else if (id === 'borderstylepopup')
		return (window as any).getBorderStyleMenuHtml(closeCallback);
	else if (id === 'insertshapespopup')
		return (window as any).getShapesPopupHtml(closeCallback);
	else if (id === 'insertconnectorspopup')
		return (window as any).getConnectorsPopupHtml(closeCallback);
};

function htmlContent(
	parentContainer: Element,
	data: HtmlContentJson /*builder*/,
) {
	parentContainer.innerHTML = getHtmlFromId(data.htmlId, data.closeCallback);
}

JSDialog.htmlContent = htmlContent;

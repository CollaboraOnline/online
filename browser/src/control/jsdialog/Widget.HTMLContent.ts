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
declare var L: any;

interface HtmlContentJson {
	id: string;
	type: 'htmlcontent';
	htmlId: string;
	closeCallback: EventListenerOrEventListenerObject;
	isReadOnlyMode: boolean | undefined;
	canUserWrite: boolean | undefined;
	text: string | undefined;
}

function sanitizeString(text: string): string {
	const sanitizer = document.createElement('div');
	sanitizer.innerText = text;
	return sanitizer.innerHTML;
}

function getPermissionModeHtml(isReadOnlyMode: boolean, canUserWrite: boolean) {
	var permissionModeDiv = '<div id="PermissionMode" class="cool-font jsdialog ';
	if (isReadOnlyMode && !canUserWrite) {
		permissionModeDiv +=
			' status-readonly-mode" title="' +
			sanitizeString(_('Permission Mode')) +
			'" style="padding: 5px 5px;"> ' +
			sanitizeString(_('Read-only')) +
			' </div>';
	} else if (isReadOnlyMode && canUserWrite) {
		permissionModeDiv +=
			' status-readonly-transient-mode" style="display: none;"></div>';
	} else {
		permissionModeDiv +=
			' status-edit-mode" title="' +
			sanitizeString(_('Permission Mode')) +
			'" style="padding: 5px 5px;"> ' +
			sanitizeString(_('Edit')) +
			' </div>';
	}
	return permissionModeDiv;
}

function getStatusbarItemHtml(id: string, title: string, text: string) {
	return (
		'<div id="' +
		sanitizeString(id) +
		'" class="cool-font" title="' +
		sanitizeString(title) +
		'" style="padding: 5px 5px;">' +
		sanitizeString(text) +
		'</div>'
	);
}

function getPageNumberHtml(text: string) {
	return getStatusbarItemHtml('StatePageNumber', _('Number of Pages'), text);
}

function getWordCountHtml(text: string) {
	return getStatusbarItemHtml('StateWordCount', _('Word Counter'), text);
}

function getStatusDocPosHtml(text: string) {
	return getStatusbarItemHtml('StatusDocPos', _('Number of Sheets'), text);
}

function getInsertModeHtml(text: string) {
	return getStatusbarItemHtml('InsertMode', _('Entering text mode'), text);
}

function getSelectionModeHtml(text: string) {
	return getStatusbarItemHtml('StatusSelectionMode', _('Selection Mode'), text);
}

function getRowColSelCountHtml(text: string) {
	return getStatusbarItemHtml(
		'RowColSelCount',
		_('Selected range of cells'),
		text,
	);
}

function getStateTableCellHtml(text: string) {
	return getStatusbarItemHtml('StateTableCell', _('Choice of functions'), text);
}

function getSlideStatusHtml(text: string) {
	return getStatusbarItemHtml('SlideStatus', _('Number of Slides'), text);
}

function getPageStatusHtml(text: string) {
	return getStatusbarItemHtml('PageStatus', _('Number of Pages'), text);
}

var getHtmlFromId = function (
	id: string,
	closeCallback: EventListenerOrEventListenerObject,
	data: HtmlContentJson,
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
		return (window as any).getInsertTablePopupHtml(closeCallback);
	else if (id === 'borderstylepopup')
		return (window as any).getBorderStyleMenuHtml(closeCallback);
	else if (id === 'insertshapespopup')
		return (window as any).getShapesPopupHtml(closeCallback);
	else if (id === 'insertconnectorspopup')
		return (window as any).getConnectorsPopupHtml(closeCallback);
	else if (id === 'userslistpopup') return L.control.createUserListWidget();
	else if (id === 'permissionmode')
		return getPermissionModeHtml(data.isReadOnlyMode, data.canUserWrite);
	else if (id === 'statepagenumber') return getPageNumberHtml(data.text);
	else if (id === 'statewordcount') return getWordCountHtml(data.text);
	else if (id === 'statusdocpos') return getStatusDocPosHtml(data.text);
	else if (id === 'insertmode') return getInsertModeHtml(data.text);
	else if (id === 'statusselectionmode') return getSelectionModeHtml(data.text);
	else if (id === 'rowcolselcount') return getRowColSelCountHtml(data.text);
	else if (id === 'statetablecell') return getStateTableCellHtml(data.text);
	else if (id === 'slidestatus') return getSlideStatusHtml(data.text);
	else if (id === 'pagestatus') return getPageStatusHtml(data.text);
};

function htmlContent(
	parentContainer: Element,
	data: HtmlContentJson,
	builder: any,
) {
	parentContainer.innerHTML = getHtmlFromId(
		data.htmlId,
		data.closeCallback,
		data,
	);

	// TODO: remove this and create real widget for userslistpopup
	if (data.htmlId === 'userslistpopup')
		setTimeout(() => builder.map.userList.renderAll(), 0);
}

JSDialog.htmlContent = htmlContent;

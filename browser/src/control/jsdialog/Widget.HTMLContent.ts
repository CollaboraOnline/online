// @ts-strict-ignore
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
	enabled: boolean;
	command: string | undefined;
}

function sanitizeString(text: string): string {
	const sanitizer = document.createElement('div');
	sanitizer.innerText = text;
	return sanitizer.innerHTML;
}

function getPermissionModeElements(
	isReadOnlyMode: boolean,
	canUserWrite: boolean,
	map: any,
) {
	const permissionModeDiv = document.createElement('div');
	permissionModeDiv.className = 'jsdialog ui-badge';

	if (isReadOnlyMode && !canUserWrite) {
		permissionModeDiv.classList.add('status-readonly-mode');
		permissionModeDiv.textContent = _('Read-only');
		permissionModeDiv.setAttribute('data-cooltip', _('Permission Mode'));
		L.control.attachTooltipEventListener(permissionModeDiv, map);
	} else if (isReadOnlyMode && canUserWrite) {
		permissionModeDiv.classList.add('status-readonly-transient-mode');
		permissionModeDiv.style.display = 'none';
	} else {
		permissionModeDiv.classList.add('status-edit-mode');
		permissionModeDiv.textContent = _('Edit mode');
		permissionModeDiv.setAttribute('data-cooltip', _('Permission Mode'));
		L.control.attachTooltipEventListener(permissionModeDiv, map);
	}

	return permissionModeDiv;
}

function getStatusbarItemElements(
	id: string,
	title: string,
	text: string,
	builder: any,
) {
	const div = document.createElement('div');
	div.id = id;
	div.className = 'jsdialog ui-badge';
	div.textContent = text;
	div.setAttribute('data-cooltip', title);
	L.control.attachTooltipEventListener(div, builder.map);

	return div;
}

function getPageNumberElements(text: string, builder: any) {
	return getStatusbarItemElements(
		'StatePageNumber',
		_('Number of Pages'),
		text,
		builder,
	);
}

function getWordCountElements(text: string, builder: any) {
	return getStatusbarItemElements(
		'StateWordCount',
		_('Word Counter'),
		text,
		builder,
	);
}

function getStatusDocPosElements(text: string, builder: any) {
	return getStatusbarItemElements(
		'StatusDocPos',
		_('Number of Sheets'),
		text,
		builder,
	);
}

function getInsertModeElements(text: string, builder: any) {
	return getStatusbarItemElements(
		'InsertMode',
		_('Entering text mode'),
		text,
		builder,
	);
}

function getSelectionModeElements(text: string, builder: any) {
	return getStatusbarItemElements(
		'StatusSelectionMode',
		_('Selection Mode'),
		text,
		builder,
	);
}

function getRowColSelCountElements(text: string, builder: any) {
	return getStatusbarItemElements(
		'RowColSelCount',
		_('Selected range of cells'),
		text,
		builder,
	);
}

function getStateTableCellElements(text: string, builder: any) {
	return getStatusbarItemElements(
		'StateTableCell',
		_('Choice of functions'),
		text,
		builder,
	);
}

function getSlideStatusElements(text: string, builder: any) {
	return getStatusbarItemElements(
		'SlideStatus',
		_('Number of Slides'),
		text,
		builder,
	);
}

function getPageStatusElements(text: string, builder: any) {
	return getStatusbarItemElements(
		'PageStatus',
		_('Number of Pages'),
		text,
		builder,
	);
}

function getDocumentStatusElements(text: string, builder: any) {
	const docstat = getStatusbarItemElements(
		'DocumentStatus',
		_('Your changes have been saved'),
		'',
		builder,
	);

	if (text === 'SAVING') docstat.textContent = _('Saving...');
	else if (text === 'SAVED') {
		const lastSaved = document.createElement('span');
		lastSaved.id = 'last-saved';
		lastSaved.textContent = '';
		lastSaved.setAttribute(
			'data-cooltip',
			_('Your changes have been saved') + '.',
		);
		L.control.attachTooltipEventListener(lastSaved, builder.map);
		docstat.appendChild(lastSaved);
	}

	return docstat;
}

function getShowCommentsStatusElements(text: string, builder: any) {
	return getStatusbarItemElements(
		'ShowComments',
		_('Show Comments'),
		text,
		builder,
	);
}

var getElementsFromId = function (
	id: string,
	closeCallback: EventListenerOrEventListenerObject,
	data: HtmlContentJson,
	builder: any,
) {
	if (id === 'iconset')
		return (window as any).getConditionalFormatMenuElements(
			'iconsetoverlay',
			true,
		);
	else if (id === 'scaleset')
		return (window as any).getConditionalColorScaleMenuElements(
			'iconsetoverlay',
			true,
		);
	else if (id === 'databarset')
		return (window as any).getConditionalDataBarMenuElements(
			'iconsetoverlay',
			true,
		);
	else if (id === 'inserttablepopup')
		return (window as any).getInsertTablePopupElements(closeCallback);
	else if (id === 'borderstylepopup')
		return (window as any).getBorderStyleMenuElements(closeCallback);
	else if (id === 'insertshapespopup')
		return (window as any).getShapesPopupElements(closeCallback);
	else if (id === 'insertconnectorspopup')
		return (window as any).getConnectorsPopupElements(closeCallback);
	else if (id === 'userslistpopup') return L.control.createUserListWidget();
	else if (id === 'permissionmode')
		return getPermissionModeElements(
			data.isReadOnlyMode,
			data.canUserWrite,
			builder.map,
		);
	else if (id === 'statepagenumber')
		return getPageNumberElements(data.text, builder);
	else if (id === 'statewordcount')
		return getWordCountElements(data.text, builder);
	else if (id === 'showcomments')
		return getShowCommentsStatusElements(data.text, builder);
	else if (id === 'statusdocpos')
		return getStatusDocPosElements(data.text, builder);
	else if (id === 'insertmode')
		return getInsertModeElements(data.text, builder);
	else if (id === 'statusselectionmode')
		return getSelectionModeElements(data.text, builder);
	else if (id === 'rowcolselcount')
		return getRowColSelCountElements(data.text, builder);
	else if (id === 'statetablecell')
		return getStateTableCellElements(data.text, builder);
	else if (id === 'slidestatus')
		return getSlideStatusElements(data.text, builder);
	else if (id === 'pagestatus')
		return getPageStatusElements(data.text, builder);
	else if (id === 'documentstatus')
		return getDocumentStatusElements(data.text, builder);
};

function htmlContent(
	parentContainer: Element,
	data: HtmlContentJson,
	builder: JSBuilder,
) {
	parentContainer.replaceChildren();

	const elements = getElementsFromId(
		data.htmlId,
		data.closeCallback,
		data,
		builder,
	);

	if (data.command) {
		elements.onclick = () => app.dispatcher.dispatch(data.command);
	}
	parentContainer.appendChild(elements);

	// TODO: remove this and create real widget for userslistpopup
	if (data.htmlId === 'userslistpopup')
		setTimeout(() => builder.map.userList.renderAll(), 0);

	if (data.enabled === false && parentContainer.firstChild)
		(parentContainer.firstChild as HTMLElement).setAttribute(
			'disabled',
			'true',
		);
}

JSDialog.htmlContent = htmlContent;

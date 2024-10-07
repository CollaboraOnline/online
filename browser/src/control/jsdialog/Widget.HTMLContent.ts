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
}

function sanitizeString(text: string): string {
	const sanitizer = document.createElement('div');
	sanitizer.innerText = text;
	return sanitizer.innerHTML;
}

function getPermissionModeElements(
	isReadOnlyMode: boolean,
	canUserWrite: boolean,
) {
	const permissionModeDiv = document.createElement('div');
	permissionModeDiv.className = 'jsdialog ui-badge';

	if (isReadOnlyMode && !canUserWrite) {
		permissionModeDiv.classList.add('status-readonly-mode');
		permissionModeDiv.title = _('Permission Mode');
		permissionModeDiv.textContent = _('Read-only');
	} else if (isReadOnlyMode && canUserWrite) {
		permissionModeDiv.classList.add('status-readonly-transient-mode');
		permissionModeDiv.style.display = 'none';
	} else {
		permissionModeDiv.classList.add('status-edit-mode');
		permissionModeDiv.title = _('Permission Mode');
		permissionModeDiv.textContent = _('Edit');
	}

	return permissionModeDiv;
}

function getStatusbarItemElements(id: string, title: string, text: string) {
	const div = document.createElement('div');
	div.id = id;
	div.className = 'jsdialog ui-badge';
	div.title = title;
	div.textContent = text;

	return div;
}

function getPageNumberElements(text: string) {
	return getStatusbarItemElements(
		'StatePageNumber',
		_('Number of Pages'),
		text,
	);
}

function getWordCountElements(text: string) {
	return getStatusbarItemElements('StateWordCount', _('Word Counter'), text);
}

function getStatusDocPosElements(text: string) {
	return getStatusbarItemElements('StatusDocPos', _('Number of Sheets'), text);
}

function getInsertModeElements(text: string) {
	return getStatusbarItemElements('InsertMode', _('Entering text mode'), text);
}

function getSelectionModeElements(text: string) {
	return getStatusbarItemElements(
		'StatusSelectionMode',
		_('Selection Mode'),
		text,
	);
}

function getRowColSelCountElements(text: string) {
	return getStatusbarItemElements(
		'RowColSelCount',
		_('Selected range of cells'),
		text,
	);
}

function getStateTableCellElements(text: string) {
	return getStatusbarItemElements(
		'StateTableCell',
		_('Choice of functions'),
		text,
	);
}

function getSlideStatusElements(text: string) {
	return getStatusbarItemElements('SlideStatus', _('Number of Slides'), text);
}

function getPageStatusElements(text: string) {
	return getStatusbarItemElements('PageStatus', _('Number of Pages'), text);
}

function getDocumentStatusElements(text: string) {
	const docstat = getStatusbarItemElements(
		'DocumentStatus',
		_('Your changes have been saved'),
		'',
	);

	if (text === 'SAVING') docstat.textContent = _('Saving...');
	else if (text === 'SAVED') {
		const lastSaved = document.createElement('span');
		lastSaved.id = 'last-saved';
		lastSaved.title = _('Your changes have been saved') + '.';
		lastSaved.textContent = '';
		docstat.appendChild(lastSaved);

		const savedStatus = document.createElement('span');
		savedStatus.id = 'saved-status-label';
		savedStatus.textContent = _('Document saved');
		docstat.appendChild(savedStatus);
	}

	return docstat;
}

var getElementsFromId = function (
	id: string,
	closeCallback: EventListenerOrEventListenerObject,
	data: HtmlContentJson,
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
		return getPermissionModeElements(data.isReadOnlyMode, data.canUserWrite);
	else if (id === 'statepagenumber') return getPageNumberElements(data.text);
	else if (id === 'statewordcount') return getWordCountElements(data.text);
	else if (id === 'statusdocpos') return getStatusDocPosElements(data.text);
	else if (id === 'insertmode') return getInsertModeElements(data.text);
	else if (id === 'statusselectionmode')
		return getSelectionModeElements(data.text);
	else if (id === 'rowcolselcount') return getRowColSelCountElements(data.text);
	else if (id === 'statetablecell') return getStateTableCellElements(data.text);
	else if (id === 'slidestatus') return getSlideStatusElements(data.text);
	else if (id === 'pagestatus') return getPageStatusElements(data.text);
	else if (id === 'documentstatus') return getDocumentStatusElements(data.text);
};

function htmlContent(
	parentContainer: Element,
	data: HtmlContentJson,
	builder: any,
) {
	parentContainer.replaceChildren();

	const elements = getElementsFromId(data.htmlId, data.closeCallback, data);

	parentContainer.appendChild(elements);

	// TODO: remove this and create real widget for userslistpopup
	if (data.htmlId === 'userslistpopup')
		setTimeout(() => builder.map.userList.renderAll(), 0);

	if (data.enabled === false && parentContainer.firstChild)
		(parentContainer.firstChild as HTMLElement).setAttribute('disabled', '');
}

JSDialog.htmlContent = htmlContent;

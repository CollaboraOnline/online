/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

interface ParsedJSONResult {
	[name: string]: any;
}

interface CRSInterface {
	scale(zoom: number): number;
}

interface MapInterface extends Evented {
	_docLayer: DocLayerInterface;
	uiManager: UIManager;
	_textInput: { debug(value: boolean): void };

	removeLayer(layer: any): void;
	addLayer(layer: any): void;
	setZoom(
		targetZoom: number,
		options: { [key: string]: any },
		animate: boolean,
	): void;

	stateChangeHandler: {
		getItemValue(unoCmd: string): string;
	};

	sendUnoCommand(unoCmd: string): void;

	getDocType(): 'text' | 'presentation' | 'spreadsheet' | 'drawing';
	isText(): boolean;
	isPresentationOrDrawing(): boolean;

	getDocSize(): cool.Point;
	getSize(): cool.Point;
	getCenter(): { lat: number; lng: number };
	_getCurrentFontName(): string;

	_docLoadedOnce: boolean;
	_debug: DebugManager;
	_fatal: boolean;
	_docPassword: string;

	options: {
		timestamp: number;
		doc: string;
		docParams: {
			access_token?: string;
			access_token_ttl?: string;
			no_auth_header?: string;
			permission?: 'edit' | 'readonly' | 'view';
		};
		renderingOptions: string;
		tileWidthTwips: number;
		tileHeightTwips: number;
		wopiSrc: string;
		previousWopiSrc: string;
		zoom: number;
		defaultZoom: number;
		crs: CRSInterface;
	};

	wopi: {
		resetAppLoaded(): void;
		DisableInactiveMessages: boolean;
		UserCanNotWriteRelative: boolean;
		BaseFileName: string;
	};

	loadDocument(socket?: SockInterface): void;
	getCurrentPartNumber(): number;
	getZoom(): number;
	showBusy(label: string, bar: boolean): void;
	hideBusy(): void;

	_clip: ClipboardInterface;

	setPermission(permission: 'edit' | 'readonly' | 'view'): void;
	onLockFailed(reason: string): void;
	updateModificationIndicator(newModificationTime: string): void;
	isEditMode(): boolean;
	isReadOnlyMode(): boolean;
	remove(): MapInterface;

	welcome: WelcomeInterface;
	_setLockProps(lockInfo: ParsedJSONResult): void;
	_setRestrictions(restrictionInfo: ParsedJSONResult): void;
	hideRestrictedItems(it: any, item: any, button: any): void;
	disableLockedItem(it: any, item: any, button: any): void;
	openUnlockPopup(cmd: ParsedJSONResult): void;
	isLockedUser(): boolean;
	isRestrictedUser(): boolean;

	focus(): void;
	editorHasFocus(): boolean;

	_fireInitComplete(condition: string): void;
	sendInitUNOCommands(): void;
	initTextInput(docType: string): void;
	saveAs(filenme: string, format?: string, options?: string): void;

	addControl(control: any): void;

	toolbarUpTemplate: any;
	menubar: Menubar;
	userList: UserList;
	sidebar: Sidebar;
}

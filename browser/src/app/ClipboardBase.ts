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
/* eslint-disable @typescript-eslint/no-empty-function */

// CoolClipboard is used to abstract our storage and management of local &
// remote clipboard data.

// Get all interesting clipboard related events here, and handle
// download logic in one place ...
// We keep track of the current selection content if it is simple
// So we can do synchronous copy/paste in the callback if possible.

class CoolClipboardBase extends BaseClass {
	private _map: MapInterface;
	private _selectionContent: string;
	private _selectionPlainTextContent: string;
	private _selectionType: string | null;
	private _accessKey: string[];
	private _clipboardSerial: number;
	private _failedTimer: TimeoutHdl | null;
	private _dummyDivName: string;
	private _unoCommandForCopyCutPaste: string | null;
	private _navigatorClipboardPasteSpecial: boolean;
	private _isActionCopy: boolean;
	private _dummyDiv: Element | null;
	private _dummyPlainDiv: Element | null;
	private _dummyClipboard: Clipboard;
	private _commandCompletion: Promise<void>[];

	constructor(map: MapInterface) {
		super();
		this._map = map;
		this._selectionContent = '';
		this._selectionPlainTextContent = '';
		this._selectionType = null;
		this._accessKey = ['', ''];
		this._clipboardSerial = 0; // incremented on each operation
		this._failedTimer = null;
		this._dummyDivName = 'copy-paste-container';
		this._unoCommandForCopyCutPaste = null;
		// Tracks if we're in paste special mode for the navigator.clipboard case
		this._navigatorClipboardPasteSpecial = false;
		// Is handling an 'Action_Copy' in progress?
		this._isActionCopy = false;

		const div: HTMLDivElement = document.createElement('div') as HTMLDivElement;
		this._dummyDiv = div;
		this._dummyPlainDiv = null;
		this._dummyClipboard = {} as Clipboard;

		// Tracks waiting for UNO commands to complete
		this._commandCompletion = [];
		this._map.on('commandresult', this._onCommandResult, this);
		this._map.on('clipboardchanged', this._onCommandResult, this);

		div.setAttribute('id', this._dummyDivName);
		div.style.userSelect = 'text !important';
		div.style.opacity = '0';
		div.setAttribute('contenteditable', 'true');
		div.setAttribute('type', 'text');
		div.style.position = 'fixed';
		div.style.left = '0px';
		div.style.top = '-200px';
		div.style.width = '15000px';
		div.style.height = '200px';
		div.style.overflow = 'hidden';
		div.style.zIndex = '-1000';
		(div.style as any)['-webkit-user-select'] = 'text !important';
		div.style.display = 'block';
		div.style.fontSize = '6pt';

		// so we get events to where we want them.
		const parent = document.getElementById('map');
		Util.ensureValue(parent);
		parent.appendChild(div);

		if (window.L.Browser.cypressTest) {
			this._dummyPlainDiv = document.createElement('div');
			this._dummyPlainDiv.id = 'copy-plain-container';
			const dummyStyle = (this._dummyPlainDiv as HTMLDivElement).style;
			dummyStyle.position = 'fixed';
			dummyStyle.left = '0px';
			dummyStyle.top = '-400px';
			dummyStyle.width = '15000px';
			dummyStyle.height = '200px';
			dummyStyle.overflow = 'hidden';
			dummyStyle.zIndex = '-1000';
			(dummyStyle as any)['-webkit-user-select'] = 'text !important';
			dummyStyle.display = 'block';
			dummyStyle.fontSize = '6pt';
			parent.appendChild(this._dummyPlainDiv);
		}

		// sensible default content.
		this._resetDiv();

		const beforeSelect = (ev: Event) => {
			return this._beforeSelect(ev);
		};

		document.oncut = (ev: Event) => {
			return this.cut(ev);
		};
		document.oncopy = (ev: Event) => {
			return this.copy(ev);
		};
		document.onpaste = (ev: Event) => {
			return this.paste(ev);
		};
		(document as any).onbeforecut = beforeSelect;
		(document as any).onbeforecopy = beforeSelect;
		(document as any).onbeforepaste = beforeSelect;
	}

	public isHtmlImage(html: string): boolean {
		console.assert(false, 'This should not be called!');
		return false;
	}

	public setKey(key: string): void {
		console.assert(false, 'This should not be called!');
	}

	public getMetaBase(): string {
		console.assert(false, 'This should not be called!');
		return '';
	}

	public getMetaPath(idx?: number): string {
		console.assert(false, 'This should not be called!');
		return '';
	}

	public getMetaURL(idx: number): string {
		console.assert(false, 'This should not be called!');
		return '';
	}

	private _getHtmlStubMarker(): string {
		console.assert(false, 'This should not be called!');
		return '';
	}

	private _isStubHtml(text: string): boolean {
		console.assert(false, 'This should not be called!');
		return false;
	}

	private _originWrapBody(body: string, isStub: boolean): string {
		console.assert(false, 'This should not be called!');
		return '';
	}

	private _getStubHtml(): string {
		console.assert(false, 'This should not be called!');
		return '';
	}

	private _getDisabledCopyStubHtml(): string {
		console.assert(false, 'This should not be called!');
		return '';
	}

	private _getMetaOrigin(html: string, prefix: string): string {
		console.assert(false, 'This should not be called!');
		return '';
	}

	private _encodeHtmlToBlob(text: string): Blob {
		console.assert(false, 'This should not be called!');
		return new Blob(['']);
	}

	private _readContentSyncToBlob(dataTransfer: DataTransfer): Blob | null {
		console.assert(false, 'This should not be called!');
		return new Blob(['']);
	}

	private async _doAsyncDownload(
		type: string,
		url: string,
		optionalFormData: FormData,
		forClipboard: boolean,
		progressFn: (progress: number) => number,
	): Promise<string | Blob> {
		console.assert(false, 'This should not be called!');
		return '';
	}

	private async _dataTransferDownloadAndPasteAsync(
		src: string,
		fallbackHtml: string,
	) {
		console.assert(false, 'This should not be called!');
	}

	private _onImageLoadFunc(file: FileReader): (e: Event) => void {
		console.assert(false, 'This should not be called!');
		return (e: Event) => {};
	}

	private _pasteTypedBlob(fileType: string, fileBlob: Blob): void {
		console.assert(false, 'This should not be called!');
	}

	private _asyncReadPasteFile(file: File): boolean {
		console.assert(false, 'This should not be called!');
		return false;
	}

	private _asyncReadPasteImage(file: File): boolean {
		console.assert(false, 'This should not be called!');
		return false;
	}

	private _asyncReadPasteAVMedia(file: File): boolean {
		console.assert(false, 'This should not be called!');
		return false;
	}

	public dataTransferToDocument(
		dataTransfer: DataTransfer,
		preferInternal: boolean,
		htmlText: string,
		usePasteKeyEvent: boolean,
	): boolean {
		console.assert(false, 'This should not be called!');
		return false;
	}

	private async _sendToInternalClipboard(
		content: Blob,
	): Promise<Blob | string> {
		console.assert(false, 'This should not be called!');
		return '';
	}

	public async dataTransferToDocumentFallback(
		dataTransfer: DataTransfer,
		htmlText: string,
		usePasteKeyEvent: boolean,
	): Promise<void> {
		console.assert(false, 'This should not be called!');
	}

	private _checkSelection(): void {
		console.assert(false, 'This should not be called!');
	}

	private _getHtmlForClipboard(): string {
		console.assert(false, 'This should not be called!');
		return '';
	}

	public populateClipboard(ev: Event): void {
		console.assert(false, 'This should not be called!');
	}

	private _isAnyInputFieldSelected(forCopy: boolean = false): boolean {
		console.assert(false, 'This should not be called!');
		return false;
	}

	private _isFormulabarSelected(): boolean {
		console.assert(false, 'This should not be called!');
		return false;
	}

	private _beforeSelect(ev: Event): void {
		console.assert(false, 'This should not be called!');
	}

	private _beforeSelectImpl(): boolean {
		console.assert(false, 'This should not be called!');
		return false;
	}

	private _resetDiv(): void {
		console.assert(false, 'This should not be called!');
	}

	private _execOnElement(operation: string): boolean {
		console.assert(false, 'This should not be called!');
		return false;
	}

	private _execCopyCutPaste(operation: string, cmd: string, params: any): void {
		console.assert(false, 'This should not be called!');
	}

	private _afterCopyCutPaste(operation: string): void {
		console.assert(false, 'This should not be called!');
	}

	private async _navigatorClipboardGetTypeCallback(
		clipboardContent: ClipboardItem,
		blob: Blob,
		type: string,
	): Promise<void> {
		console.assert(false, 'This should not be called!');
	}

	private _navigatorClipboardTextCallback(
		text: string,
		textType: string,
	): void {
		console.assert(false, 'This should not be called!');
	}

	private _onCommandResult(e: Event): void {
		console.assert(false, 'This should not be called!');
	}

	private async _sendCommandAndWaitForCompletion(
		command: string,
		params: any,
	): Promise<void> {
		console.assert(false, 'This should not be called!');
		return;
	}

	private async _parseClipboardFetchResult(
		text: Promise<string>,
		mimetype: string,
		shorttype: string,
	): Promise<Blob> {
		console.assert(false, 'This should not be called!');
		return new Blob(['']);
	}

	private _navigatorClipboardWrite(params: any): boolean {
		console.assert(false, 'This should not be called!');
		return false;
	}

	private async _asyncAttemptNavigatorClipboardWrite(
		params: any,
	): Promise<void> {
		console.assert(false, 'This should not be called!');
		return;
	}

	public parseClipboard(text: string): any {
		console.assert(false, 'This should not be called!');
		return {};
	}

	private _navigatorClipboardRead(isSpecial: boolean): boolean {
		console.assert(false, 'This should not be called!');
		return false;
	}

	private async _iOSReadClipboard(): Promise<ClipboardItem[]> {
		console.assert(false, 'This should not be called!');
		return [];
	}

	private async _asyncAttemptNavigatorClipboardRead(
		isSpecial: boolean,
	): Promise<void> {
		console.assert(false, 'This should not be called!');
		return;
	}

	public filterExecCopyPaste(cmd: string, params: any): boolean {
		console.assert(false, 'This should not be called!');
		return false;
	}

	private _doCopyCut(ev: Event, unoName: string): boolean {
		console.assert(false, 'This should not be called!');
		return false;
	}

	private _doInternalPaste(map: MapInterface, usePasteKeyEvent: boolean): void {
		console.assert(false, 'This should not be called!');
	}

	public cut(ev: Event): boolean {
		console.assert(false, 'This should not be called!');
		return false;
	}

	public copy(ev: Event): boolean {
		console.assert(false, 'This should not be called!');
		return false;
	}

	public paste(ev: Event): boolean {
		console.assert(false, 'This should not be called!');
		return false;
	}

	public clearSelection(): void {
		console.assert(false, 'This should not be called!');
	}

	public setTextSelectionHTML(html: string, plainText: string = ''): void {
		console.assert(false, 'This should not be called!');
	}

	public setTextSelectionType(selectionType: string): void {
		console.assert(false, 'This should not be called!');
	}

	public setTextSelectionText(text: string): void {
		console.assert(false, 'This should not be called!');
	}

	public setActionCopy(isActionCopy: boolean): void {
		console.assert(false, 'This should not be called!');
	}

	public isActionCopy(): boolean {
		console.assert(false, 'This should not be called!');
		return false;
	}

	public onComplexSelection(/*text*/): void {
		console.assert(false, 'This should not be called!');
	}

	private _startProgress(isLargeCopy: boolean): void {
		console.assert(false, 'This should not be called!');
	}

	private _onDownloadOnLargeCopyPaste(): void {
		console.assert(false, 'This should not be called!');
	}

	private _downloadProgressStatus(): string {
		console.assert(false, 'This should not be called!');
		return '';
	}

	private _scheduleHideDownload(): void {
		console.assert(false, 'This should not be called!');
	}

	private _stopHideDownload(): void {
		console.assert(false, 'This should not be called!');
	}

	private _warnCopyPaste(): void {
		console.assert(false, 'This should not be called!');
	}

	private _warnCopyPasteImpl(id: string): void {
		console.assert(false, 'This should not be called!');
	}

	private _substProductName(msg: string): string {
		console.assert(false, 'This should not be called!');
		return '';
	}

	private _warnLargeCopyPasteAlreadyStarted(): void {
		console.assert(false, 'This should not be called!');
	}

	public isPasteSpecialDialogOpen(): boolean {
		console.assert(false, 'This should not be called!');
		return false;
	}

	public isCopyPasteDialogReadyForCopy(): boolean {
		console.assert(false, 'This should not be called!');
		return false;
	}

	private _openPasteSpecialPopup(): void {
		console.assert(false, 'This should not be called!');
	}

	private _openPasteSpecialPopupImpl(id: string): void {
		console.assert(false, 'This should not be called!');
	}

	private _checkAndDisablePasteSpecial(): boolean {
		console.assert(false, 'This should not be called!');
		return false;
	}
}

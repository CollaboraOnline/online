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
	private _downloadProgress?: DownloadProgressInterface;

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

	// Decides if `html` effectively contains just an image.
	public isHtmlImage(html: string): boolean {
		const startsWithMeta = html.substring(0, 5) == '<meta';
		if (startsWithMeta) {
			// Ignore leading <meta>.
			const metaEnd = html.indexOf('>');
			if (metaEnd != -1) {
				// Start after '>'.
				html = html.substring(metaEnd + 1);
			}
		}

		// Starts with an <img> element.
		if (html.substring(0, 4) === '<img') {
			return true;
		}

		return false;
	}

	public setKey(key: string): void {
		if (this._accessKey[0] === key) return;
		this._accessKey[1] = this._accessKey[0];
		this._accessKey[0] = key;
	}

	public getMetaBase(): string {
		if (window.ThisIsAMobileApp) {
			return 'collabora-online-mobile'; // makeHttpUrl does not work with the file:// protocol used in mobile apps...
		}
		return window.makeHttpUrl('');
	}

	public getMetaPath(idx?: number): string {
		if (!idx) idx = 0;
		if (this._accessKey[idx] === '') return '';

		let metaPath =
			'/cool/clipboard?WOPISrc=' +
			encodeURIComponent(this._map.options.doc) +
			'&ServerId=' +
			app.socket.WSDServer.Id +
			'&ViewId=' +
			this._map._docLayer._viewId +
			'&Tag=' +
			this._accessKey[idx];

		if (window.routeToken !== '')
			metaPath += '&RouteToken=' + window.routeToken;

		return metaPath;
	}

	public getMetaURL(idx?: number): string {
		return this.getMetaBase() + this.getMetaPath(idx);
	}

	// Returns the marker used to identify stub messages.
	private _getHtmlStubMarker(): string {
		return '<title>Stub HTML Message</title>';
	}

	// Returns true if the argument is a stub html.
	private _isStubHtml(text: string): boolean {
		return text.indexOf(this._getHtmlStubMarker()) > 0;
	}

	// wrap some content with our stub magic
	private _originWrapBody(body: string, isStub: boolean): string {
		const lang = 'en_US'; // FIXME: l10n
		const encodedOrigin = encodeURIComponent(this.getMetaURL());
		let text =
			'<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.0 Transitional//EN">\n' +
			'<html>\n' +
			'  <head>\n';
		if (isStub) text += '    ' + this._getHtmlStubMarker() + '\n';
		text +=
			'    <meta http-equiv="content-type" content="text/html; charset=utf-8"/>\n' +
			'  </head>\n' +
			'  <body lang="' +
			lang +
			'" dir="ltr"><div id="meta-origin" data-coolorigin="' +
			encodedOrigin +
			'">\n' +
			body +
			'  </div></body>\n' +
			'</html>';
		return text;
	}

	// what an empty clipboard has on it
	private _getStubHtml(): string {
		return this._substProductName(
			this._originWrapBody(
				'    <p>' +
					_(
						"To paste outside {productname}, please first click the 'download' button",
					) +
					'</p>\n',
				true,
			),
		);
	}

	// used for DisableCopy mode to fill the clipboard
	private _getDisabledCopyStubHtml(): string {
		return this._substProductName(
			this._originWrapBody(
				'    <p>' + _('Copying from the document disabled') + '</p>\n',
				true,
			),
		);
	}

	private _isClipboardURLSafe(inURL: string): boolean {
		let parsedURL: URL;
		try {
			parsedURL = new URL(inURL, window.location.href);

			if (
				(parsedURL.protocol !== 'https:' &&
					parsedURL.protocol !== 'http:' &&
					parsedURL.protocol !== 'file:') ||
				parsedURL.origin !== window.location.origin ||
				!parsedURL.pathname.startsWith('/cool/clipboard')
			) {
				return false;
			}
		} catch (ex: any) {
			return false;
		}

		return true;
	}

	private _getMetaOrigin(html: string, prefix: string): string {
		const start = html.indexOf(prefix);
		if (start < 0) {
			return '';
		}
		const end = html.indexOf('"', start + prefix.length);
		if (end < 0) {
			return '';
		}
		const meta = html.substring(start + prefix.length, end);

		// quick sanity checks that it one of ours.
		if (
			meta.indexOf('%2Fclipboard%3FWOPISrc%3D') >= 0 &&
			meta.indexOf('%26ServerId%3D') > 0 &&
			meta.indexOf('%26ViewId%3D') > 0 &&
			meta.indexOf('%26Tag%3D') > 0
		) {
			const inURL = decodeURIComponent(meta);
			if (!this._isClipboardURLSafe(inURL)) {
				window.app.console.log(
					'Untrusted URL: "' + inURL + '" as clipboard origin. Rejected!',
				);
				return '';
			}

			return inURL;
		} else {
			window.app.console.log('Mis-understood foreign origin: "' + meta + '"');
		}
		return '';
	}

	private _encodeHtmlToBlob(text: string): Blob {
		const content: Array<string | Blob> = [];
		const data = new Blob([text]);
		content.push('text/html\n');
		content.push(data.size.toString(16) + '\n');
		content.push(data);
		content.push('\n');
		return new Blob(content);
	}

	private _readContentSyncToBlob(dataTransfer: DataTransfer): Blob | null {
		const content = [];
		const types: readonly string[] = dataTransfer.types;
		for (let t = 0; t < types.length; ++t) {
			if (types[t] === 'Files') continue; // images handled elsewhere.
			const dataStr = dataTransfer.getData(types[t]);
			// Avoid types that has no content.
			if (!dataStr.length) continue;
			const data = new Blob([dataStr]);
			window.app.console.log(
				'type ' +
					types[t] +
					' length ' +
					data.size +
					' -> 0x' +
					data.size.toString(16) +
					'\n',
			);
			content.push((types[t] === 'text' ? 'text/plain' : types[t]) + '\n');
			content.push(data.size.toString(16) + '\n');
			content.push(data);
			content.push('\n');
		}
		if (content.length > 0)
			return new Blob(content, {
				type: 'application/octet-stream',
				endings: 'transparent',
			});
		else return null;
	}

	// Abstract async post & download for our progress wrappers
	// type: GET or POST
	// url:  where to get / send the data
	// optionalFormData: used for POST for form data
	// forClipboard: a boolean telling if we need the "Confirm copy to clipboard" link in the end
	// completeFn: called on completion - with response.
	// progressFn: allows splitting the progress bar up.
	private async _doAsyncDownload(
		type: string,
		url: string,
		optionalFormData: FormData,
		forClipboard: boolean,
		progressFn: (progress: number) => number,
	): Promise<string | Blob> {
		const request = new XMLHttpRequest();

		// avoid to invoke the following code if the download widget depends on user interaction
		if (!this._downloadProgress || this._downloadProgress.isClosed()) {
			this._startProgress(false);
			Util.ensureValue(this._downloadProgress);
			this._downloadProgress.startProgressMode();
		}

		return await new Promise((resolve, reject) => {
			request.onload = () => {
				Util.ensureValue(this._downloadProgress);
				this._downloadProgress._onComplete();
				if (!forClipboard) {
					this._downloadProgress._onClose();
				}

				// For some reason 400 error from the server doesn't
				// invoke onerror callback, but we do get here with
				// size==0, which signifies no response from the server.
				// So we check the status code instead.
				if (request.status == 200) {
					resolve(request.response);
				} else {
					reject(request.response);
				}
			};
			request.onerror = (error) => {
				reject(error);
				Util.ensureValue(this._downloadProgress);
				this._downloadProgress._onComplete();
				this._downloadProgress._onClose();
			};

			request.ontimeout = () => {
				this._map.uiManager.showSnackbar(
					_('warning: copy/paste request timed out'),
				);
				Util.ensureValue(this._downloadProgress);
				this._downloadProgress._onClose();
				reject('request timed out');
			};

			request.upload.addEventListener(
				'progress',
				(e) => {
					if (e.lengthComputable) {
						const percent = progressFn((e.loaded / e.total) * 100);
						const progress = { statusType: 'setvalue', value: percent };
						Util.ensureValue(this._downloadProgress);
						this._downloadProgress._onUpdateProgress(progress);
					}
				},
				false,
			);

			if (window.processCoolUrl) {
				url = window.processCoolUrl({ url: url, type: 'clipboard' });
			}

			request.open(type, url, true /* isAsync */);
			request.timeout = 30 * 1000; // 30 secs ...
			request.responseType = 'blob';
			if (optionalFormData !== null) request.send(optionalFormData);
			else request.send();
		});
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

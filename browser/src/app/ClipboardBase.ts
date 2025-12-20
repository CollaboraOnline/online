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

interface CoolClipboardEvent {
	clipboardData: {
		getData(type: string): string;
		types: string[];
	};
	preventDefault: () => void;
}

interface CoolCommandEvent {
	commandName: string;
}

interface VoidPromiseArgs {
	resolve: (value: void | PromiseLike<void>) => void;
	reject: (reason?: any) => void;
}

class CoolClipboardBase extends BaseClass {
	private _map: MapInterface;
	private _selectionContent: string;
	private _selectionPlainTextContent: string;
	private _selectionType: string | null;
	private _accessKey: string[];
	private _clipboardSerial: number;
	private _failedTimer: TimeoutHdl | undefined;
	private _dummyDivName: string;
	private _unoCommandForCopyCutPaste: string | null;
	private _navigatorClipboardPasteSpecial: boolean;
	private _isActionCopy: boolean;
	private _dummyDiv: HTMLElement | null;
	private _dummyPlainDiv: Element | null;
	private _dummyClipboard: Clipboard;
	private _commandCompletion: VoidPromiseArgs[];
	private _downloadProgress?: DownloadProgressInterface;

	constructor(map: MapInterface) {
		super();
		this._map = map;
		this._selectionContent = '';
		this._selectionPlainTextContent = '';
		this._selectionType = null;
		this._accessKey = ['', ''];
		this._clipboardSerial = 0; // incremented on each operation
		this._failedTimer = undefined;
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
		optionalFormData: FormData | null,
		forClipboard: boolean,
		progressFn: (progress: number) => number,
	): Promise<Blob> {
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

	// Suck the data from one server to another asynchronously ...
	private async _dataTransferDownloadAndPasteAsync(
		src: string,
		fallbackHtml: string,
	) {
		// FIXME: add a timestamp in the links (?) ignore old / un-responsive servers (?)
		let response;
		const errorMessage = _('Failed to download clipboard, please re-copy');
		try {
			response = await this._doAsyncDownload(
				'GET',
				src,
				null,
				false,
				function (progress) {
					return progress / 2;
				},
			);
		} catch (_error) {
			window.app.console.log(
				'failed to download clipboard using fallback html',
			);

			// If it's the stub, avoid pasting.
			if (this._isStubHtml(fallbackHtml)) {
				// Let the user know they haven't really copied document content.
				window.app.console.error(
					'Clipboard: failed to download - ' + errorMessage,
				);
				this._map.uiManager.showInfoModal(
					'data-transfer-warning',
					'',
					errorMessage,
					null,
				);
				return;
			}

			const formData = new FormData();
			let commandName = null;
			if (this._checkAndDisablePasteSpecial()) {
				commandName = '.uno:PasteSpecial';
			} else {
				commandName = '.uno:Paste';
			}
			const data = JSON.stringify({
				url: src,
				commandName: commandName,
			});
			formData.append('data', new Blob([data]), 'clipboard');
			try {
				await this._doAsyncDownload(
					'POST',
					this.getMetaURL(),
					formData,
					false,
					function (progress) {
						return 50 + progress / 2;
					},
				);
			} catch (_error) {
				await this.dataTransferToDocumentFallback(null, fallbackHtml);
			}
			return;
		}

		window.app.console.log('download done - response ' + response);
		const formData = new FormData();
		formData.append('data', response, 'clipboard');

		try {
			await this._doAsyncDownload(
				'POST',
				this.getMetaURL(),
				formData,
				false,
				function (progress) {
					return 50 + progress / 2;
				},
			);

			if (this._checkAndDisablePasteSpecial()) {
				window.app.console.log('up-load done, now paste special');
				app.socket.sendMessage('uno .uno:PasteSpecial');
			} else {
				window.app.console.log('up-load done, now paste');
				app.socket.sendMessage('uno .uno:Paste');
			}
		} catch (_error) {
			window.app.console.error('Clipboard: failed to download - error');
			this._map.uiManager.showInfoModal(
				'data-transfer-warning',
				'',
				errorMessage,
				null,
			);
		}
	}

	private _onImageLoadFunc(file: File): (e: Event) => void {
		return (e: Event) => {
			this._pasteTypedBlob(file.type, (e.target as any).result);
		};
	}

	// Sends a paste event with the specified mime type and content
	private _pasteTypedBlob(fileType: string, fileBlob: Blob): void {
		const blob = new Blob(['paste mimetype=' + fileType + '\n', fileBlob]);
		app.socket.sendMessage(blob);
	}

	private _asyncReadPasteFile(file: File): boolean {
		if (file.type.match(/image.*/)) {
			return this._asyncReadPasteImage(file);
		}
		if (file.type.match(/audio.*/) || file.type.match(/video.*/)) {
			return this._asyncReadPasteAVMedia(file);
		}
		return false;
	}

	private _asyncReadPasteImage(file: File): boolean {
		const reader = new FileReader();
		reader.onload = this._onImageLoadFunc(file).bind(this);
		reader.readAsArrayBuffer(file);
		return true;
	}

	private _asyncReadPasteAVMedia(file: File): boolean {
		this._map.insertMultimedia(file);
		return true;
	}

	// Returns true if it finished synchronously, and false if it has started an async operation
	// that will likely end at a later time (required to avoid closing progress bar in paste(ev))
	// FIXME: This comment is a lie if dataTransferToDocumentFallback is called, as it calls _doAsyncDownload
	public dataTransferToDocument(
		dataTransfer: DataTransfer,
		preferInternal: boolean,
		htmlText: string,
		usePasteKeyEvent: boolean,
	): boolean {
		// Look for our HTML meta magic.
		//   cf. ClientSession.cpp /textselectioncontent:/

		const meta = this._getMetaOrigin(
			htmlText,
			'<div id="meta-origin" data-coolorigin="',
		);
		const id = this.getMetaPath(0);
		const idOld = this.getMetaPath(1);

		// for the paste, we always prefer the internal LOK's copy/paste
		if (
			preferInternal === true &&
			((id !== '' && meta.indexOf(id) >= 0) ||
				(idOld !== '' && meta.indexOf(idOld) >= 0))
		) {
			// Home from home: short-circuit internally.
			window.app.console.log('short-circuit, internal paste');
			this._doInternalPaste(this._map, usePasteKeyEvent);
			return true;
		}

		// Do we have a remote Online we can suck rich data from ?
		if (meta !== '') {
			window.app.console.log(
				'Transfer between servers\n\t"' + meta + '" vs. \n\t"' + id + '"',
			);
			this._dataTransferDownloadAndPasteAsync(meta, htmlText);
			return false; // just started async operation - did not finish yet
		}

		// Fallback.
		this.dataTransferToDocumentFallback(
			dataTransfer,
			htmlText,
			usePasteKeyEvent,
		);
		return true;
	}

	private async _sendToInternalClipboard(content: Blob): Promise<Blob | void> {
		if (window.ThisIsTheiOSApp) {
			await (window as any).webkit.messageHandlers.clipboard.postMessage(
				`sendToInternal ${await content.text()}`,
			); // no need to base64 in this direction...
		} else {
			const formData = new FormData();
			formData.append('file', content);

			return await this._doAsyncDownload(
				'POST',
				this.getMetaURL(),
				formData,
				false,
				function (progress: number) {
					return progress;
				},
			);
		}
	}

	public async dataTransferToDocumentFallback(
		dataTransfer: DataTransfer | null,
		htmlText: string,
		usePasteKeyEvent?: boolean,
	): Promise<void> {
		let content;
		if (dataTransfer) {
			// Suck HTML content out of dataTransfer now while it feels like working.
			content = this._readContentSyncToBlob(dataTransfer);
		}

		// Fallback on the html.
		if (!content && htmlText != '') {
			content = this._encodeHtmlToBlob(htmlText);
		}

		// FIXME: do we want this section ?

		// Images get a look in only if we have no content and are async (used in the Ctrl-V
		// case)
		if (
			((content == null && htmlText === '') || this.isHtmlImage(htmlText)) &&
			dataTransfer != null
		) {
			const types = dataTransfer.types;

			window.app.console.log('Attempting to paste image(s)');

			// first try to transfer images
			// TODO if we have both Files and a normal mimetype, should we handle
			// both, or prefer one or the other?
			for (let t = 0; t < types.length; ++t) {
				window.app.console.log('\ttype' + types[t]);
				if (types[t] === 'Files') {
					const files = dataTransfer.files;
					if (files !== null) {
						for (let f = 0; f < files.length; ++f)
							this._asyncReadPasteFile(files[f]);
					} // IE / Edge
					else {
						const file = dataTransfer.items[t].getAsFile();
						if (file) {
							this._asyncReadPasteFile(file);
						}
					}
				}
			}

			// If any paste special dialog is open, close it here, because we won't call
			// _doInternalPaste() that would do the closing.
			this._checkAndDisablePasteSpecial();

			return;
		}

		if (content == null) {
			window.app.console.log('Nothing we can paste on the clipboard');
			return;
		}

		window.app.console.log('Normal HTML, so smart paste not possible');

		await this._sendToInternalClipboard(content);

		window.app.console.log(
			'clipboard: Sent ' + content.size + ' bytes successfully',
		);

		this._doInternalPaste(this._map, !!usePasteKeyEvent);
	}

	private _checkSelection(): void {
		const checkSelect = document.getSelection();
		if (checkSelect && checkSelect.isCollapsed)
			window.app.console.log('Error: collapsed selection - cannot copy/paste');
	}

	private _getHtmlForClipboard(): string {
		let text;

		if (
			this._selectionType === 'complex' ||
			GraphicSelection.hasActiveSelection()
		) {
			window.app.console.log('Copy/Cut with complex/graphical selection');
			if (this._selectionType === 'text' && this._selectionContent !== '') {
				// back here again having downloaded it ...
				text = this._selectionContent; // Not sure if we hit these lines. Last else block seems to catch the downloaded content (selection type is not "complex" while copying to clipboard).
				window.app.console.log('Use downloaded selection.');
			} else {
				window.app.console.log('Downloaded that selection.');
				text = this._getStubHtml();
				this._onDownloadOnLargeCopyPaste();
				Util.ensureValue(this._downloadProgress);
				this._downloadProgress.setURI(
					// richer, bigger HTML ...
					this.getMetaURL() + '&MimeType=text/html,text/plain;charset=utf-8',
				);
			}
		} else if (this._selectionType === null) {
			window.app.console.log('Copy/Cut with no selection!');
			text = this._getStubHtml();
		} else {
			window.app.console.log('Copy/Cut with simple text selection');
			text = this._selectionContent;
		}
		return text;
	}

	// returns whether we should stop processing the event
	public populateClipboard(ev: ClipboardEvent): void {
		// If the copy paste API is not supported, we download the content as a fallback method.
		let text = this._getHtmlForClipboard();

		let plainText = DocUtil.stripHTML(text);
		if (
			text == this._selectionContent &&
			this._selectionPlainTextContent != ''
		) {
			plainText = this._selectionPlainTextContent;
		}
		if (ev.clipboardData) {
			// Standard
			if (this._unoCommandForCopyCutPaste === '.uno:CopyHyperlinkLocation') {
				const ess = 's';
				const re = new RegExp(
					'^(.*)(<a href=")([^"]+)(">.*</a>)(</p>\\n</body>\\n</html>)$',
					ess,
				);
				const match = re.exec(text);
				if (match !== null && match.length === 6) {
					text = match[1] + match[3] + match[5];
					plainText = DocUtil.stripHTML(text);
				}
			}
			// if copied content is graphical then plainText is null and it does not work on mobile.
			ev.clipboardData.setData('text/plain', plainText ? plainText : ' ');
			ev.clipboardData.setData('text/html', text);
			window.app.console.log('Put "' + text + '" on the clipboard');
			this._clipboardSerial++;
		}
	}

	private _isAnyInputFieldSelected(forCopy: boolean = false): boolean {
		if ($('#search-input').is(':focus')) return true;

		if ($('.ui-edit').is(':focus')) return true;

		if ($('.ui-textarea').is(':focus')) return true;

		if ($('input.ui-combobox-content').is(':focus')) return true;

		if (
			this._map.uiManager.isAnyDialogOpen() &&
			!this.isCopyPasteDialogReadyForCopy() &&
			!this.isPasteSpecialDialogOpen()
		)
			return true;

		if (cool.Comment.isAnyFocus()) return true;

		if (forCopy) {
			const selection = window.getSelection();
			const selectionString = selection && selection.toString();
			if (selectionString && selectionString.length !== 0) return true;
		}

		return false;
	}

	private _isFormulabarSelected(): boolean {
		if ($('#sc_input_window').is(':focus')) return true;
		return false;
	}

	// Does the selection of text before an event comes in
	private _beforeSelect(ev: Event): void {
		window.app.console.log('Got event ' + ev.type + ' setting up selection');

		if (this._isAnyInputFieldSelected(ev.type === 'beforecopy')) return;

		this._beforeSelectImpl();
	}

	private _beforeSelectImpl(): void {
		if (this._selectionType === 'slide') return;

		// We need some spaces in there ...
		this._resetDiv();

		const sel = document.getSelection();
		if (!sel) return;

		const selected = false;
		let selectRange;

		if (!selected) {
			sel.removeAllRanges();
			selectRange = document.createRange();
			Util.ensureValue(this._dummyDiv);
			selectRange.selectNodeContents(this._dummyDiv);
			sel.addRange(selectRange);

			const checkSelect = document.getSelection();
			if (!checkSelect || checkSelect.isCollapsed)
				window.app.console.log('Error: failed to select - cannot copy/paste');
		}
	}

	private _resetDiv(): void {
		Util.ensureValue(this._dummyDiv);
		// cleanup the content:
		this._dummyDiv.replaceChildren();

		const bElement = document.createElement('b');
		bElement.style.fontWeight = 'normal';
		bElement.style.backgroundColor = 'transparent';
		bElement.style.color = 'transparent';

		const span = document.createElement('span');
		span.textContent = '  ';

		bElement.appendChild(span);
		this._dummyDiv.appendChild(bElement);
	}

	// Try-harder fallbacks for emitting cut/copy/paste events.
	private _execOnElement(operation: string): boolean {
		const serial = this._clipboardSerial;

		this._resetDiv();

		// selection can change focus.
		const active = document.activeElement;

		const success =
			document.execCommand(operation) && serial !== this._clipboardSerial;

		// try to restore focus if we need to.
		if (active !== null && active !== document.activeElement)
			(active as HTMLElement).focus();

		window.app.console.log(
			'fallback ' + operation + ' ' + (success ? 'success' : 'fail'),
		);

		return success;
	}

	// Encourage browser(s) to actually execute the command
	private _execCopyCutPaste(operation: string, cmd: string, params: any): void {
		const serial = this._clipboardSerial;

		this._unoCommandForCopyCutPaste = cmd;

		if (
			operation !== 'paste' &&
			cmd !== undefined &&
			this._navigatorClipboardWrite(params)
		) {
			// This is the codepath where an UNO command initiates the clipboard
			// operation.
			return;
		}

		if (
			!window.ThisIsTheiOSApp && // in mobile apps, we want to drop straight to navigatorClipboardRead as execCommand will require user interaction...
			document.execCommand(operation) &&
			serial !== this._clipboardSerial
		) {
			window.app.console.log('copied successfully');
			this._unoCommandForCopyCutPaste = null;
			return;
		}

		if (operation == 'paste' && this._navigatorClipboardRead(false)) {
			// execCommand(paste) failed, the new clipboard API is available, tried that
			// way.
			return;
		}

		this._afterCopyCutPaste(operation);
	}

	private _afterCopyCutPaste(operation: string): void {
		const serial = this._clipboardSerial;
		this._unoCommandForCopyCutPaste = null;

		// try a hidden div
		if (this._execOnElement(operation)) {
			window.app.console.log('copied on element successfully');
			return;
		}

		// see if we have help for paste
		if (operation === 'paste') {
			try {
				window.app.console.warn('Asked parent for a paste event');
				this._map.fire('postMessage', { msgId: 'UI_Paste' });
			} catch (error) {
				window.app.console.warn('Failed to post-message: ' + error);
			}
		}

		// wait and see if we get some help
		clearTimeout(this._failedTimer);
		setTimeout(() => {
			if (this._clipboardSerial !== serial) {
				window.app.console.log('successful ' + operation);
				if (operation === 'paste') this._stopHideDownload();
			} else {
				window.app.console.log('help did not arrive for ' + operation);
				this._warnCopyPaste();
			}
		}, 150 /* ms */);
	}

	// ClipboardContent.getType() callback: used with the Paste button
	private async _navigatorClipboardGetTypeCallback(
		clipboardContent: ClipboardItem,
		blob: Blob,
		type: string,
	): Promise<void> {
		if (type == 'image/png') {
			this._pasteTypedBlob(type, blob);
			return;
		}

		let text;
		try {
			text = await blob.text();
		} catch (error: any) {
			window.app.console.log('blob.text() failed: ' + error.message);
			return;
		}

		if (type !== 'text/html' || !this.isHtmlImage(text)) {
			this._navigatorClipboardTextCallback(text, type);
			return;
		}

		// Got an image, work with that directly.
		let image;
		try {
			image = await clipboardContent.getType('image/png');
		} catch (error: any) {
			window.app.console.log(
				'clipboardContent.getType(image/png) failed: ' + error.message,
			);
			return;
		}

		this._navigatorClipboardGetTypeCallback(
			clipboardContent,
			image,
			'image/png',
		);
	}

	// Clipboard blob text() callback for the text/html and text/plain cases
	private _navigatorClipboardTextCallback(
		text: string,
		textType: string,
	): void {
		// paste() wants to work with a paste event, so construct one.
		const ev = {
			clipboardData: {
				// Used early by paste().
				getData: function (type: string): string {
					if (type === textType) {
						return text;
					}

					return '';
				},
				// Used by _readContentSyncToBlob().
				types: [textType],
			},
			preventDefault: function () {},
		};

		// Invoke paste(), which knows how to recognize our HTML vs external HTML.
		this.paste(ev as unknown as ClipboardEvent);
	}

	// Gets status of a copy/paste command from the remote Kit
	private _onCommandResult(e: CoolCommandEvent): void {
		if (
			e.commandName === '.uno:Copy' ||
			e.commandName === '.uno:Cut' ||
			e.commandName === '.uno:CopyHyperlinkLocation' ||
			e.commandName === '.uno:CopySlide'
		) {
			window.app.console.log(
				'Resolve clipboard command promise ' +
					e.commandName +
					' with queue length: ' +
					this._commandCompletion.length,
			);
			while (this._commandCompletion.length > 0) {
				const a = this._commandCompletion.shift();
				Util.ensureValue(a);
				a.resolve();
			}
		}
	}

	private async _sendCommandAndWaitForCompletion(
		command: string,
		params: any,
	): Promise<void | null> {
		if (
			command !== '.uno:Copy' &&
			command !== '.uno:Cut' &&
			command !== '.uno:CopyHyperlinkLocation' &&
			command !== '.uno:CopySlide'
		) {
			console.error(
				`_sendCommandAndWaitForCompletion was called with '${command}', but anything except Copy or Cut will never complete`,
			);
			return null;
		}

		if (this._commandCompletion.length > 0) {
			console.warn(
				'Already have ' +
					this._commandCompletion.length +
					' pending clipboard command(s)',
			);
			return null;
		}

		if (!params) app.socket.sendMessage('uno ' + command);
		else app.map.sendUnoCommand(command, params);

		return new Promise((resolve, reject) => {
			window.app.console.log('New ' + command + ' promise');
			// FIXME: add a timeout cleanup too ...
			this._commandCompletion.push({
				resolve: resolve,
				reject: reject,
			});
		});
	}

	private async _parseClipboardFetchResult(
		text: Promise<string>,
		mimetype: string,
		shorttype: string,
	): Promise<Blob> {
		const content = this.parseClipboard(await text)[shorttype];
		const blob = new Blob([content], { type: mimetype });
		console.log(
			'Generate blob of type ' +
				mimetype +
				' from ' +
				shorttype +
				' text: ' +
				content,
		);
		return blob;
	}

	// Executes the navigator.clipboard.write() call, if it's available.
	private _navigatorClipboardWrite(params: any): boolean {
		if (!window.L.Browser.clipboardApiAvailable && !window.ThisIsTheiOSApp) {
			return false;
		}

		if (this._selectionType !== 'text' && this._selectionType !== 'slide') {
			return false;
		}

		this._asyncAttemptNavigatorClipboardWrite(params);
		return true;
	}

	private async _asyncAttemptNavigatorClipboardWrite(
		params: any,
	): Promise<void> {
		const command = this._unoCommandForCopyCutPaste;
		Util.ensureValue(command);
		const check_ = this._sendCommandAndWaitForCompletion(command, params);

		// I strongly disrecommend awaiting before the clipboard.write line in the non-iOS-app path
		// It turns out there are some rather precarious conditions for copy/paste to be allowed in Safari on mobile - and awaiting seems to tip us over into "too late to copy/paste"
		// Deferring like this is kinda horrible - it certainly looks gross in places - but it's absolutely necessary to avoid errors on the clipboard.write line
		// I don't like it either :). If you change this make sure to thoroughly test cross-browser and cross-device!

		if (window.ThisIsTheiOSApp) {
			// This is sent down the fakewebsocket which can race with the
			// native message - so first step is to wait for the result of
			// that command so we are sure the clipboard is set before
			// fetching it.
			if ((await check_) === null) return; // Either wrong command or a pending event.

			await (window as any).webkit.messageHandlers.clipboard.postMessage(
				`write`,
			);
		} else {
			const url =
				this.getMetaURL() + '&MimeType=text/html,text/plain;charset=utf-8';

			const text = (async () => {
				if ((await check_) === null)
					throw new Error(
						'Failed check, either wrong command or pending event',
					);
				// We need to throw an error here rather than just returning so that a failure halts copying the ClipboardItem to the clipboard

				const result = await fetch(url);
				return await result.text();
			})();

			const clipboardItem = new ClipboardItem({
				'text/html': this._parseClipboardFetchResult(text, 'text/html', 'html'),
				'text/plain': this._parseClipboardFetchResult(
					text,
					'text/plain',
					'plain',
				),
			});
			// Again, despite fetch(url), this._parseClipboardFetchResult(...) and check_ all being promises, we need to let browser internals await them after we have safely succeeded in calling clipboard.write
			// We throw an error if our checks fail before returning our text to cause these promises to reject - that way everything can be deferred for later, with failures causing the clipboard write to fail later
			// We define the text promise outside to allow us to reuse the fetch rather than fetching twice (as in Ic23f7f817cc855ff08f25a2afefcd73d6fc3472b)

			let clipboard = navigator.clipboard;
			if (window.L.Browser.cypressTest) {
				clipboard = this._dummyClipboard;
			}

			try {
				await clipboard.write([clipboardItem]);
			} catch (error: any) {
				// When document is not focused, writing to clipboard is not allowed. But this error shouldn't stop the usage of clipboard API.
				if (!document.hasFocus()) {
					window.app.console.warn(
						'navigator.clipboard.write() failed: ' + error.message,
					);
					return;
				}

				// Similarly, we'll get an error that is identical to the permission error if our `text` promise rejects
				// But this is really a check failure - if we can see that check failed we don't need to act on the bogus permission error
				if ((await check_) === null) {
					window.app.console.warn(
						'navigator.clipboard.write() failed due to a failing check',
					);
					return;
				}

				window.app.console.error(
					'navigator.clipboard.write() failed: ' + error.message,
				);
				// Warn that the copy failed.
				this._warnCopyPaste();
				// Prefetch selection, so next time copy will work with the keyboard.
				app.socket.sendMessage(
					'gettextselection mimetype=text/html,text/plain;charset=utf-8',
				);
			}
		}
	}

	// Parses the result from the clipboard endpoint into HTML and plain text.
	public parseClipboard(text: string): any {
		let textHtml;
		let textPlain = '';
		if (text.startsWith('{')) {
			const textJson = JSON.parse(text);
			textHtml = textJson['text/html'];
			textPlain = textJson['text/plain;charset=utf-8'];
		} else {
			let idx = text.indexOf('<!DOCTYPE HTML');
			if (idx === -1) {
				idx = text.indexOf('<!DOCTYPE html');
			}
			if (idx > 0) text = text.substring(idx, text.length);
			textHtml = text;
		}

		if (!app.sectionContainer.testing) textHtml = DocUtil.stripStyle(textHtml);

		return {
			html: textHtml,
			plain: textPlain,
		};
	}

	// Executes the navigator.clipboard.read() call, if it's available.
	private _navigatorClipboardRead(isSpecial: boolean): boolean {
		if (!window.L.Browser.clipboardApiAvailable && !window.ThisIsTheiOSApp) {
			return false;
		}

		this._asyncAttemptNavigatorClipboardRead(isSpecial);
		return true;
	}

	private async _iOSReadClipboard(): Promise<ClipboardItem[] | null> {
		const encodedClipboardData =
			await window.webkit.messageHandlers.clipboard.postMessage('read');

		if (encodedClipboardData === '(internal)') {
			return null;
		}

		const clipboardData = Array.from(encodedClipboardData.split(' ')).map(
			(encoded) => (encoded === '(null)' ? '' : window.b64d(encoded as string)),
		);

		const dataByMimeType: { [name: string]: any } = {};

		if (clipboardData[0]) {
			dataByMimeType['text/plain'] = new Blob([clipboardData[0]]);
		}

		if (clipboardData[1]) {
			dataByMimeType['text/html'] = new Blob([clipboardData[1]]);
		}

		if (Object.keys(dataByMimeType).length === 0) {
			return [];
		}

		return [new ClipboardItem(dataByMimeType)];
	}

	private async _asyncAttemptNavigatorClipboardRead(
		isSpecial: boolean,
	): Promise<void> {
		let clipboard = navigator.clipboard;
		if (window.L.Browser.cypressTest) {
			clipboard = this._dummyClipboard;
		}
		let clipboardContents;
		try {
			clipboardContents = window.ThisIsTheiOSApp
				? await this._iOSReadClipboard()
				: await clipboard.read();

			if (clipboardContents === null) {
				this._doInternalPaste(this._map, false);
				return; // Internal paste, skip the rest of the browser paste code
			}
		} catch (error: any) {
			window.app.console.log(
				'navigator.clipboard.read() failed: ' + error.message,
			);
			if (isSpecial) {
				// Fallback to the old code, as in filterExecCopyPaste().
				this._openPasteSpecialPopup();
			} else {
				// Fallback to the old code, as in _execCopyCutPaste().
				this._afterCopyCutPaste('paste');
			}
			return;
		}

		if (isSpecial) {
			this._navigatorClipboardPasteSpecial = true;
		}

		if (clipboardContents.length < 1) {
			window.app.console.log('clipboard has no items');
			return;
		}

		const clipboardContent = clipboardContents[0];

		if (clipboardContent.types.includes('text/html')) {
			let blob;
			try {
				blob = await clipboardContent.getType('text/html');
			} catch (error: any) {
				window.app.console.log(
					'clipboardContent.getType(text/html) failed: ' + error.message,
				);
				return;
			}
			this._navigatorClipboardGetTypeCallback(
				clipboardContent,
				blob,
				'text/html',
			);
		} else if (clipboardContent.types.includes('text/plain')) {
			let blob;
			try {
				blob = await clipboardContent.getType('text/plain');
			} catch (error: any) {
				window.app.console.log(
					'clipboardContent.getType(text/plain) failed: ' + error.message,
				);
				return;
			}
			this._navigatorClipboardGetTypeCallback(
				clipboardContent,
				blob,
				'text/plain',
			);
		} else if (clipboardContent.types.includes('image/png')) {
			let blob;
			try {
				blob = await clipboardContent.getType('image/png');
			} catch (error: any) {
				window.app.console.log(
					'clipboardContent.getType(image/png) failed: ' + error.message,
				);
				return;
			}
			this._navigatorClipboardGetTypeCallback(
				clipboardContent,
				blob,
				'image/png',
			);
		} else {
			window.app.console.log(
				'navigator.clipboard has no text/html or text/plain',
			);
			return;
		}
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

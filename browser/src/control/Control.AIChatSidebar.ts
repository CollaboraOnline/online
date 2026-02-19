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
 * Control.AIChatSidebar - AI Chat sidebar rendered via JSDialog in the existing sidebar dock wrapper.
 *
 * Manages chat state (messages, processing), generates JSDialog widget JSON,
 * and renders using its own JSDialog builder instance with a custom callback.
 * Selected text is exchanged as markdown (text/markdown;charset=utf-8).
 */

/* global app JSDialog Autolinker */
declare var JSDialog: any;
declare var Autolinker: any;

namespace cool {
	interface ChatMessage {
		role: 'user' | 'assistant';
		content: string;
		displayContent?: string;
		selectedText?: string;
		timestamp: number;
		isError?: boolean;
		imageData?: string;
	}

	export class AIChatSidebar {
		private messages: ChatMessage[] = [];
		private isProcessing: boolean = false;
		private currentRequestId: string = '';
		private inputText: string = '';
		private _isActive: boolean = false;
		private lastSentSelectedText: string = '';
		private hintText: string = '';

		private builder: any;
		private container: HTMLElement;
		private wrapper: HTMLElement;

		private readonly PROMPT_CHIPS: string[] = [
			'Make it more concise',
			'Make it more formal',
			'Make it more casual',
			'Summarize this text',
			'Expand this text',
			'Fix grammar & spelling',
		];

		private readonly SYSTEM_PROMPT: string =
			'You are a helpful document editing assistant for Collabora Online. ' +
			'Help users with their documents — answering questions, suggesting edits, ' +
			'rewriting text, and more. When the user shares selected text, provide relevant help. ' +
			'When providing rewritten or edited text, return it in markdown format preserving ' +
			'the original formatting structure. IMPORTANT: Return the markdown text directly ' +
			'without wrapping it in code fences (do NOT use ```markdown or ``` blocks). ' +
			'Just return the raw markdown content. Be concise and helpful.';

		private readonly ACTION_KEYWORDS: string[] = [
			'rewrite',
			'fix',
			'change',
			'translate',
			'rephrase',
			'improve',
			'edit',
			'summarize',
			'simplify',
			'shorten',
			'expand',
			'formal',
			'casual',
			'correct',
			'convert',
			'make it',
			'turn it',
			'write it',
		];

		private readonly IMAGE_KEYWORDS: string[] = [
			'generate image',
			'generate an image',
			'generate a image',
			'generate picture',
			'generate a picture',
			'create image',
			'create an image',
			'create a image',
			'create picture',
			'create a picture',
			'draw image',
			'draw an image',
			'draw a image',
			'draw picture',
			'draw a picture',
			'draw me',
			'make image',
			'make an image',
			'make a image',
			'make picture',
			'make a picture',
		];

		constructor() {
			this.container = document.getElementById('aichat-panel') as HTMLElement;
			this.wrapper = document.getElementById(
				'aichat-dock-wrapper',
			) as HTMLElement;
			this.createBuilder();
			this.registerChatHandlers();
		}

		private createBuilder(): void {
			this.builder = new window.L.control.jsDialogBuilder({
				mobileWizard: this,
				map: app.map,
				windowId: -1,
				cssClass: 'jsdialog sidebar',
				useScrollAnimation: false,
				suffix: 'sidebar',
				callback: this.jsdialogCallback.bind(this),
			});
		}

		private registerChatHandlers(): void {
			app.map.on('aichatresult', this.onAIChatResult, this);
			app.map.on('aiimageresult', this.onAIImageResult, this);
		}

		toggle(): void {
			if (this._isActive) {
				this.hide();
			} else {
				this.show();
			}
		}

		show(): void {
			this._isActive = true;
			this.render();
			this.wrapper.classList.add('visible');
			this.focusInput();
		}

		hide(): void {
			this._isActive = false;
			this.wrapper.classList.remove('visible');
			if (!app.map.editorHasFocus()) {
				app.map.fire('editorgotfocus');
				app.map.focus();
			}
		}

		isVisible(): boolean {
			return this._isActive;
		}

		private render(): void {
			if (!this._isActive) return;
			this.container.innerHTML = '';
			var data = this.getWidgetJSON();
			this.builder.build(this.container, [data], false);
			this.applyMessageStyles();
			this.scrollToBottom();
			this.attachKeyboardHandler();
			if (!this.isProcessing) {
				this.focusInput();
			}
		}

		private applyMessageStyles(): void {
			for (var i = 0; i < this.messages.length; i++) {
				var el = document.getElementById('aichat-msg-' + i);
				if (el) {
					var cls =
						this.messages[i].role === 'user'
							? 'aichat-msg-user'
							: 'aichat-msg-assistant';
					el.classList.add(cls);
					if (this.messages[i].isError) {
						el.classList.add('aichat-msg-error');
					}
				}
			}
			const sendBtn = document.querySelector(
				'#aichat-send-btn button.ui-pushbutton',
			);
			if (sendBtn) {
				sendBtn.classList.toggle(
					'aichat-stop-mode',
					this.isProcessing,
				);
			}
			this.applyTooltips();
		}

		private applyTooltips(): void {
			const tooltips: Record<string, string> = {
				'aichat-clear-btn': _('New conversation'),
				'aichat-close-btn': _('Close'),
				'aichat-send-btn': this.isProcessing
					? _('Stop generating')
					: _('Send message (Enter)'),
			};
			// Action button tooltips
			for (let i = 0; i < this.messages.length; i++) {
				tooltips[`aichat-insert-text-${i}`] = _('Insert at cursor');
				tooltips[`aichat-copy-text-${i}`] = _('Copy to clipboard');
				tooltips[`aichat-insert-img-${i}`] = _('Insert at cursor');
				tooltips[`aichat-copy-img-${i}`] = _('Copy to clipboard');
			}
			for (const [id, tip] of Object.entries(tooltips)) {
				const wrapper = document.getElementById(id);
				if (wrapper) {
					wrapper.title = tip;
					const btn = wrapper.querySelector('button');
					if (btn) btn.title = tip;
				}
			}
		}

		private scrollToBottom(): void {
			requestAnimationFrame(() => {
				const messagesArea =
					document.getElementById('aichat-messages-area');
				if (messagesArea && messagesArea.lastElementChild) {
					messagesArea.lastElementChild.scrollIntoView({
						behavior: 'smooth',
						block: 'end',
					});
				}
			});
		}

		private focusInput(): void {
			requestAnimationFrame(() => {
				const textarea = document.querySelector(
					'#aichat-input .ui-textarea',
				) as HTMLTextAreaElement | null;
				if (textarea) textarea.focus();
			});
		}

		private getWidgetJSON(): any {
			const children: any[] = [
				this.getHeaderJSON(),
				this.getMessagesAreaJSON(),
			];
			if (this.hintText) {
				children.push({
					id: 'aichat-hint',
					type: 'fixedtext',
					text: this.hintText,
					enabled: true,
				});
			}
			children.push(this.getInputJSON());
			return {
				id: 'aichat-main',
				type: 'container',
				vertical: true,
				children: children,
			};
		}

		private readonly ICON_TRASH: string =
			"data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg' " +
			"fill='none' stroke='%23666' stroke-width='1.5' stroke-linecap='round' " +
			"stroke-linejoin='round'%3E%3Cpath d='M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 " +
			"1v2m2 0v14a1 1 0 01-1 1H7a1 1 0 01-1-1V6h12z'/%3E%3Cpath d='M10 11v6M14 11v6'" +
			'/%3E%3C/svg%3E';

		private readonly ICON_CLOSE: string =
			"data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg' " +
			"fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round'%3E" +
			"%3Cpath d='M6 6l12 12M18 6L6 18'/%3E%3C/svg%3E";

		private readonly ICON_SEND: string =
			"data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg' " +
			"fill='none' stroke='%23666' stroke-width='2.5' stroke-linecap='round' " +
			"stroke-linejoin='round'%3E%3Cpath d='M12 19V5M5 12l7-7 7 7'/%3E%3C/svg%3E";

		private readonly ICON_CHECK: string =
			"data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg' " +
			"fill='none' stroke='%2322c55e' stroke-width='2.5' stroke-linecap='round' " +
			"stroke-linejoin='round'%3E%3Cpath d='M5 13l4 4L19 7'/%3E%3C/svg%3E";

		private readonly ICON_INSERT: string =
			"data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg' " +
			"fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round'%3E" +
			"%3Cpath d='M12 5v14M5 12h14'/%3E%3C/svg%3E";

		private readonly ICON_STOP: string =
			"data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg' " +
			"fill='%23fff' stroke='none'%3E%3Crect x='7' y='7' width='10' height='10' " +
			"rx='2'/%3E%3C/svg%3E";

		private getHeaderJSON(): any {
			return {
				id: 'aichat-header',
				type: 'container',
				horizontal: true,
				children: [
					{
						id: 'aichat-title',
						type: 'fixedtext',
						text: _('AI Assistant'),
						enabled: true,
					},
					{
						id: 'aichat-clear-btn',
						type: 'pushbutton',
						image: this.ICON_TRASH,
						enabled: this.messages.length > 0,
					},
					{
						id: 'aichat-close-btn',
						type: 'pushbutton',
						image: this.ICON_CLOSE,
						enabled: true,
					},
				],
			};
		}

		private getMessagesAreaJSON(): any {
			const children: any[] = [];

			if (this.messages.length === 0) {
				children.push({
					id: 'aichat-empty-state',
					type: 'fixedtext',
					text: _('Ask AI anything about your document...'),
					enabled: true,
				});
				children.push(this.getPromptChipsJSON());
			} else {
				for (let i = 0; i < this.messages.length; i++) {
					children.push(this.getMessageJSON(this.messages[i], i));
				}
			}

			// Loading dots inside messages area so they scroll with messages
			if (this.isProcessing) {
				children.push({
					id: 'aichat-loading-dots',
					type: 'container',
					horizontal: true,
					children: [
						{
							id: 'aichat-dot-1',
							type: 'fixedtext',
							text: '\u25CF',
							enabled: true,
						},
						{
							id: 'aichat-dot-2',
							type: 'fixedtext',
							text: '\u25CF',
							enabled: true,
						},
						{
							id: 'aichat-dot-3',
							type: 'fixedtext',
							text: '\u25CF',
							enabled: true,
						},
					],
				});
			}

			// JSDialog builder only creates a wrapper div for containers
			// with >1 children; add a spacer to guarantee the div exists
			// so #aichat-messages-area CSS (flex: 1) applies.
			if (children.length < 2) {
				children.push({
					id: 'aichat-messages-spacer',
					type: 'fixedtext',
					text: '',
					enabled: true,
				});
			}

			return {
				id: 'aichat-messages-area',
				type: 'container',
				vertical: true,
				children: children,
			};
		}

		private getMessageJSON(msg: ChatMessage, index: number): any {
			const isUser = msg.role === 'user';
			const children: any[] = [];

			if (isUser && msg.selectedText) {
				children.push({
					id: 'aichat-context-' + index,
					type: 'fixedtext',
					html: app.LOUtil.sanitize(this.markdownToHtml(msg.selectedText)),
					enabled: true,
				});
			}

			if (msg.imageData) {
				// Image message
				children.push({
					id: `aichat-msg-text-${index}`,
					type: 'fixedtext',
					html: app.LOUtil.sanitize(
						'<img src="data:image/png;base64,' +
							msg.imageData +
							'" alt="' +
							this.escapeHtml(_('AI generated image')) +
							'" class="aichat-generated-image" />',
					),
					enabled: true,
				});
				children.push(this.getImageActionsJSON(index));
			} else {
				// Text message content - use displayContent for UI, content for API
				const displayText = msg.displayContent || msg.content;
				if (isUser || msg.isError) {
					children.push({
						id: `aichat-msg-text-${index}`,
						type: 'fixedtext',
						text: displayText,
						enabled: true,
					});
				} else {
					children.push({
						id: `aichat-msg-text-${index}`,
						type: 'fixedtext',
						html: app.LOUtil.sanitize(this.markdownToHtml(displayText)),
						enabled: true,
					});
				}

				// Action buttons for text assistant messages
				if (!isUser && !msg.isError) {
					var showInsert = this.shouldShowActions(index);
					children.push(this.getActionsJSON(index, showInsert));
				}

				// Retry button for error messages
				if (msg.isError) {
					children.push({
						id: `aichat-retry-${index}`,
						type: 'pushbutton',
						text: _('Retry'),
						enabled: true,
					});
				}
			}

			// JSDialog builder only creates a wrapper div for containers
			// with >1 children; add a spacer to guarantee the div exists
			// so applyMessageStyles can find it by ID.
			if (children.length < 2) {
				children.push({
					id: `aichat-msg-spacer-${index}`,
					type: 'fixedtext',
					text: '',
					enabled: true,
				});
			}

			return {
				id: `aichat-msg-${index}`,
				type: 'container',
				vertical: true,
				children: children,
			};
		}

		private getActionsJSON(index: number, showInsert: boolean): any {
			const children: any[] = [];

			if (showInsert) {
				children.push({
					id: `aichat-insert-text-${index}`,
					type: 'pushbutton',
					image: this.ICON_INSERT,
					enabled: true,
				});
			}

			children.push({
				id: `aichat-copy-text-${index}`,
				type: 'pushbutton',
				image: 'lc_copy.svg',
				enabled: true,
			});

			// JSDialog builder only creates a wrapper div for containers
			// with >1 children; add a spacer to ensure the actions div
			// is always created so CSS selectors match.
			if (children.length < 2) {
				children.push({
					id: `aichat-actions-spacer-${index}`,
					type: 'fixedtext',
					text: '',
					enabled: true,
				});
			}

			return {
				id: `aichat-actions-${index}`,
				type: 'container',
				horizontal: true,
				children: children,
			};
		}

		private getImageActionsJSON(index: number): any {
			return {
				id: `aichat-actions-${index}`,
				type: 'container',
				horizontal: true,
				children: [
					{
						id: `aichat-insert-img-${index}`,
						type: 'pushbutton',
						image: this.ICON_INSERT,
						enabled: true,
					},
					{
						id: `aichat-copy-img-${index}`,
						type: 'pushbutton',
						image: 'lc_copy.svg',
						enabled: true,
					},
				],
			};
		}

		private getInputJSON(): any {
			return {
				id: 'aichat-input-area',
				type: 'container',
				horizontal: true,
				children: [
					{
						id: 'aichat-input',
						type: 'multilineedit',
						text: this.inputText,
						placeholder: _('Ask AI...'),
						cursor: true,
						enabled: !this.isProcessing,
					},
					{
						id: 'aichat-send-btn',
						type: 'pushbutton',
						image: this.isProcessing
							? this.ICON_STOP
							: this.ICON_SEND,
						enabled:
							this.isProcessing ||
							this.inputText.trim().length > 0,
					},
				],
			};
		}

		private getPromptChipsJSON(): any {
			var chipChildren: any[] = [];
			for (var i = 0; i < this.PROMPT_CHIPS.length; i++) {
				chipChildren.push({
					id: 'aichat-chip-' + i,
					type: 'pushbutton',
					text: this.PROMPT_CHIPS[i],
					enabled: true,
				});
			}
			return {
				id: 'aichat-chips',
				type: 'container',
				vertical: false,
				children: chipChildren,
			};
		}

		private jsdialogCallback(
			objectType: string,
			eventType: string,
			object: any,
			data: any,
			_builder: any,
		): void {
			if (!object || !object.id) return;
			const id = object.id;

			if (eventType === 'click') {
				if (id === 'aichat-send-btn') {
					if (this.isProcessing) {
						this.isProcessing = false;
						this.currentRequestId = '';
						this.render();
					} else {
						this.sendMessage();
					}
				} else if (id === 'aichat-close-btn') {
					this.hide();
				} else if (id === 'aichat-clear-btn') {
					this.clearConversation();
				} else if (id.startsWith('aichat-insert-img-')) {
					var insertImgIdx = parseInt(id.replace('aichat-insert-img-', ''));
					var insertImgData = this.messages[insertImgIdx]?.imageData;
					if (insertImgData) {
						this.insertImageAtCursor(insertImgData);
						this.showCopyFeedback(insertImgIdx, 'aichat-insert-img-');
					}
				} else if (id.startsWith('aichat-copy-img-')) {
					var copyImgIdx = parseInt(id.replace('aichat-copy-img-', ''));
					var copyImgData = this.messages[copyImgIdx]?.imageData;
					if (copyImgData) {
						this.copyImageToClipboard(copyImgData, copyImgIdx);
					}
				} else if (id.startsWith('aichat-insert-text-')) {
					var insertIdx = parseInt(id.replace('aichat-insert-text-', ''));
					if (this.messages[insertIdx]) {
						this.insertAtCursor(this.messages[insertIdx].content);
						this.showCopyFeedback(insertIdx, 'aichat-insert-text-');
					}
				} else if (id.startsWith('aichat-copy-text-')) {
					var copyIdx = parseInt(id.replace('aichat-copy-text-', ''));
					if (this.messages[copyIdx]) {
						this.copyToClipboard(this.messages[copyIdx].content, copyIdx);
					}
				} else if (id.startsWith('aichat-chip-')) {
					var chipIdx = parseInt(id.replace('aichat-chip-', ''));
					if (this.PROMPT_CHIPS[chipIdx]) {
						this.inputText = this.PROMPT_CHIPS[chipIdx];
						this.sendMessage();
					}
				} else if (id.startsWith('aichat-retry-')) {
					var retryIdx = parseInt(id.replace('aichat-retry-', ''));
					var userMsg = this.findPrecedingUserMessage(retryIdx);
					if (userMsg) {
						// Remove error message
						this.messages.splice(retryIdx, 1);
						// Remove preceding user message
						var userIdx = this.messages.indexOf(userMsg);
						if (userIdx >= 0) this.messages.splice(userIdx, 1);
						this.inputText =
							userMsg.displayContent || userMsg.content;
						this.sendMessage();
					}
				}
			} else if (eventType === 'change') {
				if (id === 'aichat-input') {
					var prevEmpty = this.inputText.trim().length === 0;
					this.inputText = data;
					var nowEmpty = this.inputText.trim().length === 0;
					if (prevEmpty !== nowEmpty) {
						// Toggle send button without full re-render
						var sendBtn = document.querySelector(
							'#aichat-send-btn button.ui-pushbutton',
						) as HTMLButtonElement | null;
						if (sendBtn) {
							if (nowEmpty) {
								sendBtn.setAttribute('disabled', 'true');
							} else {
								sendBtn.removeAttribute('disabled');
							}
						}
					}
					// Auto-resize textarea
					var textarea = document.querySelector(
						'#aichat-input .ui-textarea',
					) as HTMLTextAreaElement | null;
					if (textarea) {
						textarea.style.height = 'auto';
						textarea.style.height =
							Math.min(textarea.scrollHeight, 120) + 'px';
					}
				}
			}
		}

		// Needed for JSDialog builder compatibility (mobileWizard interface)
		setTabs(): void {
			// no-op: required by JSDialog builder mobileWizard interface
		}
		selectedTab(): number {
			return 0;
		}

		private isImageGenerationPrompt(text: string): boolean {
			const lower = text.toLowerCase();
			return this.IMAGE_KEYWORDS.some((kw) => lower.includes(kw));
		}

		async sendMessage(): Promise<void> {
			const text = this.inputText.trim();
			if (!text || this.isProcessing) return;

			const isImageRequest = this.isImageGenerationPrompt(text);

			if (!isImageRequest && !TextSelections.isActive()) {
				this.hintText = _(
					'Please select some text in the document first, so the AI assistant can help you with it.',
				);
				this.render();
				return;
			}

			this.hintText = '';

			let selectedText = '';
			if (!isImageRequest) {
				try {
					selectedText = await this.fetchSelectedMarkdown();
				} catch (e: any) {
					if (e?.message === 'complexselection') {
						this.hintText = _(
							'The selection contains images or other non-text content that cannot be sent as context.',
						);
						this.render();
						return;
					}
					// Other errors (timeout, parse failure) — silently continue without selection
				}

				// Don't re-send identical selection context
				if (selectedText && selectedText === this.lastSentSelectedText) {
					selectedText = '';
				}
				if (selectedText) {
					this.lastSentSelectedText = selectedText;
				}
			}

			// Build user content with context
			let userContent = text;
			if (selectedText) {
				userContent =
					'[Selected text from document:\n```\n' +
					selectedText +
					'\n```]\n\n' +
					text;
			}

			// Add user message
			const userMsg: ChatMessage = {
				role: 'user',
				content: userContent,
				displayContent: text,
				selectedText: selectedText || undefined,
				timestamp: Date.now(),
			};
			this.messages.push(userMsg);
			this.inputText = '';

			// Show user message
			this.render();

			// Start processing
			this.isProcessing = true;
			this.render();

			this.currentRequestId = this.generateRequestId();

			if (isImageRequest) {
				// Send image generation request
				const payload = JSON.stringify({
					prompt: text,
					requestId: this.currentRequestId,
				});
				app.socket.sendMessage('aiimage: ' + payload);

				// Client-side timeout (60s for image gen)
				const requestId = this.currentRequestId;
				setTimeout(() => {
					if (this.isProcessing && this.currentRequestId === requestId) {
						this.onAIImageResult({
							success: false,
							error: _('Request timeout'),
							requestId: requestId,
						});
					}
				}, 60000);
			} else {
				// Build OpenAI-format messages (skip image messages)
				const apiMessages: { role: string; content: string }[] = [
					{ role: 'system', content: this.SYSTEM_PROMPT },
				];
				for (const msg of this.messages) {
					if (!msg.imageData) {
						apiMessages.push({
							role: msg.role,
							content: msg.content,
						});
					}
				}

				const payload = JSON.stringify({
					messages: apiMessages,
					requestId: this.currentRequestId,
				});
				app.socket.sendMessage('aichat: ' + payload);

				// Client-side timeout
				const requestId = this.currentRequestId;
				setTimeout(() => {
					if (this.isProcessing && this.currentRequestId === requestId) {
						this.onAIChatResult({
							success: false,
							error: _('Request timeout'),
							requestId: requestId,
						});
					}
				}, 45000);
			}
		}

		private onAIChatResult(data: any): void {
			if (data.requestId !== this.currentRequestId) return;

			this.isProcessing = false;

			if (data.success) {
				const assistantMsg: ChatMessage = {
					role: 'assistant',
					content: data.content,
					timestamp: Date.now(),
				};
				this.messages.push(assistantMsg);
			} else {
				const errorMsg: ChatMessage = {
					role: 'assistant',
					content: _('Error: ') + (data.error || _('AI request failed')),
					timestamp: Date.now(),
					isError: true,
				};
				this.messages.push(errorMsg);
			}

			this.render();
		}

		private onAIImageResult(data: any): void {
			if (data.requestId !== this.currentRequestId) return;

			this.isProcessing = false;

			if (data.success) {
				const imageMsg: ChatMessage = {
					role: 'assistant',
					content: _('Generated image'),
					imageData: data.imageData,
					timestamp: Date.now(),
				};
				this.messages.push(imageMsg);
			} else {
				const errorMsg: ChatMessage = {
					role: 'assistant',
					content: _('Error: ') + (data.error || _('Image generation failed')),
					timestamp: Date.now(),
					isError: true,
				};
				this.messages.push(errorMsg);
			}

			this.render();
		}

		clearConversation(): void {
			this.messages = [];
			this.isProcessing = false;
			this.currentRequestId = '';
			this.inputText = '';
			this.lastSentSelectedText = '';
			this.hintText = '';
			this.render();
		}

		private async fetchSelectedMarkdown(): Promise<string> {
			return new Promise((resolve, reject) => {
				const cleanup = () => {
					clearTimeout(timeout);
					app.map.off('textselectioncontent', handleTextResponse);
					app.map.off('complexselection', handleComplexResponse);
				};

				const timeout = setTimeout(() => {
					cleanup();
					reject(new Error(_('Selection fetch timeout')));
				}, 5000);

				const handleTextResponse = (e: any) => {
					const textMsg = e.msg || '';
					if (textMsg.startsWith('textselectioncontent:')) {
						cleanup();

						const content = textMsg.substring('textselectioncontent:'.length);
						try {
							// If multiple MIME types, it comes as JSON
							if (content.startsWith('{')) {
								const json = JSON.parse(content);
								const markdown = json['text/markdown;charset=utf-8'] || '';
								resolve(markdown);
							} else {
								resolve(content);
							}
						} catch {
							reject(new Error(_('Failed to parse selection content')));
						}
					}
				};

				const handleComplexResponse = () => {
					cleanup();
					reject(new Error('complexselection'));
				};

				app.map.on('textselectioncontent', handleTextResponse);
				app.map.on('complexselection', handleComplexResponse);
				app.socket.sendMessage(
					'gettextselection mimetype=text/markdown;charset=utf-8',
				);
			});
		}

		private insertAtCursor(markdownText: string): void {
			// Same paste mechanism - pastes at current cursor position
			const cleaned = this.stripCodeFences(markdownText);
			const blob = new Blob([
				'paste mimetype=text/markdown;charset=utf-8\n',
				cleaned,
			]);
			app.socket.sendMessage(blob);
		}

		private insertImageAtCursor(base64Data: string): void {
			const byteChars = atob(base64Data);
			const bytes = new Uint8Array(byteChars.length);
			for (let i = 0; i < byteChars.length; i++) {
				bytes[i] = byteChars.charCodeAt(i);
			}
			const blob = new Blob(['paste mimetype=image/png\n', bytes.buffer]);
			app.socket.sendMessage(blob);
		}

		private copyImageToClipboard(base64Data: string, index: number): void {
			var byteChars = atob(base64Data);
			var bytes = new Uint8Array(byteChars.length);
			for (var i = 0; i < byteChars.length; i++) {
				bytes[i] = byteChars.charCodeAt(i);
			}
			var imgBlob = new Blob([bytes], { type: 'image/png' });

			if (navigator.clipboard && navigator.clipboard.write) {
				navigator.clipboard
					.write([
						new ClipboardItem({
							'image/png': Promise.resolve(imgBlob),
						}),
					])
					.then(() => {
						this.showCopyFeedback(index, 'aichat-copy-img-');
					})
					.catch((e: any) => {
						window.console.error('Copy image failed:', e);
					});
			} else {
				window.console.error('Clipboard API not available');
			}
		}


		private attachKeyboardHandler(): void {
			const textarea = document.querySelector(
				'#aichat-input .ui-textarea',
			) as HTMLTextAreaElement | null;
			if (textarea) {
				textarea.addEventListener('keydown', (e: KeyboardEvent) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						this.sendMessage();
					}
				});
			}
			const container = document.getElementById('aichat-main');
			if (container) {
				container.addEventListener('keydown', (e: KeyboardEvent) => {
					if (e.key === 'Escape') {
						e.preventDefault();
						this.hide();
					}
				});
			}
		}

		private showCopyFeedback(
			index: number,
			prefix: string = 'aichat-copy-text-',
		): void {
			const wrapper = document.getElementById(prefix + index);
			if (!wrapper) return;
			const img = wrapper.querySelector('button img') as HTMLImageElement;
			if (!img) return;

			const originalSrc = img.src;
			img.src = this.ICON_CHECK;

			setTimeout(function () {
				if (img.isConnected) {
					img.src = originalSrc;
				}
			}, 1500);
		}

		private copyToClipboard(text: string, index: number): void {
			if (navigator.clipboard && window.isSecureContext) {
				navigator.clipboard
					.writeText(text)
					.then(() => {
						this.showCopyFeedback(index);
					})
					.catch(() => {
						this.fallbackCopy(text, index);
					});
			} else {
				this.fallbackCopy(text, index);
			}
		}

		private fallbackCopy(text: string, index: number): void {
			var textArea = document.createElement('textarea');
			textArea.style.position = 'absolute';
			textArea.style.opacity = '0';
			textArea.value = text;
			document.body.appendChild(textArea);
			textArea.select();
			try {
				document.execCommand('copy');
				this.showCopyFeedback(index);
			} catch (e) {
				window.console.error('Copy failed:', e);
			} finally {
				document.body.removeChild(textArea);
			}
		}

		private markdownToHtml(text: string): string {
			text = text.trim();
			// Protect code blocks from processing
			var codeBlocks: string[] = [];
			var processed = text.replace(
				/```(\w*)\n([\s\S]*?)```/g,
				function (_match: string, lang: string, code: string) {
					var idx = codeBlocks.length;
					var escaped = code
						.replace(/&/g, '&amp;')
						.replace(/</g, '&lt;')
						.replace(/>/g, '&gt;');
					codeBlocks.push(
						'<pre><code' +
							(lang ? ' class="lang-' + lang + '"' : '') +
							'>' +
							escaped +
							'</code></pre>',
					);
					return '%%CODEBLOCK' + idx + '%%';
				},
			);

			// Escape HTML in remaining text
			processed = this.escapeHtml(processed);

			// Inline code
			processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');

			// Headings (allow optional leading whitespace, process ### before ## before #)
			processed = processed.replace(/^\s*### (.+)$/gm, '<h5>$1</h5>');
			processed = processed.replace(/^\s*## (.+)$/gm, '<h4>$1</h4>');
			processed = processed.replace(/^\s*# (.+)$/gm, '<h3>$1</h3>');

			// Bold (must come before italic)
			processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

			// Italic (safe after bold is already replaced)
			processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
			processed = processed.replace(
				/(?:^| )_([^_]+)_(?:$| )/gm,
				' <em>$1</em> ',
			);

			// Links
			processed = processed.replace(
				/\[([^\]]+)\]\(([^)]+)\)/g,
				'<a href="$2" target="_blank" rel="noopener">$1</a>',
			);

			// Lists
			processed = this.processLists(processed);

			// Paragraph breaks and line breaks
			processed = processed.replace(/\n\n+/g, '</p><p>');
			processed = processed.replace(/\n/g, '<br>');
			processed = '<p>' + processed + '</p>';

			// Clean up empty paragraphs around block elements
			processed = processed.replace(/<p><\/p>/g, '');
			processed = processed.replace(/<p>(<(?:h[3-5]|pre|ul|ol))/g, '$1');
			processed = processed.replace(/(<\/(?:h[3-5]|pre|ul|ol)>)<\/p>/g, '$1');
			processed = processed.replace(/<p>(%%CODEBLOCK\d+%%)<\/p>/g, '$1');

			// Restore code blocks
			processed = processed.replace(
				/%%CODEBLOCK(\d+)%%/g,
				function (_match: string, idx: string) {
					return codeBlocks[parseInt(idx)];
				},
			);

			// Autolink bare URLs
			if (typeof Autolinker !== 'undefined') {
				processed = Autolinker.link(processed);
			}

			return processed;
		}

		private escapeHtml(text: string): string {
			return text
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;');
		}

		private processLists(text: string): string {
			// Unordered lists
			text = text.replace(/((?:^[-*] .+$\n?)+)/gm, function (match: string) {
				var items = match
					.trim()
					.split('\n')
					.map(function (line: string) {
						return '<li>' + line.replace(/^[-*] /, '') + '</li>';
					})
					.join('');
				return '<ul>' + items + '</ul>';
			});
			// Ordered lists
			text = text.replace(/((?:^\d+\. .+$\n?)+)/gm, function (match: string) {
				var items = match
					.trim()
					.split('\n')
					.map(function (line: string) {
						return '<li>' + line.replace(/^\d+\. /, '') + '</li>';
					})
					.join('');
				return '<ol>' + items + '</ol>';
			});
			return text;
		}

		private shouldShowActions(assistantMsgIndex: number): boolean {
			const userMsg = this.findPrecedingUserMessage(assistantMsgIndex);
			if (!userMsg || !userMsg.selectedText) return false;

			const lower = userMsg.content.toLowerCase();
			return this.ACTION_KEYWORDS.some((kw) => lower.includes(kw));
		}

		private findPrecedingUserMessage(
			assistantMsgIndex: number,
		): ChatMessage | null {
			for (let i = assistantMsgIndex - 1; i >= 0; i--) {
				if (this.messages[i].role === 'user') {
					return this.messages[i];
				}
			}
			return null;
		}

		private stripCodeFences(text: string): string {
			// Strip markdown code fences that AI models often wrap responses in
			// Handles: ```markdown\n...\n``` and ```\n...\n```
			let result = text.trim();
			const fencePattern = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/;
			const match = result.match(fencePattern);
			if (match) {
				result = match[1];
			}
			return result;
		}

		private generateRequestId(): string {
			return (
				'aichat-' +
				Date.now().toString(36) +
				'-' +
				Math.random().toString(36).substring(2, 8)
			);
		}
	}
}

JSDialog.AIChatSidebar = null as cool.AIChatSidebar | null;

JSDialog.getAIChatSidebar = function (): cool.AIChatSidebar {
	if (!JSDialog.AIChatSidebar) {
		JSDialog.AIChatSidebar = new cool.AIChatSidebar();
	}
	return JSDialog.AIChatSidebar;
};

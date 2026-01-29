/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

namespace cool {
	export interface AIModel {
		id: string;
		name: string;
	}

	export interface AIProvider {
		id: string;
		name: string;
		baseUrl?: string;
		modelsEndpoint?: string;
	}

	export const AI_PROVIDERS: Array<AIProvider> = [
		{
			id: 'gemini',
			name: 'Google Gemini',
			baseUrl: 'https://generativelanguage.googleapis.com',
			modelsEndpoint: '/v1beta/models',
		},
	];

	const ERROR_MESSAGES: Record<number, string> = {
		400: 'Invalid request',
		401: 'Invalid API key',
		403: 'API key lacks permissions',
		429: 'Rate limited - please wait a moment and retry',
		500: 'API server error - try again later',
		503: 'Service temporarily unavailable',
	};

	export class ProviderDialog {
		id: string = 'AIProviderDialog';

		selectedProvider: string = 'gemini';
		selectedModel: string = '';
		apiKey: string = '';
		availableModels: Array<AIModel> = [];
		isLoading: boolean = false;
		apiKeyValid: boolean = false;
		errorMessage: string = '';

		private providerLbJSON(
			providers: Array<string>,
			defaultProviderIndex: number,
		): ListBoxWidget {
			return {
				id: 'providerlb',
				type: 'listbox',
				enabled: true,
				children: [
					{
						id: '',
						type: 'control',
						enabled: true,
						children: [],
					},
					{
						type: 'pushbutton',
						enabled: true,
						symbol: 'SPIN_DOWN',
					} as PushButtonWidget,
				],
				labelledBy: 'providerft',
				entries: providers,
				selectedCount: 1,
				selectedEntries: [String(defaultProviderIndex)],
			} as ListBoxWidget;
		}

		private modelLbJSON(
			models: Array<string>,
			defaultModelIndex: number,
		): ListBoxWidget {
			return {
				id: 'modellb',
				type: 'listbox',
				enabled: true,
				children: [
					{
						id: '',
						type: 'control',
						enabled: true,
						children: [],
					},
					{
						type: 'pushbutton',
						enabled: true,
						symbol: 'SPIN_DOWN',
					} as PushButtonWidget,
				],
				labelledBy: 'modelft',
				entries: models,
				selectedCount: 1,
				selectedEntries: [String(defaultModelIndex)],
			} as ListBoxWidget;
		}

		private getAPIKeyEditJSON(): EditWidgetJSON {
			return {
				id: 'apikeyedit',
				type: 'edit',
				text: this.apiKey,
				placeholder: _('Enter your API key'),
				password: true,
				enabled: true,
			} as EditWidgetJSON;
		}

		private getFetchButtonJSON(): PushButtonWidget {
			return {
				id: 'fetchmodels',
				type: 'pushbutton',
				text: _('Fetch Models'),
				enabled: this.apiKey.length > 0 && !this.isLoading,
			} as PushButtonWidget;
		}

		private getStatusLabelJSON(): TextWidget {
			let text = '';
			let visible = true;

			if (this.isLoading) {
				text = _('Fetching models...');
			} else if (this.errorMessage) {
				text = this.errorMessage;
			} else if (this.apiKeyValid && this.availableModels.length > 0) {
				text = _('API key validated successfully');
				visible = false;
			} else {
				visible = false;
			}

			return {
				id: 'statuslabel',
				type: 'fixedtext',
				text: text,
				enabled: true,
				visible: visible,
			} as TextWidget;
		}

		getChildrenJSON(): Array<WidgetJSON> {
			const providers = AI_PROVIDERS.map((p) => p.name);
			let defaultProviderIndex = AI_PROVIDERS.findIndex(
				(p) => p.id === this.selectedProvider,
			);
			if (defaultProviderIndex === -1) defaultProviderIndex = 0;

			let modelEntries: Array<string> = [];
			let defaultModelIndex = 0;

			if (this.isLoading) {
				modelEntries = [_('Loading models...')];
			} else if (this.errorMessage) {
				modelEntries = [_('Error loading models')];
			} else if (this.availableModels.length > 0) {
				modelEntries = this.availableModels.map((m) => m.name);
				defaultModelIndex = this.availableModels.findIndex(
					(m) => m.id === this.selectedModel,
				);
				if (defaultModelIndex === -1) defaultModelIndex = 0;
			} else {
				modelEntries = [_('Enter API key and click Fetch Models')];
			}

			return [
				{
					id: 'providerft',
					type: 'fixedtext',
					text: _('Provider:'),
					enabled: true,
					labelFor: 'providerlb',
				} as TextWidget,
				this.providerLbJSON(providers, defaultProviderIndex),
				{
					id: 'apikeyft',
					type: 'fixedtext',
					text: _('API Key:'),
					enabled: true,
					labelFor: 'apikeyedit',
				} as TextWidget,
				{
					id: 'apikeycontainer',
					type: 'container',
					horizontal: true,
					children: [this.getAPIKeyEditJSON(), this.getFetchButtonJSON()],
				} as ContainerWidgetJSON,
				this.getStatusLabelJSON(),
				{
					id: 'modelft',
					type: 'fixedtext',
					text: _('Model:'),
					enabled: this.availableModels.length > 0,
					labelFor: 'modellb',
				} as TextWidget,
				this.modelLbJSON(modelEntries, defaultModelIndex),
				{
					id: this.id + '-buttonbox',
					type: 'buttonbox',
					children: [
						{
							id: 'save',
							type: 'pushbutton',
							text: _('Save'),
							enabled: this.apiKeyValid && this.selectedModel.length > 0,
						} as PushButtonWidget,
						{
							id: 'cancel',
							type: 'pushbutton',
							text: _('Cancel'),
						} as PushButtonWidget,
					],
					layoutstyle: 'end',
				} as ButtonBoxWidget,
			];
		}

		getJSON(): JSDialogJSON {
			const children = this.getChildrenJSON();
			return {
				id: this.id,
				dialogid: this.id,
				type: 'dialog',
				text: _('AI Provider Settings'),
				title: _('AI Provider Settings'),
				jsontype: 'dialog',
				responses: [
					{
						id: 'save',
						response: 1,
					},
					{
						id: 'cancel',
						response: 0,
					},
				],
				children: [
					{
						id: this.id + '-mainbox',
						type: 'container',
						vertical: true,
						children: children,
					} as ContainerWidgetJSON,
				],
			} as JSDialogJSON;
		}

		private async fetchModels(): Promise<void> {
			if (this.apiKey.length === 0) {
				this.showError(_('Please enter an API key first'));
				return;
			}

			this.isLoading = true;
			this.errorMessage = '';
			this.updateDialog();

			try {
				const provider = AI_PROVIDERS.find(
					(p) => p.id === this.selectedProvider,
				);
				if (!provider || !provider.baseUrl || !provider.modelsEndpoint) {
					throw new Error('Invalid provider configuration');
				}

				const url = `${provider.baseUrl}${provider.modelsEndpoint}?key=${this.apiKey}`;
				const response = await fetch(url);

				if (!response.ok) {
					const errorCode = response.status;
					const errorMsg =
						ERROR_MESSAGES[errorCode] ||
						_(`API error (${errorCode}): ${response.statusText}`);
					throw new Error(errorMsg);
				}

				const data = await response.json();

				this.availableModels =
					data.models
						?.filter((m: any) =>
							m.supportedGenerationMethods?.includes('generateContent'),
						)
						?.map((m: any) => ({
							id: m.name.replace('models/', ''),
							name: m.displayName || m.name,
						})) || [];

				if (this.availableModels.length === 0) {
					this.showError(_('No text generation models found'));
					this.isLoading = false;
					this.updateDialog();
					return;
				}

				this.apiKeyValid = true;
				this.selectedModel = this.availableModels[0].id;
				this.errorMessage = '';
			} catch (error) {
				this.showError(
					error instanceof Error ? error.message : _('Failed to fetch models'),
				);
				this.apiKeyValid = false;
				this.availableModels = [];
			}

			this.isLoading = false;
			this.updateDialog();
		}

		private showError(message: string): void {
			this.errorMessage = message;
			this.apiKeyValid = false;
		}

		private clearError(): void {
			this.errorMessage = '';
		}

		private updateDialog(): void {
			app.map.fire('jsdialogupdate', {
				data: {
					jsontype: 'dialog',
					action: 'update',
					id: this.id,
					control: {
						id: this.id + '-mainbox',
						type: 'container',
						vertical: true,
						children: this.getChildrenJSON(),
					} as ContainerWidgetJSON,
				},
				callback: this.callback.bind(this) as JSDialogCallback,
			});
		}

		private loadSettings(): void {
			this.selectedProvider =
				window.prefs.get('AIPreferenceProvider') || 'gemini';
			this.selectedModel = window.prefs.get('AIPreferenceModel') || '';
			this.apiKey = window.prefs.get('AIPreferenceApiKey') || '';
		}

		private saveSettings(): void {
			window.prefs.set('AIPreferenceProvider', this.selectedProvider);
			window.prefs.set('AIPreferenceModel', this.selectedModel);
			window.prefs.set('AIPreferenceApiKey', this.apiKey);
		}

		private callback(
			objectType: string,
			eventType: string,
			object: any,
			data: any,
			builder: JSBuilder,
		): void {
			if (eventType === 'click') {
				if (object.id === 'fetchmodels') {
					const apiKeyInput = document.querySelector(
						'#AIProviderDialog input#apikeyedit-input',
					) as HTMLInputElement;
					if (apiKeyInput) {
						this.apiKey = apiKeyInput.value;
					}
					this.fetchModels();
				} else if (object.id === 'save') {
					if (this.apiKeyValid && this.selectedModel.length > 0) {
						this.saveSettings();
						this.close();
					}
				} else if (object.id === 'cancel') {
					this.close();
				}
			} else if (eventType === 'selected') {
				if (object.id === 'providerlb') {
					const providerIndex = parseInt(data.split(';')[0]);
					this.selectedProvider = AI_PROVIDERS[providerIndex]?.id || 'gemini';
					this.clearError();
					this.apiKeyValid = false;
					this.availableModels = [];
					this.selectedModel = '';
					this.updateDialog();
				} else if (object.id === 'modellb' && this.availableModels.length > 0) {
					const modelIndex = parseInt(data.split(';')[0]);
					if (this.availableModels[modelIndex]) {
						this.selectedModel = this.availableModels[modelIndex].id;
					}
				}
			} else if (eventType === 'change' && object.id === 'apikeyedit') {
				this.apiKey = data;
				this.apiKeyValid = false;
				this.clearError();
				this.updateDialog();
			}
		}

		public close(): void {
			const closeEvent = {
				data: {
					action: 'close',
					id: this.id,
				},
			};
			app.map.fire('jsdialog', closeEvent);
		}

		open(): void {
			this.loadSettings();
			const dialogBuildEvent = {
				data: this.getJSON(),
				callback: this.callback.bind(this) as JSDialogCallback,
			};
			app.map.fire('jsdialog', dialogBuildEvent);
		}

		private getSelectedText(): string {
			const clip = app.map._clip;

			// Get plain text version
			if (clip._selectionPlainTextContent) {
				return clip._selectionPlainTextContent;
			}

			// Or extract from HTML version
			if (clip._selectionContent) {
				return DocUtil.stripHTML(clip._selectionContent);
			}

			return '';
		}
	}

	interface PresetPrompt {
		id: string;
		label: string;
		prompt: string;
	}

	export class RewriteTextDialog {
		id: string = 'AIRewriteTextDialog';

		// State management
		originalText: string = '';
		currentPrompt: string = '';
		rewrittenText: string = '';
		isLoadingSelection: boolean = false;
		isProcessing: boolean = false;
		errorMessage: string = '';
		hasResult: boolean = false;

		// Preset prompts configuration
		private readonly PRESET_PROMPTS: Array<PresetPrompt> = [
			{
				id: 'formal',
				label: _('Make it formal'),
				prompt: 'Rewrite the following text to be more formal and professional:',
			},
			{
				id: 'casual',
				label: _('Make it casual'),
				prompt: 'Rewrite the following text to be more casual and conversational:',
			},
			{
				id: 'grammar',
				label: _('Fix grammar'),
				prompt: 'Fix all grammar, spelling, and punctuation errors in the following text:',
			},
			{
				id: 'simplify',
				label: _('Simplify'),
				prompt: 'Simplify the following text to make it easier to understand:',
			},
		];

		async open(): Promise<void> {
			// Check if AI is configured
			const provider = window.prefs.get('AIPreferenceProvider');
			const model = window.prefs.get('AIPreferenceModel');
			const apiKey = window.prefs.get('AIPreferenceApiKey');

			if (!provider || !model || !apiKey) {
				// Open settings dialog first
				const settingsDialog = JSDialog.aiProviderDialog();
				settingsDialog.open();
				return;
			}

			// Show loading state
			this.isLoadingSelection = true;
			this.showLoadingDialog();

			try {
				// Fetch selected text
				this.originalText = await this.fetchSelectedText();

				if (!this.originalText || this.originalText.trim().length === 0) {
					this.showError(_('No text selected. Please select text to rewrite.'));
					setTimeout(() => this.close(), 3000);
					return;
				}

				// Show main dialog
				this.isLoadingSelection = false;
				this.showMainDialog();
			} catch (error) {
				this.isLoadingSelection = false;
				this.showError(
					error instanceof Error
						? error.message
						: _('Failed to get selected text'),
				);
				setTimeout(() => this.close(), 3000);
			}
		}

		private showLoadingDialog(): void {
			const dialogBuildEvent = {
				data: this.getLoadingJSON(),
				callback: this.callback.bind(this) as JSDialogCallback,
			};
			app.map.fire('jsdialog', dialogBuildEvent);
		}

		private showMainDialog(): void {
			const dialogBuildEvent = {
				data: this.getJSON(),
				callback: this.callback.bind(this) as JSDialogCallback,
			};
			app.map.fire('jsdialog', dialogBuildEvent);
		}

		private getLoadingJSON(): JSDialogJSON {
			return {
				id: this.id,
				dialogid: this.id,
				type: 'dialog',
				text: _('Rewrite Text with AI'),
				title: _('Rewrite Text with AI'),
				jsontype: 'dialog',
				responses: [],
				children: [
					{
						id: this.id + '-loadingbox',
						type: 'container',
						vertical: true,
						children: [
							{
								id: 'loadinglabel',
								type: 'fixedtext',
								text: _('Loading selected text...'),
								enabled: true,
							} as TextWidget,
						],
					} as ContainerWidgetJSON,
				],
			} as JSDialogJSON;
		}

		private getJSON(): JSDialogJSON {
			const children = this.getChildrenJSON();
			return {
				id: this.id,
				dialogid: this.id,
				type: 'dialog',
				text: _('Rewrite Text with AI'),
				title: _('Rewrite Text with AI'),
				jsontype: 'dialog',
				responses: [
					{
						id: 'accept',
						response: 1,
					},
					{
						id: 'cancel',
						response: 0,
					},
				],
				children: [
					{
						id: this.id + '-mainbox',
						type: 'container',
						vertical: true,
						children: children,
					} as ContainerWidgetJSON,
				],
			} as JSDialogJSON;
		}

		private getChildrenJSON(): Array<WidgetJSON> {
			const children: Array<WidgetJSON> = [
				// Original text label
				{
					id: 'originallabel',
					type: 'fixedtext',
					text: _('Original Text:'),
					enabled: true,
				} as TextWidget,

				// Original text display (multiline, read-only)
				{
					id: 'originaltext',
					type: 'edit',
					text: this.originalText,
					enabled: false,
					multiLine: true,
					vScrollBar: true,
					placeholder: '',
					password: false,
					hidden: false,
					changedCallback: null,
				} as EditWidgetJSON,

				// Prompt instructions label
				{
					id: 'promptlabel',
					type: 'fixedtext',
					text: _('How would you like to rewrite it?'),
					enabled: true,
				} as TextWidget,

				// Preset prompt buttons (horizontal container)
				{
					id: 'presetbuttons',
					type: 'container',
					horizontal: true,
					children: this.PRESET_PROMPTS.map(
						(p) =>
							({
								id: `preset-${p.id}`,
								type: 'pushbutton',
								text: p.label,
								enabled: !this.isProcessing,
							}) as PushButtonWidget,
					),
				} as ContainerWidgetJSON,

				// Custom prompt label
				{
					id: 'customlabel',
					type: 'fixedtext',
					text: _('Or enter custom instructions:'),
					enabled: true,
				} as TextWidget,

				// Custom prompt input
				{
					id: 'customprompt',
					type: 'edit',
					text: this.currentPrompt,
					placeholder: _(
						'E.g., "Make it more concise" or "Translate to Spanish"',
					),
					enabled: !this.isProcessing,
				} as EditWidgetJSON,

				// Rewrite button
				{
					id: 'rewritebtn',
					type: 'pushbutton',
					text: this.isProcessing ? _('Processing...') : _('Rewrite'),
					enabled: !this.isProcessing && this.currentPrompt.trim().length > 0,
				} as PushButtonWidget,
			];

			// Add result section if we have results
			if (this.hasResult) {
				children.push(
					{
						id: 'resultlabel',
						type: 'fixedtext',
						text: _('Result:'),
						enabled: true,
					} as TextWidget,
					{
						id: 'resulttext',
						type: 'edit',
						text: this.rewrittenText,
						enabled: false,
						multiLine: true,
						vScrollBar: true,
						placeholder: '',
						password: false,
						hidden: false,
						changedCallback: null,
					} as EditWidgetJSON,
				);
			}

			// Status/error label
			if (this.errorMessage || this.isProcessing) {
				children.push({
					id: 'statuslabel',
					type: 'fixedtext',
					text:
						this.errorMessage ||
						(this.isProcessing ? _('Processing with AI...') : ''),
					enabled: true,
					visible: true,
				} as TextWidget);
			}

			// Action buttons
			children.push({
				id: this.id + '-buttonbox',
				type: 'buttonbox',
				layoutstyle: 'end',
				children: [
					{
						id: 'accept',
						type: 'pushbutton',
						text: _('Accept'),
						enabled: this.hasResult && !this.isProcessing,
					} as PushButtonWidget,
					{
						id: 'cancel',
						type: 'pushbutton',
						text: _('Cancel'),
						enabled: true,
					} as PushButtonWidget,
				],
			} as ButtonBoxWidget);

			return children;
		}

		private async fetchSelectedText(): Promise<string> {
			return new Promise((resolve, reject) => {
				// Setup timeout
				const timeout = setTimeout(() => {
					app.map.off('textselectioncontent', handleResponse);
					reject(new Error(_('Selection fetch timeout')));
				}, 5000);

				// Setup one-time message handler
				const handleResponse = (e: any) => {
					const textMsg = e.msg || '';
					if (textMsg.startsWith('textselectioncontent:')) {
						// Remove listener and clear timeout
						app.map.off('textselectioncontent', handleResponse);
						clearTimeout(timeout);

						// Parse response
						const content = textMsg.substring('textselectioncontent:'.length);
						let plainText = '';

						try {
							if (content.startsWith('{')) {
								// JSON format with multiple mimetypes
								const json = JSON.parse(content);
								plainText = json['text/plain;charset=utf-8'] || '';
							} else {
								// HTML format - strip tags
								plainText = this.stripHTML(content);
							}

							resolve(plainText);
						} catch (parseError) {
							reject(new Error(_('Failed to parse selection content')));
						}
					}
				};

				// Register handler
				app.map.on('textselectioncontent', handleResponse);

				// Request selection
				app.socket.sendMessage(
					'gettextselection mimetype=text/html,text/plain;charset=utf-8',
				);
			});
		}

		private async rewriteWithAI(prompt: string): Promise<void> {
			if (!prompt || prompt.trim().length === 0) {
				this.showError(_('Please enter a prompt'));
				return;
			}

			this.isProcessing = true;
			this.clearError();
			this.updateDialog();

			try {
				const provider = window.prefs.get('AIPreferenceProvider');
				const model = window.prefs.get('AIPreferenceModel');
				const apiKey = window.prefs.get('AIPreferenceApiKey');

				if (!provider || !model || !apiKey) {
					throw new Error(_('AI settings not configured'));
				}

				this.rewrittenText = await this.callAIAPI(
					provider,
					model,
					apiKey,
					prompt,
					this.originalText,
				);
				this.hasResult = true;
				this.isProcessing = false;
				this.updateDialog();
			} catch (error) {
				this.showError(
					error instanceof Error ? error.message : _('Failed to rewrite text'),
				);
				this.isProcessing = false;
				this.updateDialog();
			}
		}

		private async callAIAPI(
			providerId: string,
			modelId: string,
			apiKey: string,
			userPrompt: string,
			selectedText: string,
		): Promise<string> {
			const provider = AI_PROVIDERS.find((p) => p.id === providerId);
			if (!provider || !provider.baseUrl) {
				throw new Error(_('Invalid provider configuration'));
			}

			// Build API URL (Gemini format)
			const url = `${provider.baseUrl}/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

			// Build request payload
			const payload = {
				contents: [
					{
						parts: [
							{
								text: `${userPrompt}\n\n${selectedText}`,
							},
						],
					},
				],
			};

			// Create timeout promise that rejects
			const timeoutPromise = new Promise<string>((resolve, reject) => {
				setTimeout(() => {
					reject(new Error(_('Request timeout')));
				}, 30000);
			});

			// Make API call
			const apiCall = async (): Promise<string> => {
				const response = await fetch(url, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(payload),
				});

				if (!response.ok) {
					const errorCode = response.status;
					const errorMsg =
						ERROR_MESSAGES[errorCode] ||
						_(`API error (${errorCode}): ${response.statusText}`);
					throw new Error(errorMsg);
				}

				const data = await response.json();

				// Extract text from Gemini response format
				const result =
					data.candidates?.[0]?.content?.parts?.[0]?.text || '';

				if (!result) {
					throw new Error(_('No response from AI'));
				}

				return result;
			};

			// Race between API call and timeout
			try {
				const result = await Promise.race<string>([apiCall(), timeoutPromise]);
				return result;
			} catch (error) {
				if (error instanceof TypeError) {
					throw new Error(_('Network error - please check your connection'));
				}
				throw error;
			}
		}

	private replaceSelection(): void {
		// Encode the rewritten text for UNO command
		const encodedText = encodeURIComponent(this.rewrittenText);

		// Send ReplaceText UNO command directly
		app.socket.sendMessage('uno .uno:ReplaceText?Text:string=' + encodedText);

		// Close dialog
		this.close();
	}

		private stripHTML(html: string): string {
			// Use DocUtil if available, otherwise fallback
			if (typeof DocUtil !== 'undefined' && DocUtil.stripHTML) {
				return DocUtil.stripHTML(html);
			}

			// Fallback: basic HTML stripping
			const div = document.createElement('div');
			div.innerHTML = html;
			return div.textContent || div.innerText || '';
		}

		private updateDialog(): void {
			app.map.fire('jsdialogupdate', {
				data: {
					jsontype: 'dialog',
					action: 'update',
					id: this.id,
					control: {
						id: this.id + '-mainbox',
						type: 'container',
						vertical: true,
						children: this.getChildrenJSON(),
					} as ContainerWidgetJSON,
				},
				callback: this.callback.bind(this) as JSDialogCallback,
			});
		}

		private showError(message: string): void {
			this.errorMessage = message;
		}

		private clearError(): void {
			this.errorMessage = '';
		}

		private callback(
			objectType: string,
			eventType: string,
			object: any,
			data: any,
			builder: JSBuilder,
		): void {
			if (eventType === 'click') {
				// Preset prompt buttons
				if (object.id?.startsWith('preset-')) {
					const presetId = object.id.replace('preset-', '');
					const preset = this.PRESET_PROMPTS.find((p) => p.id === presetId);
					if (preset) {
						this.currentPrompt = preset.prompt;
						this.updateDialog();
						// Auto-trigger rewrite
						this.rewriteWithAI(preset.prompt);
					}
				}
				// Rewrite button
				else if (object.id === 'rewritebtn') {
					if (this.currentPrompt.trim().length > 0) {
						this.rewriteWithAI(this.currentPrompt);
					}
				}
				// Accept button
				else if (object.id === 'accept') {
					this.replaceSelection();
				}
				// Cancel button
				else if (object.id === 'cancel') {
					this.close();
				}
			} else if (eventType === 'change') {
				// Custom prompt input
				if (object.id === 'customprompt') {
					this.currentPrompt = data;
					this.updateDialog();
				}
			}
		}

		public close(): void {
			const closeEvent = {
				data: {
					action: 'close',
					id: this.id,
				},
			};
			app.map.fire('jsdialog', closeEvent);
		}
	}
}

JSDialog.aiProviderDialog = () => {
	return new cool.ProviderDialog();
};

JSDialog.aiRewriteTextDialog = () => {
	return new cool.RewriteTextDialog();
};

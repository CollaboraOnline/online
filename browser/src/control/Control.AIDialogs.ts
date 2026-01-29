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
		baseUrl: string;
		isCustom?: boolean;
	}

	export const AI_PROVIDERS: Array<AIProvider> = [
		{
			id: 'openai',
			name: 'OpenAI',
			baseUrl: 'https://api.openai.com',
		},
		{
			id: 'groq',
			name: 'Groq',
			baseUrl: 'https://api.groq.com/openai',
		},
		{
			id: 'together',
			name: 'Together AI',
			baseUrl: 'https://api.together.xyz',
		},
		{
			id: 'mistral',
			name: 'Mistral AI',
			baseUrl: 'https://api.mistral.ai',
		},
		{
			id: 'custom',
			name: 'Custom (OpenAI Compatible)',
			baseUrl: '',
			isCustom: true,
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

		selectedProvider: string = 'openai';
		selectedModel: string = '';
		apiKey: string = '';
		customBaseUrl: string = '';
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

		private getCustomUrlEditJSON(): EditWidgetJSON {
			return {
				id: 'customurledit',
				type: 'edit',
				text: this.customBaseUrl,
				placeholder: _('e.g.') + 'http://localhost:11434/v1',
				enabled: true,
			} as EditWidgetJSON;
		}

		private getFetchButtonJSON(): PushButtonWidget {
			const provider = AI_PROVIDERS.find((p) => p.id === this.selectedProvider);
			const isCustom = provider?.isCustom ?? false;
			const hasRequiredFields = isCustom
				? this.customBaseUrl.length > 0 && this.apiKey.length > 0
				: this.apiKey.length > 0;
			return {
				id: 'fetchmodels',
				type: 'pushbutton',
				text: _('Fetch Models'),
				enabled: hasRequiredFields && !this.isLoading,
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

			const currentProvider = AI_PROVIDERS.find(
				(p) => p.id === this.selectedProvider,
			);
			const isCustomProvider = currentProvider?.isCustom ?? false;

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
				modelEntries = isCustomProvider
					? [_('Enter Base URL and click Fetch Models')]
					: [_('Enter API key and click Fetch Models')];

				if (this.selectedModel) modelEntries = [this.selectedModel];
			}

			const children: Array<WidgetJSON> = [
				{
					id: 'providerft',
					type: 'fixedtext',
					text: _('Provider:'),
					enabled: true,
					labelFor: 'providerlb',
				} as TextWidget,
				this.providerLbJSON(providers, defaultProviderIndex),
			];

			if (isCustomProvider) {
				children.push(
					{
						id: 'customurlft',
						type: 'fixedtext',
						text: _('Base URL:'),
						enabled: true,
						labelFor: 'customurledit',
					} as TextWidget,
					this.getCustomUrlEditJSON(),
				);
			}

			children.push(
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
			);

			return children;
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
			const provider = AI_PROVIDERS.find((p) => p.id === this.selectedProvider);
			const isCustom = provider?.isCustom ?? false;

			if (isCustom && this.customBaseUrl.length === 0) {
				this.showError(_('Please enter a Base URL first'));
				return;
			}
			if (this.apiKey.length === 0) {
				this.showError(_('Please enter an API key first'));
				return;
			}

			this.isLoading = true;
			this.errorMessage = '';
			this.updateDialog();

			try {
				if (!provider) {
					throw new Error(_('Invalid provider configuration'));
				}

				// Determine base URL
				const baseUrl = isCustom ? this.customBaseUrl : provider.baseUrl;
				if (!baseUrl) {
					throw new Error(_('Invalid provider configuration'));
				}

				// Build URL for OpenAI-compatible /v1/models endpoint
				const url = `${baseUrl.replace(/\/$/, '')}/v1/models`;

				// Build headers with Bearer auth
				const headers: HeadersInit = {
					'Content-Type': 'application/json',
				};
				if (this.apiKey) {
					headers['Authorization'] = `Bearer ${this.apiKey}`;
				}

				const response = await fetch(url, { headers });

				if (!response.ok) {
					const errorCode = response.status;
					const errorMsg =
						ERROR_MESSAGES[errorCode] ||
						_(`API error (${errorCode}): ${response.statusText}`);
					throw new Error(errorMsg);
				}

				const data = await response.json();

				// Parse OpenAI-compatible response format: { data: [{ id: "model-id" }, ...] }
				this.availableModels =
					data.data?.map((m: any) => ({
						id: m.id,
						name: m.id,
					})) || [];

				if (this.availableModels.length === 0) {
					this.showError(_('No models found'));
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
				window.prefs.get('AIPreferenceProvider') || 'openai';
			this.selectedModel = window.prefs.get('AIPreferenceModel') || '';
			this.apiKey = window.prefs.get('AIPreferenceApiKey') || '';
			this.customBaseUrl = window.prefs.get('AIPreferenceCustomUrl') || '';
		}

		private saveSettings(): void {
			window.prefs.set('AIPreferenceProvider', this.selectedProvider);
			window.prefs.set('AIPreferenceModel', this.selectedModel);
			window.prefs.set('AIPreferenceApiKey', this.apiKey);
			window.prefs.set('AIPreferenceCustomUrl', this.customBaseUrl);
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
					// Get API key from input
					const apiKeyInput = document.querySelector(
						'#AIProviderDialog input#apikeyedit-input',
					) as HTMLInputElement;
					if (apiKeyInput) {
						this.apiKey = apiKeyInput.value;
					}

					const customUrlInput = document.querySelector(
						'#AIProviderDialog input#customurledit-input',
					) as HTMLInputElement;
					if (customUrlInput) {
						this.customBaseUrl = customUrlInput.value;
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
					this.selectedProvider = AI_PROVIDERS[providerIndex]?.id || 'openai';
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
			} else if (eventType === 'change') {
				if (object.id === 'apikeyedit') {
					this.apiKey = data;
					this.apiKeyValid = false;
					this.clearError();
					this.updateDialog();
				} else if (object.id === 'customurledit') {
					this.customBaseUrl = data;
					this.apiKeyValid = false;
					this.clearError();
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

		open(): void {
			this.loadSettings();
			const dialogBuildEvent = {
				data: this.getJSON(),
				callback: this.callback.bind(this) as JSDialogCallback,
			};
			app.map.fire('jsdialog', dialogBuildEvent);
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
		isProcessing: boolean = false;
		errorMessage: string = '';
		hasResult: boolean = false;
		selectedPresetId: string = '';

		// Preset prompts configuration
		private readonly PRESET_PROMPTS: Array<PresetPrompt> = [
			{
				id: 'formal',
				label: _('Make it formal'),
				prompt:
					'Rewrite the following text to be more formal and professional:',
			},
			{
				id: 'casual',
				label: _('Make it casual'),
				prompt:
					'Rewrite the following text to be more casual and conversational:',
			},
			{
				id: 'grammar',
				label: _('Fix grammar'),
				prompt:
					'Fix all grammar, spelling, and punctuation errors in the following text:',
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

			try {
				// Fetch selected text
				this.originalText = await this.fetchSelectedText();

				if (!this.originalText || this.originalText.trim().length === 0) {
					this.showError(_('No text selected. Please select text to rewrite.'));
					setTimeout(() => this.close(), 3000);
					return;
				}

				this.showMainDialog();
			} catch (error) {
				this.showError(
					error instanceof Error
						? error.message
						: _('Failed to get selected text'),
				);
				setTimeout(() => this.close(), 3000);
			}
		}

		private showMainDialog(): void {
			const dialogBuildEvent = {
				data: this.getJSON(),
				callback: this.callback.bind(this) as JSDialogCallback,
			};
			app.map.fire('jsdialog', dialogBuildEvent);
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
				{
					id: 'promptlabel',
					type: 'fixedtext',
					text: _('How would you like to rewrite it?'),
					enabled: true,
				} as TextWidget,

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
								isToggle: true,
								checked: this.selectedPresetId === p.id,
							}) as PushButtonWidget,
					),
				} as ContainerWidgetJSON,

				{
					id: 'customlabel',
					type: 'fixedtext',
					text: _('Or enter custom instructions:'),
					enabled: true,
				} as TextWidget,

				{
					id: 'customprompt',
					type: 'edit',
					text: this.currentPrompt,
					placeholder: _(
						'E.g., "Make it more concise" or "Translate to Spanish"',
					),
					enabled: !this.isProcessing,
				} as EditWidgetJSON,

				{
					id: 'rewritebtncontainer',
					type: 'container',
					horizontal: true,
					children: [
						{
							id: 'rewritebtn',
							type: 'pushbutton',
							text: _('Rewrite'),
							enabled:
								!this.isProcessing && this.currentPrompt.trim().length > 0,
						} as PushButtonWidget,
					],
				} as ContainerWidgetJSON,
			];

			if (this.isProcessing) {
				children.push({
					id: 'loadingprogress',
					type: 'progressbar',
					infinite: true,
				} as WidgetJSON);
			}

			if (this.errorMessage) {
				children.push({
					id: 'statuslabel',
					type: 'fixedtext',
					text: this.errorMessage,
					enabled: true,
					visible: true,
				} as TextWidget);
			}

			children.push({
				id: 'separator',
				type: 'separator',
				orientation: 'horizontal',
			} as WidgetJSON);

			// Two-column layout for original and rewritten text
			children.push({
				id: 'textcolumns',
				type: 'container',
				horizontal: true,
				children: [
					// Left column: Original text
					{
						id: 'leftcolumn',
						type: 'container',
						vertical: true,
						children: [
							{
								id: 'originallabel',
								type: 'fixedtext',
								text: _('Original Text:'),
								enabled: true,
							} as TextWidget,
							{
								id: 'originaltext',
								type: 'multilineedit',
								text: this.originalText,
								cursor: false,
								enabled: false,
							} as WidgetJSON,
						],
					} as ContainerWidgetJSON,
					// Right column: Rewritten text (editable)
					{
						id: 'rightcolumn',
						type: 'container',
						vertical: true,
						children: [
							{
								id: 'resultlabel',
								type: 'fixedtext',
								text: _('Rewritten Text:'),
								enabled: true,
							} as TextWidget,
							{
								id: 'resulttext',
								type: 'multilineedit',
								text: this.rewrittenText,
								placeholder: _('AI rewritten text will appear here'),
								cursor: true,
								enabled: true,
							} as WidgetJSON,
						],
					} as ContainerWidgetJSON,
				],
			} as ContainerWidgetJSON);

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
						enabled: this.rewrittenText.length > 0 && !this.isProcessing,
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
						app.map.off('textselectioncontent', handleResponse);
						clearTimeout(timeout);

						const content = textMsg.substring('textselectioncontent:'.length);
						let plainText = '';

						try {
							const json = JSON.parse(content);
							plainText = json['text/plain;charset=utf-8'] || '';
							resolve(plainText);
						} catch (parseError) {
							reject(new Error(_('Failed to parse selection content')));
						}
					}
				};

				app.map.on('textselectioncontent', handleResponse);

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
				const providerId = window.prefs.get('AIPreferenceProvider');
				const model = window.prefs.get('AIPreferenceModel');
				const apiKey = window.prefs.get('AIPreferenceApiKey') || '';
				const customUrl = window.prefs.get('AIPreferenceCustomUrl') || '';

				if (!providerId || !model) {
					throw new Error(_('AI settings not configured'));
				}

				this.rewrittenText = await this.callAIAPI(
					providerId,
					model,
					apiKey,
					customUrl,
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
			customUrl: string,
			userPrompt: string,
			selectedText: string,
		): Promise<string> {
			const provider = AI_PROVIDERS.find((p) => p.id === providerId);
			if (!provider) {
				throw new Error(_('Invalid provider configuration'));
			}

			// Determine base URL
			const baseUrl = provider.isCustom ? customUrl : provider.baseUrl;
			if (!baseUrl) {
				throw new Error(_('Invalid provider configuration'));
			}

			// Build API URL (OpenAI-compatible format)
			const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;

			// Build headers with Bearer auth
			const headers: HeadersInit = {
				'Content-Type': 'application/json',
			};
			if (apiKey) {
				headers['Authorization'] = `Bearer ${apiKey}`;
			}

			// System message to ensure clean output
			const systemMessage =
				'You are a text rewriting assistant. Your task is to rewrite text according to the user\'s instructions. Preserve the original language; do not translate unless the user explicitly requests it. IMPORTANT: Return ONLY the rewritten text, nothing else. Do not include explanations, introductions, or any meta-commentary. Do not wrap the text in quotes. Do not say things like "Here is the rewritten text:" - just provide the rewritten text directly.';

			const payload = {
				model: modelId,
				messages: [
					{
						role: 'system',
						content: systemMessage,
					},
					{
						role: 'user',
						content: `${userPrompt}\n\nText to rewrite:\n${selectedText}`,
					},
				],
			};

			// Create timeout promise that rejects
			const timeoutPromise = new Promise<string>((_resolve, reject) => {
				setTimeout(() => {
					reject(new Error(_('Request timeout')));
				}, 30000);
			});

			// Make API call
			const apiCall = async (): Promise<string> => {
				const response = await fetch(url, {
					method: 'POST',
					headers,
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

				// Extract text from OpenAI-compatible response format
				const result = data.choices?.[0]?.message?.content || '';

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
			const encodedText = encodeURIComponent(this.rewrittenText);
			app.socket.sendMessage('uno .uno:ReplaceText?Text:string=' + encodedText);
			this.close();
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
			if (eventType === 'click' || eventType === 'toggle') {
				if (object.id?.startsWith('preset-')) {
					const presetId = object.id.replace('preset-', '');
					const preset = this.PRESET_PROMPTS.find((p) => p.id === presetId);
					if (preset) {
						this.selectedPresetId = presetId;
						this.currentPrompt = preset.prompt;
						this.updateDialog();
					}
				} else if (object.id === 'rewritebtn') {
					if (this.currentPrompt.trim().length > 0) {
						this.rewriteWithAI(this.currentPrompt);
					}
				} else if (object.id === 'accept') {
					this.replaceSelection();
				} else if (object.id === 'cancel') {
					this.close();
				}
			} else if (eventType === 'change') {
				if (object.id === 'customprompt') {
					this.currentPrompt = data;
					if (this.selectedPresetId) {
						this.selectedPresetId = '';
						this.updateDialog();
					}
				} else if (object.id === 'resulttext') {
					this.rewrittenText = data;
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

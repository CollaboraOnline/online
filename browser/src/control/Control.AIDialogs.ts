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
			if (!app.map.isAIEnabled) {
				this.showError(_('AI settings not configured'));
				setTimeout(() => this.close(), 3000);
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
				this.rewrittenText = await this.requestRewrite(prompt);
				this.hasResult = true;
			} catch (error) {
				this.showError(
					error instanceof Error ? error.message : _('Failed to rewrite text'),
				);
			} finally {
				this.isProcessing = false;
				this.updateDialog();
			}
		}

		private async requestRewrite(prompt: string): Promise<string> {
			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					app.map.off('commandresult', handleResponse);
					reject(new Error(_('Request timeout')));
				}, 40000);

				const handleResponse = (e: any) => {
					if (!e || e.commandName !== '.uno:RewriteAI') {
						return;
					}

					app.map.off('commandresult', handleResponse);
					clearTimeout(timeout);

					if (e.success) {
						const resultText = typeof e.result === 'string' ? e.result : '';
						if (resultText) {
							resolve(resultText);
							return;
						}
						reject(new Error(_('No response from AI')));
						return;
					}

					const errorMessage =
						typeof e.result === 'string' && e.result.trim().length > 0
							? e.result
							: _('Failed to rewrite text');
					reject(new Error(errorMessage));
				};

				app.map.on('commandresult', handleResponse);

				const encodedSelectedText = encodeURIComponent(this.originalText);
				const encodedPrompt = encodeURIComponent(prompt);
				app.socket.sendMessage(
					`uno .uno:RewriteAI selectedText=${encodedSelectedText} prompt=${encodedPrompt}`,
				);
			});
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

JSDialog.aiRewriteTextDialog = () => {
	return new cool.RewriteTextDialog();
};

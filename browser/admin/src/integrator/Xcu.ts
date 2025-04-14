interface XcuObject {
	[app: string]: any;
}

const defaultXcuObj: Record<string, any> = {
	Calc: {
		Grid: {
			Option: {
				SnapToGrid: false,
				SizeToGrid: true,
				VisibleGrid: false,
				Synchronize: true,
			},
		},
		Print: {
			Page: {
				EmptyPages: false,
				ForceBreaks: false,
			},
			Other: {
				AllSheets: false,
			},
		},
	},
	Draw: {
		Grid: {
			Option: {
				SnapToGrid: true,
				VisibleGrid: false,
				Synchronize: false,
			},
			SnapGrid: {
				Size: true,
			},
		},
		Print: {
			Content: {
				Drawing: true,
			},
			Page: {
				PageSize: false,
				PageTile: false,
				Booklet: false,
				BookletFront: true,
				BookletBack: true,
			},
			Other: {
				PageName: false,
				Date: false,
				Time: false,
				HiddenPage: true,
				FromPrinterSetup: false,
			},
		},
	},
	Impress: {
		Grid: {
			Option: {
				SnapToGrid: true,
				VisibleGrid: false,
				Synchronize: false,
			},
			SnapGrid: {
				Size: true,
			},
		},
		Print: {
			Content: {
				Presentation: true,
				Note: false,
				Handout: false,
				Outline: false,
			},
			Page: {
				PageSize: false,
				PageTile: false,
				Booklet: false,
				BookletFront: true,
				BookletBack: true,
			},
			Other: {
				PageName: false,
				Date: false,
				Time: false,
				HiddenPage: true,
				FromPrinterSetup: false,
				HandoutHorizontal: false,
			},
		},
	},
	Writer: {
		Grid: {
			Option: {
				SnapToGrid: false,
				VisibleGrid: false,
				Synchronize: false,
			},
		},
		Print: {
			Content: {
				Graphic: true,
				Table: true,
				Drawing: true,
				Control: true,
				Background: true,
				PrintBlack: false,
				PrintHiddenText: false,
				PrintPlaceholders: false,
			},
			Page: {
				LeftPage: true,
				RightPage: true,
				Reversed: false,
				Brochure: false,
				BrochureRightToLeft: false,
			},
			Output: {
				SinglePrintJob: false,
			},
			Papertray: {
				FromPrinterSetup: false,
			},
			EmptyPages: true,
		},
		Content: {
			Display: {
				GraphicObject: true,
			},
		},
	},
};

class Xcu {
	private xcuDataObj: XcuObject = {};
	private fileId: string | null = null;

	constructor(fileId: string, XcuFileContent: string | null) {
		this.fileId = fileId;

		try {
			this.xcuDataObj =
				XcuFileContent === null || XcuFileContent.length === 0
					? defaultXcuObj
					: this.parse(XcuFileContent);
		} catch (error) {
			console.error('Error parsing XCU file:', error);
		}
	}

	private parse(content: string): XcuObject {
		const parser = new DOMParser();
		const xmlDoc = parser.parseFromString(content, 'application/xml');

		if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
			throw new Error('Error parsing XCU file: Invalid XML content.');
		}

		const result: XcuObject = {};

		const items = xmlDoc.getElementsByTagName('item');

		Array.from(items).forEach((item) => {
			const rawPath = item.getAttribute('oor:path');
			if (!rawPath) {
				return;
			}

			const prefix = '/org.openoffice.Office.';
			const path = rawPath.startsWith(prefix)
				? rawPath.slice(prefix.length)
				: rawPath;

			const keys = path.split('/').filter((key) => key.trim() !== '');

			let currentLevel = result;
			keys.forEach((key) => {
				if (!(key in currentLevel)) {
					currentLevel[key] = {};
				}
				currentLevel = currentLevel[key];
			});

			const props = item.getElementsByTagName('prop');
			Array.from(props).forEach((prop) => {
				const propName = prop.getAttribute('oor:name');
				if (!propName) {
					return;
				}

				const valueElement = prop.getElementsByTagName('value')[0];
				let value: string | boolean = valueElement
					? valueElement.textContent || ''
					: '';

				const lowerValue = value.toLowerCase();
				if (lowerValue === 'true') {
					value = true;
				} else if (lowerValue === 'false') {
					value = false;
				}

				if (typeof value === 'boolean') {
					currentLevel[propName] = value;
				}
			});
		});

		return result;
	}

	private generate(xcu: XcuObject): string {
		function generateItemNodes(node: any, path: string[]): string[] {
			const items: string[] = [];
			const leafProps: { [key: string]: string | boolean } = {};
			const nestedKeys: string[] = [];

			for (const key in node) {
				if (Object.prototype.hasOwnProperty.call(node, key)) {
					const value = node[key];
					if (
						value !== null &&
						typeof value === 'object' &&
						!Array.isArray(value)
					) {
						nestedKeys.push(key);
					} else {
						leafProps[key] = value;
					}
				}
			}

			if (Object.keys(leafProps).length > 0) {
				const oorPath = '/org.openoffice.Office.' + path.join('/');
				let propsXml = '';
				for (const propName in leafProps) {
					if (Object.prototype.hasOwnProperty.call(leafProps, propName)) {
						const value = leafProps[propName];
						let valueStr = '';
						if (typeof value === 'boolean') {
							valueStr = value ? 'true' : 'false';
						} else {
							valueStr = String(value);
						}
						propsXml += `\n    <prop oor:name="${propName}" oor:op="fuse"><value>${valueStr}</value></prop>`;
					}
				}
				const itemXml =
					`  <item oor:path="${oorPath}">` + propsXml + `\n  </item>`;
				items.push(itemXml);
			}

			for (const key of nestedKeys) {
				const child = node[key];
				const newPath = path.concat(key);
				items.push(...generateItemNodes(child, newPath));
			}

			return items;
		}

		const itemsXml = generateItemNodes(xcu, []);
		const xcuXml =
			`<?xml version="1.0" encoding="UTF-8"?>\n` +
			`<oor:items\n` +
			`    xmlns:oor="http://openoffice.org/2001/registry"\n` +
			`    xmlns:xs="http://www.w3.org/2001/XMLSchema"\n` +
			`    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n\n` +
			itemsXml.join('\n') +
			`\n</oor:items>`;
		return xcuXml;
	}

	private renderXcuTree(data: any, pathPrefix: string = ''): HTMLElement {
		const container = document.createElement('div');
		if (typeof data !== 'object' || data === null) {
			container.textContent = String(data);
			return container;
		}
		for (const key in data) {
			if (Object.prototype.hasOwnProperty.call(data, key)) {
				const value = data[key];
				const uniqueId = pathPrefix ? `${pathPrefix}-${key}` : key;
				if (
					typeof value === 'object' &&
					value !== null &&
					!Array.isArray(value)
				) {
					const fieldset = document.createElement('fieldset');
					fieldset.classList.add('xcu-settings-fieldset');
					const legend = document.createElement('legend');
					legend.textContent = key;
					fieldset.appendChild(legend);
					const childContent = this.renderXcuTree(value, uniqueId);
					fieldset.appendChild(childContent);
					container.appendChild(fieldset);
				} else {
					const isCheck: boolean = value;
					const checkboxWrapper = document.createElement('span');
					checkboxWrapper.className = `checkbox-radio-switch checkbox-radio-switch-checkbox ${isCheck ? '' : 'checkbox-radio-switch--checked'} checkbox-wrapper`;
					checkboxWrapper.id = uniqueId + '-container';

					const inputCheckbox = document.createElement('input');
					inputCheckbox.type = 'checkbox';
					inputCheckbox.className = 'checkbox-radio-switch-input';
					inputCheckbox.id = uniqueId + '-input';
					inputCheckbox.checked = isCheck;
					checkboxWrapper.appendChild(inputCheckbox);

					const checkboxContent = document.createElement('span');
					checkboxContent.className =
						'checkbox-content checkbox-content-checkbox checkbox-content--has-text checkbox-radio-switch__content';
					checkboxContent.id = uniqueId + '-content';
					checkboxWrapper.appendChild(checkboxContent);

					const checkboxContentIcon = document.createElement('span');
					checkboxContentIcon.className = `checkbox-content-icon checkbox-radio-switch__icon ${isCheck ? '' : 'checkbox-content-icon--checked'}`;
					checkboxContentIcon.ariaHidden = 'true';
					checkboxContent.appendChild(checkboxContentIcon);

					const materialIcon = document.createElement('span');
					materialIcon.className = `material-design-icon ${isCheck ? 'checkbox-marked-icon' : 'checkbox-blank-outline-icon'}`;
					materialIcon.ariaHidden = 'true';

					const iconSvg = `
					<svg fill="currentColor" class="material-design-icon__svg" width="24" height="24" viewBox="0 0 24 24">
					${
						isCheck
							? `<path d="M10,17L5,12L6.41,10.58L10,14.17L17.59,6.58L19,8M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3Z">
							<!---->
						  </path>`
							: `<path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z">
							<!---->
						  </path>`
					}
					</svg>`;

					checkboxContentIcon.appendChild(materialIcon);
					materialIcon.innerHTML = iconSvg;

					const textElement = document.createElement('span');
					textElement.className =
						'checkbox-content__text checkbox-radio-switch__text';
					textElement.textContent = key;
					checkboxContent.appendChild(textElement);

					checkboxWrapper.addEventListener('click', (event) => {
						const currentChecked = !(inputCheckbox as HTMLInputElement).checked;
						inputCheckbox.checked = currentChecked;
						if (currentChecked) {
							checkboxWrapper.classList.remove(
								'checkbox-radio-switch--checked',
							);
						} else {
							checkboxWrapper.classList.add('checkbox-radio-switch--checked');
						}
						materialIcon.innerHTML = `
							<svg fill="currentColor" class="material-design-icon__svg" width="24" height="24" viewBox="0 0 24 24">
							${
								currentChecked
									? `<path d="M10,17L5,12L6.41,10.58L10,14.17L17.59,6.58L19,8M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3Z">
									<!---->
								</path>`
									: `<path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z">
									<!---->
								</path>`
							}
							</svg>`;

						data[key] = currentChecked;
					});

					container.appendChild(checkboxWrapper);
				}
			}
		}
		return container;
	}

	public createXcuEditorUI(container: HTMLElement): HTMLElement {
		const heading = document.createElement('h3');
		heading.textContent = 'Document View';
		container.appendChild(heading);

		const descEl = document.createElement('p');
		descEl.textContent = 'Adjust how office documents look.';
		container.appendChild(descEl);

		const editorContainer = document.createElement('div');
		editorContainer.id = 'xcu-editor';

		const navContainer = document.createElement('div');
		navContainer.className = 'xcu-editor-tabs-nav';

		const tabs = [
			{ id: 'calc', label: 'Calc' },
			{ id: 'writer', label: 'Writer' },
			{ id: 'impress', label: 'Impress' },
			{ id: 'draw', label: 'Draw' },
		];

		tabs.forEach((tab) => {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'xcu-editor-tab';
			btn.id = `xcu-tab-${tab.id}`;
			btn.textContent = tab.label;
			btn.addEventListener('click', () => {
				navContainer
					.querySelectorAll('.xcu-editor-tab')
					.forEach((b) => b.classList.remove('active'));
				btn.classList.add('active');

				const contentsContainer = editorContainer.querySelector(
					'#xcu-tab-contents',
				) as HTMLElement;
				contentsContainer.innerHTML = '';
				if (this.xcuDataObj && this.xcuDataObj[tab.label]) {
					const renderedTree = this.renderXcuTree(this.xcuDataObj[tab.label]);
					renderedTree.classList.add('xcu-settings-grid');
					contentsContainer.appendChild(renderedTree);
				} else {
					contentsContainer.textContent = `No settings available for ${tab.label}`;
				}
			});
			navContainer.appendChild(btn);
		});

		const contentsContainer = document.createElement('div');
		contentsContainer.id = 'xcu-tab-contents';
		contentsContainer.textContent = 'Select a tab to view settings.';

		editorContainer.appendChild(navContainer);
		editorContainer.appendChild(contentsContainer);
		container.appendChild(editorContainer);

		const actionsContainer = document.createElement('div');
		actionsContainer.classList.add('xcu-editor-actions');

		const resetButton = document.createElement('button');
		resetButton.type = 'button';
		resetButton.id = 'xcu-reset-button';
		resetButton.classList.add('button', 'button--vue-secondary');
		resetButton.title = 'Reset to default Document View settings';
		resetButton.innerHTML = `
			<span class="button__wrapper">
				<span class="button__icon xcu-reset-icon">
				<svg fill="currentColor" width="24" height="24" viewBox="0 0 24 24">
					<!-- Replace with your Reset icon SVG path -->
					<path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 .34-.03.67-.08 1h2.02c.05-.33.06-.66.06-1 0-4.42-3.58-8-8-8zm-6 7c0-.34.03-.67.08-1H4.06c-.05.33-.06.66-.06 1 0 4.42 3.58 8 8 8v3l4-4-4-4v3c-3.31 0-6-2.69-6-6z"></path>
				</svg>
				</span>
			</span>
			`;

		resetButton.addEventListener('click', async () => {
			const confirmed = window.confirm(
				'Are you sure you want to reset Document View settings?',
			);
			if (!confirmed) {
				return;
			}
			resetButton.disabled = true;
			this.xcuDataObj = defaultXcuObj;
			this.generateXcuAndUpload();
			resetButton.disabled = false;
		});

		const saveButton = document.createElement('button');
		saveButton.type = 'button';
		saveButton.id = 'xcu-save-button';
		saveButton.classList.add('button', 'button-primary');
		saveButton.title = 'Save Document View settings';
		saveButton.innerHTML = `
			<span class="button__wrapper">
				<span class="button--text-only">Save</span>
			</span>
			`;

		saveButton.addEventListener('click', async () => {
			saveButton.disabled = true;
			this.generateXcuAndUpload();
			saveButton.disabled = false;
		});

		actionsContainer.appendChild(resetButton);
		actionsContainer.appendChild(saveButton);
		container.appendChild(actionsContainer);

		setTimeout(() => {
			const defaultTab = navContainer.querySelector(
				'#xcu-tab-calc',
			) as HTMLElement;
			if (defaultTab) {
				defaultTab.click();
			}
		}, 0);

		return container;
	}

	public async generateXcuAndUpload(): Promise<void> {
		const xcuContent = this.generate(this.xcuDataObj);
		await (window as any).settingIframe.uploadXcuFile(this.fileId, xcuContent);
	}
}

(window as any).Xcu = Xcu;

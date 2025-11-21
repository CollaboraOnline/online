// @ts-strict-ignore
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
/* global $ _ */

interface BackstageTabConfig {
	id: string;
	label: string;
	type: 'view' | 'action';
	visible?: boolean;
	viewType?: 'home' | 'templates' | 'info' | 'export';
	actionType?:
		| 'open'
		| 'save'
		| 'saveas'
		| 'print'
		| 'share'
		| 'repair'
		| 'properties'
		| 'history';
}

interface TemplateTypeMap {
	writer: 'writer';
	calc: 'calc';
	impress: 'impress';
}

type TemplateType = TemplateTypeMap[keyof TemplateTypeMap];

interface TemplateData {
	id: string;
	name: string;
	type: TemplateType;
	path?: string;
	preview?: string;
	featured?: boolean;
	searchText: string;
}

interface TemplateManifestEntry {
	id?: string;
	name?: string;
	type?: string;
	category?: string;
	path: string;
	preview?: string | null;
	featured?: boolean;
}

interface TemplateManifest {
	templates?: TemplateManifestEntry[];
}

interface ExportFormatData {
	id: string;
	name: string;
	description: string;
}

interface ExportOptionItem {
	action: string;
	text: string;
	command?: string;
}

// todo: currently export as and downloadAs with pdf as not working, skipping for moment
interface ExportSections {
	exportAs: ExportOptionItem[];
	downloadAs: ExportOptionItem[];
}

class BackstageView extends window.L.Class {
	private readonly container: HTMLElement;
	private contentArea!: HTMLElement;
	private isVisible: boolean = false;
	private readonly map: any;
	private templates: TemplateManifestEntry[] | null = null;
	private templatesPromise: Promise<void> | null = null;
	private templatesLoadError: boolean = false;
	private activeTemplateType: TemplateType = 'writer';
	private templateSearchQuery: string = '';
	private templateGridContainer: HTMLElement | null = null;
	private templateFeaturedRowContainer: HTMLElement | null = null;
	private templateSearchContainer: HTMLElement | null = null;
	private saveTabElement: HTMLElement | null = null;

	private actionHandlers: Record<string, () => void> = {
		open: () => this.executeOpen(),
		save: () => this.executeSave(),
		saveas: () => this.executeSaveAs(),
		print: () => this.executePrint(),
		share: () => this.executeShare(),
		repair: () => this.executeRepair(),
		properties: () => this.executeDocumentProperties(),
		history: () => this.executeRevisionHistory(),
	};

	constructor(map: any) {
		super();
		this.map = map;
		this.container = this.createContainer();
		document.body.appendChild(this.container);
		this.map?.on('commandstatechanged', (e: any) => {
			if (e.commandName === '.uno:ModifiedStatus') {
				this.updateSaveButtonState();
			}
		}, this);
	}

	private createContainer(): HTMLElement {
		const container = this.createElement(
			'div',
			'backstage-view hidden',
			'backstage-view',
		);

		const header = this.createHeader();
		container.appendChild(header);

		const mainWrapper = this.createElement('div', 'backstage-main-wrapper');
		const sidebar = this.createSidebar();
		this.contentArea = this.createElement('div', 'backstage-content');

		mainWrapper.appendChild(sidebar);
		mainWrapper.appendChild(this.contentArea);
		container.appendChild(mainWrapper);

		this.renderNewView();
		return container;
	}

	private createHeader(): HTMLElement {
		const header = this.createElement('div', 'backstage-header');
		const title = this.createElement('span', 'backstage-header-title');
		title.textContent = 'Collabora Office';

		const closeButton = this.createElement('div', 'backstage-header-close');
		closeButton.setAttribute('aria-label', _('Close backstage'));
		closeButton.title = _('Close backstage');

		const closeBtn = this.createElement('span', 'backstage-header-close-icon');
		closeBtn.setAttribute('aria-hidden', 'true');
		closeBtn.textContent = '×';
		closeButton.appendChild(closeBtn);

		window.L.DomEvent.on(closeButton, 'click', () => this.hide(), this);

		header.appendChild(title);
		header.appendChild(closeButton);
		return header;
	}

	private createSidebar(): HTMLElement {
		const sidebar = this.createElement('div', 'backstage-sidebar');
		const backButton = this.createSidebarBackBtn();
		sidebar.appendChild(backButton);

		const tabsContainer = this.createElement('div', 'backstage-sidebar-tabs');
		const tabConfigs = this.getTabsConfig();

		tabConfigs.forEach((config) => {
			if (config.visible === false) return;

			const tabElement = this.createTabElement(config);
			tabsContainer.appendChild(tabElement);
		});

		sidebar.appendChild(tabsContainer);
		return sidebar;
	}

	private createSidebarBackBtn(): HTMLElement {
		const backButton = this.createElement('div', 'backstage-sidebar-back');

		backButton.setAttribute('aria-label', _('Back to document'));
		backButton.title = _('Back to document');

		const icon = this.createElement('span', 'backstage-sidebar-back-icon');
		icon.setAttribute('aria-hidden', 'true');
		icon.textContent = '←';
		backButton.appendChild(icon);

		window.L.DomEvent.on(backButton, 'click', () => this.hide(), this);

		return backButton;
	}

	private createTabElement(config: BackstageTabConfig): HTMLElement {
		const element = this.createElement('div', 'backstage-sidebar-item');
		element.id = `backstage-${config.id}`;

		if (config.id === 'save') this.saveTabElement = element;

		const label = this.createElement('span');
		label.textContent = config.label;
		element.appendChild(label);

		const action =
			config.type === 'view'
				? () => this.handleViewTab(config)
				: () => this.handleActionTab(config);

		window.L.DomEvent.on(element, 'click', action, this);
		return element;
	}

	private getTabsConfig(): BackstageTabConfig[] {
		return [
			{
				id: 'home',
				label: _('Home'),
				type: 'view',
				viewType: 'home',
				visible: false,
			},
			{
				id: 'new',
				label: _('New'),
				type: 'view',
				viewType: 'templates',
				visible: true,
			},
			{
				id: 'open',
				label: _UNO('.uno:Open'),
				type: 'action',
				actionType: 'open',
				visible: true,
			},
			{
				id: 'share',
				label: _('Share'),
				type: 'action',
				actionType: 'share',
				visible: this.isFeatureEnabled('share'),
			},
			{
				id: 'info',
				label: _('Info'),
				type: 'view',
				viewType: 'info',
				visible: true,
			},
			{
				id: 'save',
				label: _('Save'),
				type: 'action',
				actionType: 'save',
				visible: this.isFeatureEnabled('save'),
			},
			{
				id: 'saveas',
				label: _('Save As'),
				type: 'action',
				actionType: 'saveas',
				visible: this.isFeatureEnabled('saveAs'),
			},
			{
				id: 'print',
				label: _('Print'),
				type: 'action',
				actionType: 'print',
				visible: this.isFeatureEnabled('print'),
			},
			{
				id: 'export',
				label: _('Export'),
				type: 'view',
				viewType: 'export',
				visible: true,
			},
		];
	}

	private handleViewTab(config: BackstageTabConfig): void {
		const viewRenderers: Record<string, () => void> = {
			home: () => this.renderHomeView(),
			templates: () => this.renderNewView(),
			info: () => this.renderInfoView(),
			export: () => this.renderExportView(),
		};

		const viewType = config.viewType;
		if (!viewType) return;

		const renderer = viewRenderers[viewType];
		if (renderer) renderer();
	}

	private handleActionTab(config: BackstageTabConfig): void {
		if (config.actionType === 'save' && !this.isDocumentModified()) return;
		const handler = this.actionHandlers[config.actionType || ''];
		if (handler) handler();
	}

	private isFeatureEnabled(feature: string): boolean {
		const wopi = this.map['wopi'] || {};
		const featureFlags: Record<string, boolean> = {
			share: !!wopi.EnableShare,
			save: !wopi.HideSaveOption,
			saveAs: !wopi.UserCanNotWriteRelative,
			print: !wopi.HidePrintOption,
			repair: !wopi.HideRepairOption,
		};
		return featureFlags[feature] !== false;
	}

	private renderHomeView(): void {
		this.setActiveTab('backstage-home');
		this.clearContent();

		this.addSectionHeader(
			_('Recent'),
			_('Recently opened documents will appear here'),
		);
	}

	private renderNewView(): void {
		this.setActiveTab('backstage-new');
		this.clearContent();
		this.templateGridContainer = null;
		this.templateFeaturedRowContainer = null;
		this.templateSearchContainer = null;

		this.addSectionHeader(
			_('New Document'),
			_('Start from a template or a blank file'),
		);

		if (!this.templates) {
			this.renderTemplatesLoadingState();
			this.loadTemplatesData().then(() => {
				if (this.isVisible) this.renderNewView();
			});
			return;
		}

		const templates = this.getTemplatesData();
		const explorer = this.renderTemplateExplorer(templates);
		this.contentArea.appendChild(explorer);
	}

	private renderInfoView(): void {
		this.setActiveTab('backstage-info');
		this.clearContent();

		this.addSectionHeader(
			_('Document Info'),
			_('View document properties and information'),
		);

		const propertiesColumn = this.createInfoPropertiesColumn();
		this.contentArea.appendChild(propertiesColumn);
	}

	private renderExportView(): void {
		this.setActiveTab('backstage-export');
		this.clearContent();

		// extract list from notebookbar - incase need to add condition better to add there?
		const exportOptions = this.getExportOptionsFromNotebookbar();

		if (exportOptions.downloadAs.length > 0) {
			this.addSectionHeader(
				_('Export Document'),
				_('export your documents in different formats'),
			);

			const downloadAsGrid = this.createExportGridFromOptions(
				exportOptions.downloadAs,
			);
			this.contentArea.appendChild(downloadAsGrid);
		}
	}

	private createExportGridFromOptions(
		options: ExportOptionItem[],
	): HTMLElement {
		const grid = this.createElement('div', 'backstage-formats-grid');

		options.forEach((option) => {
			const card = this.createExportCardFromOption(option);
			grid.appendChild(card);
		});

		return grid;
	}

	private createExportCardFromOption(option: ExportOptionItem): HTMLElement {
		const card = this.createElement('div', 'backstage-format-card');

		const format = option.action.startsWith('downloadas-')
			? option.action.substring('downloadas-'.length)
			: '';
		const extension = format ? `.${format}` : '';

		const icon = this.createElement('div', 'format-icon');
		icon.textContent = extension.toUpperCase().replace('.', '');
		card.appendChild(icon);

		const description = this.createElement('div', 'format-description');
		description.textContent = option.text;
		card.appendChild(description);

		window.L.DomEvent.on(
			card,
			'click',
			() => this.dispatchExportAction(option.action, option.command),
			this,
		);
		return card;
	}


	private createInfoPropertiesColumn(): HTMLElement {
		const column = this.createElement('div', 'backstage-info-properties');

		const header = this.createElement('h3', 'backstage-section-header');
		header.textContent = _('Properties');
		column.appendChild(header);

		const propertiesList = this.createPropertiesList();
		column.appendChild(propertiesList);

		const button = this.createPrimaryButton(
			_('More Property Info'),
			() => this.executeDocumentProperties(),
		);
		column.appendChild(button);

		return column;
	}

	private createElement(
		tag: string,
		className?: string,
		id?: string,
	): HTMLElement {
		const element = window.L.DomUtil.create(tag, className || '');
		if (id) element.id = id;
		return element;
	}


	private createPrimaryButton(
		label: string,
		onClick: () => void,
	): HTMLButtonElement {
		const button = this.createElement(
			'button',
			'backstage-property-button',
		) as HTMLButtonElement;
		button.textContent = label;
		window.L.DomEvent.on(button, 'click', onClick, this);
		return button;
	}

	private createPropertiesList(): HTMLElement {
		const list = this.createElement('div', 'backstage-properties-list');

		const properties = this.getDocumentProperties();

		properties.forEach((prop) => {
			if (prop.value) {
				const item = this.createPropertyItem(prop.label, prop.value);
				list.appendChild(item);
			}
		});

		return list;
	}

	private createPropertyItem(label: string, value: string): HTMLElement {
		const item = this.createElement('div', 'backstage-property-item');

		const labelEl = this.createElement('div', 'property-label');
		labelEl.textContent = label;
		item.appendChild(labelEl);

		const valueEl = this.createElement('div', 'property-value');
		valueEl.textContent = value;
		item.appendChild(valueEl);

		return item;
	}
	
	private getFileName = (wopi: any): string => {
		if (wopi?.BreadcrumbDocName) return wopi.BreadcrumbDocName;
		if (wopi?.BaseFileName) return wopi.BaseFileName;

		const doc = this.map?.options?.doc;
		if (doc) {
			const filename = doc.split('/').pop()?.split('?')[0];
			if (filename) return decodeURIComponent(filename);
		}

		return '';
	};


	private getDocumentProperties(): Array<{ label: string; value: string }> {
		const docType = this.getDocTypeString();
		const docLayer = this.map?._docLayer;
		const wopi = this.map?.['wopi'];

		const typeLabels: Record<
			string,
			{ type: string; parts: string }
		> = {
			text: { type: _('Text Document'), parts: _('Pages') },
			spreadsheet: { type: _('Spreadsheet'), parts: _('Sheets') },
			presentation: { type: _('Presentation'), parts: _('Slides') },
			drawing: { type: _('Drawing'), parts: _('Pages') },
		};

		const config = typeLabels[docType] || {
			type: _('Document'),
			parts: _('Parts'),
		};


		const properties = [
			{ label: _('Type'), value: config.type },
			{
				label: config.parts,
				value: docLayer?._parts ? String(docLayer._parts) : '-',
			},
			{
				label: _('Mode'),
				value: this.map?.isEditMode() ? _('Edit') : _('View Only'),
			},
		];

		const filename = this.getFileName(wopi);
		if (filename) {
			properties.splice(1, 0, {
				label: _('File Name'),
				value: filename,
			});
		}

		return properties;
	}

	private addSectionHeader(title: string, description: string): void {
		const titleElement = this.createElement('h2', 'backstage-content-title');
		titleElement.textContent = title;
		this.contentArea.appendChild(titleElement);

		const descElement = this.createElement(
			'p',
			'backstage-content-description',
		);
		descElement.textContent = description;
		this.contentArea.appendChild(descElement);
	}

	private clearContent(): void {
		while (this.contentArea.firstChild) {
			this.contentArea.removeChild(this.contentArea.firstChild);
		}
	}

	private setActiveTab(tabId: string): void {
		$('.backstage-sidebar-item').removeClass('active');
		$('#' + tabId).addClass('active');
	}

	private getTemplatesData(): TemplateData[] {
		const entries = this.templates || [];
		const templates: TemplateData[] = [];

		entries.forEach((entry) => {
			const absolutePath = entry.path;
			if (!absolutePath) return;

			const type = this.normalizeTemplateType(entry.type, absolutePath);
			if (!type) return;

			const name = entry.name || this.deriveDisplayName(absolutePath);
			const id = entry.id || this.slugify(name + absolutePath);
			const searchComponents = [name, type, absolutePath];

		templates.push({
			id,
			name,
			type,
			path: absolutePath,
			preview: entry.preview || undefined,
			featured: !!entry.featured,
			searchText: searchComponents.join(' ').toLowerCase(),
		});
	});

	// Sort by type first (writer, calc, impress), then alphabetically by name
	const typeOrder: Record<TemplateType, number> = {
		writer: 1,
		calc: 2,
		impress: 3,
	};

	return templates.sort((a, b) => {
		const typeComparison = typeOrder[a.type] - typeOrder[b.type];
		if (typeComparison !== 0) return typeComparison;
		return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
	});
}

	private async loadTemplatesData(): Promise<void> {
		if (this.templatesPromise) return this.templatesPromise;

		const loader = (async () => {
			try {
				const entries = await this.fetchTemplateManifest(
					'templates/templates.json',
				);
				this.templates = entries;
				this.templatesLoadError = false;
				
				if (!entries || entries.length === 0) {
					console.error('Templates manifest loaded but contains no templates founded!');
				}
			} catch (error) {
				console.error('Unable to load templates manifest', error);
				this.templates = [];
				this.templatesLoadError = true;
			}
		})();

		this.templatesPromise = loader.finally(() => {
			this.templatesPromise = null;
		});

		return this.templatesPromise;
	}

	private renderTemplatesLoadingState(): void {
		const wrapper = this.createElement('div', 'backstage-templates-empty');
		const info = this.createElement('p', 'backstage-content-description');
		info.textContent = _('Loading templates…');
		wrapper.appendChild(info);
		this.contentArea.appendChild(wrapper);
	}

	private renderTemplateExplorer(allTemplates: TemplateData[]): HTMLElement {
		const previousType = this.activeTemplateType;
		const detectedType = this.detectTemplateTypeFromDoc();
		if (detectedType !== previousType) this.templateSearchQuery = '';
		this.activeTemplateType = detectedType;

		const container = this.createElement('div', 'backstage-template-explorer');

		const filteredTemplates = this.getFilteredTemplates(allTemplates);

		const featuredRow = this.renderFeaturedRow();
		if (featuredRow) {
			container.appendChild(featuredRow);
			this.templateFeaturedRowContainer = featuredRow;
		} else {
			this.templateFeaturedRowContainer = null;
		}

		// Only show search bar if there are custom templates to search through
		if (allTemplates.length > 0) {
			const search = this.renderTemplateSearch();
			this.templateSearchContainer = search;
			container.appendChild(search);
		} else {
			this.templateSearchContainer = null;
		}

		const grid = this.renderTemplateGrid(filteredTemplates);
		this.templateGridContainer = grid;
		container.appendChild(grid);

		return container;
	}

	private renderTemplateSearch(): HTMLElement {
		const container = this.createElement('div', 'template-search');
		const input = this.createElement(
			'input',
			'template-search-input',
		) as HTMLInputElement;
		input.type = 'search';
		input.placeholder = _('Search templates');
		input.value = this.templateSearchQuery;

		window.L.DomEvent.on(
			input,
			'input',
			() => {
				this.templateSearchQuery = input.value || '';
				this.updateTemplateGrid();
			},
			this,
		);

		container.appendChild(input);
		return container;
	}

	private getFilteredTemplates(allTemplates: TemplateData[]): TemplateData[] {
		const query = this.templateSearchQuery.trim().toLowerCase();
		return allTemplates.filter((template) => {
			if (!query) return true;
			return template.searchText.includes(query);
		});
	}

	private renderFeaturedRow(): HTMLElement | null {
		const blankTemplates = [
			this.getBlankTemplate('writer'),
			this.getBlankTemplate('calc'),
			this.getBlankTemplate('impress'),
		].filter((t): t is TemplateData => t !== null);

		const query = this.templateSearchQuery.trim().toLowerCase();
		const filteredBlankTemplates = query
			? blankTemplates.filter((t) => t.searchText.includes(query))
			: blankTemplates;

		if (filteredBlankTemplates.length === 0) return null;

		const row = this.createElement('div', 'template-featured-row');
		filteredBlankTemplates.forEach((blankTemplate) => {
			row.appendChild(
				this.createTemplateCard(blankTemplate, {
					variant: 'featured',
					isBlank: true,
				}),
			);
		});
		return row;
	}

	private renderTemplateGrid(templates: TemplateData[]): HTMLElement {
		const grid = this.createElement('div', 'backstage-templates-grid');

		if (!templates.length) {
			// Only show "no match" message if user is actively searching
			if (this.templateSearchQuery.trim()) {
				const empty = this.createElement('div', 'template-grid-empty');
				empty.textContent = _('No templates match your search.');
				grid.appendChild(empty);
			}
			return grid;
		}

		templates.forEach((template) => {
			grid.appendChild(this.createTemplateCard(template));
		});

		return grid;
	}

	private updateTemplateGrid(): void {
		if (!this.templates || !this.templateGridContainer) return;

		const allTemplates = this.getTemplatesData();
		const filteredTemplates = this.getFilteredTemplates(allTemplates);
		const newGrid = this.renderTemplateGrid(filteredTemplates);
		this.templateGridContainer.replaceWith(newGrid);
		this.templateGridContainer = newGrid;

		const newFeaturedRow = this.renderFeaturedRow();
		if (this.templateFeaturedRowContainer) {
			if (newFeaturedRow) {
				this.templateFeaturedRowContainer.replaceWith(newFeaturedRow);
				this.templateFeaturedRowContainer = newFeaturedRow;
			} else {
				this.templateFeaturedRowContainer.remove();
				this.templateFeaturedRowContainer = null;
			}
		} else if (newFeaturedRow && this.templateSearchContainer) {
			// Only try to insert if search container exists
			if (this.templateSearchContainer.parentElement) {
				this.templateSearchContainer.parentElement.insertBefore(
					newFeaturedRow,
					this.templateSearchContainer,
				);
				this.templateFeaturedRowContainer = newFeaturedRow;
			}
		} else if (newFeaturedRow && this.templateGridContainer.parentElement) {
			// If no search container, insert before grid
			this.templateGridContainer.parentElement.insertBefore(
				newFeaturedRow,
				this.templateGridContainer,
			);
			this.templateFeaturedRowContainer = newFeaturedRow;
		}
	}

	private getTemplateTypeLabel(type: TemplateType): string {
		switch (type) {
			case 'writer':
				return 'Writer';
			case 'calc':
				return 'Calc';
			case 'impress':
				return 'Impress';
			default:
				return type;
		}
	}

	private createTemplateCard(
		template: TemplateData,
		options: { variant?: 'featured'; isBlank?: boolean } = {},
	): HTMLElement {
		const card = this.createElement('div', 'backstage-template-card');
		if (options.variant === 'featured') card.classList.add('is-featured');
		if (options.isBlank) card.classList.add('is-blank');

		const previewWrapper = this.createElement('div', 'template-thumbnail');
		const preview = this.createElement('img') as HTMLImageElement;
		preview.alt = template.name;
		if (template.preview) preview.src = template.preview;
		else preview.src = this.getDefaultPreview(template.type);
		previewWrapper.appendChild(preview);
		card.appendChild(previewWrapper);

		const name = this.createElement('div', 'template-name');
		name.textContent = template.name;
		card.appendChild(name);

		window.L.DomEvent.on(
			card,
			'click',
			() => this.triggerNewDocument(template),
			this,
		);
		return card;
	}

	private getDefaultPreview(type: TemplateType): string {
		const previews: Record<TemplateType, string> = {
			writer: 'images/filetype/writer.svg',
			calc: 'images/filetype/calc.svg',
			impress: 'images/filetype/impress.svg',
		};
		return previews[type] || 'images/filetype/document.svg';
	}

	private getBlankTemplate(type: TemplateType): TemplateData | null {
		let name: string;
		let previewPath: string | undefined;
		switch (type) {
			case 'calc':
				name = _('Blank Spreadsheet');
				previewPath = 'images/templates/preview/blank_spreadsheet.png';
				break;
			case 'impress':
				name = _('Blank Presentation');
				previewPath = 'images/templates/preview/blank_presentation.png';
				break;
			case 'writer':
			default:
				name = _('Blank Document');
				previewPath = 'images/templates/preview/blank_writer.png';
				break;
		}

		return {
			id: `blank-${type}`,
			name,
			type,
			preview: previewPath,
			searchText: `${name.toLowerCase()} ${type} blank`,
		};
	}

	private detectTypeFromPath(templatePath: string): TemplateType | null {
		const extension = templatePath.split('.').pop()?.toLowerCase() || '';
		const map: Record<string, TemplateType> = {
			ott: 'writer',
			oth: 'writer',
			otm: 'writer',
			ots: 'calc',
			otp: 'impress',
		};
		return map[extension] || null;
	}

	private normalizeTemplateType(
		entryType: string | undefined,
		templatePath: string,
	): TemplateType | null {
		const normalized = (entryType || '').toLowerCase();
		if (
			normalized === 'writer' ||
			normalized === 'calc' ||
			normalized === 'impress'
		)
			return normalized as TemplateType;
		return this.detectTypeFromPath(templatePath);
	}

	private slugify(value: string): string {
		return value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.replace(/-{2,}/g, '-');
	}

	private deriveDisplayName(templatePath: string): string {
		const baseName = templatePath.split(/[\\/]/).pop() || templatePath;
		const nameWithoutExtension = baseName.replace(/\.[^.]+$/, '');
		return nameWithoutExtension
			.replace(/[_-]+/g, ' ')
			.replace(/\s+/g, ' ')
			.replace(/\b\w/g, (char) => char.toUpperCase());
	}

	private async fetchTemplateManifest(
		manifestPath: string,
	): Promise<TemplateManifestEntry[]> {
		if (window.location.protocol === 'file:') {
			return this.fetchTemplateManifestViaXHR(manifestPath);
		}

		const response = await fetch(manifestPath, { cache: 'no-store' });
		if (!response.ok) throw new Error('Failed to load template manifest');

		return this.parseManifest(await response.json());
	}

	private fetchTemplateManifestViaXHR(
		manifestPath: string,
	): Promise<TemplateManifestEntry[]> {
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open('GET', manifestPath, true);
			xhr.responseType = 'text';
			xhr.onload = () => {
				const success =
					xhr.status === 0 || (xhr.status >= 200 && xhr.status < 400);
				if (!success) {
					reject(
						new Error(
							`Failed to load template manifest (status ${xhr.status})`,
						),
					);
					return;
				}

				try {
					const payload = JSON.parse(xhr.responseText);
					resolve(this.parseManifest(payload));
				} catch (error) {
					reject(error);
				}
			};
			xhr.onerror = () =>
				reject(new Error('XHR failed while loading template manifest'));
			xhr.send();
		});
	}

	private parseManifest(payload: any): TemplateManifestEntry[] {
		let entries: TemplateManifestEntry[] = [];
		if (payload && Array.isArray((payload as TemplateManifest).templates)) {
			entries = (payload as TemplateManifest)
				.templates as TemplateManifestEntry[];
		} else if (Array.isArray(payload)) {
			entries = payload as TemplateManifestEntry[];
		}
		return entries.filter((entry) => !!entry.path);
	}

	private getDocTypeString(): string {
		const docLayer = this.map && this.map._docLayer;
		const docType = docLayer && docLayer._docType;
		return docType || 'text';
	}

	private getExportOptionsFromNotebookbar(): ExportSections {
		const docType = this.getDocTypeString();
		const builder = new (window.L.Control.NotebookbarBuilder as any)();

		let downloadAsOpts: ExportOptionItem[] = builder._getDownloadAsSubmenuOpts
			? builder._getDownloadAsSubmenuOpts(docType) || []
			: [];

		downloadAsOpts = downloadAsOpts.filter(
			(option) =>
				option.action !== 'exportpdf' && option.command !== 'exportpdf',
		);

		return {
			exportAs: [],
			downloadAs: downloadAsOpts,
		};
	}

	private executeOpen(): void {
		this.sendUnoCommand('.uno:Open');
		this.hide();
	}

	private executeSave(): void {
		if (this.map && this.map.save) {
			this.map.save(false, false);
		}
		this.hide();
	}

	private executeSaveAs(): void {
		this.sendUnoCommand('.uno:SaveAs');
		this.hide();
	}

	private executePrint(): void {
		if (window.ThisIsAMobileApp) {
			window.postMobileMessage('PRINT');
		} else if (this.map && this.map.print) {
			this.map.print();
		}
		this.hide();
	}

	private executeShare(): void {
		this.fireMapEvent('postMessage', { msgId: 'UI_Share' });
		this.hide();
	}

	private executeRevisionHistory(): void {
		this.fireMapEvent('postMessage', { msgId: 'rev-history' });
		this.hide();
	}

	private executeRepair(): void {
		this.sendUnoCommand('.uno:Repair');
		this.hide();
	}

	private executeDocumentProperties(): void {
		this.sendUnoCommand('.uno:SetDocumentProperties');
		this.hide();
	}

	private triggerNewDocument(template: TemplateData): void {
		const docType = template.type || 'writer';
		const params: string[] = ['type=' + docType];
		if (template.path) {
			params.push('template=' + encodeURIComponent(template.path));
		}

		window.postMobileMessage('newdoc ' + params.join(' '));
		this.hide();
	}

	private dispatchExportAction(action: string, command?: string): void {
		const actionToDispatch = command || action;

		if (window.app && window.app.dispatcher) {
			window.app.dispatcher.dispatch(actionToDispatch);
		} else {
			console.warn('app.dispatcher not available, using fallback');
			this.handleExportFallback(actionToDispatch);
		}
		this.hide();
	}

	private getBaseFileName(): string {
		const fileName = this.map?.['wopi']?.BaseFileName || 'document';
		const lastDot = fileName.lastIndexOf('.');
		return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
	}

	private handleExportFallback(action: string): void {
		if (action === 'exportdirectpdf') {
			if (this.map && this.map.downloadAs) {
				this.map.downloadAs(this.getBaseFileName() + '.pdf', 'pdf');
			}
			return;
		}

		if (action.startsWith('downloadas-')) {
			const format = action.substring('downloadas-'.length);
			if (this.map && this.map.downloadAs) {
				this.map.downloadAs(this.getBaseFileName() + '.' + format, format);
			}
			return;
		}

		console.error('something want wrong with this action: ', action);
	}

	private sendUnoCommand(command: string): void {
		if (this.map && this.map.sendUnoCommand) {
			this.map.sendUnoCommand(command);
		}
	}

	private fireMapEvent(eventName: string, data?: any): void {
		if (this.map && this.map.fire) {
			this.map.fire(eventName, data);
		}
	}

	public show(): void {
		if (this.isVisible) {
			return;
		}

		this.isVisible = true;
		$(this.container).removeClass('hidden');
		this.hideDocumentContainer();
		this.renderNewView();
		this.updateSaveButtonState();
		this.container.focus();
		this.fireMapEvent('backstageshow');
	}

	public hide(): void {
		if (!this.isVisible) {
			return;
		}

		this.isVisible = false;
		$(this.container).addClass('hidden');
		this.showDocumentContainer();
		this.focusMap();
		this.fireMapEvent('backstagehide');
	}

	public toggle(): void {
		if (this.isVisible) {
			this.hide();
		} else {
			this.show();
		}
	}

	private hideDocumentContainer(): void {
		$('#document-container').addClass('hidden');
		$('.notebookbar-scroll-wrapper').addClass('hidden');
	}

	private showDocumentContainer(): void {
		$('#document-container').removeClass('hidden');
		$('.notebookbar-scroll-wrapper').removeClass('hidden');
	}

	private focusMap(): void {
		if (this.map && this.map.focus) {
			this.map.focus();
		}
	}

	private detectTemplateTypeFromDoc(): TemplateType {
		const docLayer = this.map && this.map._docLayer;
		const docType = docLayer && docLayer._docType;
		switch (docType) {
			case 'spreadsheet':
				return 'calc';
			case 'presentation':
			case 'drawing':
				return 'impress';
			default:
				return 'writer';
		}
	}

	private isDocumentModified(): boolean {
		return this.map?.stateChangeHandler?.getItemValue('.uno:ModifiedStatus') === 'true';
	}

	private updateSaveButtonState(): void {
		if (!this.saveTabElement) return;
		this.saveTabElement.classList.toggle('disabled', !this.isDocumentModified());
	}
}

window.L.Control.BackstageView = BackstageView;

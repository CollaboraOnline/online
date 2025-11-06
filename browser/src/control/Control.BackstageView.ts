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
	actionType?: 'open' | 'save' | 'saveas' | 'print' | 'share' | 'repair' | 'properties' | 'history';
}

interface TemplateData {
	name: string;
	type: string;
}

interface ExportFormatData {
	id: string;
	name: string;
	description: string;
}

class BackstageView extends window.L.Class {
	private readonly container: HTMLElement;
	private contentArea!: HTMLElement;
	private isVisible: boolean = false;
	private readonly map: any;

	constructor(map: any) {
		super();
		this.map = map;
		this.container = this.createContainer();
		document.body.appendChild(this.container);
	}

	private createContainer(): HTMLElement {
		const container = this.createElement('div', 'backstage-view hidden', 'backstage-view');
		
		const header = this.createHeader();
		container.appendChild(header);

		const mainWrapper = this.createElement('div', 'backstage-main-wrapper');
		const sidebar = this.createSidebar();
		this.contentArea = this.createElement('div', 'backstage-content');

		mainWrapper.appendChild(sidebar);
		mainWrapper.appendChild(this.contentArea);
		container.appendChild(mainWrapper);

		this.renderHomeView();
		return container;
	}

	private createHeader(): HTMLElement {
		const header = this.createElement('div', 'backstage-header');
		const backButton = this.createElement('button', 'backstage-back-button') as HTMLButtonElement;
		
		backButton.textContent = '← Back';
		backButton.title = 'Back to document';
		window.L.DomEvent.on(backButton, 'click', () => this.hide(), this);

		header.appendChild(backButton);
		return header;
	}

	private createSidebar(): HTMLElement {
		const sidebar = this.createElement('div', 'backstage-sidebar');
		const tabConfigs = this.getTabsConfig();

		tabConfigs.forEach(config => {
			if (config.visible === false) return;
			
			const tabElement = this.createTabElement(config);
			sidebar.appendChild(tabElement);
		});

		return sidebar;
	}

	private createTabElement(config: BackstageTabConfig): HTMLElement {
		const element = this.createElement('div', 'backstage-sidebar-item');
		element.id = `backstage-${config.id}`;
		
		const label = this.createElement('span');
		label.textContent = config.label;
		element.appendChild(label);
		
		const action = config.type === 'view' 
			? () => this.handleViewTab(config)
			: () => this.handleActionTab(config);
		
		window.L.DomEvent.on(element, 'click', action, this);
		return element;
	}

	private getTabsConfig(): BackstageTabConfig[] {
		return [
			{ id: 'home', label: 'Home', type: 'view', viewType: 'home', visible: true },
			{ id: 'new', label: 'New', type: 'view', viewType: 'templates', visible: true },
			{ id: 'open', label: 'Open', type: 'action', actionType: 'open', visible: true },
			{ id: 'share', label: 'Share', type: 'action', actionType: 'share', visible: this.isFeatureEnabled('share') },
			{ id: 'info', label: 'Info', type: 'view', viewType: 'info', visible: true },
			{ id: 'save', label: 'Save', type: 'action', actionType: 'save', visible: this.isFeatureEnabled('save') },
			{ id: 'saveas', label: 'Save As', type: 'action', actionType: 'saveas', visible: this.isFeatureEnabled('saveAs') },
			{ id: 'print', label: 'Print', type: 'action', actionType: 'print', visible: this.isFeatureEnabled('print') },
			{ id: 'export', label: 'Export', type: 'view', viewType: 'export', visible: true },
		];
	}

	private handleViewTab(config: BackstageTabConfig): void {
		const viewRenderers: Record<string, () => void> = {
			'home': () => this.renderHomeView(),
			'templates': () => this.renderNewView(),
			'info': () => this.renderInfoView(),
			'export': () => this.renderExportView(),
		};

		const renderer = viewRenderers[config.viewType!];
		if (renderer) renderer();
	}

	private handleActionTab(config: BackstageTabConfig): void {
		const actionHandlers: Record<string, () => void> = {
			'open': () => this.executeOpen(),
			'save': () => this.executeSave(),
			'saveas': () => this.executeSaveAs(),
			'print': () => this.executePrint(),
			'share': () => this.executeShare(),
			'repair': () => this.executeRepair(),
			'properties': () => this.executeDocumentProperties(),
			'history': () => this.executeRevisionHistory(),
		};

		const handler = actionHandlers[config.actionType!];
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

		this.addSectionHeader('Recent', 'Recently opened documents will appear here');
	}

	private renderNewView(): void {
		this.setActiveTab('backstage-new');
		this.clearContent();

		this.addSectionHeader('New Document', 'Create a new blank document');

		const templates = this.getTemplatesData();
		const grid = this.createTemplateGrid(templates);
		this.contentArea.appendChild(grid);
	}

	private renderInfoView(): void {
		this.setActiveTab('backstage-info');
		this.clearContent();

		this.addSectionHeader('Document Info', 'Manage document history, repairs, and properties');

		const container = this.createElement('div', 'backstage-info-container');
		
		const actionsColumn = this.createInfoActionsColumn();
		const propertiesColumn = this.createInfoPropertiesColumn();
		
		container.appendChild(actionsColumn);
		container.appendChild(propertiesColumn);
		this.contentArea.appendChild(container);
	}

	private renderExportView(): void {
		this.setActiveTab('backstage-export');
		this.clearContent();

		this.addSectionHeader('Export As', 'Export your document to a different file format');

		const formats = this.getExportFormatsData();
		const grid = this.createExportGrid(formats);
		this.contentArea.appendChild(grid);
	}

	private createTemplateGrid(templates: TemplateData[]): HTMLElement {
		const grid = this.createElement('div', 'backstage-templates-grid');

		templates.forEach(template => {
			const card = this.createTemplateCard(template);
			grid.appendChild(card);
		});

		return grid;
	}

	private createTemplateCard(template: TemplateData): HTMLElement {
		const card = this.createElement('div', 'backstage-template-card');
		
		const name = this.createElement('div', 'template-name');
		name.textContent = template.name;
		card.appendChild(name);
		
		window.L.DomEvent.on(card, 'click', () => this.createNewDocument(), this);
		return card;
	}

	private createExportGrid(formats: ExportFormatData[]): HTMLElement {
		const grid = this.createElement('div', 'backstage-formats-grid');

		formats.forEach(format => {
			const card = this.createExportCard(format);
			grid.appendChild(card);
		});

		return grid;
	}

	private createExportCard(format: ExportFormatData): HTMLElement {
		const card = this.createElement('div', 'backstage-format-card');
		
		const icon = this.createElement('div', 'format-icon');
		icon.textContent = format.name;
		card.appendChild(icon);
		
		const description = this.createElement('div', 'format-description');
		description.textContent = format.description;
		card.appendChild(description);
		
		window.L.DomEvent.on(card, 'click', () => this.exportDocument(format.id), this);
		return card;
	}

	private createInfoActionsColumn(): HTMLElement {
		const column = this.createElement('div', 'backstage-info-actions');

		const historyButton = this.createActionButton('File History', () => this.executeRevisionHistory());
		column.appendChild(historyButton);

		if (this.isFeatureEnabled('repair')) {
			const repairButton = this.createActionButton('Repair Document', () => this.executeRepair());
			column.appendChild(repairButton);
		}

		return column;
	}

	private createInfoPropertiesColumn(): HTMLElement {
		const column = this.createElement('div', 'backstage-info-properties');

		const header = this.createElement('h3', 'backstage-section-header');
		header.textContent = 'Properties';
		column.appendChild(header);

		const button = this.createPrimaryButton('View Properties...', () => this.executeDocumentProperties());
		column.appendChild(button);

		return column;
	}

	private createElement(tag: string, className?: string, id?: string): HTMLElement {
		const element = window.L.DomUtil.create(tag, className || '');
		if (id) element.id = id;
		return element;
	}

	private createActionButton(label: string, onClick: () => void): HTMLButtonElement {
		const button = this.createElement('button', 'backstage-info-button') as HTMLButtonElement;
		button.textContent = label;
		window.L.DomEvent.on(button, 'click', onClick, this);
		return button;
	}

	private createPrimaryButton(label: string, onClick: () => void): HTMLButtonElement {
		const button = this.createElement('button', 'backstage-action-button') as HTMLButtonElement;
		button.textContent = label;
		window.L.DomEvent.on(button, 'click', onClick, this);
		return button;
	}

	private addSectionHeader(title: string, description: string): void {
		const titleElement = this.createElement('h2', 'backstage-content-title');
		titleElement.textContent = title;
		this.contentArea.appendChild(titleElement);

		const descElement = this.createElement('p', 'backstage-content-description');
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
		return [
			{ name: 'Blank Document', type: 'writer' },
			{ name: 'Blank Spreadsheet', type: 'calc' },
			{ name: 'Blank Presentation', type: 'impress' },
		];
	}

	private getExportFormatsData(): ExportFormatData[] {
		return [
			{ id: 'pdf', name: 'PDF', description: 'Portable Document' },
			{ id: 'docx', name: 'DOCX', description: 'Word Document' },
			{ id: 'xlsx', name: 'XLSX', description: 'Excel Spreadsheet' },
			{ id: 'pptx', name: 'PPTX', description: 'PowerPoint' },
			{ id: 'odt', name: 'ODT', description: 'OpenDocument Text' },
			{ id: 'ods', name: 'ODS', description: 'OpenDocument Spreadsheet' },
			{ id: 'odp', name: 'ODP', description: 'OpenDocument Presentation' },
		];
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

	private createNewDocument(): void {
		window.postMobileMessage('uno .uno:Open');
		this.hide();
	}

	private exportDocument(format: string): void {
		if (this.map && this.map.downloadAs) {
			this.map.downloadAs('document', format, '', 'export');
		}
		this.hide();
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
		this.renderHomeView();
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
}

window.L.Control.BackstageView = BackstageView;


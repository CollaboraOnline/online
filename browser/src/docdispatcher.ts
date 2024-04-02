/* global Proxy _ */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* global app _ */

// app.dispatcher.dispatch() will be used to call some actions so we can share the code

class Dispatcher {
	private actionsMap: any = {};

	private addGeneralCommands() {
		this.actionsMap['save'] = function () {
			// Save only when not read-only.
			if (!app.map.isReadOnlyMode()) {
				app.map.fire('postMessage', {
					msgId: 'UI_Save',
					args: { source: 'toolbar' },
				});
				if (!app.map._disableDefaultAction['UI_Save']) {
					app.map.save(
						false /* An explicit save should terminate cell edit */,
						false /* An explicit save should save it again */,
					);
				}
			}
		};

		this.actionsMap['userlist'] = () => {
			if (app.map.userList) app.map.userList.openDropdown();
		};

		this.actionsMap['print'] = function () {
			app.map.print();
		};

		this.actionsMap['remotelink'] = function () {
			app.map.fire('postMessage', { msgId: 'UI UI_PickLink' });
		};
		// TODO: deduplicate
		this.actionsMap['hyperlinkdialog'] = function () {
			app.map.showHyperlinkDialog();
		};
		this.actionsMap['inserthyperlink'] = () => {
			if (app.map.getDocType() == 'spreadsheet')
				app.map.sendUnoCommand('.uno:HyperlinkDialog');
			else app.map.showHyperlinkDialog();
		};
		this.actionsMap['rev-history'] = function () {
			app.map.openRevisionHistory();
		};
		this.actionsMap['shareas'] = function () {
			app.map.openShare();
		};

		this.actionsMap['savecomments'] = function () {
			if (app.isCommentEditingAllowed()) {
				app.map.fire('postMessage', { msgId: 'UI_Save' });
				if (!app.map._disableDefaultAction['UI_Save']) {
					app.map.save(false, false);
				}
			}
		};

		this.actionsMap['charmapcontrol'] = function () {
			app.map.sendUnoCommand('.uno:InsertSymbol');
		};
		this.actionsMap['closetablet'] = function () {
			app.map.uiManager.enterReadonlyOrClose();
		};

		this.actionsMap['comment_wizard'] = function () {
			const configuration = window as any;
			if (configuration.commentWizard) {
				configuration.commentWizard = false;
				app.sectionContainer
					.getSectionWithName(L.CSections.CommentList.name)
					.removeHighlighters();
				app.map.fire('closemobilewizard');
				//app.map.mobileTopBar.uncheck(id);
			} else {
				if (configuration.insertionMobileWizard)
					app.dispatcher.dispatch('insertion_mobile_wizard');
				else if (configuration.mobileWizard)
					app.dispatcher.dispatch('mobile_wizard');
				configuration.commentWizard = true;
				var menuData = app.map._docLayer.getCommentWizardStructure();
				app.map.fire('mobilewizard', { data: menuData });
				//app.map.mobileTopBar.check(id);
			}
		};
		this.actionsMap['mobile_wizard'] = () => {
			const configuration = window as any;
			if (configuration.mobileWizard) {
				configuration.mobileWizard = false;
				app.map.sendUnoCommand('.uno:SidebarHide');
				app.map.fire('closemobilewizard');
				//app.map.mobileTopBar.uncheck(id);
			} else {
				if (configuration.insertionMobileWizard)
					app.dispatcher.dispatch('insertion_mobile_wizard');
				else if (configuration.commentWizard)
					app.dispatcher.dispatch('comment_wizard');
				configuration.mobileWizard = true;
				app.map.sendUnoCommand('.uno:SidebarShow');
				app.map.fire('showwizardsidebar');
				//app.map.mobileTopBar.check(id);
			}
		};
		this.actionsMap['insertion_mobile_wizard'] = () => {
			const configuration = window as any;
			if (configuration.insertionMobileWizard) {
				configuration.insertionMobileWizard = false;
				app.map.fire('closemobilewizard');
				//app.map.mobileTopBar.uncheck(id);
			} else {
				if (configuration.mobileWizard)
					app.dispatcher.dispatch('mobile_wizard');
				else if (configuration.commentWizard)
					app.dispatcher.dispatch('comment_wizard');
				configuration.insertionMobileWizard = true;
				const menuData = app.map.menubar.generateInsertMenuStructure();
				app.map.fire('mobilewizard', { data: menuData });
				//app.map.mobileTopBar.check(id);
			}
		};

		this.actionsMap['toggledarktheme'] = function () {
			app.map.uiManager.toggleDarkMode();
		};
		this.actionsMap['home-search'] = function () {
			app.map.uiManager.focusSearch();
		};
		this.actionsMap['renamedocument'] = function () {
			app.map.uiManager.renameDocument();
		};
		this.actionsMap['togglewasm'] = function () {
			app.map.uiManager.toggleWasm();
		};

		this.actionsMap['languagemenu'] = function () {
			app.map.fire('morelanguages');
		};
		this.actionsMap['morelanguages-selection'] = function () {
			app.map.fire('morelanguages', { applyto: 'selection' });
		};
		this.actionsMap['morelanguages-paragraph'] = function () {
			app.map.fire('morelanguages', { applyto: 'paragraph' });
		};
		this.actionsMap['morelanguages-all'] = function () {
			app.map.fire('morelanguages', { applyto: 'all' });
		};
		this.actionsMap['localgraphic'] = function () {
			L.DomUtil.get('insertgraphic').click();
		};
		this.actionsMap['remotegraphic'] = function () {
			app.map.fire('postMessage', { msgId: 'UI_InsertGraphic' });
		};

		this.actionsMap['showhelp'] = function () {
			app.map.showHelp('online-help-content');
		};

		this.actionsMap['focustonotebookbar'] = function () {
			const tabsContainer = document.getElementsByClassName(
				'notebookbar-tabs-container',
			)[0].children[0];
			let elementToFocus: HTMLButtonElement;
			if (tabsContainer) {
				for (let i = 0; i < tabsContainer.children.length; i++) {
					if (tabsContainer.children[i].classList.contains('selected')) {
						elementToFocus = tabsContainer.children[i] as HTMLButtonElement;
						break;
					}
				}
			}
			if (!elementToFocus)
				elementToFocus = document.getElementById(
					'Home-tab-label',
				) as HTMLButtonElement;

			elementToFocus.focus();
		};

		this.actionsMap['saveas'] = function () {
			if (app.map && app.map.uiManager.getCurrentMode() === 'notebookbar') {
				app.map.openSaveAs(); // Opens save as dialog if integrator supports it.
			}
		};

		this.actionsMap['insertcomment'] = function () {
			app.map.insertComment();
		};

		this.actionsMap['zoomin'] = () => {
			app.map.zoomIn(1, null, true /* animate? */);
		};
		this.actionsMap['zoomout'] = () => {
			app.map.zoomOut(1, null, true /* animate? */);
		};
		this.actionsMap['zoomreset'] = () => {
			app.map.setZoom(app.map.options.zoom);
		};

		this.actionsMap['searchprev'] = () => {
			app.map.search(L.DomUtil.get('search-input').value, true);
		};
		this.actionsMap['searchnext'] = () => {
			app.map.search(L.DomUtil.get('search-input').value);
		};
		this.actionsMap['cancelsearch'] = () => {
			app.map.cancelSearch();
		};

		this.actionsMap['prev'] = () => {
			if (app.map._docLayer._docType === 'text') app.map.goToPage('prev');
			else app.map.setPart('prev');
		};
		this.actionsMap['next'] = () => {
			if (app.map._docLayer._docType === 'text') app.map.goToPage('next');
			else app.map.setPart('next');
		};

		this.actionsMap['inserttextbox'] = () => {
			app.map.sendUnoCommand('.uno:Text?CreateDirectly:bool=true');
		};
		this.actionsMap['insertannotation'] = () => {
			app.map.insertComment();
		};
	}

	private addExportCommands() {
		this.actionsMap['exportpdf'] = function () {
			app.map.sendUnoCommand('.uno:ExportToPDF', {
				SynchronMode: {
					type: 'boolean',
					value: false,
				},
			});
		};

		this.actionsMap['exportdirectpdf'] = function () {
			app.map.sendUnoCommand('.uno:ExportDirectToPDF', {
				SynchronMode: {
					type: 'boolean',
					value: false,
				},
			});
		};

		this.actionsMap['exportepub'] = function () {
			app.map.sendUnoCommand('.uno:ExportToEPUB', {
				SynchronMode: {
					type: 'boolean',
					value: false,
				},
			});
		};
	}

	private addCalcCommands() {
		this.actionsMap['acceptformula'] = function () {
			if (window.mode.isMobile()) {
				app.map.focus();
				app.map._docLayer.postKeyboardEvent(
					'input',
					app.map.keyboard.keyCodes.enter,
					app.map.keyboard._toUNOKeyCode(app.map.keyboard.keyCodes.enter),
				);
			} else {
				app.map.sendUnoCommand('.uno:AcceptFormula');
			}

			app.map.onFormulaBarBlur();
			app.map.formulabarBlur();
			app.map.formulabarSetDirty();
		};

		this.actionsMap['cancelformula'] = function () {
			app.map.sendUnoCommand('.uno:Cancel');
			app.map.onFormulaBarBlur();
			app.map.formulabarBlur();
			app.map.formulabarSetDirty();
		};

		this.actionsMap['startformula'] = function () {
			app.map.sendUnoCommand('.uno:StartFormula');
			app.map.onFormulaBarFocus();
			app.map.formulabarFocus();
			app.map.formulabarSetDirty();
		};

		this.actionsMap['functiondialog'] = function () {
			if (window.mode.isMobile() && app.map._functionWizardData) {
				app.map._docLayer._closeMobileWizard();
				app.map._docLayer._openMobileWizard(app.map._functionWizardData);
				app.map.formulabarSetDirty();
			} else {
				app.map.sendUnoCommand('.uno:FunctionDialog');
			}
		};

		this.actionsMap['print-active-sheet'] = function () {
			const currentSheet = app.map._docLayer._selectedPart + 1;
			const options = {
				ExportFormFields: {
					type: 'boolean',
					value: false,
				},
				ExportNotes: {
					type: 'boolean',
					value: false,
				},
				SheetRange: {
					type: 'string',
					value: currentSheet + '-' + currentSheet,
				},
			};
			const optionsString = JSON.stringify(options);
			app.map.print(optionsString);
		};

		this.actionsMap['print-all-sheets'] = function () {
			app.map.print();
		};
		this.actionsMap['togglerelative'] = function () {
			app.map.sendUnoCommand('.uno:ToggleRelative');
		};
		this.actionsMap['focusonaddressinput'] = function () {
			document.getElementById('addressInput').focus();
		};

		// sheets toolbar
		this.actionsMap['insertsheet'] = function () {
			var nPos = $('#spreadsheet-tab-scroll')[0].childElementCount;
			app.map.insertPage(nPos);
			app.map.insertPage.scrollToEnd = true;
		};
		this.actionsMap['firstrecord'] = function () {
			$('#spreadsheet-tab-scroll').scrollLeft(0);
		};
		this.actionsMap['nextrecord'] = function () {
			// TODO: We should get visible tab's width instead of 60px
			$('#spreadsheet-tab-scroll').scrollLeft(
				$('#spreadsheet-tab-scroll').scrollLeft() + 60,
			);
		};
		this.actionsMap['prevrecord'] = function () {
			$('#spreadsheet-tab-scroll').scrollLeft(
				$('#spreadsheet-tab-scroll').scrollLeft() - 30,
			);
		};
		this.actionsMap['lastrecord'] = function () {
			// Set a very high value, so that scroll is set to the maximum possible value internally.
			// https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollLeft
			L.DomUtil.get('spreadsheet-tab-scroll').scrollLeft = 100000;
		};
	}

	private addImpressAndDrawCommands() {
		this.actionsMap['presentation'] = function () {
			app.map.fire('fullscreen');
		};
		this.actionsMap['fullscreen-drawing'] = () => {
			L.toggleFullScreen();
		};
		this.actionsMap['fullscreen-presentation'] = () => {
			app.map.fire('fullscreen');
		};
		this.actionsMap['presentinwindow'] = function () {
			app.map.fire('presentinwindow');
		};

		this.actionsMap['deletepage'] = function () {
			let msg: string;
			if (app.map.getDocType() === 'presentation') {
				msg = _('Are you sure you want to delete this slide?');
			} else {
				/* drawing */
				msg = _('Are you sure you want to delete this page?');
			}
			app.map.uiManager.showInfoModal(
				'deleteslide-modal',
				_('Delete'),
				msg,
				'',
				_('OK'),
				function () {
					app.map.deletePage();
				},
				true,
				'deleteslide-modal-response',
			);
		};

		this.actionsMap['previouspart'] = function () {
			app.map._docLayer._preview._scrollViewByDirection('prev');
			if (app.file.fileBasedView) app.map._docLayer._checkSelectedPart();
		};

		this.actionsMap['nextpart'] = function () {
			app.map._docLayer._preview._scrollViewByDirection('next');
			if (app.file.fileBasedView) app.map._docLayer._checkSelectedPart();
		};

		this.actionsMap['lastpart'] = function () {
			if (app && app.file.fileBasedView === true) {
				const partToSelect = app.map._docLayer._parts - 1;
				app.map._docLayer._preview._scrollViewToPartPosition(partToSelect);
				app.map._docLayer._checkSelectedPart();
			}
		};

		this.actionsMap['firstpart'] = function () {
			if (app && app.file.fileBasedView === true) {
				const partToSelect = 0;
				app.map._docLayer._preview._scrollViewToPartPosition(partToSelect);
				app.map._docLayer._checkSelectedPart();
			}
		};

		this.actionsMap['hideslide'] = function () {
			app.map.hideSlide();
		};
		this.actionsMap['showslide'] = function () {
			app.map.showSlide();
		};
		this.actionsMap['duplicatepage'] = function () {
			app.map.duplicatePage();
		};
		this.actionsMap['insertpage'] = function () {
			app.map.insertPage();
		};

		this.actionsMap['leftpara'] = function () {
			app.map.sendUnoCommand(
				(window as any).getUNOCommand({
					textCommand: '.uno:LeftPara',
					objectCommand: '.uno:ObjectAlignLeft',
					unosheet: '.uno:AlignLeft',
				}),
			);
		};
		this.actionsMap['centerpara'] = function () {
			app.map.sendUnoCommand(
				(window as any).getUNOCommand({
					textCommand: '.uno:CenterPara',
					objectCommand: '.uno:AlignCenter',
					unosheet: '.uno:AlignHorizontalCenter',
				}),
			);
		};
		this.actionsMap['rightpara'] = function () {
			app.map.sendUnoCommand(
				(window as any).getUNOCommand({
					textCommand: '.uno:RightPara',
					objectCommand: '.uno:ObjectAlignRight',
					unosheet: '.uno:AlignRight',
				}),
			);
		};
	}

	private addZoteroCommands() {
		this.actionsMap['zoteroaddeditcitation'] = function () {
			app.map.zotero.handleItemList();
		};
		this.actionsMap['zoterosetdocprefs'] = function () {
			app.map.zotero.handleStyleList();
		};
		this.actionsMap['zoteroaddeditbibliography'] = function () {
			app.map.zotero.insertBibliography();
		};
		this.actionsMap['zoteroaddnote'] = function () {
			app.map.zotero.handleInsertNote();
		};
		this.actionsMap['zoterorefresh'] = function () {
			app.map.zotero.refreshCitationsAndBib();
		};
		this.actionsMap['zoterounlink'] = function () {
			app.map.zotero.unlinkCitations();
		};
	}

	private addWriterCommands() {
		this.actionsMap['.uno:ShowResolvedAnnotations'] = function () {
			const items = app.map['stateChangeHandler'];
			let val = items.getItemValue('.uno:ShowResolvedAnnotations');
			val = val === 'true' || val === true;
			app.map.showResolvedComments(!val);
		};

		this.actionsMap['.uno:AcceptAllTrackedChanges'] = function () {
			app.map.sendUnoCommand('.uno:AcceptAllTrackedChanges');
			app.socket.sendMessage('commandvalues command=.uno:ViewAnnotations');
		};

		this.actionsMap['.uno:RejectAllTrackedChanges'] = function () {
			app.map.sendUnoCommand('.uno:RejectAllTrackedChanges');
			const commentSection = app.sectionContainer.getSectionWithName(
				L.CSections.CommentList.name,
			);
			commentSection.rejectAllTrackedCommentChanges();
		};
	}

	constructor() {
		this.addGeneralCommands();
		this.addExportCommands();

		if (app.map._docLayer._docType === 'text') {
			this.addWriterCommands();
			this.addZoteroCommands();
		} else if (app.map._docLayer._docType === 'spreadsheet') {
			this.addCalcCommands();
		} else if (
			['presentation', 'drawing'].includes(app.map._docLayer._docType)
		) {
			this.addImpressAndDrawCommands();
		}
	}

	public dispatch(action: string) {
		// Don't allow to execute new actions while any dialog is visible.
		// It prevents launching multiple instances of the same dialog.
		if (
			app.map.dialog.hasOpenedDialog() ||
			(app.map.jsdialog && app.map.jsdialog.hasDialogOpened())
		) {
			app.map.dialog.blinkOpenDialog();
			console.debug('Cannot dispatch: ' + action + ' when dialog is opened.');
			return;
		}

		if (action.indexOf('saveas-') === 0) {
			const format = action.substring('saveas-'.length);
			app.map.openSaveAs(format);
			return;
		} else if (action.indexOf('downloadas-') === 0) {
			const format = action.substring('downloadas-'.length);
			let fileName = app.map['wopi'].BaseFileName;
			fileName = fileName.substr(0, fileName.lastIndexOf('.'));
			fileName = fileName === '' ? 'document' : fileName;
			app.map.downloadAs(fileName + '.' + format, format);
			return;
		}

		if (action.indexOf('exportas-') === 0) {
			const format = action.substring('exportas-'.length);
			app.map.openSaveAs(format);
			return;
		}

		if (
			action === '.uno:Copy' ||
			action === '.uno:Cut' ||
			action === '.uno:Paste' ||
			action === '.uno:PasteSpecial'
		) {
			app.map._clip.filterExecCopyPaste(action);
		}

		if (this.actionsMap[action] !== undefined) {
			this.actionsMap[action]();
			return;
		}

		console.error('unknown dispatch: "' + action + '"');
	}
}

app.definitions['dispatcher'] = Dispatcher;

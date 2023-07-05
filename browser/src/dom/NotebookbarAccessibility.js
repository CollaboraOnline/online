/* -*- js-indent-level: 8 -*- */
/*
	This class is used for managing the accessibility keys of notebookbar control.
*/

/* global app NotebookbarAccessibilityDefinitions */

/*
	This class relies on following id convention (example for "Home" tab):
		* Tab button id: "Home-etc..."
		* Tab content container id: "Home-container"
*/
var NotebookbarAccessibility = function() {

	this.initialized = false;

	this.activeTabPointers = {
		id: '',
		contentList: [],
		infoBoxList: []
	},

	this.definitions = new NotebookbarAccessibilityDefinitions();
	this.tabInfoList = null; // This is to be fetched from NotebookbarAccessibilityDefinitions class at initialization.
	this.combination = null;
	this.filteredItem = null;
	this.state = 0; // 0: User needs to select a tab. 1: User needs to either select an acccess key of tab content or navigate by arrow keys.

	this.addInfoBox = function(anchorElement) {
		var infoBox = document.createElement('div');
		infoBox.classList.add('accessibility-info-box');
		infoBox.textContent = anchorElement.accessKey;
		var rectangle = anchorElement.getBoundingClientRect();
		infoBox.style.top = (rectangle.top + 20) + 'px';
		infoBox.style.left = rectangle.left + 'px';
		document.body.appendChild(infoBox);

		return infoBox;
	};

	// Checks the current tab's content.
	this.getElementOfWhichIdStartsWith = function(id) {
		var tab = document.getElementById(this.activeTabPointers.id.split('-')[0] + '-container');

		if (tab) {
			var element = tab.querySelector('[id^="' + id + '"]');

			if (!element || element.length === 0)
				return null;
			if (element.length && element.length > 1) {
				console.warn('NotebookbarAccessibility: Multiple elements inside the same tab with the same functionality.');
				return null;
			}
			else
				return element;
		}
		else {
			console.warn('Couldn\t find element: ' + id.split()[0] + '-container');
			return null;
		}
	};

	this.setupAcceleratorsForCurrentTab = function(id) {
		if (id === undefined)
			id = this.activeTabPointers.id;

		this.removeAllInfoBoxes();

		this.activeTabPointers.id = id;
		this.activeTabPointers.contentList = this.tabInfoList[id].contentList;
		this.activeTabPointers.infoBoxList = [];

		for (var i = 0; i < this.activeTabPointers.contentList.length; i++) {
			var element = this.getElementOfWhichIdStartsWith(this.activeTabPointers.contentList[i].id);
			if (element) {
				this.activeTabPointers.contentList[i].id = element.id; // Change the stored id so we can use getElementById from now.
				element.accessKey = this.activeTabPointers.contentList[i].combination;
				this.activeTabPointers.infoBoxList.push(this.addInfoBox(element));
			}
			else
				console.warn('NotebookbarAccessibility: Element with id ' + this.activeTabPointers.contentList[i].id + ' doesn\'t exist.');
		}
	};

	/*
		We want to show the accelerator info boxes if no JSDialog is open.
		When a JSDialog is open, we will underline the accelerator keys of the dialog.
	*/
	this.mayShowAcceleratorInfoBoxes = false;
	this.onDocumentKeyDown = function(event) {
		if (this.initialized) {
			if (app.map && app.map.jsdialog && app.map.jsdialog.hasDialogOpened()) {
				if (event.keyCode === 18)
					document.body.classList.add('activate-underlines');
			}
			else if (event.keyCode === 18 || (event.keyCode === 18 && event.shiftKey)) {
				this.mayShowAcceleratorInfoBoxes = true;
			}
		}
	};

	this.onDocumentKeyUp = function(event) {
		if (this.initialized) {
			if (app.map && app.map.jsdialog && app.map.jsdialog.hasDialogOpened()) {
				if (event.keyCode === 18)
					document.body.classList.remove('activate-underlines');
			}
			else if (this.mayShowAcceleratorInfoBoxes && (event.keyCode === 18 || (event.keyCode === 18 && event.shiftKey))) { // 18: Alt key.
				this.resetState();
				this.addTabAccelerators();
				this.accessibilityInputElement.focus();
			}
			else if (event.keyCode === 16) // ShiftLeft.
				return; // Ignore shift key.
			else {
				this.resetState();
			}
		}
	};

	this.onInputFocus = function() {
		document.body.classList.add('activate-info-boxes');
	};

	this.onInputBlur = function() {
		document.body.classList.remove('activate-info-boxes');
		app.map._textInput._abortComposition({ type: 'Notebookbar Accessibility' });
	};

	this.isAllFilteredOut = function() {
		var count = document.querySelectorAll('.accessibility-info-box:not(.filtered_out)');
		count = count.length;
		return count === 0;
	};

	this.filterOutNonMatchingInfoBoxes = function() {
		var keyList = document.getElementsByClassName('accessibility-info-box');

		for (var i = 0; i < keyList.length; i++)
			keyList[i].classList.remove('filtered_out');

		if (this.combination !== null) {
			for (var i = 0; i < keyList.length; i++) {
				if (!keyList[i].textContent.startsWith(this.combination))
					keyList[i].classList.add('filtered_out');
			}
		}
	};

	this.checkTabAccelerators = function() {
		for (var tabId in this.tabInfoList) {
			if (Object.prototype.hasOwnProperty.call(this.tabInfoList, tabId)) {
				var element = document.getElementById(tabId);
				if (element && !element.classList.contains('hidden')) {
					if (this.tabInfoList[tabId].combination === this.combination) {
						this.filteredItem = this.tabInfoList[tabId];
						this.filteredItem.id = tabId;
						break;
					}
				}
			}
		}
	};

	this.checkContentAccelerators = function() {
		for (var i = 0; i < this.activeTabPointers.contentList.length; i++) {
			var item = this.activeTabPointers.contentList[i];
			if (this.combination === item.combination) {
				this.filteredItem = this.activeTabPointers.contentList[i];
				break;
			}
		}
	};

	this.checkCombinationAgainstAcccelerators = function() {
		this.filteredItem = null;

		if (this.state === 0)
			this.checkTabAccelerators();
		else if (this.state === 1)
			this.checkContentAccelerators();
	};

	this.clickOnFilteredItem = function() {
		if (this.filteredItem !== null) {
			var element = document.getElementById(this.filteredItem.id);
			if (element) {
				element.click();

				if (this.state === 0) {
					this.setupAcceleratorsForCurrentTab(element.id);
					this.combination = null;
					this.accessibilityInputElement.value = '';
					this.accessibilityInputElement.focus();
					this.state = 1;
				}
				else if (this.filteredItem.focusBack === true) {
					app.map.focus();
				}
			}
			this.filteredItem = null;
		}
		else
			app.map.focus();
	};

	this.resetState = function() {
		this.removeAllInfoBoxes();
		this.state = 0;
		this.accessibilityInputElement.value = '';
		this.combination = null;
		this.mayShowAcceleratorInfoBoxes = false;
		this.filteredItem = null;
	};

	this.onInputKeyUp = function(event) {
		var key = event.key.toUpperCase();
		event.preventDefault();
		event.stopPropagation();

		if (key === 'ESCAPE' || key === 'ALT') {
			if (this.combination === null)
				app.map.focus();
			else {
				this.resetState();
			}
		}
		else if (key === 'ENTER' || key === ' ') {
			if (this.filteredItem !== null)
				this.clickOnFilteredItem();
			else
				app.map.focus();
		}
		else if (event.keyCode === 16) // ShiftLeft.
			return; // Ignore shift key.
		else if (key === 'ARROWUP') {
			// Try to set focus on tab button.
			if (this.activeTabPointers.id)
				document.getElementById(this.activeTabPointers.id).focus();
		}
		else if (key === 'ARROWDOWN') {
			// Try to set focus on the first button of the tab content.
			if (this.activeTabPointers.contentList.length > 0) {
				for (var i = 0; i < this.activeTabPointers.contentList.length; i++) {
					var element = document.getElementById(this.activeTabPointers.contentList[i].id);
					if (element.tabIndex >= 0) {
						element.focus();
						break;
					}
				}
			}
		}
		else {
			if (this.combination === null) {
				this.combination = key;
				this.checkCombinationAgainstAcccelerators();
				this.filterOutNonMatchingInfoBoxes();
			}
			else {
				this.combination += key;
				this.checkCombinationAgainstAcccelerators();
				this.filterOutNonMatchingInfoBoxes();
			}

			// So we checked the pressed key against available combinations. If there is no match, focus back to map.
			if (this.isAllFilteredOut() === true)
				app.map.focus();
		}
	};

	this.removeAllInfoBoxes = function() {
		var infoBoxes = document.getElementsByClassName('accessibility-info-box');
		for (var i = infoBoxes.length - 1; i > -1; i--) {
			document.body.removeChild(infoBoxes[i]);
		}
	};

	this.addTabAccelerators = function() {
		// Remove all info boxes first.
		this.removeAllInfoBoxes();

		for (var tabId in this.tabInfoList) {
			if (Object.prototype.hasOwnProperty.call(this.tabInfoList, tabId)) {
				var element = document.getElementById(tabId);
				if (element && !element.classList.contains('hidden')) {
					element.accessKey = this.tabInfoList[tabId].combination;
					this.addInfoBox(element);
				}
			}
		}
	};

	this.initTabListeners = function() {
		Object.keys(this.tabInfoList).forEach(function(tabId) {
			var element = document.getElementById(tabId);
			if (element) {
				element.addEventListener('click', function() {
					if (this.activeTabPointers.id !== element.id) {
						this.setupAcceleratorsForCurrentTab(element.id);
					}
				}.bind(this));
			}
		}.bind(this));
	};

	this.initAccessibilityInputElement = function() {
		// Create an input element for catching the events and prevent document from catching them.
		this.accessibilityInputElement = document.createElement('input');
		this.accessibilityInputElement.style.width = this.accessibilityInputElement.style.height = '0';
		this.accessibilityInputElement.id = 'accessibilityInputElement';
		this.accessibilityInputElement.onfocus = this.onInputFocus.bind(this);
		this.accessibilityInputElement.onblur = this.onInputBlur.bind(this);
		this.accessibilityInputElement.onkeyup = this.onInputKeyUp.bind(this);

		var container = document.createElement('div');
		container.style.width = container.style.height = '0';
		container.style.overflow = 'hidden';
		container.appendChild(this.accessibilityInputElement);

		document.body.appendChild(container);
	};

	this.initialize = function() {
		setTimeout(function() {
			if (window.mode.isDesktop()) {
				if (document.body.dataset.userinterfacemode === 'notebookbar') {
					this.tabInfoList = this.definitions.getDefinitions();

					if (this.tabInfoList !== null) {
						this.initTabListeners();
						this.initAccessibilityInputElement();
						this.initialized = true;
					}
				}
			}
		}.bind(this), 3000);
	};
};

app.definitions.NotebookbarAccessibility = NotebookbarAccessibility;

app.UI.notebookbarAccessibility = new app.definitions.NotebookbarAccessibility();

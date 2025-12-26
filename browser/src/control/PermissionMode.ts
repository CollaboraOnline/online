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
 * Permission View Mode Dropdown (Viewing / Editing)
 * Compatible with Collabora Online build system (no imports)
 */

class PermissionViewMode {
	map: any;

	viewModeDropdown: HTMLElement | null = null;
	viewModeToggle: HTMLElement | null = null;
	viewModeMenu: HTMLElement | null = null;
	viewModeCurrentLabel: HTMLElement | null = null;
	readonlyIndicator: HTMLElement | null = null;

	constructor(map: any) {
		this.map = map;
	}

	init(): void {
		app.layoutingService.appendLayoutingTask(() => {
			const root = document.getElementById('viewMode');
			if (!root) return;

			root.innerHTML = '';

			this.readonlyIndicator = document.createElement('div');
			this.readonlyIndicator.id = 'readonlyMode';
			this.readonlyIndicator.className =
				'unotoolbutton notebookbar ui-content unospan readonly inline hidden';
			this.readonlyIndicator.tabIndex = -1;

			const roLabel = document.createElement('span');
			roLabel.className = 'ui-content unolabel';
			roLabel.textContent = _('Read-only');

			this.readonlyIndicator.appendChild(roLabel);
			root.appendChild(this.readonlyIndicator);

			// Tooltip (same treatment as before)
			this.readonlyIndicator.setAttribute('data-cooltip', _('Permission Mode'));
			window.L.control.attachTooltipEventListener(
				this.readonlyIndicator,
				this.map,
			);

			this.viewModeDropdown = document.createElement('div');
			this.viewModeDropdown.id = 'viewModeDropdown';
			this.viewModeDropdown.className = 'viewmode-dropdown hidden';
			this.viewModeDropdown.setAttribute('aria-hidden', 'true');

			this.viewModeToggle = document.createElement('div');
			this.viewModeToggle.id = 'viewModeToggle';
			this.viewModeToggle.className =
				'unotoolbutton notebookbar ui-content inline';
			this.viewModeToggle.setAttribute('aria-haspopup', 'true');
			this.viewModeToggle.setAttribute('aria-expanded', 'false');
			this.viewModeToggle.title = _('Permission Mode');

			this.viewModeCurrentLabel = document.createElement('span');
			this.viewModeCurrentLabel.id = 'viewModeCurrentLabel';
			this.viewModeCurrentLabel.className = 'ui-content unolabel';
			this.viewModeCurrentLabel.textContent = _('Viewing');

			const arrow = document.createElement('div');
			arrow.className = 'arrowbackground';
			arrow.setAttribute('aria-hidden', 'true');
			arrow.tabIndex = -1;

			const arrowIcon = document.createElement('i');
			arrowIcon.className = 'unoarrow';
			arrow.appendChild(arrowIcon);

			this.viewModeToggle.appendChild(this.viewModeCurrentLabel);
			this.viewModeToggle.appendChild(arrow);

			this.viewModeDropdown.appendChild(this.viewModeToggle);

			this.viewModeMenu = document.createElement('div');
			this.viewModeMenu.id = 'viewModeMenu';
			this.viewModeMenu.className = 'viewmode-menu hidden';

			const optView = document.createElement('div');
			optView.className = 'viewmode-option';
			optView.dataset.mode = 'view';
			optView.textContent = _('Viewing Mode');

			const optEdit = document.createElement('div');
			optEdit.className = 'viewmode-option';
			optEdit.dataset.mode = 'edit';
			optEdit.textContent = _('Editing Mode');

			this.viewModeMenu.appendChild(optView);
			this.viewModeMenu.appendChild(optEdit);

			this.viewModeDropdown.appendChild(this.viewModeMenu);

			// Add dropdown to root
			root.appendChild(this.viewModeDropdown);

			this.attachHandlers();

			app.events.on('updatepermission', this.updateReadonlyIndicator.bind(this));
		});
	}

	attachHandlers(): void {
		const caret = this.viewModeToggle?.querySelector('.arrowbackground');

		caret?.addEventListener('click', (e) => {
			e.stopPropagation();
			this.toggleMenu();
		});

		this.viewModeCurrentLabel?.addEventListener('click', (e) => {
			e.stopPropagation();
		});

		this.viewModeMenu?.querySelectorAll('.viewmode-option').forEach((opt) => {
			opt.addEventListener('click', (e) => {
				const mode = (e.target as HTMLElement).dataset.mode || 'view';
				this.handleModeSelection(mode);
			});
		});

		document.addEventListener('click', (e) => {
			if (!this.viewModeDropdown?.contains(e.target as Node)) {
				this.closeMenu();
			}
		});
	}

	toggleMenu(): void {
		if (!this.viewModeMenu || !this.viewModeToggle) return;

		const open = this.viewModeMenu.classList.toggle('hidden') === false;

		this.viewModeToggle.classList.toggle('menu-open', open);
		this.viewModeToggle.setAttribute('aria-expanded', open ? 'true' : 'false');

		if (open) {
			// Boundary checks
			const menuRect = this.viewModeMenu.getBoundingClientRect();
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;

			if (menuRect.right > viewportWidth) {
				this.viewModeMenu.style.left = `${viewportWidth - menuRect.width}px`;
			}
			if (menuRect.bottom > viewportHeight) {
				this.viewModeMenu.style.top = `${viewportHeight - menuRect.height}px`;
			}
		}
	}

	closeMenu(): void {
		if (!this.viewModeMenu || !this.viewModeToggle) return;

		this.viewModeMenu.classList.add('hidden');
		this.viewModeToggle.classList.remove('menu-open');
		this.viewModeToggle.setAttribute('aria-expanded', 'false');
	}

	show(): void {
		if (!this.viewModeDropdown) return;

		this.viewModeDropdown.classList.remove('hidden');
		this.viewModeDropdown.setAttribute('aria-hidden', 'false');
		this.closeMenu();
	}

	hide(): void {
		if (!this.viewModeDropdown) return;

		this.viewModeDropdown.classList.add('hidden');
		this.viewModeDropdown.setAttribute('aria-hidden', 'true');
		this.closeMenu();
	}

	/** Handle user selecting Viewing / Editing */
	handleModeSelection(mode: string): void {
		// Skip if already in the requested mode
		const currentPermission = this.map._permission;
		if (
			(mode === 'edit' && currentPermission === 'edit') ||
			(mode === 'view' && currentPermission === 'readonly')
		) {
			this.closeMenu();
			return;
		}

		if (mode === 'edit') {
			if (typeof this.map._switchToEditMode === 'function')
				this.map._switchToEditMode();
			else this.map.setPermission('edit');

			if (this.viewModeCurrentLabel)
				this.viewModeCurrentLabel.textContent = _('Editing');

			this.closeMenu();
			return;
		}

		if (this.viewModeCurrentLabel) {
			this.viewModeCurrentLabel.textContent = _('Viewing');
			this.map.setPermission('readonly');
		}

		this.closeMenu();
	}

	/**
	 * Updates visibility of the Read-only badge/button in the top toolbar.
	 */
	updateReadonlyIndicator(): void {
		app.layoutingService.appendLayoutingTask(() => {
			if (!this.readonlyIndicator) return;

			if (this.map.isEditMode && this.map.isEditMode()) {
				this.readonlyIndicator.classList.add('hidden');
				this.show();

				if (this.viewModeCurrentLabel) {
					this.viewModeCurrentLabel.textContent = _('Editing');
				}
				return;
			}

			if (
				app.file.permission === 'edit' &&
				this.map._shouldStartReadOnly &&
				this.map._shouldStartReadOnly()
			) {
				this.readonlyIndicator.classList.add('hidden');
				this.show();

				if (this.viewModeCurrentLabel)
					this.viewModeCurrentLabel.textContent = _('Viewing');
				return;
			}

			if (app.file.permission === 'readonly') {
				// Determine if this is "forced" readonly (locked/no write access) or "soft" readonly (user toggled)
				// If user has write access but is in readonly mode, show the dropdown.
				var userCanWrite = this.map['wopi'] && this.map['wopi'].UserCanWrite;

				if (userCanWrite) {
					this.readonlyIndicator.classList.add('hidden');
					this.show();
					if (this.viewModeCurrentLabel)
						this.viewModeCurrentLabel.textContent = _('Viewing');
				} else {
					this.readonlyIndicator.classList.remove('hidden');
					this.hide();
				}
			} else {
				this.readonlyIndicator.classList.add('hidden');
				this.show();
			}
		});
	}
}

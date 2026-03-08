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

class FormulaErrorHelpSection extends HTMLObjectSection {
	static sectionName = 'formula error help button';

	constructor(documentPosition: cool.SimplePoint) {
		super(
			app.CSections.FormulaErrorHelpButton.name,
			null as unknown as number,
			null as unknown as number,
			documentPosition,
			'formula-error-help-btn',
			true,
		);

		const objectDiv = this.getHTMLObject();
		objectDiv.style.pointerEvents = '';

		const img = document.createElement('img');
		app.LOUtil.setImage(img, 'lc_aichat_fix_formula.svg', app.map);
		img.setAttribute('width', '16');
		img.setAttribute('height', '16');
		objectDiv.appendChild(img);

		const span = document.createElement('span');
		span.textContent = _('Help fix this error');
		objectDiv.appendChild(span);

		objectDiv.onclick = (e: MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			FormulaErrorHelpSection.hide();
			app.dispatcher.dispatch('helpfixformulaerror');
		};
	}

	zIndex: number = app.CSections.FormulaErrorHelpButton.zIndex;

	public static show(documentPosition: cool.SimplePoint): void {
		FormulaErrorHelpSection.hide();
		const section = new FormulaErrorHelpSection(documentPosition);
		app.sectionContainer.addSection(section);
	}

	public static hide(): void {
		if (FormulaErrorHelpSection.isOpen())
			app.sectionContainer.removeSection(
				app.CSections.FormulaErrorHelpButton.name,
			);
	}

	public static isOpen(): boolean {
		return app.sectionContainer.doesSectionExist(
			app.CSections.FormulaErrorHelpButton.name,
		);
	}
}

app.definitions.formulaErrorHelpSection = FormulaErrorHelpSection;

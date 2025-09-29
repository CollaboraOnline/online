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
 * Util.ModelState - will hold and update the state of a JSDialog model for a component
 *                   that will allow to be aware of previous updates even if we recreate
 *                   DOM nodes without any server communication (example: notebookbar switch)
 */

class JSDialogModelState {
	protected componentName: string;
	private model: WidgetJSON | null;

	constructor(componentName: string) {
		app.console.debug(
			'JSDialogModelState: created new for component: ' + componentName,
		);
		this.componentName = componentName;
		this.model = null;
	}

	/// replaces complete state of a model
	public fullUpdate(data: JSDialogJSON) {
		app.console.debug(
			'JSDialogModelState: set model for component: ' + this.componentName,
		);

		this.model = data;
	}

	/// applies widget update to a model
	public widgetUpdate(data: JSDialogJSON) {
		if (!data || !data.control || !data.control.id) {
			app.console.error(
				'JSDialogModelState: bad syntax in widgetUpdate: ' +
					JSON.stringify(data),
			);
			return;
		}

		const found = this.getById(data.control.id);
		if (found) app.console.debug('update');
	}

	/// applies action to a model
	public widgetAction(data: JSDialogJSON) {
		if (!data || !data.data || !data.data.control_id) {
			app.console.error(
				'JSDialogModelState: bad syntax in widgetAction: ' +
					JSON.stringify(data),
			);
			return;
		}

		const found = this.getById(data.data.control_id);
		if (found) app.console.debug('action');
	}

	/// returns current state of a widget with given id
	public getById(widgetId: string): WidgetJSON | null {
		if (!this.model) {
			app.console.debug(
				'JSDialogModelState: model missing in component: ' + this.componentName,
			);
			return null;
		}

		const found = JSDialogModelState.findWidgetById(widgetId, this.model);
		if (!found)
			app.console.debug('JSDialogModelState: not found id: ' + widgetId);
		return found;
	}

	private static findWidgetById(
		id: string,
		model: WidgetJSON,
	): WidgetJSON | null {
		if (model.id === id) {
			return model;
		} else if (model.children) {
			for (const i in model.children) {
				const found = JSDialogModelState.findWidgetById(id, model.children[i]);
				if (found) return found;
			}
		}

		return null;
	}
}

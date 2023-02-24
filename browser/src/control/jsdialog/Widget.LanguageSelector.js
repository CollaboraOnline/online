/* -*- js-indent-level: 8 -*- */
/*
 * JSDialog.LanguageSelector - widgets for selecting spell/grammar checking language
 *
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

/* global _UNO JSDialog $ */

function _notebookbarLanguageSelector(parentContainer, data, builder) {
	var options = {hasDropdownArrow: true};
	var control = builder._unoToolButton(parentContainer, data, builder, options);

	$(control.container).unbind('click.toolbutton');
	$(control.container).click(function () {
		if (builder.map.getDocType() !== 'text') {
			builder.map.fire('morelanguages');
		} else {
			$(control.container).w2menu({
				items: [
					{id: 'selection', text: _UNO('.uno:SetLanguageSelectionMenu', 'text')},
					{id: 'paragraph', text: _UNO('.uno:SetLanguageParagraphMenu', 'text')},
					{id: 'all', text: _UNO('.uno:SetLanguageAllTextMenu', 'text')},
				],
				onSelect: function (event) {
					builder.map.fire('morelanguages', {applyto: event.item.id});
				}
			});
		}});

	builder._preventDocumentLosingFocusOnClick(control.container);

	return false;
}

JSDialog.notebookbarLanguageSelector = function (parentContainer, data, builder) {
	var buildInnerData = _notebookbarLanguageSelector(parentContainer, data, builder);
	return buildInnerData;
};

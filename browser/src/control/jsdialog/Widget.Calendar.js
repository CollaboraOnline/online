/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

/*
 * JSDialog.Calendar - calendar widget
 *
 * Example JSON:
 * {
 *     id: 'id',
 *     type: 'calendar',
 *     day: 2,
 *     month: 3,
 * 	   year: 2023
 * }
 */

/* global JSDialog $ */

function _calendarControl(parentContainer, data, builder) {
	var container = L.DomUtil.create('div', 'ui-calendar ' + builder.options.cssClass, parentContainer);
	container.id = data.id;

	$.datepicker.setDefaults($.datepicker.regional[window.langParamLocale.language]);
	$(container).datepicker({
		defaultDate: new Date(data.year, data.month - 1, data.day),
		dateFormat: 'mm/dd/yy',
		onSelect: function (date) {
			if (date != '') {
				builder.callback('calendar', 'selectdate', container, date, builder);
				$(container).datepicker('destroy');
			}
		}
	});

	return false;
}

JSDialog.calendar = function (parentContainer, data, builder) {
	var buildInnerData = _calendarControl(parentContainer, data, builder);
	return buildInnerData;
};

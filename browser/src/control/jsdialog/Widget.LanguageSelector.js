/* -*- js-indent-level: 8 -*- */
/*
 * JSDialog.LanguageSelector - widgets for selecting spell/grammar chacking language
 */

/* global app _UNO _ JSDialog $ */

function _notebookbarLanguageSelector(parentContainer, data, builder) {
	var menu = [
		{id: 'nb-LanguageMenu', name: _UNO('.uno:LanguageMenu'), type: 'menu', menu: [
			{name: _UNO('.uno:SetLanguageSelectionMenu', 'text'), type: 'menu', menu: [
				{name: _('None (Do not check spelling)'), id: 'noneselection', uno: '.uno:LanguageStatus?Language:string=Current_LANGUAGE_NONE'}]},
			{name: _UNO('.uno:SetLanguageParagraphMenu', 'text'), type: 'menu', menu: [
				{name: _('None (Do not check spelling)'), id: 'noneparagraph', uno: '.uno:LanguageStatus?Language:string=Paragraph_LANGUAGE_NONE'}]},
			{name: _UNO('.uno:SetLanguageAllTextMenu', 'text'), type: 'menu', menu: [
				{name: _('None (Do not check spelling)'), id: 'nonelanguage', uno: '.uno:LanguageStatus?Language:string=Default_LANGUAGE_NONE'}]},
		]}
	];

	if (builder.map.getDocType() !== 'text') {
		menu = [
			{id: 'nb-LanguageMenu', name: _UNO('.uno:LanguageMenu'), type: 'menu', menu: [
				{name: _UNO('.uno:LanguageMenu'), type: 'menu', menu: [
					{name: _('None (Do not check spelling)'), id: 'nonelanguage', uno: '.uno:LanguageStatus?Language:string=Default_LANGUAGE_NONE'}]}
			]}
		];
	}

	var noLabels = builder.options.noLabelsForUnoButtons;
	builder.options.noLabelsForUnoButtons = false;

	var options = {hasDropdownArrow: true};
	var control = builder._unoToolButton(parentContainer, data, builder, options);

	$(control.container).tooltip({disabled: true});
	$(control.container).unbind('click');

	builder.options.noLabelsForUnoButtons = noLabels;

	$(control.container).unbind('click.toolbutton');
	$(control.container).tooltip({disabled: true});
	$(control.container).addClass('sm sm-simple lo-menu');

	var menubar = L.control.menubar({allowedReadonlyMenus: ['nb-hamburger']});
	menubar._map = builder.map;
	var menuHtml = menubar._createMenu(menu);
	document.getElementById(data.id).setAttribute('role', 'menu');

	var oldContent = $(control.container).children().detach();
	$(control.container).append(menuHtml);

	$(control.container).smartmenus({
		hideOnClick: true,
		showOnClick: true,
		hideTimeout: 0,
		hideDuration: 0,
		hideFunction: null,
		showDuration: 0,
		showFunction: null,
		showTimeout: 0,
		collapsibleHideDuration: 0,
		collapsibleHideFunction: null,
		subIndicatorsPos: 'append',
		subIndicatorsText: '&#8250;'
	});

	$(menuHtml[0]).children('a').empty();
	$(menuHtml[0]).children('a').append(oldContent);
	$(menuHtml[0]).children('a').click(function () {
		$(control.container).smartmenus('menuHideAll');
	});

	$(control.container).bind('beforeshow.smapi', {self: menubar}, menubar._beforeShow);
	$(control.container).bind('click.smapi', {self: menubar}, menubar._onClicked);
	$(control.container).bind('select.smapi', {self: menubar}, menubar._onItemSelected);
	$(control.container).bind('keydown', {self: menubar}, menubar._onKeyDown);
	$(control.container).bind('hideAll.smapi', {self: menubar}, menubar._onMouseOut);

	builder.map.on('commandvalues', menubar._onInitLanguagesMenu, menubar);
	app.socket.sendMessage('commandvalues command=.uno:LanguageStatus');

	return false;
}

JSDialog.notebookbarLanguageSelector = function (parentContainer, data, builder) {
	var buildInnerData = _notebookbarLanguageSelector(parentContainer, data, builder);
	return buildInnerData;
};

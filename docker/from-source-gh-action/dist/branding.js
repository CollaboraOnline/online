/* (C) Collabora Productivity 2025, All Rights Reserved, (version 24.04-35) */

var brandProductName = 'Collabora Online Development Edition (CODE)';
var brandProductURL = 'https://www.collaboraonline.com/code/';
var brandProductFAQURL = 'https://www.collaboraonline.com/code/#code-scalability';
var menuItems;
window.onload = function() {
	// wait until the menu (and particularly the document-header) actually exists
	function setLogo() {
		var logoHeader = document.getElementById('document-header');
		if (!logoHeader) {
			// the logo does not exist in the menu yet, re-try in 250ms
			setTimeout(setLogo, 250);
		} else {
			var logo = $('#document-header > div');
			logo.attr('title', brandProductName);
			logo.off('click').on('click', function() { window.open(brandProductURL, '_blank'); });

			menuItems = document.querySelectorAll('#main-menu > li > a');
		}
	}
	function setAboutImg() {
		var lk = document.getElementById('lokit-version');
		var aboutDialog = document.getElementById('about-dialog-info');
		if (!lk || !aboutDialog) {
			setTimeout(setAboutImg, 250);
		} else {
			var div = document.createElement('div');
			div.style.marginInlineEnd = 'auto';
			div.id = 'lokit-extra';

			let span = document.createElement('span');
			span.setAttribute('dir', 'ltr');
			span.textContent = 'built on\u00A0';

			let anchor = document.createElement('a');
			anchor.href = 'https://col.la/lot';
			anchor.setAttribute('target', '_blank');
			anchor.textContent = 'a great technology base';

			div.appendChild(span);
			div.appendChild(anchor);
			lk.parentNode.parentNode.insertBefore(div, lk.parentNode);
		}
	}

	function addIntegratorSidebar() {
		var logoHeader = document.getElementById('document-header');
		if (!logoHeader) {
			// the logo does not exist in the menu yet, re-try in 250ms
			setTimeout(addIntegratorSidebar, 250);
		}
   }


	setLogo();
	setAboutImg();
	addIntegratorSidebar();
}

/*a::first-letter"*/
document.onkeyup = function(e) {
	if (e.altKey && e.shiftKey) {
		console.log('alt + shift + f');
		menuItems.forEach(function(menuItem) {
		  menuItem.style.setProperty('text-decoration', 'underline', 'important');
		});
	}
};

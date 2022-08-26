var appEl = document.getElementById('app');
var rowT = 6;
var colT = 2;
var cellT = rowT + colT

var gridEl = '<div class="grid" style=" \
				grid-template-rows: repeat(' + rowT  + ', auto); \
				grid-template-columns: repeat(' + colT  + ', auto); ">';

for (var i = 0; i < cellT; i++) {
	gridEl += '<div class="cell">cell ' + i + '</div>';
}

gridEl += '</div>';
appEl.insertAdjacentHTML('afterend', gridEl);

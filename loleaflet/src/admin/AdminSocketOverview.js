/*
	Socket to be intialized on opening the overview page in Admin console
*/
/* global vex $ Util AdminSocketBase */
/* eslint no-unused-vars:0 */
var AdminSocketOverview = AdminSocketBase.extend({
	constructor: function(host) {
		this.base(host);
	},

	_basicStatsIntervalId: 0,

	_getBasicStats: function() {
		this.socket.send('total_mem');
		this.socket.send('active_docs_count');
		this.socket.send('active_users_count');
	},

	onSocketOpen: function() {
		this.socket.send('documents');
		this.socket.send('subscribe document addview rmview rmdoc');

		this._getBasicStats();
		var socketOverview = this;
		this._basicStatsIntervalId =
		setInterval(function() {
			return socketOverview._getBasicStats();
		}, 5000);

		// Allow table rows to have a context menu for terminating sessions
		$('body').on('contextmenu', 'table tr', function(ev) {
			$('#rowContextMenu').css({
				display: 'block',
				left: ev.pageX,
				top: ev.pageY
			})
			.data('rowToKill', ev.target.parentElement.id);

			return false;
		})
		.click(function() {
			$('#rowContextMenu').hide();
		});

		$('#rowContextMenu').on('click', 'a', function() {
			vex.dialog.confirm({
				message: 'Are you sure you want to terminate this session?',
				callback: function(value) {
					if (value) {
						var killPid = ($('#rowContextMenu').data('rowToKill')).substring('doc'.length);
						socketOverview.socket.send('kill ' + killPid);
					}
					$('#rowContextMenu').hide();
				}
			});
		});
	},

	onSocketMessage: function(e) {
		var textMsg;
		if (typeof e.data === 'string') {
			textMsg = e.data;
		}
		else {
			textMsg = '';
		}

		var tableContainer = document.getElementById('doclist');
		var rowContainer;
		var pidEle, urlEle, viewsEle, memEle, docEle;
		var nViews, nTotalViews;
		var docProps, sPid, sUrl, sViews, sMem;
		if (textMsg.startsWith('documents')) {
			var documents = textMsg.substring('documents'.length);
			documents = documents.trim().split('\n');
			for (var i = 0; i < documents.length; i++) {
				if (documents[i] === '') {
					continue;
				}
				docProps = documents[i].trim().split(' ');
				sPid = docProps[0];
				sUrl = docProps[1];
				sViews = docProps[2];
				sMem = docProps[3];
				if (sUrl === '0') {
					continue;
				}
				rowContainer = document.createElement('tr');
				rowContainer.id = 'doc' + sPid;
				tableContainer.appendChild(rowContainer);

				pidEle = document.createElement('td');
				pidEle.innerHTML = sPid;
				rowContainer.appendChild(pidEle);

				urlEle = document.createElement('td');
				urlEle.innerHTML = sUrl;
				rowContainer.appendChild(urlEle);

				viewsEle = document.createElement('td');
				viewsEle.id = 'docview' + sPid;
				viewsEle.innerHTML = sViews;
				rowContainer.appendChild(viewsEle);

				memEle = document.createElement('td');
				memEle.innerHTML = Util.humanize(parseInt(sMem));
				rowContainer.appendChild(memEle);
			}
		}
		else if (textMsg.startsWith('addview')) {
			sPid = textMsg.substring('addview'.length).trim().split(' ')[0];
			nViews = parseInt(document.getElementById('docview' + sPid).innerHTML);
			document.getElementById('docview' + sPid).innerHTML = nViews + 1;
			nTotalViews = parseInt(document.getElementById('active_users_count').innerHTML);
			document.getElementById('active_users_count').innerHTML = nTotalViews + 1;
		}
		else if (textMsg.startsWith('rmview')) {
			sPid = textMsg.substring('addview'.length).trim().split(' ')[0];
			nViews = parseInt(document.getElementById('docview' + sPid).innerHTML);
			document.getElementById('docview' + sPid).innerHTML = nViews - 1;
			nTotalViews = parseInt(document.getElementById('active_users_count').innerHTML);
			document.getElementById('active_users_count').innerHTML = nTotalViews - 1;
		}
		else if (textMsg.startsWith('document')) {
			textMsg = textMsg.substring('document'.length);
			docProps = textMsg.trim().split(' ');
			sPid = docProps[0];
			sUrl = docProps[1];
			sMem = docProps[2];

			docEle = document.getElementById('doc' + sPid);
			if (docEle) {
				tableContainer.removeChild(docEle);
			}
			if (sUrl === '0') {
				return;
			}

			rowContainer = document.createElement('tr');
			rowContainer.id = 'doc' + docProps[0];
			tableContainer.appendChild(rowContainer);

			pidEle = document.createElement('td');
			pidEle.innerHTML = docProps[0];
			rowContainer.appendChild(pidEle);

			urlEle = document.createElement('td');
			urlEle.innerHTML = docProps[1];
			rowContainer.appendChild(urlEle);

			viewsEle = document.createElement('td');
			viewsEle.innerHTML = 0;
			viewsEle.id = 'docview' + docProps[0];
			rowContainer.appendChild(viewsEle);

			memEle = document.createElement('td');
			memEle.innerHTML = Util.humanize(parseInt(sMem));
			rowContainer.appendChild(memEle);

			var totalUsersEle = document.getElementById('active_docs_count');
			totalUsersEle.innerHTML = parseInt(totalUsersEle.innerHTML) + 1;
		}
		else if (textMsg.startsWith('total_mem') ||
			textMsg.startsWith('active_docs_count') ||
			textMsg.startsWith('active_users_count'))
		{
			textMsg = textMsg.split(' ');
			var sCommand = textMsg[0];
			var nData = parseInt(textMsg[1]);

			if (sCommand === 'total_mem') {
				nData = Util.humanize(nData);
			}
			document.getElementById(sCommand).innerHTML = nData;
		}
		else if (textMsg.startsWith('rmdoc')) {
			textMsg = textMsg.substring('rmdoc'.length);
			docProps = textMsg.trim().split(' ');
			sPid = docProps[0];
			docEle = document.getElementById('doc' + sPid);
			if (docEle) {
				tableContainer.removeChild(docEle);
			}
		}
	},

	onSocketClose: function() {
		clearInterval(this._basicStatsIntervalId);
	}
});

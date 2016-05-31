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

	_docElapsedTimeIntervalId: 0,

	_getBasicStats: function() {
		this.socket.send('total_mem');
		this.socket.send('active_docs_count');
		this.socket.send('active_users_count');
	},

	onSocketOpen: function() {
		this.socket.send('documents');
		this.socket.send('subscribe adddoc rmdoc');

		this._getBasicStats();
		var socketOverview = this;
		this._basicStatsIntervalId =
		setInterval(function() {
			return socketOverview._getBasicStats();
		}, 5000);

		this._docElapsedTimeIntervalId =
		setInterval(function() {
			$('td.elapsed_time').each(function() {
				var newSecs = parseInt($(this).val()) + 1;
				$(this).val(newSecs);
				$(this).html(Util.humanizeSecs(newSecs));
			});
		}, 1000);

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
				message: _('Are you sure you want to terminate this session?'),
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
		var pidEle, nameEle, viewsEle, memEle, sDocTimeEle, docEle, aEle;
		var nViews, nTotalViews;
		var docProps, sPid, sName, sViews, sMem, sDocTime;
		if (textMsg.startsWith('documents')) {
			var documents = textMsg.substring('documents'.length);
			documents = documents.trim().split('\n');
			for (var i = 0; i < documents.length; i++) {
				if (documents[i] === '') {
					continue;
				}
				docProps = documents[i].trim().split(' ');
				sPid = docProps[0];
				sName = decodeURI(docProps[1]);
				sViews = docProps[2];
				sMem = docProps[3];
				sDocTime = docProps[4];
				if (sName === '0') {
					continue;
				}
				rowContainer = document.createElement('tr');
				rowContainer.id = 'doc' + sPid;
				tableContainer.appendChild(rowContainer);

				pidEle = document.createElement('td');
				pidEle.innerHTML = sPid;
				rowContainer.appendChild(pidEle);

				nameEle = document.createElement('td');
				nameEle.innerHTML = sName;
				rowContainer.appendChild(nameEle);

				viewsEle = document.createElement('td');
				viewsEle.id = 'docview' + sPid;
				viewsEle.innerHTML = sViews;
				rowContainer.appendChild(viewsEle);

				memEle = document.createElement('td');
				memEle.innerHTML = Util.humanizeMem(parseInt(sMem));
				rowContainer.appendChild(memEle);

				sDocTimeEle = document.createElement('td');
				sDocTimeEle.className = 'elapsed_time';
				sDocTimeEle.value = parseInt(sDocTime);
				sDocTimeEle.innerHTML = Util.humanizeSecs(sDocTime);
				rowContainer.appendChild(sDocTimeEle);
			}
		}
		else if (textMsg.startsWith('adddoc')) {
			textMsg = textMsg.substring('adddoc'.length);
			docProps = textMsg.trim().split(' ');
			sPid = docProps[0];
			sName = decodeURI(docProps[1]);
			// docProps[2] == sessionid
			sMem = docProps[3];

			docEle = document.getElementById('doc' + sPid);
			if (!docEle) {

				if (sName === '0') {
					return;
				}

				rowContainer = document.createElement('tr');
				rowContainer.id = 'doc' + sPid;
				tableContainer.appendChild(rowContainer);

				pidEle = document.createElement('td');
				pidEle.innerHTML = sPid;
				rowContainer.appendChild(pidEle);

				nameEle = document.createElement('td');
				nameEle.innerHTML = sName;
				rowContainer.appendChild(nameEle);

				viewsEle = document.createElement('td');
				viewsEle.innerHTML = 0;
				viewsEle.id = 'docview' + sPid;
				rowContainer.appendChild(viewsEle);

				memEle = document.createElement('td');
				memEle.innerHTML = Util.humanizeMem(parseInt(sMem));
				rowContainer.appendChild(memEle);

				sDocTimeEle = document.createElement('td');
				sDocTimeEle.className = 'elapsed_time';
				sDocTimeEle.value = 0;
				sDocTimeEle.innerHTML = Util.humanizeSecs(0);
				rowContainer.appendChild(sDocTimeEle);

				var totalUsersEle = document.getElementById('active_docs_count');
				totalUsersEle.innerHTML = parseInt(totalUsersEle.innerHTML) + 1;

			}

			viewsEle = document.getElementById('docview' + sPid);
			nViews = parseInt(viewsEle.innerHTML);
			viewsEle.innerHTML = nViews + 1;

			aEle = document.getElementById('active_users_count');
			nTotalViews = parseInt(aEle.innerHTML);
			aEle.innerHTML = nTotalViews + 1;
		}
		else if (textMsg.startsWith('total_mem') ||
			textMsg.startsWith('active_docs_count') ||
			textMsg.startsWith('active_users_count'))
		{
			textMsg = textMsg.split(' ');
			var sCommand = textMsg[0];
			var nData = parseInt(textMsg[1]);

			if (sCommand === 'total_mem') {
				nData = Util.humanizeMem(nData);
			}
			document.getElementById(sCommand).innerHTML = nData;
		}
		else if (textMsg.startsWith('rmdoc')) {
			textMsg = textMsg.substring('rmdoc'.length);
			docProps = textMsg.trim().split(' ');
			sPid = docProps[0];
			// docProps[1] == sessionid

			docEle = document.getElementById('doc' + sPid);
			if (docEle) {
				viewsEle = document.getElementById('docview' + sPid);
				nViews = parseInt(viewsEle.innerHTML) - 1;
				viewsEle.innerHTML = nViews;
				if (!nViews) {
					tableContainer.removeChild(docEle);
				}

				aEle = document.getElementById('active_users_count');
				nTotalViews = parseInt(aEle.innerHTML);
				aEle.innerHTML = nTotalViews - 1;
			}
		}
	},

	onSocketClose: function() {
		clearInterval(this._basicStatsIntervalId);
		clearInterval(this._docElapsedTimeIntervalId);
	}
});

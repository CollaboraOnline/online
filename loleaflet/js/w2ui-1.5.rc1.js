/* w2ui 1.5.rc1 (nightly) (c) http://w2ui.com, vitmalina@gmail.com */
var w2ui  = w2ui  || {};
var w2obj = w2obj || {}; // expose object to be able to overwrite default functions

/************************************************
*  Library: Web 2.0 UI for jQuery
*  - Following objects are defines
*        - w2ui             - object that will contain all widgets
*        - w2obj            - object with widget prototypes
*        - w2utils          - basic utilities
*        - $().w2render     - common render
*        - $().w2destroy    - common destroy
*        - $().w2marker     - marker plugin
*        - $().w2tag        - tag plugin
*        - $().w2overlay    - overlay plugin
*        - $().w2menu       - menu plugin
*        - w2utils.event    - generic event object
*  - Dependencies: jQuery
*
* == NICE TO HAVE ==
*   - overlay should be displayed where more space (on top or on bottom)
*   - write and article how to replace certain framework functions
*   - add maxHeight for the w2menu
*   - add time zone
*   - TEST On IOS
*   - $().w2marker() -- only unmarks first instance
*   - subitems for w2menus()
*   - add w2utils.lang wrap for all captions in all buttons.
*   - $().w2date(), $().w2dateTime()
*
************************************************/

var w2utils = (function ($) {
    var tmp = {}; // for some temp variables
    var obj = {
        version  : '1.5.RC1',
        settings : {
            "locale"            : "en-us",
            "dateFormat"        : "m/d/yyyy",
            "timeFormat"        : "hh:mi pm",
            "datetimeFormat"    : "m/d/yyyy|hh:mi pm",
            "currencyPrefix"    : "$",
            "currencySuffix"    : "",
            "currencyPrecision" : 2,
            "groupSymbol"       : ",",
            "decimalSymbol"     : ".",
            "shortmonths"       : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
            "fullmonths"        : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
            "shortdays"         : ["M", "T", "W", "T", "F", "S", "S"],
            "fulldays"          : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
            "weekStarts"        : "M",        // can be "M" for Monday or "S" for Sunday
            "dataType"          : 'HTTPJSON', // can be HTTP, HTTPJSON, RESTFULL, RESTFULLJSON, JSON (case sensitive)
            "phrases"           : {},         // empty object for english phrases
            "dateStartYear"     : 1950,       // start year for date-picker
            "dateEndYear"       : 2020        // end year for date picker
        },
        isBin           : isBin,
        isInt           : isInt,
        isFloat         : isFloat,
        isMoney         : isMoney,
        isHex           : isHex,
        isAlphaNumeric  : isAlphaNumeric,
        isEmail         : isEmail,
        isDate          : isDate,
        isTime          : isTime,
        isDateTime      : isDateTime,
        age             : age,
        interval        : interval,
        date            : date,
        formatSize      : formatSize,
        formatNumber    : formatNumber,
        formatDate      : formatDate,
        formatTime      : formatTime,
        formatDateTime  : formatDateTime,
        stripTags       : stripTags,
        encodeTags      : encodeTags,
        decodeTags      : decodeTags,
        escapeId        : escapeId,
        base64encode    : base64encode,
        base64decode    : base64decode,
        md5             : md5,
        transition      : transition,
        lock            : lock,
        unlock          : unlock,
        message         : message,
        lang            : lang,
        locale          : locale,
        getSize         : getSize,
        getStrWidth     : getStrWidth,
        scrollBarSize   : scrollBarSize,
        checkName       : checkName,
        checkUniqueId   : checkUniqueId,
        parseRoute      : parseRoute,
        cssPrefix       : cssPrefix,
        getCursorPosition : getCursorPosition,
        setCursorPosition : setCursorPosition,
        testLocalStorage  : testLocalStorage,
        hasLocalStorage   : testLocalStorage(),
        // some internal variables
        isIOS : ((navigator.userAgent.toLowerCase().indexOf('iphone') != -1 ||
                 navigator.userAgent.toLowerCase().indexOf('ipod') != -1 ||
                 navigator.userAgent.toLowerCase().indexOf('ipad') != -1)
                 ? true : false),
        isIE : ((navigator.userAgent.toLowerCase().indexOf('msie') != -1 ||
                 navigator.userAgent.toLowerCase().indexOf('trident') != -1 )
                 ? true : false)
    };
    return obj;

    function isBin (val) {
        var re = /^[0-1]+$/;
        return re.test(val);
    }

    function isInt (val) {
        var re = /^[-+]?[0-9]+$/;
        return re.test(val);
    }

    function isFloat (val) {
        if (typeof val == 'string') val = val.replace(/\s+/g, '').replace(w2utils.settings.groupSymbol, '').replace(w2utils.settings.decimalSymbol, '.');
        return (typeof val === 'number' || (typeof val === 'string' && val !== '')) && !isNaN(Number(val));
    }

    function isMoney (val) {
        var se = w2utils.settings;
        var re = new RegExp('^'+ (se.currencyPrefix ? '\\' + se.currencyPrefix + '?' : '') +
                            '[-+]?'+ (se.currencyPrefix ? '\\' + se.currencyPrefix + '?' : '') +
                            '[0-9]*[\\'+ se.decimalSymbol +']?[0-9]+'+ (se.currencySuffix ? '\\' + se.currencySuffix + '?' : '') +'$', 'i');
        if (typeof val === 'string') {
            val = val.replace(new RegExp(se.groupSymbol, 'g'), '');
        }
        if (typeof val === 'object' || val === '') return false;
        return re.test(val);
    }

    function isHex (val) {
        var re = /^[a-fA-F0-9]+$/;
        return re.test(val);
    }

    function isAlphaNumeric (val) {
        var re = /^[a-zA-Z0-9_-]+$/;
        return re.test(val);
    }

    function isEmail (val) {
        var email = /^[a-zA-Z0-9._%-+]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
        return email.test(val);
    }

    function isDate (val, format, retDate) {
        if (!val) return false;

        var dt   = 'Invalid Date';
        var month, day, year;

        if (format == null) format = w2utils.settings.dateFormat;

        if (typeof val.getUTCFullYear === 'function') { // date object
            year  = val.getUTCFullYear();
            month = val.getUTCMonth() + 1;
            day   = val.getUTCDate();
        } else if (parseInt(val) == val && parseInt(val) > 0) {
            val = new Date(parseInt(val));
            year  = val.getUTCFullYear();
            month = val.getUTCMonth() + 1;
            day   = val.getUTCDate();
        } else {
            val = String(val);
            // convert month formats
            if (new RegExp('mon', 'ig').test(format)) {
                format = format.replace(/month/ig, 'm').replace(/mon/ig, 'm').replace(/dd/ig, 'd').replace(/[, ]/ig, '/').replace(/\/\//g, '/').toLowerCase();
                val    = val.replace(/[, ]/ig, '/').replace(/\/\//g, '/').toLowerCase();
                for (var m = 0, len = w2utils.settings.fullmonths.length; m < len; m++) {
                    var t = w2utils.settings.fullmonths[m];
                    val = val.replace(new RegExp(t, 'ig'), (parseInt(m) + 1)).replace(new RegExp(t.substr(0, 3), 'ig'), (parseInt(m) + 1));
                }
            }
            // format date
            var tmp  = val.replace(/-/g, '/').replace(/\./g, '/').toLowerCase().split('/');
            var tmp2 = format.replace(/-/g, '/').replace(/\./g, '/').toLowerCase();
            if (tmp2 === 'mm/dd/yyyy') { month = tmp[0]; day = tmp[1]; year = tmp[2]; }
            if (tmp2 === 'm/d/yyyy')   { month = tmp[0]; day = tmp[1]; year = tmp[2]; }
            if (tmp2 === 'dd/mm/yyyy') { month = tmp[1]; day = tmp[0]; year = tmp[2]; }
            if (tmp2 === 'd/m/yyyy')   { month = tmp[1]; day = tmp[0]; year = tmp[2]; }
            if (tmp2 === 'yyyy/dd/mm') { month = tmp[2]; day = tmp[1]; year = tmp[0]; }
            if (tmp2 === 'yyyy/d/m')   { month = tmp[2]; day = tmp[1]; year = tmp[0]; }
            if (tmp2 === 'yyyy/mm/dd') { month = tmp[1]; day = tmp[2]; year = tmp[0]; }
            if (tmp2 === 'yyyy/m/d')   { month = tmp[1]; day = tmp[2]; year = tmp[0]; }
            if (tmp2 === 'mm/dd/yy')   { month = tmp[0]; day = tmp[1]; year = tmp[2]; }
            if (tmp2 === 'm/d/yy')     { month = tmp[0]; day = tmp[1]; year = parseInt(tmp[2]) + 1900; }
            if (tmp2 === 'dd/mm/yy')   { month = tmp[1]; day = tmp[0]; year = parseInt(tmp[2]) + 1900; }
            if (tmp2 === 'd/m/yy')     { month = tmp[1]; day = tmp[0]; year = parseInt(tmp[2]) + 1900; }
            if (tmp2 === 'yy/dd/mm')   { month = tmp[2]; day = tmp[1]; year = parseInt(tmp[0]) + 1900; }
            if (tmp2 === 'yy/d/m')     { month = tmp[2]; day = tmp[1]; year = parseInt(tmp[0]) + 1900; }
            if (tmp2 === 'yy/mm/dd')   { month = tmp[1]; day = tmp[2]; year = parseInt(tmp[0]) + 1900; }
            if (tmp2 === 'yy/m/d')     { month = tmp[1]; day = tmp[2]; year = parseInt(tmp[0]) + 1900; }
        }
        if (!isInt(year)) return false;
        if (!isInt(month)) return false;
        if (!isInt(day)) return false;
        year  = +year;
        month = +month;
        day   = +day;
        dt    = new Date(year, month - 1, day);
        // do checks
        if (month == null) return false;
        if (String(dt) == 'Invalid Date') return false;
        if ((dt.getMonth() + 1 !== month) || (dt.getDate() !== day) || (dt.getFullYear() !== year)) return false;
        if (retDate === true) return dt; else return true;
    }

    function isTime (val, retTime) {
        // Both formats 10:20pm and 22:20
        if (val == null) return false;
        var max, am, pm;
        // -- process american format
        val = String(val);
        val = val.toUpperCase();
        am = val.indexOf('AM') >= 0;
        pm = val.indexOf('PM') >= 0;
        var ampm = (pm || am);
        if (ampm) max = 12; else max = 24;
        val = val.replace('AM', '').replace('PM', '');
        val = $.trim(val);
        // ---
        var tmp = val.split(':');
        var h = parseInt(tmp[0] || 0), m = parseInt(tmp[1] || 0), s = parseInt(tmp[2] || 0);
        // accept edge case: 3PM is a good timestamp, but 3 (without AM or PM) is NOT:
        if ((!ampm || tmp.length !== 1) && tmp.length !== 2 && tmp.length !== 3) { return false; }
        if (tmp[0] === '' || h < 0 || h > max || !this.isInt(tmp[0]) || tmp[0].length > 2) { return false; }
        if (tmp.length > 1 && (tmp[1] === '' || m < 0 || m > 59 || !this.isInt(tmp[1]) || tmp[1].length !== 2)) { return false; }
        if (tmp.length > 2 && (tmp[2] === '' || s < 0 || s > 59 || !this.isInt(tmp[2]) || tmp[2].length !== 2)) { return false; }
        // check the edge cases: 12:01AM is ok, as is 12:01PM, but 24:01 is NOT ok while 24:00 is (midnight; equivalent to 00:00).
        // meanwhile, there is 00:00 which is ok, but 0AM nor 0PM are okay, while 0:01AM and 0:00AM are.
        if (!ampm && max === h && (m !== 0 || s !== 0)) { return false; }
        if (ampm && tmp.length === 1 && h === 0) { return false; }

        if (retTime === true) {
            if (pm && h !== 12) h += 12;   // 12:00pm - is noon
            if (am && h === 12) h += 12;   // 12:00am - is midnight
            return {
                hours: h,
                minutes: m,
                seconds: s
            };
        }
        return true;
    }

    function isDateTime (val, format, retDate) {
        if (format == null) format = w2utils.settings.datetimeFormat;
        var formats = format.split('|');
        if (typeof val.getUTCFullYear === 'function') { // date object
            if (retDate !== true) return true;
            return val;
        } else if (parseInt(val) == val && parseInt(val) > 0) {
            val = new Date(parseInt(val));
            if (retDate !== true) return true;
            return val;
        } else {
            var tmp = String(val).indexOf(' ');
            var values  = [val.substr(0, tmp), val.substr(tmp).trim()];
            formats[0] = formats[0].trim();
            if (formats[1]) formats[1] = formats[1].trim();
            // check
            var tmp1 = w2utils.isDate(values[0], formats[0], true);
            var tmp2 = w2utils.isTime(values[1], true);
            if (tmp1 !== false && tmp2 !== false) {
                if (retDate !== true) return true;
                tmp1.setHours(tmp2.hours);
                tmp1.setMinutes(tmp2.minutes);
                tmp1.setSeconds(tmp2.seconds);
                return tmp1;
            } else {
                return false;
            }
        }
    }

    function age(dateStr) {
        var d1;
        if (dateStr === '' || dateStr == null) return '';
        if (typeof dateStr.getUTCFullYear === 'function') { // date object
            d1 = dateStr;
        } else if (parseInt(dateStr) == dateStr && parseInt(dateStr) > 0) {
            d1 = new Date(parseInt(dateStr));
        } else {
            d1 = new Date(dateStr);
        }
        if (String(d1) == 'Invalid Date') return '';

        var d2  = new Date();
        var sec = (d2.getTime() - d1.getTime()) / 1000;
        var amount = '';
        var type   = '';
        if (sec < 0) {
            amount = 0;
            type   = 'sec';
        } else if (sec < 60) {
            amount = Math.floor(sec);
            type   = 'sec';
            if (sec < 0) { amount = 0; type = 'sec'; }
        } else if (sec < 60*60) {
            amount = Math.floor(sec/60);
            type   = 'min';
        } else if (sec < 24*60*60) {
            amount = Math.floor(sec/60/60);
            type   = 'hour';
        } else if (sec < 30*24*60*60) {
            amount = Math.floor(sec/24/60/60);
            type   = 'day';
        } else if (sec < 365*24*60*60) {
            amount = Math.floor(sec/30/24/60/60*10)/10;
            type   = 'month';
        } else if (sec < 365*4*24*60*60) {
            amount = Math.floor(sec/365/24/60/60*10)/10;
            type   = 'year';
        } else if (sec >= 365*4*24*60*60) {
            // factor in leap year shift (only older then 4 years)
            amount = Math.floor(sec/365.25/24/60/60*10)/10;
            type   = 'year';
        }
        return amount + ' ' + type + (amount > 1 ? 's' : '');
    }

    function interval (value) {
        var ret = '';
        if (value < 1000) {
            ret = "< 1 sec";
        } else if (value < 60000) {
            ret = Math.floor(value / 1000) + " secs";
        } else if (value < 3600000) {
            ret = Math.floor(value / 60000) + " mins";
        } else if (value < 86400000) {
            ret = Math.floor(value / 3600000 * 10) / 10 + " hours";
        } else if (value < 2628000000) {
            ret = Math.floor(value / 86400000 * 10) / 10 + " days";
        } else if (value < 3.1536e+10) {
            ret = Math.floor(value / 2628000000 * 10) / 10 + " months";
        } else {
            ret = Math.floor(value / 3.1536e+9) / 10 + " years";
        }
        return ret;
    }

    function date (dateStr) {
        if (dateStr === '' || dateStr == null || (typeof dateStr == 'object' && !dateStr.getMonth)) return '';
        var d1 = new Date(dateStr);
        if (w2utils.isInt(dateStr)) d1 = new Date(Number(dateStr)); // for unix timestamps
        if (String(d1) == 'Invalid Date') return '';

        var months = w2utils.settings.shortmonths;
        var d2   = new Date(); // today
        var d3   = new Date();
        d3.setTime(d3.getTime() - 86400000); // yesterday

        var dd1  = months[d1.getMonth()] + ' ' + d1.getDate() + ', ' + d1.getFullYear();
        var dd2  = months[d2.getMonth()] + ' ' + d2.getDate() + ', ' + d2.getFullYear();
        var dd3  = months[d3.getMonth()] + ' ' + d3.getDate() + ', ' + d3.getFullYear();

        var time = (d1.getHours() - (d1.getHours() > 12 ? 12 :0)) + ':' + (d1.getMinutes() < 10 ? '0' : '') + d1.getMinutes() + ' ' + (d1.getHours() >= 12 ? 'pm' : 'am');
        var time2= (d1.getHours() - (d1.getHours() > 12 ? 12 :0)) + ':' + (d1.getMinutes() < 10 ? '0' : '') + d1.getMinutes() + ':' + (d1.getSeconds() < 10 ? '0' : '') + d1.getSeconds() + ' ' + (d1.getHours() >= 12 ? 'pm' : 'am');
        var dsp = dd1;
        if (dd1 === dd2) dsp = time;
        if (dd1 === dd3) dsp = w2utils.lang('Yesterday');

        return '<span title="'+ dd1 +' ' + time2 +'">'+ dsp +'</span>';
    }

    function formatSize (sizeStr) {
        if (!w2utils.isFloat(sizeStr) || sizeStr === '') return '';
        sizeStr = parseFloat(sizeStr);
        if (sizeStr === 0) return 0;
        var sizes = ['Bt', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB'];
        var i = parseInt( Math.floor( Math.log(sizeStr) / Math.log(1024) ) );
        return (Math.floor(sizeStr / Math.pow(1024, i) * 10) / 10).toFixed(i === 0 ? 0 : 1) + ' ' + (sizes[i] || '??');
    }

    function formatNumber (val, fraction, useGrouping) {
        if (val == null || val === '' || typeof val == 'object') return '';
        var options = {
            minimumFractionDigits : fraction,
            maximumFractionDigits : fraction,
            useGrouping : useGrouping
        };
        if (fraction == null || fraction < 0) {
            options.minimumFractionDigits = 0;
            options.maximumFractionDigits = 20;
        }
        return parseFloat(val).toLocaleString(w2utils.settings.locale, options);
    }

    function formatDate (dateStr, format) { // IMPORTANT dateStr HAS TO BE valid JavaScript Date String
        if (!format) format = this.settings.dateFormat;
        if (dateStr === '' || dateStr == null || (typeof dateStr == 'object' && !dateStr.getMonth)) return '';

        var dt = new Date(dateStr);
        if (w2utils.isInt(dateStr)) dt = new Date(Number(dateStr)); // for unix timestamps
        if (String(dt) == 'Invalid Date') return '';

        var year  = dt.getFullYear();
        var month = dt.getMonth();
        var date  = dt.getDate();
        return format.toLowerCase()
            .replace('month', w2utils.settings.fullmonths[month])
            .replace('mon', w2utils.settings.shortmonths[month])
            .replace(/yyyy/g, year)
            .replace(/yyy/g, year)
            .replace(/yy/g, year > 2000 ? 100 + parseInt(String(year).substr(2)) : String(year).substr(2))
            .replace(/(^|[^a-z$])y/g, '$1' + year)            // only y's that are not preceded by a letter
            .replace(/mm/g, (month + 1 < 10 ? '0' : '') + (month + 1))
            .replace(/dd/g, (date < 10 ? '0' : '') + date)
            .replace(/th/g, (date == 1 ? 'st' : 'th'))
            .replace(/th/g, (date == 2 ? 'nd' : 'th'))
            .replace(/th/g, (date == 3 ? 'rd' : 'th'))
            .replace(/(^|[^a-z$])m/g, '$1' + (month + 1))     // only y's that are not preceded by a letter
            .replace(/(^|[^a-z$])d/g, '$1' + date);           // only y's that are not preceded by a letter
    }

    function formatTime (dateStr, format) { // IMPORTANT dateStr HAS TO BE valid JavaScript Date String
        var months = w2utils.settings.shortmonths;
        var fullMonths = w2utils.settings.fullmonths;
        if (!format) format = this.settings.timeFormat;
        if (dateStr === '' || dateStr == null || (typeof dateStr == 'object' && !dateStr.getMonth)) return '';

        var dt = new Date(dateStr);
        if (w2utils.isInt(dateStr)) dt  = new Date(Number(dateStr)); // for unix timestamps
        if (w2utils.isTime(dateStr)) {
            var tmp = w2utils.isTime(dateStr, true);
            dt = new Date();
            dt.setHours(tmp.hours);
            dt.setMinutes(tmp.minutes);
        }
        if (String(dt) == 'Invalid Date') return '';

        var type = 'am';
        var hour = dt.getHours();
        var h24  = dt.getHours();
        var min  = dt.getMinutes();
        var sec  = dt.getSeconds();
        if (min < 10) min = '0' + min;
        if (sec < 10) sec = '0' + sec;
        if (format.indexOf('am') !== -1 || format.indexOf('pm') !== -1) {
            if (hour >= 12) type = 'pm';
            if (hour > 12)  hour = hour - 12;
        }
        return format.toLowerCase()
            .replace('am', type)
            .replace('pm', type)
            .replace('hhh', (hour < 10 ? '0' + hour : hour))
            .replace('hh24', (h24 < 10 ? '0' + h24 : h24))
            .replace('h24', h24)
            .replace('hh', hour)
            .replace('mm', min)
            .replace('mi', min)
            .replace('ss', sec)
            .replace(/(^|[^a-z$])h/g, '$1' + hour)    // only y's that are not preceded by a letter
            .replace(/(^|[^a-z$])m/g, '$1' + min)     // only y's that are not preceded by a letter
            .replace(/(^|[^a-z$])s/g, '$1' + sec);    // only y's that are not preceded by a letter
    }

    function formatDateTime(dateStr, format) {
        var fmt;
        if (dateStr === '' || dateStr == null || (typeof dateStr == 'object' && !dateStr.getMonth)) return '';
        if (typeof format !== 'string') {
            fmt = [this.settings.dateFormat, this.settings.timeFormat];
        } else {
            fmt = format.split('|');
            fmt[0] = fmt[0].trim();
            fmt[1] = fmt[1].trim();
        }
        // older formats support
        if (fmt[1] == 'h12') fmt[1] = 'h:m pm';
        if (fmt[1] == 'h24') fmt[1] = 'h24:m';
        return this.formatDate(dateStr, fmt[0]) + ' ' + this.formatTime(dateStr, fmt[1]);
    }

    function stripTags (html) {
        if (html == null) return html;
        switch (typeof html) {
            case 'number':
                break;
            case 'string':
                html = String(html).replace(/(<([^>]+)>)/ig, "");
                break;
            case 'object':
                // does not modify original object, but creates a copy
                if (Array.isArray(html)) {
                    html = $.extend(true, [], html);
                    for (var i = 0; i < html.length; i++) html[i] = this.stripTags(html[i]);
                }  else {
                    html = $.extend(true, {}, html);
                    for (var i in html) html[i] = this.stripTags(html[i]);
                }
                break;
        }
        return html;
    }

    function encodeTags (html) {
        if (html == null) return html;
        switch (typeof html) {
            case 'number':
                break;
            case 'string':
                html = String(html).replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
                break;
            case 'object':
                // does not modify original object, but creates a copy
                if (Array.isArray(html)) {
                    html = $.extend(true, [], html);
                    for (var i = 0; i < html.length; i++) html[i] = this.encodeTags(html[i]);
                }  else {
                    html = $.extend(true, {}, html);
                    for (var i in html) html[i] = this.encodeTags(html[i]);
                }
                break;
        }
        return html;
    }

    function decodeTags (html) {
        if (html == null) return html;
        switch (typeof html) {
            case 'number':
                break;
            case 'string':
                html = String(html).replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
                break;
            case 'object':
                // does not modify original object, but creates a copy
                if (Array.isArray(html)) {
                    html = $.extend(true, [], html);
                    for (var i = 0; i < html.length; i++) html[i] = this.decodeTags(html[i]);
                }  else {
                    html = $.extend(true, {}, html);
                    for (var i in html) html[i] = this.decodeTags(html[i]);
                }
                break;
        }
        return html;
    }

    function escapeId (id) {
        if (id === '' || id == null) return '';
        return String(id).replace(/([;&,\.\+\*\~'`:"\!\^#$%@\[\]\(\)=<>\|\/? {}\\])/g, '\\$1');
    }

    function base64encode (input) {
        var output = "";
        var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        var i = 0;
        var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        input = utf8_encode(input);

        while (i < input.length) {
            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);
            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;
            if (isNaN(chr2)) {
                enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
                enc4 = 64;
            }
            output = output + keyStr.charAt(enc1) + keyStr.charAt(enc2) + keyStr.charAt(enc3) + keyStr.charAt(enc4);
        }

        function utf8_encode (string) {
            string = String(string).replace(/\r\n/g,"\n");
            var utftext = "";

            for (var n = 0; n < string.length; n++) {
                var c = string.charCodeAt(n);
                if (c < 128) {
                    utftext += String.fromCharCode(c);
                }
                else if((c > 127) && (c < 2048)) {
                    utftext += String.fromCharCode((c >> 6) | 192);
                    utftext += String.fromCharCode((c & 63) | 128);
                }
                else {
                    utftext += String.fromCharCode((c >> 12) | 224);
                    utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                    utftext += String.fromCharCode((c & 63) | 128);
                }
            }
            return utftext;
        }

        return output;
    }

    function base64decode (input) {
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;
        var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

        while (i < input.length) {
            enc1 = keyStr.indexOf(input.charAt(i++));
            enc2 = keyStr.indexOf(input.charAt(i++));
            enc3 = keyStr.indexOf(input.charAt(i++));
            enc4 = keyStr.indexOf(input.charAt(i++));
            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;
            output = output + String.fromCharCode(chr1);
            if (enc3 !== 64) {
                output = output + String.fromCharCode(chr2);
            }
            if (enc4 !== 64) {
                output = output + String.fromCharCode(chr3);
            }
        }
        output = utf8_decode(output);

        function utf8_decode (utftext) {
            var string = "";
            var i = 0;
            var c = 0, c2, c3;

            while ( i < utftext.length ) {
                c = utftext.charCodeAt(i);
                if (c < 128) {
                    string += String.fromCharCode(c);
                    i++;
                }
                else if((c > 191) && (c < 224)) {
                    c2 = utftext.charCodeAt(i+1);
                    string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                    i += 2;
                }
                else {
                    c2 = utftext.charCodeAt(i+1);
                    c3 = utftext.charCodeAt(i+2);
                    string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                    i += 3;
                }
            }

            return string;
        }

        return output;
    }

    function md5(input) {
        /*
         * Based on http://pajhome.org.uk/crypt/md5
         */

        var hexcase = 0;
        var b64pad = "";

        function __pj_crypt_hex_md5(s) {
            return __pj_crypt_rstr2hex(__pj_crypt_rstr_md5(__pj_crypt_str2rstr_utf8(s)));
        }
        function __pj_crypt_b64_md5(s) {
            return __pj_crypt_rstr2b64(__pj_crypt_rstr_md5(__pj_crypt_str2rstr_utf8(s)));
        }
        function __pj_crypt_any_md5(s, e) {
            return __pj_crypt_rstr2any(__pj_crypt_rstr_md5(__pj_crypt_str2rstr_utf8(s)), e);
        }
        function __pj_crypt_hex_hmac_md5(k, d)
        {
            return __pj_crypt_rstr2hex(__pj_crypt_rstr_hmac_md5(__pj_crypt_str2rstr_utf8(k), __pj_crypt_str2rstr_utf8(d)));
        }
        function __pj_crypt_b64_hmac_md5(k, d)
        {
            return __pj_crypt_rstr2b64(__pj_crypt_rstr_hmac_md5(__pj_crypt_str2rstr_utf8(k), __pj_crypt_str2rstr_utf8(d)));
        }
        function __pj_crypt_any_hmac_md5(k, d, e)
        {
            return __pj_crypt_rstr2any(__pj_crypt_rstr_hmac_md5(__pj_crypt_str2rstr_utf8(k), __pj_crypt_str2rstr_utf8(d)), e);
        }

        /*
         * Calculate the MD5 of a raw string
         */
        function __pj_crypt_rstr_md5(s)
        {
            return __pj_crypt_binl2rstr(__pj_crypt_binl_md5(__pj_crypt_rstr2binl(s), s.length * 8));
        }

        /*
         * Calculate the HMAC-MD5, of a key and some data (raw strings)
         */
        function __pj_crypt_rstr_hmac_md5(key, data)
        {
            var bkey = __pj_crypt_rstr2binl(key);
            if (bkey.length > 16)
                bkey = __pj_crypt_binl_md5(bkey, key.length * 8);

            var ipad = Array(16), opad = Array(16);
            for (var i = 0; i < 16; i++)
            {
                ipad[i] = bkey[i] ^ 0x36363636;
                opad[i] = bkey[i] ^ 0x5C5C5C5C;
            }

            var hash = __pj_crypt_binl_md5(ipad.concat(__pj_crypt_rstr2binl(data)), 512 + data.length * 8);
            return __pj_crypt_binl2rstr(__pj_crypt_binl_md5(opad.concat(hash), 512 + 128));
        }

        /*
         * Convert a raw string to a hex string
         */
        function __pj_crypt_rstr2hex(input)
        {
            try {
                hexcase
            } catch (e) {
                hexcase = 0;
            }
            var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
            var output = "";
            var x;
            for (var i = 0; i < input.length; i++)
            {
                x = input.charCodeAt(i);
                output += hex_tab.charAt((x >>> 4) & 0x0F)
                        + hex_tab.charAt(x & 0x0F);
            }
            return output;
        }

        /*
         * Convert a raw string to a base-64 string
         */
        function __pj_crypt_rstr2b64(input)
        {
            try {
                b64pad
            } catch (e) {
                b64pad = '';
            }
            var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            var output = "";
            var len = input.length;
            for (var i = 0; i < len; i += 3)
            {
                var triplet = (input.charCodeAt(i) << 16)
                        | (i + 1 < len ? input.charCodeAt(i + 1) << 8 : 0)
                        | (i + 2 < len ? input.charCodeAt(i + 2) : 0);
                for (var j = 0; j < 4; j++)
                {
                    if (i * 8 + j * 6 > input.length * 8)
                        output += b64pad;
                    else
                        output += tab.charAt((triplet >>> 6 * (3 - j)) & 0x3F);
                }
            }
            return output;
        }

        /*
         * Convert a raw string to an arbitrary string encoding
         */
        function __pj_crypt_rstr2any(input, encoding)
        {
            var divisor = encoding.length;
            var i, j, q, x, quotient;

            /* Convert to an array of 16-bit big-endian values, forming the dividend */
            var dividend = Array(Math.ceil(input.length / 2));
            for (i = 0; i < dividend.length; i++)
            {
                dividend[i] = (input.charCodeAt(i * 2) << 8) | input.charCodeAt(i * 2 + 1);
            }

            /*
             * Repeatedly perform a long division. The binary array forms the dividend,
             * the length of the encoding is the divisor. Once computed, the quotient
             * forms the dividend for the next step. All remainders are stored for later
             * use.
             */
            var full_length = Math.ceil(input.length * 8 /
                    (Math.log(encoding.length) / Math.log(2)));
            var remainders = Array(full_length);
            for (j = 0; j < full_length; j++)
            {
                quotient = Array();
                x = 0;
                for (i = 0; i < dividend.length; i++)
                {
                    x = (x << 16) + dividend[i];
                    q = Math.floor(x / divisor);
                    x -= q * divisor;
                    if (quotient.length > 0 || q > 0)
                        quotient[quotient.length] = q;
                }
                remainders[j] = x;
                dividend = quotient;
            }

            /* Convert the remainders to the output string */
            var output = "";
            for (i = remainders.length - 1; i >= 0; i--)
                output += encoding.charAt(remainders[i]);

            return output;
        }

        /*
         * Encode a string as utf-8.
         * For efficiency, this assumes the input is valid utf-16.
         */
        function __pj_crypt_str2rstr_utf8(input)
        {
            var output = "";
            var i = -1;
            var x, y;

            while (++i < input.length)
            {
                /* Decode utf-16 surrogate pairs */
                x = input.charCodeAt(i);
                y = i + 1 < input.length ? input.charCodeAt(i + 1) : 0;
                if (0xD800 <= x && x <= 0xDBFF && 0xDC00 <= y && y <= 0xDFFF)
                {
                    x = 0x10000 + ((x & 0x03FF) << 10) + (y & 0x03FF);
                    i++;
                }

                /* Encode output as utf-8 */
                if (x <= 0x7F)
                    output += String.fromCharCode(x);
                else if (x <= 0x7FF)
                    output += String.fromCharCode(0xC0 | ((x >>> 6) & 0x1F),
                            0x80 | (x & 0x3F));
                else if (x <= 0xFFFF)
                    output += String.fromCharCode(0xE0 | ((x >>> 12) & 0x0F),
                            0x80 | ((x >>> 6) & 0x3F),
                            0x80 | (x & 0x3F));
                else if (x <= 0x1FFFFF)
                    output += String.fromCharCode(0xF0 | ((x >>> 18) & 0x07),
                            0x80 | ((x >>> 12) & 0x3F),
                            0x80 | ((x >>> 6) & 0x3F),
                            0x80 | (x & 0x3F));
            }
            return output;
        }

        /*
         * Encode a string as utf-16
         */
        function __pj_crypt_str2rstr_utf16le(input)
        {
            var output = "";
            for (var i = 0; i < input.length; i++)
                output += String.fromCharCode(input.charCodeAt(i) & 0xFF,
                        (input.charCodeAt(i) >>> 8) & 0xFF);
            return output;
        }

        function __pj_crypt_str2rstr_utf16be(input)
        {
            var output = "";
            for (var i = 0; i < input.length; i++)
                output += String.fromCharCode((input.charCodeAt(i) >>> 8) & 0xFF,
                        input.charCodeAt(i) & 0xFF);
            return output;
        }

        /*
         * Convert a raw string to an array of little-endian words
         * Characters >255 have their high-byte silently ignored.
         */
        function __pj_crypt_rstr2binl(input)
        {
            var output = Array(input.length >> 2);
            for (var i = 0; i < output.length; i++)
                output[i] = 0;
            for (var i = 0; i < input.length * 8; i += 8)
                output[i >> 5] |= (input.charCodeAt(i / 8) & 0xFF) << (i % 32);
            return output;
        }

        /*
         * Convert an array of little-endian words to a string
         */
        function __pj_crypt_binl2rstr(input)
        {
            var output = "";
            for (var i = 0; i < input.length * 32; i += 8)
                output += String.fromCharCode((input[i >> 5] >>> (i % 32)) & 0xFF);
            return output;
        }

        /*
         * Calculate the MD5 of an array of little-endian words, and a bit length.
         */
        function __pj_crypt_binl_md5(x, len)
        {
            /* append padding */
            x[len >> 5] |= 0x80 << ((len) % 32);
            x[(((len + 64) >>> 9) << 4) + 14] = len;

            var a = 1732584193;
            var b = -271733879;
            var c = -1732584194;
            var d = 271733878;

            for (var i = 0; i < x.length; i += 16)
            {
                var olda = a;
                var oldb = b;
                var oldc = c;
                var oldd = d;

                a = __pj_crypt_md5_ff(a, b, c, d, x[i + 0], 7, -680876936);
                d = __pj_crypt_md5_ff(d, a, b, c, x[i + 1], 12, -389564586);
                c = __pj_crypt_md5_ff(c, d, a, b, x[i + 2], 17, 606105819);
                b = __pj_crypt_md5_ff(b, c, d, a, x[i + 3], 22, -1044525330);
                a = __pj_crypt_md5_ff(a, b, c, d, x[i + 4], 7, -176418897);
                d = __pj_crypt_md5_ff(d, a, b, c, x[i + 5], 12, 1200080426);
                c = __pj_crypt_md5_ff(c, d, a, b, x[i + 6], 17, -1473231341);
                b = __pj_crypt_md5_ff(b, c, d, a, x[i + 7], 22, -45705983);
                a = __pj_crypt_md5_ff(a, b, c, d, x[i + 8], 7, 1770035416);
                d = __pj_crypt_md5_ff(d, a, b, c, x[i + 9], 12, -1958414417);
                c = __pj_crypt_md5_ff(c, d, a, b, x[i + 10], 17, -42063);
                b = __pj_crypt_md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
                a = __pj_crypt_md5_ff(a, b, c, d, x[i + 12], 7, 1804603682);
                d = __pj_crypt_md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
                c = __pj_crypt_md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
                b = __pj_crypt_md5_ff(b, c, d, a, x[i + 15], 22, 1236535329);

                a = __pj_crypt_md5_gg(a, b, c, d, x[i + 1], 5, -165796510);
                d = __pj_crypt_md5_gg(d, a, b, c, x[i + 6], 9, -1069501632);
                c = __pj_crypt_md5_gg(c, d, a, b, x[i + 11], 14, 643717713);
                b = __pj_crypt_md5_gg(b, c, d, a, x[i + 0], 20, -373897302);
                a = __pj_crypt_md5_gg(a, b, c, d, x[i + 5], 5, -701558691);
                d = __pj_crypt_md5_gg(d, a, b, c, x[i + 10], 9, 38016083);
                c = __pj_crypt_md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
                b = __pj_crypt_md5_gg(b, c, d, a, x[i + 4], 20, -405537848);
                a = __pj_crypt_md5_gg(a, b, c, d, x[i + 9], 5, 568446438);
                d = __pj_crypt_md5_gg(d, a, b, c, x[i + 14], 9, -1019803690);
                c = __pj_crypt_md5_gg(c, d, a, b, x[i + 3], 14, -187363961);
                b = __pj_crypt_md5_gg(b, c, d, a, x[i + 8], 20, 1163531501);
                a = __pj_crypt_md5_gg(a, b, c, d, x[i + 13], 5, -1444681467);
                d = __pj_crypt_md5_gg(d, a, b, c, x[i + 2], 9, -51403784);
                c = __pj_crypt_md5_gg(c, d, a, b, x[i + 7], 14, 1735328473);
                b = __pj_crypt_md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);

                a = __pj_crypt_md5_hh(a, b, c, d, x[i + 5], 4, -378558);
                d = __pj_crypt_md5_hh(d, a, b, c, x[i + 8], 11, -2022574463);
                c = __pj_crypt_md5_hh(c, d, a, b, x[i + 11], 16, 1839030562);
                b = __pj_crypt_md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
                a = __pj_crypt_md5_hh(a, b, c, d, x[i + 1], 4, -1530992060);
                d = __pj_crypt_md5_hh(d, a, b, c, x[i + 4], 11, 1272893353);
                c = __pj_crypt_md5_hh(c, d, a, b, x[i + 7], 16, -155497632);
                b = __pj_crypt_md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
                a = __pj_crypt_md5_hh(a, b, c, d, x[i + 13], 4, 681279174);
                d = __pj_crypt_md5_hh(d, a, b, c, x[i + 0], 11, -358537222);
                c = __pj_crypt_md5_hh(c, d, a, b, x[i + 3], 16, -722521979);
                b = __pj_crypt_md5_hh(b, c, d, a, x[i + 6], 23, 76029189);
                a = __pj_crypt_md5_hh(a, b, c, d, x[i + 9], 4, -640364487);
                d = __pj_crypt_md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
                c = __pj_crypt_md5_hh(c, d, a, b, x[i + 15], 16, 530742520);
                b = __pj_crypt_md5_hh(b, c, d, a, x[i + 2], 23, -995338651);

                a = __pj_crypt_md5_ii(a, b, c, d, x[i + 0], 6, -198630844);
                d = __pj_crypt_md5_ii(d, a, b, c, x[i + 7], 10, 1126891415);
                c = __pj_crypt_md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
                b = __pj_crypt_md5_ii(b, c, d, a, x[i + 5], 21, -57434055);
                a = __pj_crypt_md5_ii(a, b, c, d, x[i + 12], 6, 1700485571);
                d = __pj_crypt_md5_ii(d, a, b, c, x[i + 3], 10, -1894986606);
                c = __pj_crypt_md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
                b = __pj_crypt_md5_ii(b, c, d, a, x[i + 1], 21, -2054922799);
                a = __pj_crypt_md5_ii(a, b, c, d, x[i + 8], 6, 1873313359);
                d = __pj_crypt_md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
                c = __pj_crypt_md5_ii(c, d, a, b, x[i + 6], 15, -1560198380);
                b = __pj_crypt_md5_ii(b, c, d, a, x[i + 13], 21, 1309151649);
                a = __pj_crypt_md5_ii(a, b, c, d, x[i + 4], 6, -145523070);
                d = __pj_crypt_md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
                c = __pj_crypt_md5_ii(c, d, a, b, x[i + 2], 15, 718787259);
                b = __pj_crypt_md5_ii(b, c, d, a, x[i + 9], 21, -343485551);

                a = __pj_crypt_safe_add(a, olda);
                b = __pj_crypt_safe_add(b, oldb);
                c = __pj_crypt_safe_add(c, oldc);
                d = __pj_crypt_safe_add(d, oldd);
            }
            return Array(a, b, c, d);
        }

        /*
         * These functions implement the four basic operations the algorithm uses.
         */
        function __pj_crypt_md5_cmn(q, a, b, x, s, t)
        {
            return __pj_crypt_safe_add(__pj_crypt_bit_rol(__pj_crypt_safe_add(__pj_crypt_safe_add(a, q), __pj_crypt_safe_add(x, t)), s), b);
        }
        function __pj_crypt_md5_ff(a, b, c, d, x, s, t)
        {
            return __pj_crypt_md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
        }
        function __pj_crypt_md5_gg(a, b, c, d, x, s, t)
        {
            return __pj_crypt_md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
        }
        function __pj_crypt_md5_hh(a, b, c, d, x, s, t)
        {
            return __pj_crypt_md5_cmn(b ^ c ^ d, a, b, x, s, t);
        }
        function __pj_crypt_md5_ii(a, b, c, d, x, s, t)
        {
            return __pj_crypt_md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
        }

        /*
         * Add integers, wrapping at 2^32. This uses 16-bit operations internally
         * to work around bugs in some JS interpreters.
         */
        function __pj_crypt_safe_add(x, y)
        {
            var lsw = (x & 0xFFFF) + (y & 0xFFFF);
            var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
            return (msw << 16) | (lsw & 0xFFFF);
        }

        /*
         * Bitwise rotate a 32-bit number to the left.
         */
        function __pj_crypt_bit_rol(num, cnt)
        {
            return (num << cnt) | (num >>> (32 - cnt));
        }

        return __pj_crypt_hex_md5(input);

    }

    function transition (div_old, div_new, type, callBack) {
        var width  = $(div_old).width();
        var height = $(div_old).height();
        var time   = 0.5;

        if (!div_old || !div_new) {
            console.log('ERROR: Cannot do transition when one of the divs is null');
            return;
        }

        div_old.parentNode.style.cssText += 'perspective: 900px; overflow: hidden;';
        div_old.style.cssText += '; position: absolute; z-index: 1019; backface-visibility: hidden';
        div_new.style.cssText += '; position: absolute; z-index: 1020; backface-visibility: hidden';

        switch (type) {
            case 'slide-left':
                // init divs
                div_old.style.cssText += 'overflow: hidden; transform: translate3d(0, 0, 0)';
                div_new.style.cssText += 'overflow: hidden; transform: translate3d('+ width + 'px, 0, 0)';
                $(div_new).show();
                // -- need a timing function because otherwise not working
                window.setTimeout(function() {
                    div_new.style.cssText += 'transition: '+ time +'s; transform: translate3d(0, 0, 0)';
                    div_old.style.cssText += 'transition: '+ time +'s; transform: translate3d(-'+ width +'px, 0, 0)';
                }, 1);
                break;

            case 'slide-right':
                // init divs
                div_old.style.cssText += 'overflow: hidden; transform: translate3d(0, 0, 0)';
                div_new.style.cssText += 'overflow: hidden; transform: translate3d(-'+ width +'px, 0, 0)';
                $(div_new).show();
                // -- need a timing function because otherwise not working
                window.setTimeout(function() {
                    div_new.style.cssText += 'transition: '+ time +'s; transform: translate3d(0px, 0, 0)';
                    div_old.style.cssText += 'transition: '+ time +'s; transform: translate3d('+ width +'px, 0, 0)';
                }, 1);
                break;

            case 'slide-down':
                // init divs
                div_old.style.cssText += 'overflow: hidden; z-index: 1; transform: translate3d(0, 0, 0)';
                div_new.style.cssText += 'overflow: hidden; z-index: 0; transform: translate3d(0, 0, 0)';
                $(div_new).show();
                // -- need a timing function because otherwise not working
                window.setTimeout(function() {
                    div_new.style.cssText += 'transition: '+ time +'s; transform: translate3d(0, 0, 0)';
                    div_old.style.cssText += 'transition: '+ time +'s; transform: translate3d(0, '+ height +'px, 0)';
                }, 1);
                break;

            case 'slide-up':
                // init divs
                div_old.style.cssText += 'overflow: hidden; transform: translate3d(0, 0, 0)';
                div_new.style.cssText += 'overflow: hidden; transform: translate3d(0, '+ height +'px, 0)';
                $(div_new).show();
                // -- need a timing function because otherwise not working
                window.setTimeout(function() {
                    div_new.style.cssText += 'transition: '+ time +'s; transform: translate3d(0, 0, 0)';
                    div_old.style.cssText += 'transition: '+ time +'s; transform: translate3d(0, 0, 0)';
                }, 1);
                break;

            case 'flip-left':
                // init divs
                div_old.style.cssText += 'overflow: hidden; transform: rotateY(0deg)';
                div_new.style.cssText += 'overflow: hidden; transform: rotateY(-180deg)';
                $(div_new).show();
                // -- need a timing function because otherwise not working
                window.setTimeout(function() {
                    div_new.style.cssText += 'transition: '+ time +'s; transform: rotateY(0deg)';
                    div_old.style.cssText += 'transition: '+ time +'s; transform: rotateY(180deg)';
                }, 1);
                break;

            case 'flip-right':
                // init divs
                div_old.style.cssText += 'overflow: hidden; transform: rotateY(0deg)';
                div_new.style.cssText += 'overflow: hidden; transform: rotateY(180deg)';
                $(div_new).show();
                // -- need a timing function because otherwise not working
                window.setTimeout(function() {
                    div_new.style.cssText += 'transition: '+ time +'s; transform: rotateY(0deg)';
                    div_old.style.cssText += 'transition: '+ time +'s; transform: rotateY(-180deg)';
                }, 1);
                break;

            case 'flip-down':
                // init divs
                div_old.style.cssText += 'overflow: hidden; transform: rotateX(0deg)';
                div_new.style.cssText += 'overflow: hidden; transform: rotateX(180deg)';
                $(div_new).show();
                // -- need a timing function because otherwise not working
                window.setTimeout(function() {
                    div_new.style.cssText += 'transition: '+ time +'s; transform: rotateX(0deg)';
                    div_old.style.cssText += 'transition: '+ time +'s; transform: rotateX(-180deg)';
                }, 1);
                break;

            case 'flip-up':
                // init divs
                div_old.style.cssText += 'overflow: hidden; transform: rotateX(0deg)';
                div_new.style.cssText += 'overflow: hidden; transform: rotateX(-180deg)';
                $(div_new).show();
                // -- need a timing function because otherwise not working
                window.setTimeout(function() {
                    div_new.style.cssText += 'transition: '+ time +'s; transform: rotateX(0deg)';
                    div_old.style.cssText += 'transition: '+ time +'s; transform: rotateX(180deg)';
                }, 1);
                break;

            case 'pop-in':
                // init divs
                div_old.style.cssText += 'overflow: hidden; transform: translate3d(0, 0, 0)';
                div_new.style.cssText += 'overflow: hidden; transform: translate3d(0, 0, 0); transform: scale(.8); opacity: 0;';
                $(div_new).show();
                // -- need a timing function because otherwise not working
                window.setTimeout(function() {
                    div_new.style.cssText += 'transition: '+ time +'s; transform: scale(1); opacity: 1;';
                    div_old.style.cssText += 'transition: '+ time +'s;';
                }, 1);
                break;

            case 'pop-out':
                // init divs
                div_old.style.cssText += 'overflow: hidden; transform: translate3d(0, 0, 0); transform: scale(1); opacity: 1;';
                div_new.style.cssText += 'overflow: hidden; transform: translate3d(0, 0, 0); opacity: 0;';
                $(div_new).show();
                // -- need a timing function because otherwise not working
                window.setTimeout(function() {
                    div_new.style.cssText += 'transition: '+ time +'s; opacity: 1;';
                    div_old.style.cssText += 'transition: '+ time +'s; transform: scale(1.7); opacity: 0;';
                }, 1);
                break;

            default:
                // init divs
                div_old.style.cssText += 'overflow: hidden; transform: translate3d(0, 0, 0)';
                div_new.style.cssText += 'overflow: hidden; translate3d(0, 0, 0); opacity: 0;';
                $(div_new).show();
                // -- need a timing function because otherwise not working
                window.setTimeout(function() {
                    div_new.style.cssText += 'transition: '+ time +'s; opacity: 1;';
                    div_old.style.cssText += 'transition: '+ time +'s';
                }, 1);
                break;
        }

        setTimeout(function () {
            if (type === 'slide-down') {
                $(div_old).css('z-index', '1019');
                $(div_new).css('z-index', '1020');
            }
            if (div_new) {
                $(div_new).css({ 'opacity': '1' }).css(w2utils.cssPrefix({
                    'transition': '',
                    'transform' : ''
                }));
            }
            if (div_old) {
                $(div_old).css({ 'opacity': '1' }).css(w2utils.cssPrefix({
                    'transition': '',
                    'transform' : ''
                }));
            }
            if (typeof callBack === 'function') callBack();
        }, time * 1000);
    }

    function lock (box, msg, spinner) {
        var options = {};
        if (typeof msg === 'object') {
            options = msg;
        } else {
            options.msg     = msg;
            options.spinner = spinner;
        }
        if (!options.msg && options.msg !== 0) options.msg = '';
        w2utils.unlock(box);
        $(box).prepend(
            '<div class="w2ui-lock"></div>'+
            '<div class="w2ui-lock-msg"></div>'
        );
        var $lock = $(box).find('.w2ui-lock');
        var mess = $(box).find('.w2ui-lock-msg');
        if (!options.msg) mess.css({ 'background-color': 'transparent', 'border': '0px' });
        if (options.spinner === true) options.msg = '<div class="w2ui-spinner" '+ (!options.msg ? 'style="width: 35px; height: 35px"' : '') +'></div>' + options.msg;
        if (options.opacity != null) $lock.css('opacity', options.opacity);
        if (typeof $lock.fadeIn == 'function') {
            $lock.fadeIn(200);
            mess.html(options.msg).fadeIn(200);
        } else {
            $lock.show();
            mess.html(options.msg).show(0);
        }
    }

    function unlock (box, speed) {
        if (isInt(speed)) {
            $(box).find('.w2ui-lock').fadeOut(speed);
            setTimeout(function () {
                $(box).find('.w2ui-lock').remove();
                $(box).find('.w2ui-lock-msg').remove();
            }, speed);
        } else {
            $(box).find('.w2ui-lock').remove();
            $(box).find('.w2ui-lock-msg').remove();
        }
    }

    /**
    *  Used in w2popup, w2grid, w2form, w2layout
    *  should be called with .call(...) method
    */

    function message(where, options) {
        var obj = this, closeTimer, edata;
        // var where.path    = 'w2popup';
        // var where.title   = '.w2ui-popup-title';
        // var where.body    = '.w2ui-box';
        $().w2tag(); // hide all tags
        if (!options) options = { width: 200, height: 100 };
        if (options.on == null) $.extend(options, w2utils.event);
        if (options.width == null) options.width = 200;
        if (options.height == null) options.height = 100;
        var pWidth  = parseInt($(where.box).width());
        var pHeight = parseInt($(where.box).height());
        var titleHeight = parseInt($(where.box).find(where.title).css('height') || 0);
        if (options.width > pWidth) options.width = pWidth - 10;
        if (options.height > pHeight - titleHeight) options.height = pHeight - 10 - titleHeight;
        options.originalWidth  = options.width;
        options.originalHeight = options.height;
        if (parseInt(options.width) < 0)   options.width  = pWidth + options.width;
        if (parseInt(options.width) < 10)  options.width  = 10;
        if (parseInt(options.height) < 0)  options.height  = pHeight + options.height - titleHeight;
        if (parseInt(options.height) < 10) options.height = 10;
        if (options.hideOnClick == null) options.hideOnClick = false;
        var poptions = $(where.box).data('options') || {};
        if (options.width == null || options.width > poptions.width - 10) {
            options.width = poptions.width - 10;
        }
        if (options.height == null || options.height > poptions.height - titleHeight - 5) {
            options.height = poptions.height - titleHeight - 5; // need margin from bottom only
        }
        // negative value means margin
        if (options.originalHeight < 0) options.height = pHeight + options.originalHeight - titleHeight;
        if (options.originalWidth < 0) options.width = pWidth + options.originalWidth * 2; // x 2 because there is left and right margin
        var head = $(where.box).find(where.title);

        // if some messages are closing, insta close them
        var $tmp = $(where.box).find('.w2ui-message.w2ui-closing');
        if ($(where.box).find('.w2ui-message.w2ui-closing').length > 0) {
            clearTimeout(closeTimer);
            closeCB($tmp, $tmp.data('options') || {});
        }
        var msgCount = $(where.box).find('.w2ui-message').length;
        // remove message
        if ($.trim(options.html) === '' && $.trim(options.body) === '' && $.trim(options.buttons) === '') {
            if (msgCount === 0) return; // no messages at all
            var $msg = $(where.box).find('#w2ui-message'+ (msgCount-1));
            var options = $msg.data('options') || {};
            // before event
            edata = options.trigger({ phase: 'before', type: 'close', target: 'self' });
            if (edata.isCancelled === true) return;
            // default behavior
            $msg.css(w2utils.cssPrefix({
                'transition': '0.15s',
                'transform': 'translateY(-' + options.height + 'px)'
            })).addClass('w2ui-closing');
            if (msgCount == 1) {
                if (this.unlock) {
                    if (where.param) this.unlock(where.param, 150); else this.unlock(150);
                }
            } else {
                $(where.box).find('#w2ui-message'+ (msgCount-2)).css('z-index', 1500);
            }
            closeTimer = setTimeout(function () { closeCB($msg, options) }, 150);

        } else {

            if ($.trim(options.body) !== '' || $.trim(options.buttons) !== '') {
                options.html = '<div class="w2ui-message-body">'+ (options.body || '') +'</div>'+
                    '<div class="w2ui-message-buttons">'+ (options.buttons || '') +'</div>';
            }
            // hide previous messages
            $(where.box).find('.w2ui-message').css('z-index', 1390);
            head.data('old-z-index', head.css('z-index'));
            head.css('z-index', 1501);
            // add message
            $(where.box).find(where.body)
                .before('<div id="w2ui-message' + msgCount + '" onmousedown="event.stopPropagation();" '+
                        '   class="w2ui-message" style="display: none; z-index: 1500; ' +
                            (head.length === 0 ? 'top: 0px;' : 'top: ' + w2utils.getSize(head, 'height') + 'px;') +
                            (options.width  != null ? 'width: ' + options.width + 'px; left: ' + ((pWidth - options.width) / 2) + 'px;' : 'left: 10px; right: 10px;') +
                            (options.height != null ? 'height: ' + options.height + 'px;' : 'bottom: 6px;') +
                            w2utils.cssPrefix('transition', '.3s', true) + '"' +
                            (options.hideOnClick === true
                                ? where.param
                                    ? 'onclick="'+ where.path +'.message(\''+ where.param +'\');"'
                                    : 'onclick="'+ where.path +'.message();"'
                                : '') + '>' +
                        '</div>');
            $(where.box).find('#w2ui-message'+ msgCount)
                .data('options', options)
                .data('prev_focus', $(':focus'));
            var display = $(where.box).find('#w2ui-message'+ msgCount).css('display');
            $(where.box).find('#w2ui-message'+ msgCount).css(w2utils.cssPrefix({
                'transform': (display == 'none' ? 'translateY(-' + options.height + 'px)' : 'translateY(0px)')
            }));
            if (display == 'none') {
                $(where.box).find('#w2ui-message'+ msgCount).show().html(options.html);
                options.box = $(where.box).find('#w2ui-message'+ msgCount);
                // before event
                edata = options.trigger({ phase: 'before', type: 'open', target: 'self' });
                if (edata.isCancelled === true) {
                    head.css('z-index', head.data('old-z-index'));
                    $(where.box).find('#w2ui-message'+ msgCount).remove();
                    return;
                }
                // timer needs to animation
                setTimeout(function () {
                    $(where.box).find('#w2ui-message'+ msgCount).css(w2utils.cssPrefix({
                        'transform': (display == 'none' ? 'translateY(0px)' : 'translateY(-' + options.height + 'px)')
                    }));
                }, 1);
                // timer for lock
                if (msgCount === 0 && this.lock) {
                    if (where.param) this.lock(where.param); else this.lock();
                }
                setTimeout(function() {
                    // has to be on top of lock
                    $(where.box).find('#w2ui-message'+ msgCount).css(w2utils.cssPrefix({ 'transition': '0s' }));
                    // event after
                    options.trigger($.extend(edata, { phase: 'after' }));
                }, 350);
            }
        }

        function closeCB($msg, options) {
            if (edata == null) {
                // before event
                edata = options.trigger({ phase: 'before', type: 'open', target: 'self' });
                if (edata.isCancelled === true) {
                    head.css('z-index', head.data('old-z-index'));
                    $(where.box).find('#w2ui-message'+ msgCount).remove();
                    return;
                }
            }
            var $focus = $msg.data('prev_focus');
            $msg.remove();
            if ($focus && $focus.length > 0) {
                $focus.focus();
            } else {
                if (obj && obj.focus) obj.focus();
            }
            head.css('z-index', head.data('old-z-index'));
            // event after
            options.trigger($.extend(edata, { phase: 'after' }));
        }
    }

    function getSize (el, type) {
        var $el = $(el);
        var bwidth = {
            left    : parseInt($el.css('border-left-width')) || 0,
            right   : parseInt($el.css('border-right-width')) || 0,
            top     : parseInt($el.css('border-top-width')) || 0,
            bottom  : parseInt($el.css('border-bottom-width')) || 0
        };
        var mwidth = {
            left    : parseInt($el.css('margin-left')) || 0,
            right   : parseInt($el.css('margin-right')) || 0,
            top     : parseInt($el.css('margin-top')) || 0,
            bottom  : parseInt($el.css('margin-bottom')) || 0
        };
        var pwidth = {
            left    : parseInt($el.css('padding-left')) || 0,
            right   : parseInt($el.css('padding-right')) || 0,
            top     : parseInt($el.css('padding-top')) || 0,
            bottom  : parseInt($el.css('padding-bottom')) || 0
        };
        switch (type) {
            case 'top'      : return bwidth.top + mwidth.top + pwidth.top;
            case 'bottom'   : return bwidth.bottom + mwidth.bottom + pwidth.bottom;
            case 'left'     : return bwidth.left + mwidth.left + pwidth.left;
            case 'right'    : return bwidth.right + mwidth.right + pwidth.right;
            case 'width'    : return bwidth.left + bwidth.right + mwidth.left + mwidth.right + pwidth.left + pwidth.right + parseInt($el.width());
            case 'height'   : return bwidth.top + bwidth.bottom + mwidth.top + mwidth.bottom + pwidth.top + pwidth.bottom + parseInt($el.height());
            case '+width'   : return bwidth.left + bwidth.right + mwidth.left + mwidth.right + pwidth.left + pwidth.right;
            case '+height'  : return bwidth.top + bwidth.bottom + mwidth.top + mwidth.bottom + pwidth.top + pwidth.bottom;
        }
        return 0;
    }

    function getStrWidth (str, styles) {
        var w, html = '<div id="_tmp_width" style="position: absolute; top: -900px;'+ (styles || '') +'">'+
                        encodeTags(str) +
                      '</div>';
        $('body').append(html);
        w = $('#_tmp_width').width();
        $('#_tmp_width').remove();
        return w;
    }

    function lang (phrase) {
        var translation = this.settings.phrases[phrase];
        if (translation == null) return phrase; else return translation;
    }

    function locale (locale) {
        if (!locale) locale = 'en-us';

        // if the locale is an object, not a string, than we assume it's a
        if(typeof locale !== "string" ) {
            w2utils.settings = $.extend(true, w2utils.settings, locale);
            return;
        }

        if (locale.length === 5) locale = 'locale/'+ locale +'.json';

        // clear phrases from language before
        w2utils.settings.phrases = {};

        // load from the file
        $.ajax({
            url      : locale,
            type     : "GET",
            dataType : "JSON",
            async    : false,
            success  : function (data, status, xhr) {
                w2utils.settings = $.extend(true, w2utils.settings, data);
            },
            error    : function (xhr, status, msg) {
                console.log('ERROR: Cannot load locale '+ locale);
            }
        });
    }

    function scrollBarSize () {
        if (tmp.scrollBarSize) return tmp.scrollBarSize;
        var html =
            '<div id="_scrollbar_width" style="position: absolute; top: -300px; width: 100px; height: 100px; overflow-y: scroll;">'+
            '    <div style="height: 120px">1</div>'+
            '</div>';
        $('body').append(html);
        tmp.scrollBarSize = 100 - $('#_scrollbar_width > div').width();
        $('#_scrollbar_width').remove();
        if (String(navigator.userAgent).indexOf('MSIE') >= 0) tmp.scrollBarSize  = tmp.scrollBarSize / 2; // need this for IE9+
        return tmp.scrollBarSize;
    }

    function checkName (params, component) { // was w2checkNameParam
        if (!params || params.name == null) {
            console.log('ERROR: The parameter "name" is required but not supplied in $().'+ component +'().');
            return false;
        }
        if (w2ui[params.name] != null) {
            console.log('ERROR: The parameter "name" is not unique. There are other objects already created with the same name (obj: '+ params.name +').');
            return false;
        }
        if (!w2utils.isAlphaNumeric(params.name)) {
            console.log('ERROR: The parameter "name" has to be alpha-numeric (a-z, 0-9, dash and underscore). ');
            return false;
        }
        return true;
    }

    function checkUniqueId (id, items, itemsDecription, objName) { // was w2checkUniqueId
        if (!$.isArray(items)) items = [items];
        for (var i = 0; i < items.length; i++) {
            if (items[i].id === id) {
                console.log('ERROR: The parameter "id='+ id +'" is not unique within the current '+ itemsDecription +'. (obj: '+ objName +')');
                return false;
            }
        }
        return true;
    }

    function parseRoute(route) {
        var keys = [];
        var path = route
            .replace(/\/\(/g, '(?:/')
            .replace(/\+/g, '__plus__')
            .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?/g, function(_, slash, format, key, capture, optional) {
                keys.push({ name: key, optional: !! optional });
                slash = slash || '';
                return '' + (optional ? '' : slash) + '(?:' + (optional ? slash : '') + (format || '') + (capture || (format && '([^/.]+?)' || '([^/]+?)')) + ')' + (optional || '');
            })
            .replace(/([\/.])/g, '\\$1')
            .replace(/__plus__/g, '(.+)')
            .replace(/\*/g, '(.*)');
        return {
            path  : new RegExp('^' + path + '$', 'i'),
            keys  : keys
        };
    }

    function cssPrefix(field, value, returnString) {
        var css    = {};
        var newCSS = {};
        var ret    = '';
        if (!$.isPlainObject(field)) {
            css[field] = value;
        } else {
            css = field;
            if (value === true) returnString = true;
        }
        for (var c in css) {
            newCSS[c] = css[c];
            newCSS['-webkit-'+c] = css[c];
            newCSS['-moz-'+c]    = css[c].replace('-webkit-', '-moz-');
            newCSS['-ms-'+c]     = css[c].replace('-webkit-', '-ms-');
            newCSS['-o-'+c]      = css[c].replace('-webkit-', '-o-');
        }
        if (returnString === true) {
            for (var c in newCSS) {
                ret += c + ': ' + newCSS[c] + '; ';
            }
        } else {
            ret = newCSS;
        }
        return ret;
    }

    function getCursorPosition(input) {
        if (input == null) return null;
        var caretOffset = 0;
        var doc = input.ownerDocument || input.document;
        var win = doc.defaultView || doc.parentWindow;
        var sel;
        if (input.tagName && input.tagName.toUpperCase() == 'INPUT' && input.selectionStart) {
            // standards browser
            caretOffset = input.selectionStart;
        } else {
            if (win.getSelection) {
                sel = win.getSelection();
                if (sel.rangeCount > 0) {
                    var range = sel.getRangeAt(0);
                    var preCaretRange = range.cloneRange();
                    preCaretRange.selectNodeContents(input);
                    preCaretRange.setEnd(range.endContainer, range.endOffset);
                    caretOffset = preCaretRange.toString().length;
                }
            } else if ( (sel = doc.selection) && sel.type != "Control") {
                var textRange = sel.createRange();
                var preCaretTextRange = doc.body.createTextRange();
                preCaretTextRange.moveToElementText(input);
                preCaretTextRange.setEndPoint("EndToEnd", textRange);
                caretOffset = preCaretTextRange.text.length;
            }
        }
        return caretOffset;
    }

    function setCursorPosition(input, pos, posEnd) {
        var range = document.createRange();
        var el, sel = window.getSelection();
        if (input == null) return;
        for (var i = 0; i < input.childNodes.length; i++) {
            var tmp = $(input.childNodes[i]).text();
            if (input.childNodes[i].tagName) {
                tmp = $(input.childNodes[i]).html();
                tmp = tmp.replace(/&lt;/g, '<')
                         .replace(/&gt;/g, '>')
                         .replace(/&amp;/g, '&')
                         .replace(/&quot;/g, '"')
                         .replace(/&nbsp;/g, ' ');
            }
            if (pos <= tmp.length) {
                el = input.childNodes[i];
                if (el.childNodes && el.childNodes.length > 0) el = el.childNodes[0];
                if (el.childNodes && el.childNodes.length > 0) el = el.childNodes[0];
                break;
            } else {
                pos -= tmp.length;
            }
        }
        if (el == null) return;
        if (pos > el.length) pos = el.length;
        range.setStart(el, pos);
        if (posEnd) {
            range.setEnd(el, posEnd);
        } else {
            range.collapse(true);
        }
        sel.removeAllRanges();
        sel.addRange(range);
    }

    function testLocalStorage() {
        // test if localStorage is available, see issue #1282
        // original code: https://github.com/Modernizr/Modernizr/blob/master/feature-detects/storage/localstorage.js
        var str = 'w2ui_test';
        try {
          localStorage.setItem(str, str);
          localStorage.removeItem(str);
          return true;
        } catch (e) {
          return false;
        }
    }

})(jQuery);

/***********************************************************
*  Formatters object
*  --- Primariy used in grid
*
*********************************************************/

w2utils.formatters = {

    'number': function (value, params) {
        if (parseInt(params) > 20) params = 20;
        if (parseInt(params) < 0) params = 0;
        if (value == null || value === '') return '';
        return w2utils.formatNumber(parseFloat(value), params, true);
    },

    'float': function (value, params) {
        return w2utils.formatters['number'](value, params);
    },

    'int': function (value, params) {
        return w2utils.formatters['number'](value, 0);
    },

    'money': function (value, params) {
        if (value == null || value === '') return '';
        var data = w2utils.formatNumber(Number(value), w2utils.settings.currencyPrecision || 2);
        return (w2utils.settings.currencyPrefix || '') + data + (w2utils.settings.currencySuffix || '');
    },

    'currency': function (value, params) {
        return w2utils.formatters['money'](value, params);
    },

    'percent': function (value, params) {
        if (value == null || value === '') return '';
        return w2utils.formatNumber(value, params || 1) + '%';
    },

    'size': function (value, params) {
        if (value == null || value === '') return '';
        return w2utils.formatSize(parseInt(value));
    },

    'date': function (value, params) {
        if (params === '') params = w2utils.settings.dateFormat;
        if (value == null || value === 0 || value === '') return '';
        var dt = w2utils.isDateTime(value, params, true);
        if (dt === false) dt = w2utils.isDate(value, params, true);
        return '<span title="'+ dt +'">' + w2utils.formatDate(dt, params) + '</span>';
    },

    'datetime': function (value, params) {
        if (params === '') params = w2utils.settings.datetimeFormat;
        if (value == null || value === 0 || value === '') return '';
        var dt = w2utils.isDateTime(value, params, true);
        if (dt === false) dt = w2utils.isDate(value, params, true);
        return '<span title="'+ dt +'">' + w2utils.formatDateTime(dt, params) + '</span>';
    },

    'time': function (value, params) {
        if (params === '') params = w2utils.settings.timeFormat;
        if (params === 'h12') params = 'hh:mi pm';
        if (params === 'h24') params = 'h24:mi';
        if (value == null || value === 0 || value === '') return '';
        var dt = w2utils.isDateTime(value, params, true);
        if (dt === false) dt = w2utils.isDate(value, params, true);
        return '<span title="'+ dt +'">' + w2utils.formatTime(value, params) + '</span>';
    },

    'timestamp': function (value, params) {
        if (params === '') params = w2utils.settings.datetimeFormat;
        if (value == null || value === 0 || value === '') return '';
        var dt = w2utils.isDateTime(value, params, true);
        if (dt === false) dt = w2utils.isDate(value, params, true);
        return dt.toString ? dt.toString() : '';
    },

    'gmt': function (value, params) {
        if (params === '') params = w2utils.settings.datetimeFormat;
        if (value == null || value === 0 || value === '') return '';
        var dt = w2utils.isDateTime(value, params, true);
        if (dt === false) dt = w2utils.isDate(value, params, true);
        return dt.toUTCString ? dt.toUTCString() : '';
    },

    'age': function (value, params) {
        if (value == null || value === 0 || value === '') return '';
        var dt = w2utils.isDateTime(value, null, true);
        if (dt === false) dt = w2utils.isDate(value, null, true);
        return '<span title="'+ dt +'">' + w2utils.age(value) + (params ? (' ' + params) : '') + '</span>';
    },

    'interval': function (value, params) {
        if (value == null || value === 0 || value === '') return '';
        return w2utils.interval(value) + (params ? (' ' + params) : '');
    },

    'toggle': function (value, params) {
        return (value ? 'Yes' : '');
    },

    'password': function (value, params) {
        var ret = "";
        for (var i=0; i < value.length; i++) {
            ret += "*";
        }
        return ret;
    }
};

/***********************************************************
*  Generic Event Object
*  --- This object is reused across all other
*  --- widgets in w2ui.
*
*********************************************************/

w2utils.event = {

    on: function (edata, handler) {
        var $ = jQuery;
        var scope;
        // allow 'eventName.scope' syntax
        if (typeof edata == 'string' && edata.indexOf('.') != -1) {
            var tmp = edata.split('.');
            edata = tmp[0];
            scope = tmp[1];
        }
        // allow 'eventName:after' syntax
        if (typeof edata == 'string' && edata.indexOf(':') != -1) {
            var tmp = edata.split(':');
            if (['complete', 'done'].indexOf(edata[1]) != -1) edata[1] = 'after';
            edata = {
                type    : tmp[0],
                execute : tmp[1]
            };
        }
        if (!$.isPlainObject(edata)) edata = { type: edata, scope: scope };
        edata = $.extend({ type: null, execute: 'before', target: null, onComplete: null }, edata);
        // errors
        if (!edata.type) { console.log('ERROR: You must specify event type when calling .on() method of '+ this.name); return; }
        if (!handler) { console.log('ERROR: You must specify event handler function when calling .on() method of '+ this.name); return; }
        if (!$.isArray(this.handlers)) this.handlers = [];
        console.log('add', edata);
        this.handlers.push({ edata: edata, handler: handler });
    },

    off: function (edata, handler) {
        var $ = jQuery;
        var scope;
        // allow 'eventName.scope' syntax
        if (typeof edata == 'string' && edata.indexOf('.') != -1) {
            var tmp = edata.split('.');
            edata = tmp[0];
            scope = tmp[1];
        }
        // allow 'eventName:after' syntax
        if (typeof edata == 'string' && edata.indexOf(':') != -1) {
            var tmp = edata.split(':');
            if (['complete', 'done'].indexOf(edata[1]) != -1) edata[1] = 'after';
            edata = {
                type    : tmp[0],
                execute : tmp[1]
            }
        }
        if (!$.isPlainObject(edata)) edata = { type: edata };
        edata = $.extend({}, { type: null, execute: 'before', target: null, onComplete: null }, edata);
        // errors
        if (!edata.type && !scope) { console.log('ERROR: You must specify event type when calling .off() method of '+ this.name); return; }
        if (!handler) { handler = null; }
        // remove handlers
        var newHandlers = [];
        for (var h = 0, len = this.handlers.length; h < len; h++) {
            var t = this.handlers[h];
            if ((t.edata.type === edata.type || edata.type === '*' || (t.edata.scope != null && edata.type == '')) &&
                (t.edata.target === edata.target || edata.target == null) &&
                (t.edata.execute === edata.execute || edata.execute == null) &&
                (t.handler === handler || handler == null || (scope != null && t.edata.scope == scope)))
            {
                // match
            } else {
                newHandlers.push(t);
            }
        }
        this.handlers = newHandlers;
    },

    trigger: function (edata) {
        var $ = jQuery;
        var edata = $.extend({ type: null, phase: 'before', target: null, doneHandlers: [] }, edata, {
            isStopped       : false,
            isCancelled     : false,
            done            : function (handler) { this.doneHandlers.push(handler); },
            preventDefault  : function () { this.isCancelled = true; },
            stopPropagation : function () { this.isStopped   = true; }
        });
        if (edata.phase === 'before') edata.onComplete = null;
        var args, fun, tmp;
        if (edata.target == null) edata.target = null;
        if (!$.isArray(this.handlers)) this.handlers = [];
        // process events in REVERSE order
        for (var h = this.handlers.length-1; h >= 0; h--) {
            var item = this.handlers[h];
            if ((item.edata.type === edata.type || item.edata.type === '*') &&
                (item.edata.target === edata.target || item.edata.target == null) &&
                (item.edata.execute === edata.phase || item.edata.execute === '*' || item.edata.phase === '*'))
            {
                edata = $.extend({}, item.edata, edata);
                // check handler arguments
                args = [];
                tmp  = new RegExp(/\((.*?)\)/).exec(item.handler);
                if (tmp) args = tmp[1].split(/\s*,\s*/);
                if (args.length === 2) {
                    item.handler.call(this, edata.target, edata); // old way for back compatibility
                } else {
                    item.handler.call(this, edata); // new way
                }
                if (edata.isStopped === true || edata.stop === true) return edata; // back compatibility edata.stop === true
            }
        }
        // main object events
        var funName = 'on' + edata.type.substr(0,1).toUpperCase() + edata.type.substr(1);
        if (edata.phase === 'before' && typeof this[funName] === 'function') {
            fun = this[funName];
            // check handler arguments
            args = [];
            tmp  = new RegExp(/\((.*?)\)/).exec(fun);
            if (tmp) args = tmp[1].split(/\s*,\s*/);
            if (args.length === 2) {
                fun.call(this, edata.target, edata); // old way for back compatibility
            } else {
                fun.call(this, edata); // new way
            }
            if (edata.isStopped === true || edata.stop === true) return edata; // back compatibility edata.stop === true
        }
        // item object events
        if (edata.object != null && edata.phase === 'before' &&
            typeof edata.object[funName] === 'function')
        {
            fun = edata.object[funName];
            // check handler arguments
            args = [];
            tmp  = new RegExp(/\((.*?)\)/).exec(fun);
            if (tmp) args = tmp[1].split(/\s*,\s*/);
            if (args.length === 2) {
                fun.call(this, edata.target, edata); // old way for back compatibility
            } else {
                fun.call(this, edata); // new way
            }
            if (edata.isStopped === true || edata.stop === true) return edata;
        }
        // execute onComplete
        if (edata.phase === 'after') {
            if (typeof edata.onComplete === 'function') edata.onComplete.call(this, edata);
            for (var i = 0; i < edata.doneHandlers.length; i++) {
                if (typeof edata.doneHandlers[i] == 'function') {
                    edata.doneHandlers[i].call(this, edata);
                }
            }
        }
        return edata;
    }
};

/***********************************************************
*  Commonly used plugins
*  --- used primarily in grid and form
*
*********************************************************/

(function ($) {

    $.fn.w2render = function (name) {
        if ($(this).length > 0) {
            if (typeof name === 'string' && w2ui[name]) w2ui[name].render($(this)[0]);
            if (typeof name === 'object') name.render($(this)[0]);
        }
    };

    $.fn.w2destroy = function (name) {
        if (!name && this.length > 0) name = this.attr('name');
        if (typeof name === 'string' && w2ui[name]) w2ui[name].destroy();
        if (typeof name === 'object') name.destroy();
    };

    $.fn.w2marker = function () {
        var str = Array.prototype.slice.call(arguments, 0);
        if (Array.isArray(str[0])) str = str[0];
        if (str.length === 0 || !str[0]) { // remove marker
            return $(this).each(clearMarkedText);
        } else { // add marker
            return $(this).each(function (index, el) {
                clearMarkedText(index, el);
                for (var s = 0; s < str.length; s++) {
                    var tmp = str[s];
                    if (typeof tmp !== 'string') tmp = String(tmp);
                    // escape regex special chars
                    tmp = tmp.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&").replace(/&/g, '&amp;').replace(/</g, '&gt;').replace(/>/g, '&lt;');
                    var regex = new RegExp(tmp + '(?!([^<]+)?>)', "gi"); // only outside tags
                    el.innerHTML = el.innerHTML.replace(regex, replaceValue);
                }
                function replaceValue(matched) { // mark new
                    return '<span class="w2ui-marker">' + matched + '</span>';
                }
            });
        }

        function clearMarkedText(index, el) {
            while (el.innerHTML.indexOf('<span class="w2ui-marker">') != -1) {
                el.innerHTML = el.innerHTML.replace(/\<span class=\"w2ui\-marker\"\>((.|\n|\r)*)\<\/span\>/ig, '$1'); // unmark
            }
        }
    };

    // -- w2tag - there can be multiple on screen at a time

    $.fn.w2tag = function (text, options) {
        // only one argument
        if (arguments.length == 1 && typeof text == 'object') {
            options = text;
            if (options.html != null) text = options.html;
        }
        // default options
        options = $.extend({
            id              : null,     // id for the tag, otherwise input id is used
            html            : text,     // or html
            position        : 'right|top',  // can be left, right, top, bottom
            align           : 'none',   // can be none, left, right (only works for potision: top | bottom)
            left            : 0,        // delta for left coordinate
            top             : 0,        // delta for top coordinate
            style           : '',       // adition style for the tag
            css             : {},       // add css for input when tag is shown
            className       : '',       // add class bubble
            inputClass      : '',       // add class for input when tag is shown
            onShow          : null,     // callBack when shown
            onHide          : null,     // callBack when hidden
            hideOnKeyPress  : true,     // hide tag if key pressed
            hideOnBlur      : false,    // hide tag on blur
            hideOnClick     : false     // hide tag on document click
        }, options);
        if (options.name != null && options.id == null) options.id = options.name;

        // for backward compatibility
        if (options['class'] !== '' && options.inputClass === '') options.inputClass = options['class'];

        // remove all tags
        if ($(this).length === 0) {
            $('.w2ui-tag').each(function (index, el) {
                var opt = $(el).data('options');
                if (opt == null) opt = {};
                $($(el).data('taged-el'))
                    .removeClass(opt.inputClass)
                    .removeData('w2tag')
                    .removeData('checkIfMoved');
                clearInterval($(el).data('timer'));
                $(el).remove();
            });
            return;
        }
        return $(this).each(function (index, el) {
            // show or hide tag
            var origID = (options.id ? options.id : el.id);
            var tagID  = w2utils.escapeId(origID);
            var $tags  = $('#w2ui-tag-'+tagID);
            if (text === '' || text == null) {
                // remmove element
                $tags.css('opacity', 0);
                clearInterval($tags.data('timer'));
                $tags.remove();
                return;
            } else if ($tags.length !== 0) {
                // if already present
                options = $.extend($tags.data('options'), options);
                $tags.data('options', options);
                $tags.find('.w2ui-tag-body')
                    .attr('style', options.style)
                    .addClass(options.className)
                    .html(options.html);
                checkIfMoved(true);
            } else {
                var originalCSS = '';
                if ($(el).length > 0) originalCSS = $(el)[0].style.cssText;
                // insert
                $('body').append(
                    '<div onclick="event.stopPropagation()" style="display:none;" id="w2ui-tag-'+ origID +'" '+
                    '       class="w2ui-tag '+ ($(el).parents('.w2ui-popup, .w2ui-overlay-popup, .w2ui-message').length > 0 ? 'w2ui-tag-popup' : '') + '">'+
                    '   <div style="margin: -2px 0px 0px -2px; white-space: nowrap;">'+
                    '      <div class="w2ui-tag-body '+ options.className +'" style="'+ (options.style || '') +'">'+ text +'</div>'+
                    '   </div>' +
                    '</div>');
                $tags = $('#w2ui-tag-'+tagID);
                $(el).data('w2tag', $tags.get(0)).data('checkIfMoved', checkIfMoved);
            }

            // need time out to allow tag to be rendered
            setTimeout(function () {
                $tags.css('display', 'block');
                if (!$(el).offset()) return;
                var pos = checkIfMoved(true);
                if (pos == null) return;
                $tags.css({
                        opacity : '1',
                        left    : pos.left + 'px',
                        top     : pos.top + 'px'
                    })
                    .data('options', options)
                    .data('taged-el', el)
                    .data('position', pos.left + 'x' + pos.top)
                    .data('timer', setTimeout(checkIfMoved, 100))
                    .find('.w2ui-tag-body').addClass(pos['posClass']);

                $(el).css(options.css)
                    .off('.w2tag')
                    .addClass(options.inputClass);

                if (options.hideOnKeyPress) {
                    $(el).on('keypress.w2tag', hideTag);
                }
                if (options.hideOnBlur) {
                    $(el).on('blur.w2tag', hideTag);
                }
                if (options.hideOnClick) {
                    $(document).on('click.w2tag', hideTag)
                }
                if (typeof options.onShow === 'function') options.onShow();
            }, 1);

            // bind event to hide it
            function hideTag() {
                $tags = $('#w2ui-tag-'+tagID);
                if ($tags.length <= 0) return;
                clearInterval($tags.data('timer'));
                $tags.remove();
                $(document).off('.w2tag');
                $(el).off('.w2tag', hideTag)
                    .removeClass(options.inputClass)
                    .removeData('w2tag')
                    .removeData('checkIfMoved');
                if ($(el).length > 0) $(el)[0].style.cssText = originalCSS;
                if (typeof options.onHide === 'function') options.onHide();
            }

            function checkIfMoved(checkOnly, instant) {
                // monitor if destroyed
                var offset = $(el).offset();
                if ($(el).length === 0 || (offset.left === 0 && offset.top === 0) || $tags.find('.w2ui-tag-body').length === 0) {
                    clearInterval($tags.data('timer'));
                    hideTag();
                    return;
                }
                if (!instant) setTimeout(checkIfMoved, 100);
                // monitor if moved
                var posClass = 'w2ui-tag-right';
                var posLeft  = parseInt(offset.left + el.offsetWidth + (options.left ? options.left : 0));
                var posTop   = parseInt(offset.top + (options.top ? options.top : 0));
                var tagBody  = $tags.find('.w2ui-tag-body');
                var width    = tagBody[0].offsetWidth;
                var height   = tagBody[0].offsetHeight;
                if (typeof options.position == 'string' && options.position.indexOf('|') != -1) {
                    options.position = options.position.split('|');
                }
                if (options.position == 'top') {
                    posClass  = 'w2ui-tag-top';
                    posLeft   = parseInt(offset.left + (options.left ? options.left : 0)) - 14;
                    posTop    = parseInt(offset.top + (options.top ? options.top : 0)) - height - 10;
                }
                else if (options.position == 'bottom') {
                    posClass  = 'w2ui-tag-bottom';
                    posLeft   = parseInt(offset.left + (options.left ? options.left : 0)) - 14;
                    posTop    = parseInt(offset.top + el.offsetHeight + (options.top ? options.top : 0)) + 10;
                }
                else if (options.position == 'left') {
                    posClass  = 'w2ui-tag-left';
                    posLeft   = parseInt(offset.left + (options.left ? options.left : 0)) - width - 20;
                    posTop    = parseInt(offset.top + (options.top ? options.top : 0));
                }
                else if (Array.isArray(options.position)) {
                    // try to fit the tag on screen in the order defined in the array
                    var maxWidth  = window.innerWidth;
                    var maxHeight = window.innerHeight
                    for (var i=0; i<options.position.length; i++) {
                        var pos = options.position[i];
                        if (pos == 'right') {
                            posClass = 'w2ui-tag-right';
                            posLeft  = parseInt(offset.left + el.offsetWidth + (options.left ? options.left : 0));
                            posTop   = parseInt(offset.top + (options.top ? options.top : 0));
                            if (posLeft+width <= maxWidth) break;
                        }
                        else if (pos == 'left') {
                            posClass  = 'w2ui-tag-left';
                            posLeft   = parseInt(offset.left + (options.left ? options.left : 0)) - width - 20;
                            posTop    = parseInt(offset.top + (options.top ? options.top : 0));
                            if (posLeft >= 0) break;
                        }
                        else if (pos == 'top') {
                            posClass  = 'w2ui-tag-top';
                            posLeft   = parseInt(offset.left + (options.left ? options.left : 0)) - 14;
                            posTop    = parseInt(offset.top + (options.top ? options.top : 0)) - height - 10;
                            if(posLeft+width <= maxWidth && posTop >= 0) break;
                        }
                        else if (pos == 'bottom') {
                            posClass  = 'w2ui-tag-bottom';
                            posLeft   = parseInt(offset.left + (options.left ? options.left : 0)) - 14;
                            posTop    = parseInt(offset.top + el.offsetHeight + (options.top ? options.top : 0)) + 10;
                            if (posLeft+width <= maxWidth && posTop+height <= maxHeight) break;
                        }
                    }
                    if (tagBody.data('posClass') !== posClass) {
                        tagBody.removeClass('w2ui-tag-right w2ui-tag-left w2ui-tag-top w2ui-tag-bottom')
                            .addClass(posClass)
                            .data('posClass', posClass);
                    }
                }
                if ($tags.data('position') !== posLeft + 'x' + posTop && checkOnly !== true) {
                    $tags.css(w2utils.cssPrefix({ 'transition': (instant ? '0s' : '.2s') })).css({
                        left: posLeft + 'px',
                        top : posTop + 'px'
                    }).data('position', posLeft + 'x' + posTop);
                }
                return { left: posLeft, top: posTop, posClass: posClass };
            }
        });
    };

    // w2overlay - appears under the element, there can be only one at a time

    $.fn.w2overlay = function (html, options) {
        var obj  = this;
        var name = '';
        var defaults = {
            name        : null,              // it not null, then allows multiple concurrent overlays
            html        : '',                // html text to display
            align       : 'none',            // can be none, left, right, both
            left        : 0,                 // offset left
            top         : 0,                 // offset top
            tipLeft     : 30,                // tip offset left
            noTip       : false,             // if true - no tip will be displayed
            selectable  : false,
            width       : 0,                 // fixed width
            height      : 0,                 // fixed height
            maxWidth    : null,              // max width if any
            maxHeight   : null,              // max height if any
            contextMenu : false,             // if true, it will be opened at mouse position
            pageX       : null,
            pageY       : null,
            originalEvent : null,
            style       : '',                // additional style for main div
            'class'     : '',                // additional class name for main div
            overlayStyle: '',
            onShow      : null,              // event on show
            onHide      : null,              // event on hide
            openAbove   : false,             // show above control
            tmp         : {}
        };
        if (arguments.length == 1) {
            if (typeof html == 'object') {
                options = html;
            } else {
                options = { html: html };
            }
        }
        if (arguments.length == 2) options.html = html;
        if (!$.isPlainObject(options)) options = {};
        options = $.extend({}, defaults, options);
        if (options.name) name = '-' + options.name;
        // hide
        var tmp_hide;
        if (this.length === 0 || options.html === '' || options.html == null) {
            if ($('#w2ui-overlay'+ name).length > 0) {
                tmp_hide = $('#w2ui-overlay'+ name)[0].hide;
                if (typeof tmp_hide === 'function') tmp_hide();
            } else {
                $('#w2ui-overlay'+ name).remove();
            }
            return $(this);
        }
        // hide previous if any
        if ($('#w2ui-overlay'+ name).length > 0) {
            tmp_hide = $('#w2ui-overlay'+ name)[0].hide;
            $(document).off('.w2overlayHide');
            if (typeof tmp_hide === 'function') tmp_hide();
        }
        if (obj.length > 0 && (obj[0].tagName == null || obj[0].tagName.toUpperCase() == 'BODY')) options.contextMenu = true;
        if (options.contextMenu && options.originalEvent) {
            options.pageX = options.originalEvent.pageX;
            options.pageY = options.originalEvent.pageY;
        }
        if (options.contextMenu && (options.pageX == null || options.pageY == null)) {
            console.log('ERROR: to display menu at mouse location, pass options.pageX and options.pageY.');
        }
        // append
        $('body').append(
            '<div id="w2ui-overlay'+ name +'" style="display: none; left: 0px; top: 0px; '+ options.overlayStyle +'"'+
            '        class="w2ui-reset w2ui-overlay '+ ($(this).parents('.w2ui-popup, .w2ui-overlay-popup, .w2ui-message').length > 0 ? 'w2ui-overlay-popup' : '') +'">'+
            '    <style></style>'+
            '    <div style="min-width: 100%; '+ options.style +'" class="'+ options['class'] +'"></div>'+
            '</div>'
        );
        // init
        var div1 = $('#w2ui-overlay'+ name);
        var div2 = div1.find(' > div');
        div2.html(options.html);
        // pick bg color of first div
        var bc  = div2.css('background-color');
        if (bc != null && bc !== 'rgba(0, 0, 0, 0)' && bc !== 'transparent') div1.css({ 'background-color': bc, 'border-color': bc });

        var offset = $(obj).offset() || {};
        div1.data('element', obj.length > 0 ? obj[0] : null)
            .data('options', options)
            .data('position', offset.left + 'x' + offset.top)
            .fadeIn('fast')
            .on('click', function (event) {
                // if there is label for input, it will produce 2 click events
                if (event.target.tagName.toUpperCase() == 'LABEL') event.stopPropagation();
            })
            .on('mousedown', function (event) {
                $('#w2ui-overlay'+ name).data('keepOpen', true);
                if (['INPUT', 'TEXTAREA', 'SELECT'].indexOf(event.target.tagName.toUpperCase()) == -1 && !options.selectable) {
                    event.preventDefault();
                }
            });
        div1[0].hide   = hide;
        div1[0].resize = resize;

        // need time to display
        setTimeout(function () {
            resize();
            $(document).off('.w2overlayHide').on('click.w2overlayHide', hide);
            if (typeof options.onShow === 'function') options.onShow();
        }, 10);

        monitor();
        return $(this);

        // monitor position
        function monitor() {
            var tmp = $('#w2ui-overlay'+ name);
            if (tmp.data('element') !== obj[0]) return; // it if it different overlay
            if (tmp.length === 0) return;
            var offset = $(obj).offset() || {};
            var pos = offset.left + 'x' + offset.top;
            if (tmp.data('position') !== pos) {
                hide();
            } else {
                setTimeout(monitor, 250);
            }
        }

        // click anywhere else hides the drop down
        function hide(event) {
            if (event && event.button !== 0) return; // only for left click button
            var div1 = $('#w2ui-overlay'+ name);
            if (div1.data('keepOpen') === true) {
                div1.removeData('keepOpen');
                return;
            }
            var result;
            if (typeof options.onHide === 'function') result = options.onHide();
            if (result === false) return;
            div1.remove();
            $(document).off('click', hide);
            clearInterval(div1.data('timer'));
        }

        function resize () {
            var div1 = $('#w2ui-overlay'+ name);
            var div2 = div1.find(' > div');
            var menu = $('#w2ui-overlay'+ name +' div.menu');
            menu.css('overflow-y', 'hidden');
            // if goes over the screen, limit height and width
            if (div1.length > 0) {
                div2.height('auto').width('auto');
                // width/height
                var overflowX = false;
                var overflowY = false;
                var h = div2.height();
                var w = div2.width();
                if (options.width && options.width < w) w = options.width;
                if (w < 30) w = 30;
                // if content of specific height
                if (options.tmp.contentHeight) {
                    h = parseInt(options.tmp.contentHeight);
                    div2.height(h);
                    setTimeout(function () {
                        var $div = div2.find('div.menu');
                        if (h > $div.height()) {
                            div2.find('div.menu').css('overflow-y', 'hidden');
                        }
                    }, 1);
                    setTimeout(function () {
                        var $div = div2.find('div.menu');
                        if ($div.css('overflow-y') != 'auto') $div.css('overflow-y', 'auto');
                    }, 10);
                }
                if (options.tmp.contentWidth && options.align != 'both') {
                    w = parseInt(options.tmp.contentWidth);
                    div2.width(w);
                    setTimeout(function () {
                        if (w > div2.find('div.menu > table').width()) {
                            div2.find('div.menu > table').css('overflow-x', 'hidden');
                        }
                    }, 1);
                    setTimeout(function () {
                        div2.find('div.menu > table').css('overflow-x', 'auto');
                    }, 10);
                }
                // adjust position
                var boxLeft  = options.left;
                var boxWidth = options.width;
                var tipLeft  = options.tipLeft;
                // alignment
                switch (options.align) {
                    case 'both':
                        boxLeft = 17;
                        if (options.width === 0) options.width = w2utils.getSize($(obj), 'width');
                        if (options.maxWidth && options.width > options.maxWidth) options.width = options.maxWidth;
                        break;
                    case 'left':
                        boxLeft = 17;
                        break;
                    case 'right':
                        boxLeft = w2utils.getSize($(obj), 'width') - w + 10;
                        tipLeft = w - 40;
                        break;
                }
                if (w === 30 && !boxWidth) boxWidth = 30; else boxWidth = (options.width ? options.width : 'auto');
                var tmp = (w - 17) / 2;
                if (boxWidth != 'auto') tmp = (boxWidth - 17) / 2;
                if (tmp < 25) {
                    boxLeft = 25 - tmp;
                    tipLeft = Math.floor(tmp);
                }
                // Y coord
                var X, Y, offsetTop;
                if (options.contextMenu) { // context menu
                    X = options.pageX + 8;
                    Y = options.pageY - 0;
                    offsetTop = options.pageY;
                } else {
                    var offset = obj.offset() || {};
                    X = ((offset.left > 25 ? offset.left : 25) + boxLeft);
                    Y = (offset.top + w2utils.getSize(obj, 'height') + options.top + 7);
                    offsetTop = offset.top;
                }
                div1.css({
                    left        :  X + 'px',
                    top         :  Y + 'px',
                    'min-width' : boxWidth,
                    'min-height': (options.height ? options.height : 'auto')
                });
                // $(window).height() - has a problem in FF20
                var offset = div2.offset() || {};
                var maxHeight = window.innerHeight + $(document).scrollTop() - offset.top - 7;
                var maxWidth  = window.innerWidth + $(document).scrollLeft() - offset.left - 7;
                if (options.contextMenu) { // context menu
                    maxHeight = window.innerHeight + $(document).scrollTop() - options.pageY - 15;
                    maxWidth  = window.innerWidth + $(document).scrollLeft() - options.pageX;
                }

                if ((maxHeight > -50 && maxHeight < 210) || options.openAbove === true) {
                    var tipOffset;
                    // show on top
                    if (options.contextMenu) { // context menu
                        maxHeight = options.pageY - 7;
                        tipOffset = 5;
                    } else {
                        maxHeight = offset.top - $(document).scrollTop() - 7;
                        tipOffset = 24;
                    }
                    if (options.maxHeight && maxHeight > options.maxHeight) maxHeight = options.maxHeight;
                    if (h > maxHeight) {
                        overflowY = true;
                        div2.height(maxHeight).width(w).css({ 'overflow-y': 'auto' });
                        h = maxHeight;
                    }
                    div1.addClass('bottom-arrow');
                    div1.css('top', (offsetTop - h - tipOffset + options.top) + 'px');
                    div1.find('>style').html(
                        '#w2ui-overlay'+ name +':before { margin-left: '+ parseInt(tipLeft) +'px; }'+
                        '#w2ui-overlay'+ name +':after { margin-left: '+ parseInt(tipLeft) +'px; }'
                    );
                } else {
                    // show under
                    if (options.maxHeight && maxHeight > options.maxHeight) maxHeight = options.maxHeight;
                    if (h > maxHeight) {
                        overflowY = true;
                        div2.height(maxHeight).width(w).css({ 'overflow-y': 'auto' });
                    }
                    div1.addClass('top-arrow');
                    div1.find('>style').html(
                        '#w2ui-overlay'+ name +':before { margin-left: '+ parseInt(tipLeft) +'px; }'+
                        '#w2ui-overlay'+ name +':after { margin-left: '+ parseInt(tipLeft) +'px; }'
                    );
                }
                // check width
                w = div2.width();
                maxWidth = window.innerWidth + $(document).scrollLeft() - offset.left - 7;
                if (options.maxWidth && maxWidth > options.maxWidth) maxWidth = options.maxWidth;
                if (w > maxWidth && options.align !== 'both') {
                    options.align = 'right';
                    setTimeout(function () { resize(); }, 1);
                }
                // don't show tip
                if (options.contextMenu || options.noTip) { // context menu
                    div1.find('>style').html(
                        '#w2ui-overlay'+ name +':before { display: none; }'+
                        '#w2ui-overlay'+ name +':after { display: none; }'
                    );
                }
                // check scroll bar (needed to avoid horizontal scrollbar)
                if (overflowY && options.align != 'both') div2.width(w + w2utils.scrollBarSize() + 2);
            }
            menu.css('overflow-y', 'auto');
        }
    };

    $.fn.w2menu = function (menu, options) {
        /*
        ITEM STRUCTURE
            item : {
                id       : null,
                text     : '',
                style    : '',
                img      : '',
                icon     : '',
                count    : '',
                tooltip  : '',
                hidden   : false,
                checked  : null,
                disabled : false
                ...
            }
        */
        // if items is a function
        if (options && typeof options.items == 'function') {
            options.items = options.items();
        }
        var defaults = {
            type       : 'normal',    // can be normal, radio, check
            index      : null,        // current selected
            items      : [],
            render     : null,
            msgNoItems : 'No items',
            onSelect   : null,
            tmp        : {}
        };
        var obj  = this;
        var name = '';
        if (menu === 'refresh') {
            // if not show - call blur
            if ($('#w2ui-overlay'+ name).length > 0) {
                options = $.extend($.fn.w2menuOptions, options);
                var scrTop = $('#w2ui-overlay'+ name +' div.menu').scrollTop();
                $('#w2ui-overlay'+ name +' div.menu').html(getMenuHTML());
                $('#w2ui-overlay'+ name +' div.menu').scrollTop(scrTop);
                mresize();
            } else {
                $(this).w2menu(options);
            }
        } else if (menu === 'refresh-index') {
            var $menu  = $('#w2ui-overlay'+ name +' div.menu');
            var cur    = $menu.find('tr[index='+ options.index +']');
            var scrTop = $menu.scrollTop();
            $menu.find('tr.w2ui-selected').removeClass('w2ui-selected'); // clear all
            cur.addClass('w2ui-selected'); // select current
            // scroll into view
            if (cur.length > 0) {
                var top    = cur[0].offsetTop - 5; // 5 is margin top
                var height = $menu.height();
                $menu.scrollTop(scrTop);
                if (top < scrTop || top + cur.height() > scrTop + height) {
                    $menu.animate({ 'scrollTop': top - (height - cur.height() * 2) / 2 }, 200, 'linear');
                }
            }
            mresize();
        } else {
            if (arguments.length === 1) options = menu; else options.items = menu;
            if (typeof options !== 'object') options = {};
            options = $.extend({}, defaults, options);
            $.fn.w2menuOptions = options;
            if (options.name) name = '-' + options.name;
            if (typeof options.select === 'function' && typeof options.onSelect !== 'function') options.onSelect = options.select;
            if (typeof options.onRender === 'function' && typeof options.render !== 'function') options.render = options.onRender;
            // since only one overlay can exist at a time
            $.fn.w2menuClick = function (event, index) {
                var keepOpen = false;
                if (['radio', 'check'].indexOf(options.type) != -1) {
                    if (event.shiftKey || event.metaKey || event.ctrlKey) keepOpen = true;
                }
                if (typeof options.onSelect === 'function') {
                    // need time so that menu first hides
                    setTimeout(function () {
                        options.onSelect({
                            index: index,
                            item: options.items[index],
                            keepOpen: keepOpen,
                            originalEvent: event
                        });
                    }, 10);
                }
                // do not uncomment (or enum search type is not working in grid)
                // setTimeout(function () { $(document).click(); }, 50);
                // -- hide
                var div = $('#w2ui-overlay'+ name);
                div.removeData('keepOpen');
                if (typeof div[0].hide === 'function' && !keepOpen) {
                    div[0].hide();
                }
            };
            $.fn.w2menuDown = function (event, index) {
                var $el  = $(event.target).parents('tr');
                var tmp  = $el.find('.w2ui-icon');
                if ((options.type == 'check') || (options.type == 'radio')) {
                   var item = options.items[index];
                   item.checked = !item.checked;
                   if (item.checked) {
                       if (options.type == 'radio') {
                           tmp.parents('table').find('.w2ui-icon')
                               .removeClass('w2ui-icon-check')
                               .addClass('w2ui-icon-empty');
                       }
                       tmp.removeClass('w2ui-icon-empty').addClass('w2ui-icon-check');
                   } else if (options.type == 'check') {
                       tmp.removeClass('w2ui-icon-check').addClass('w2ui-icon-empty');
                   }
                }
                // highlight record
                $el.parent().find('tr').removeClass('w2ui-selected');
                $el.addClass('w2ui-selected');
            };
            var html = '';
            if (options.search) {
                html +=
                    '<div style="position: absolute; top: 0px; height: 40px; left: 0px; right: 0px; border-bottom: 1px solid silver; background-color: #ECECEC; padding: 8px 5px;">'+
                    '    <div class="w2ui-icon icon-search" style="position: absolute; margin-top: 4px; margin-left: 6px; width: 11px; background-position: left !important;"></div>'+
                    '    <input id="menu-search" type="text" style="width: 100%; outline: none; padding-left: 20px;" onclick="event.stopPropagation();"/>'+
                    '</div>';
                options.style += ';background-color: #ECECEC';
                options.index = 0;
                for (var i = 0; i < options.items.length; i++) options.items[i].hidden = false;
            }
            html += '<div class="menu" style="position: absolute; top: '+ (options.search ? 40 : 0) + 'px; bottom: 0px; width: 100%;">' +
                        getMenuHTML() +
                    '</div>';
            var ret = $(this).w2overlay(html, options);
            setTimeout(function () {
                $('#w2ui-overlay'+ name +' #menu-search')
                    .on('keyup', change)
                    .on('keydown', function (event) {
                        // cancel tab key
                        if (event.keyCode === 9) { event.stopPropagation(); event.preventDefault(); }
                    });
                if (options.search) {
                    if (['text', 'password'].indexOf($(obj)[0].type) != -1 || $(obj)[0].tagName.toUpperCase() == 'TEXTAREA') return;
                    $('#w2ui-overlay'+ name +' #menu-search').focus();
                }
                mresize();
            }, 200);
            mresize();
            return ret;
        }
        return;

        function mresize() {
            setTimeout(function () {
                // show selected
                $('#w2ui-overlay'+ name +' tr.w2ui-selected').removeClass('w2ui-selected');
                var cur    = $('#w2ui-overlay'+ name +' tr[index='+ options.index +']');
                var scrTop = $('#w2ui-overlay'+ name +' div.menu').scrollTop();
                cur.addClass('w2ui-selected');
                if (options.tmp) options.tmp.contentHeight = $('#w2ui-overlay'+ name +' table').height() + (options.search ? 50 : 10);
                if (options.tmp) options.tmp.contentWidth  = $('#w2ui-overlay'+ name +' table').width();
                if ($('#w2ui-overlay'+ name).length > 0) $('#w2ui-overlay'+ name)[0].resize();
                // scroll into view
                if (cur.length > 0) {
                    var top    = cur[0].offsetTop - 5; // 5 is margin top
                    var el     = $('#w2ui-overlay'+ name +' div.menu');
                    var height = el.height();
                    $('#w2ui-overlay'+ name +' div.menu').scrollTop(scrTop);
                    if (top < scrTop || top + cur.height() > scrTop + height) {
                        $('#w2ui-overlay'+ name +' div.menu').animate({ 'scrollTop': top - (height - cur.height() * 2) / 2 }, 200, 'linear');
                    }
                }
            }, 1);
        }

        function change(event) {
            var search  = this.value;
            var key     = event.keyCode;
            var cancel  = false;
            switch (key) {
                case 13: // enter
                    $('#w2ui-overlay'+ name).remove();
                    $.fn.w2menuClick(event, options.index);
                    break;
                case 9:  // tab
                case 27: // escape
                    $('#w2ui-overlay'+ name).remove();
                    $.fn.w2menuClick(event, -1);
                    break;
                case 38: // up
                    options.index = w2utils.isInt(options.index) ? parseInt(options.index) : 0;
                    options.index--;
                    while (options.index > 0 && options.items[options.index].hidden) options.index--;
                    if (options.index === 0 && options.items[options.index].hidden) {
                        while (options.items[options.index] && options.items[options.index].hidden) options.index++;
                    }
                    if (options.index < 0) options.index = 0;
                    cancel = true;
                    break;
                case 40: // down
                    options.index = w2utils.isInt(options.index) ? parseInt(options.index) : 0;
                    options.index++;
                    while (options.index < options.items.length-1 && options.items[options.index].hidden) options.index++;
                    if (options.index === options.items.length-1 && options.items[options.index].hidden) {
                        while (options.items[options.index] && options.items[options.index].hidden) options.index--;
                    }
                    if (options.index >= options.items.length) options.index = options.items.length - 1;
                    cancel = true;
                    break;
            }
            // filter
            if (!cancel) {
                var shown  = 0;
                for (var i = 0; i < options.items.length; i++) {
                    var item = options.items[i];
                    var prefix = '';
                    var suffix = '';
                    if (['is', 'begins with'].indexOf(options.match) !== -1) prefix = '^';
                    if (['is', 'ends with'].indexOf(options.match) !== -1) suffix = '$';
                    try {
                        var re = new RegExp(prefix + search + suffix, 'i');
                        if (re.test(item.text) || item.text === '...') item.hidden = false; else item.hidden = true;
                    } catch (e) {}
                    // do not show selected items
                    if (obj.type === 'enum' && $.inArray(item.id, ids) !== -1) item.hidden = true;
                    if (item.hidden !== true) shown++;
                }
                options.index = 0;
                while (options.index < options.items.length-1 && options.items[options.index].hidden) options.index++;
                if (shown <= 0) options.index = -1;
            }
            $(obj).w2menu('refresh', options);
            mresize();
        }

        function getMenuHTML() {
            if (options.spinner) {
                return  '<table class="w2ui-drop-menu"><tbody><tr><td style="padding: 5px 10px 10px 10px; text-align: center">'+
                        '    <div class="w2ui-spinner" style="width: 18px; height: 18px; position: relative; top: 5px;"></div> '+
                        '    <div style="display: inline-block; padding: 3px; color: #999;">'+ w2utils.lang('Loading...') +'</div>'+
                        '</td></tr></tbody></table>';
            }
            var count        = 0;
            var menu_html    = '<table cellspacing="0" cellpadding="0" class="w2ui-drop-menu"><tbody>';
            var img = null, icon = null;
            for (var f = 0; f < options.items.length; f++) {
                var mitem = options.items[f];
                if (typeof mitem === 'string') {
                    mitem = { id: mitem, text: mitem };
                } else {
                    if (mitem.text != null && mitem.id == null) mitem.id = mitem.text;
                    if (mitem.text == null && mitem.id != null) mitem.text = mitem.id;
                    if (mitem.caption != null) mitem.text = mitem.caption;
                    img  = mitem.img;
                    icon = mitem.icon;
                    if (img  == null) img  = null; // img might be undefined
                    if (icon == null) icon = null; // icon might be undefined
                }
                if (['radio', 'check'].indexOf(options.type) != -1) {
                    if (mitem.checked === true) icon = 'w2ui-icon-check'; else icon = 'w2ui-icon-empty';
                }
                if (mitem.hidden !== true) {
                    var imgd = '';
                    var txt = mitem.text;
                    if (typeof options.render === 'function') txt = options.render(mitem, options);
                    if (img)  imgd = '<td class="menu-icon"><div class="w2ui-tb-image w2ui-icon '+ img +'"></div></td>';
                    if (icon) imgd = '<td class="menu-icon" align="center"><span class="w2ui-icon '+ icon +'"></span></td>';
                    // render only if non-empty
                    if (txt != null && txt !== '' && !(/^-+$/.test(txt))) {
                        var bg = (count % 2 === 0 ? 'w2ui-item-even' : 'w2ui-item-odd');
                        if (options.altRows !== true) bg = '';
                        var colspan = 1;
                        if (imgd === '') colspan++;
                        if (mitem.count == null && mitem.hotkey == null) colspan++;
                        if (mitem.tooltip == null && mitem.hint != null) mitem.tooltip = mitem.hint; // for backward compatibility
                        menu_html +=
                            '<tr index="'+ f + '" style="'+ (mitem.style ? mitem.style : '') +'" '+ (mitem.tooltip ? 'title="'+ w2utils.lang(mitem.tooltip) +'"' : '') +
                            '        class="'+ bg +' '+ (options.index === f ? 'w2ui-selected' : '') + ' ' + (mitem.disabled === true ? 'w2ui-disabled' : '') +'"'+
                            '        onmousedown="if ('+ (mitem.disabled === true ? 'true' : 'false') + ') return;'+
                            '               jQuery.fn.w2menuDown(event, \''+ f +'\');"'+
                            '        onclick="event.stopPropagation(); '+
                            '               if ('+ (mitem.disabled === true ? 'true' : 'false') + ') return;'+
                            '               jQuery.fn.w2menuClick(event, \''+ f +'\');">'+
                                imgd +
                            '   <td class="menu-text" colspan="'+ colspan +'">'+ w2utils.lang(txt) +'</td>'+
                            '   <td class="menu-count">'+
                                    (mitem.count != null ? '<span>' + mitem.count + '</span>' : '') +
                                    (mitem.hotkey != null ? '<span class="hotkey">' + mitem.hotkey + '</span>' : '') +
                            '</td>' +
                            '</tr>';
                        count++;
                    } else {
                        // horizontal line
                        menu_html += '<tr><td colspan="3" style="padding: 6px; pointer-events: none"><div style="border-top: 1px solid silver;"></div></td></tr>';
                    }
                }
                options.items[f] = mitem;
            }
            if (count === 0) {
                menu_html += '<tr><td style="padding: 13px; color: #999; text-align: center">'+ options.msgNoItems +'</div></td></tr>';
            }
            menu_html += "</tbody></table>";
            return menu_html;
        }
    };

    $.fn.w2color = function (options, callBack) {
        var obj   = this;
        var el    = $(this)[0];
        var index = [-1, -1];
        if ($.fn.w2colorPalette == null) {
            $.fn.w2colorPalette = [
                ['000000', '555555', '888888', 'BBBBBB', 'DDDDDD', 'EEEEEE', 'F7F7F7', 'FFFFFF'],
                ['FF011B', 'FF9838', 'FFFD59', '01FD55', '00FFFE', '006CE7', '9B24F4', 'FF21F5'],
                ['FFEAEA', 'FCEFE1', 'FCF5E1', 'EBF7E7', 'E9F3F5', 'ECF4FC', 'EAE6F4', 'F5E7ED'],
                ['F4CCCC', 'FCE5CD', 'FFF2CC', 'D9EAD3', 'D0E0E3', 'CFE2F3', 'D9D1E9', 'EAD1DC'],
                ['EA9899', 'F9CB9C', 'FEE599', 'B6D7A8', 'A2C4C9', '9FC5E8', 'B4A7D6', 'D5A6BD'],
                ['E06666', 'F6B26B', 'FED966', '93C47D', '76A5AF', '6FA8DC', '8E7CC3', 'C27BA0'],
                ['CC0814', 'E69138', 'F1C232', '6AA84F', '45818E', '3D85C6', '674EA7', 'A54D79'],
                ['99050C', 'B45F17', 'BF901F', '37761D', '124F5C', '0A5394', '351C75', '741B47'],
                // ['660205', '783F0B', '7F6011', '274E12', '0C343D', '063762', '20124D', '4C1030'],
                ['F2F2F2', 'F2F2F2', 'F2F2F2', 'F2F2F2', 'F2F2F2'] // custom colors (up to 4)
            ];
        }
        var pal = $.fn.w2colorPalette;
        if (typeof options == 'string') options = {
            color: options,
            transparent: true
        };
        // add remove transarent color
        if (options.transparent && pal[0][1] == '555555') {
            pal[0].splice(1, 1);
            pal[0].push('');
        }
        if (!options.transparent && pal[0][1] != '555555') {
            pal[0].splice(1, 0, '555555');
            pal[0].pop();
        }
        if (options.color) options.color = String(options.color).toUpperCase();

        if ($('#w2ui-overlay').length === 0) {
            $(el).w2overlay(getColorHTML(options), {
                onHide: function () {
                    if (typeof callBack == 'function') callBack($(el).data('_color'));
                    $(el).removeData('_color');
                }
            });
        } else { // only refresh contents
            $('#w2ui-overlay .w2ui-color').parent().html(getColorHTML(options));
        }
        // bind events
        $('#w2ui-overlay .color')
            .off('.w2color')
            .on('mousedown.w2color', function (event) {
                var color = $(event.originalEvent.target).attr('name');
                index = $(event.originalEvent.target).attr('index').split(':');
                $(el).data('_color', color);
            })
            .on('mouseup.w2color', function () {
                setTimeout(function () {
                    if ($("#w2ui-overlay").length > 0) $('#w2ui-overlay').removeData('keepOpen')[0].hide();
                }, 10);
            });
        $('#w2ui-overlay input')
            .off('.w2color')
            .on('mousedown.w2color', function (event) {
                $('#w2ui-overlay').data('keepOpen', true);
                setTimeout(function () { $('#w2ui-overlay').data('keepOpen', true); }, 10);
                event.stopPropagation();
            })
            .on('keyup.w2color', function (event) {
                if (this.value !== '' && this.value[0] !== '#') this.value = '#' + this.value;
            })
            .on('change.w2color', function (event) {
                var tmp = this.value;
                if (tmp.substr(0, 1) == '#') tmp = tmp.substr(1);
                if (tmp.length != 6) {
                    $(this).w2tag('Invalid color.');
                    return;
                }
                $.fn.w2colorPalette[pal.length - 1].unshift(tmp.toUpperCase());
                $(el).w2color(options, callBack);
                setTimeout(function() { $('#w2ui-overlay input')[0].focus(); }, 100);
            })
            .w2field('hex');

        el.nav = function (direction) {
            switch (direction) {
                case 'up':
                    index[0]--;
                    break;
                case 'down':
                    index[0]++;
                    break;
                case 'right':
                    index[1]++;
                    break;
                case 'left':
                    index[1]--;
                    break;
            }
            if (index[0] < 0) index[0] = 0;
            if (index[0] > pal.length - 2) index[0] = pal.length - 2;
            if (index[1] < 0) index[1] = 0;
            if (index[1] > pal[0].length - 1) index[1] = pal[0].length - 1;

            color = pal[index[0]][index[1]];
            $(el).data('_color', color);
            return color;
        };

        function getColorHTML(options) {
            var color = options.color;
            var html  = '<div class="w2ui-color" onmousedown="event.stopPropagation(); event.preventDefault()">'+ // prevent default is needed otherwiser selection gets unselected
                        '<table cellspacing="5"><tbody>';
            for (var i = 0; i < pal.length - 1; i++) {
                html += '<tr>';
                for (var j = 0; j < pal[i].length; j++) {
                    html += '<td>'+
                            '    <div class="color '+ (pal[i][j] === '' ? 'no-color' : '') +'" style="background-color: #'+ pal[i][j] +';" ' +
                            '       name="'+ pal[i][j] +'" index="'+ i + ':' + j +'">'+ (options.color == pal[i][j] ? '&#149;' : '&#160;') +
                            '    </div>'+
                            '</td>';
                    if (options.color == pal[i][j]) index = [i, j];
                }
                html += '</tr>';
                if (i < 2) html += '<tr><td style="height: 8px" colspan="8"></td></tr>';
            }
            var tmp = pal[pal.length - 1];
            html += '<tr><td style="height: 8px" colspan="8"></td></tr>'+
                    '<tr>'+
                    '   <td colspan="4" style="text-align: left"><input placeholder="#FFF000" style="margin-left: 1px; width: 74px" maxlength="7"/></td>'+
                    '   <td><div class="color" style="background-color: #'+ tmp[0] +';" name="'+ tmp[0] +'" index="8:0">'+ (options.color == tmp[0] ? '&#149;' : '&#160;') +'</div></td>'+
                    '   <td><div class="color" style="background-color: #'+ tmp[1] +';" name="'+ tmp[1] +'" index="8:0">'+ (options.color == tmp[1] ? '&#149;' : '&#160;') +'</div></td>'+
                    '   <td><div class="color" style="background-color: #'+ tmp[2] +';" name="'+ tmp[2] +'" index="8:0">'+ (options.color == tmp[2] ? '&#149;' : '&#160;') +'</div></td>'+
                    '   <td><div class="color" style="background-color: #'+ tmp[3] +';" name="'+ tmp[3] +'" index="8:0">'+ (options.color == tmp[3] ? '&#149;' : '&#160;') +'</div></td>'+
                    '</tr>'+
                    '<tr><td style="height: 4px" colspan="8"></td></tr>';
            html += '</tbody></table></div>';
            return html;
        }
    };

})(jQuery);

/************************************************************************
*   Library: Web 2.0 UI for jQuery (using prototypical inheritance)
*   - Following objects defined
*        - w2grid        - grid widget
*        - $().w2grid    - jQuery wrapper
*   - Dependencies: jQuery, w2utils, w2toolbar, w2fields
*
* == NICE TO HAVE ==
*   - column autosize based on largest content
*   - reorder columns/records
*   - problem with .set() and arrays, array get extended too, but should be replaced
*   - after edit stay on the same record option
*   - if supplied array of ids, get should return array of records
*   - allow functions in routeData (also add routeData to list/enum)
*   - implement global routeData and all elements read from there
*   - send parsed URL to the event if there is routeData
*   - if you set searchData or sortData and call refresh() it should work
*   - add selectType: 'none' so that no selection can be make but with mouse
*   - reorder records with frozen columns
*   - focus/blur for selectType = cell not display grayed out selection
*   - frozen columns
        - load more only on the right side
        - scrolling on frozen columns is not working only on regular columns
*   - copy or large number of records is slow
*   - reusable search component (see https://github.com/vitmalina/w2ui/issues/914#issuecomment-107340524)
*   - allow enum in inline edit (see https://github.com/vitmalina/w2ui/issues/911#issuecomment-107341193)
*   - if record has no recid, then it should be index in the aray (should not be 0)
*
* == KNOWN ISSUES ==
*   - bug: vs_start = 100 and more then 500 records, when scrolling empty sets
*   - row drag and drop has bugs
*   - Shift-click/Ctrl-click/Ctrl-Shift-Click selection is not as robust as it should be
*
* == 1.5 changes
*   - $('#grid').w2grid() - if called w/o argument then it returns grid object
*   - added statusRange     : true,
*           statusBuffered  : false,
*           statusRecordID  : true,
*           statusSelection : true,
*           statusResponse  : true,
*           statusSort      : true,
*           statusSearch    : true,
*   - change selectAll() and selectNone() - return time it took
*   - added vs_start and vs_extra
*   - added update(cells) - updates only data in the grid (or cells)
*   - add to docs onColumnDragStart, onColumnDragEnd
*   - onSelect and onSelect should fire 1 time for selects with shift or selectAll(), selectNone()
*   - record.w2ui.style[field_name]
*   - use column field for style: { 1: 'color: red' }
*   - added focus(), blur(), onFocus, onBlur
*   - search.simple - if false, will not show up in simple search
*   - search.operator - default operator to use with search field
*   - search.operators - array of operators for the serach
*   - search.hidden - could not be clearned by the user
*   - search.value - only for hidden searches
*   - if .search(val) - search all fields
*   - refactor reorderRow (not finished)
*   - return JSON can now have summary array
*   - frozen columns
*   - added selectionSave, selectionRestore - for internal use
*   - added additional search filter options for int, float, date, time
*   - added getLineHTML
*   - added lineNumberWidth
*   - add searches.style
*   - getColumn without params returns fields of all columns
*   - getSearch without params returns fields of all searches
*   - added column.tooltip
*   - added hasFocus, refactored w2utils.keyboard
*   - do not clear selection when clicked and it was not in focus
*   - added record.w2ui.colspan
*   - editable area extends with typing
*   - removed onSubmit and onDeleted - now it uses onSave and onDelete
*   - column.seachable - can be an object, which will create search
*   - added null, not null filters
*   - update(cells) - added argument cells
*   - scrollIntoView(..., ..., instant) - added third argument
*   - added onResizeDblClick
*   - added onColumnDblClick
*   - implemented showBubble
*   - added show.searchAll
*   - added w2grid.operators
*   - added w2grid.operatorsMap
*   - move events into prototype
*   - move rec.summary, rec.style, rec.editable -> into rec.w2ui.summary, rec.w2ui.style, rec.w2ui.editable
*   - record: {
        recid
        field1
        ...
        fieldN
        w2ui: {
            colspan: { field: 5, ...}
            editable: true/false
            changes: {
                field: chagned_value,
                ....
            },
            children: [
                // similar to records array
                // can have sub children
            ]
            parent_recid: (internally set, id of the parent record, when children are copied to records array)
            summary: true/false
            style: 'string' - for entire row OR { field: 'string', ...} - per field
            class: 'string' - for entire row OR { field: 'string', ...} - per field
        }
    }
*   - added this.show.toolbarInput
*   - disableCVS
*   - grid.message
*   - added noReset option to localSort()
*   - onColumnSelect
*   - need to update PHP example
*   - added scrollToColumn(field)
*   - textSearch: 'begins' (default), 'contains', 'is', ...
*   - added refreshBody
*   - added response.total = -1 (or not present) to indicate that number of records is unknown
*   - message(.., callBack) - added callBack
*   - grid.msgEmpty
*   - field.render(..., data) -- added last argument which is what grid thinks should be there
*   - onSearchOpen (onSearch will have mutli and reset flags)
*   - added httpHeaders
*   - col.editable can be a function which will be called with the same args as col.render()
*   - getCellEditable(index, col_ind) -- return an 'editable' descriptor if cell is really editable
*   - added stateId
*   - rec.w2ui.class (and rec.w2ui.class { fname: '...' })
*   - columnTooltip
*   - expendable grids are still working
*   - added search.type = 'color'
*
************************************************************************/

(function ($) {
    var w2grid = function(options) {

        // public properties
        this.name         = null;
        this.box          = null;     // HTML element that hold this element
        this.header       = '';
        this.url          = '';
        this.routeData    = {};       // data for dynamic routes
        this.columns      = [];       // { field, caption, size, attr, render, hidden, gridMinWidth, editable }
        this.columnGroups = [];       // { span: int, caption: 'string', master: true/false }
        this.records      = [];       // { recid: int(requied), field1: 'value1', ... fieldN: 'valueN', style: 'string',  changes: object }
        this.summary      = [];       // arry of summary records, same structure as records array
        this.searches     = [];       // { type, caption, field, inTag, outTag, hidden }
        this.searchData   = [];
        this.sortData     = [];
        this.postData     = {};
        this.httpHeaders  = {};
        this.toolbar      = {};       // if not empty object; then it is toolbar object
        this.stateId      = null;     // Custom state name for satateSave, stateRestore and stateReset

        this.show = {
            header          : false,
            toolbar         : false,
            footer          : false,
            columnHeaders   : true,
            lineNumbers     : false,
            expandColumn    : false,
            selectColumn    : false,
            emptyRecords    : true,
            toolbarReload   : true,
            toolbarColumns  : true,
            toolbarSearch   : true,
            toolbarInput    : true,
            toolbarAdd      : false,
            toolbarEdit     : false,
            toolbarDelete   : false,
            toolbarSave     : false,
            searchAll       : true,
            statusRange     : true,
            statusBuffered  : false,
            statusRecordID  : true,
            statusSelection : true,
            statusResponse  : true,
            statusSort      : false,
            statusSearch    : false,
            recordTitles    : true,
            selectionBorder : true,
            skipRecords     : true,
            saveRestoreState: true
        };

        this.hasFocus        = false;
        this.autoLoad        = true;     // for infinite scroll
        this.fixedBody       = true;     // if false; then grid grows with data
        this.recordHeight    = 24;       // should be in prototype
        this.lineNumberWidth = null;
        this.vs_start        = 150;
        this.vs_extra        = 15;
        this.keyboard        = true;
        this.selectType      = 'row';    // can be row|cell
        this.multiSearch     = true;
        this.multiSelect     = true;
        this.multiSort       = true;
        this.reorderColumns  = false;
        this.reorderRows     = false;
        this.markSearch      = true;
        this.columnTooltip   = 'normal'; // can be normal, top, bottom, left, right
        this.disableCVS      = false;    // disable Column Virtual Scroll
        this.textSearch      = 'begins'; // default search type for text

        this.total   = 0;     // server total
        this.limit   = 100;
        this.offset  = 0;     // how many records to skip (for infinite scroll) when pulling from server
        this.style   = '';
        this.ranges  = [];
        this.menu    = [];
        this.method  = null;  // if defined, then overwrited ajax method
        this.recid   = null;
        this.parser  = null;

        // internal
        this.last = {
            field     : '',
            caption   : '',
            logic     : 'OR',
            search    : '',
            searchIds : [],
            selection : {
                indexes : [],
                columns : {}
            },
            multi       : false,
            scrollTop   : 0,
            scrollLeft  : 0,
            colStart    : 0,    // for column virtual scrolling
            colEnd      : 0,
            sortData    : null,
            sortCount   : 0,
            xhr         : null,
            range_start : null,
            range_end   : null,
            sel_ind     : null,
            sel_col     : null,
            sel_type    : null,
            edit_col    : null,
            isSafari    : (/^((?!chrome|android).)*safari/i).test(navigator.userAgent)
        };

        $.extend(true, this, w2obj.grid, options);
    };

    // ====================================================
    // -- Registers as a jQuery plugin

    $.fn.w2grid = function(method) {
        if ($.isPlainObject(method)) {
            // check name parameter
            if (!w2utils.checkName(method, 'w2grid')) return;
            // remember items
            var columns      = method.columns;
            var columnGroups = method.columnGroups;
            var records      = method.records;
            var searches     = method.searches;
            var searchData   = method.searchData;
            var sortData     = method.sortData;
            var postData     = method.postData;
            var httpHeaders  = method.httpHeaders;
            var toolbar      = method.toolbar;
            // extend items
            var object = new w2grid(method);
            $.extend(object, { postData: {}, httpHeaders: {}, records: [], columns: [], searches: [], toolbar: {}, sortData: [], searchData: [], handlers: [] });
            if (object.onExpand != null) object.show.expandColumn = true;
            $.extend(true, object.toolbar, toolbar);
            // reassign variables
            var p;
            if (columns)      for (p = 0; p < columns.length; p++)      object.columns[p]       = $.extend(true, {}, columns[p]);
            if (columnGroups) for (p = 0; p < columnGroups.length; p++) object.columnGroups[p]  = $.extend(true, {}, columnGroups[p]);
            if (searches)     for (p = 0; p < searches.length; p++)     object.searches[p]      = $.extend(true, {}, searches[p]);
            if (searchData)   for (p = 0; p < searchData.length; p++)   object.searchData[p]    = $.extend(true, {}, searchData[p]);
            if (sortData)     for (p = 0; p < sortData.length; p++)     object.sortData[p]      = $.extend(true, {}, sortData[p]);
            object.postData = $.extend(true, {}, postData);
            object.httpHeaders = $.extend(true, {}, httpHeaders);

            // check if there are records without recid
            if (records) for (var r = 0; r < records.length; r++) {
                if (records[r].recid == null && records[r][object.recid] == null) {
                    console.log('ERROR: Cannot add records without recid. (obj: '+ object.name +')');
                    return;
                }
                object.records[r] = $.extend(true, {}, records[r]);
            }
            // add searches
            for (var i = 0; i < object.columns.length; i++) {
                var col = object.columns[i];
                var search = col.searchable;
                if (search == null || search === false || object.getSearch(col.field) != null) continue;
                if ($.isPlainObject(search)) {
                    object.addSearch($.extend({ field: col.field, caption: col.caption, type: 'text' }, search));
                } else {
                    var stype = col.searchable, attr  = '';
                    if (col.searchable === true) { stype = 'text'; attr = 'size="20"'; }
                    object.addSearch({ field: col.field, caption: col.caption, type: stype, attr: attr });
                }
            }
            // init toolbar
            object.initToolbar();
            // render if necessary
            if ($(this).length !== 0) {
                object.render($(this)[0]);
            }
            // register new object
            w2ui[object.name] = object;
            return object;

        } else {
            var obj = w2ui[$(this).attr('name')];
            if (!obj) return null;
            if (arguments.length > 0) {
                if (obj[method]) obj[method].apply(obj, Array.prototype.slice.call(arguments, 1));
                return this;
            } else {
                return obj;
            }
        }
    };

    // ====================================================
    // -- Implementation of core functionality

    w2grid.prototype = {
        msgDelete       : 'Are you sure you want to delete selected records?',
        msgNotJSON      : 'Returned data is not in valid JSON format.',
        msgAJAXerror    : 'AJAX error. See console for more details.',
        msgRefresh      : 'Refreshing...',
        msgNeedReload   : 'Your remote data source record count has changed, reloading from the first record.',
        msgEmpty        : '', // if not blank, then it is message when server returns no records

        buttons: {
            'reload'   : { type: 'button', id: 'w2ui-reload', icon: 'w2ui-icon-reload', tooltip: 'Reload data in the list' },
            'columns'  : { type: 'drop', id: 'w2ui-column-on-off', icon: 'w2ui-icon-columns', tooltip: 'Show/hide columns', arrow: false, html: '' },
            'search'   : { type: 'html',   id: 'w2ui-search',
                            html: '<div class="w2ui-icon icon-search-down w2ui-search-down" '+
                                  'onclick="var obj = w2ui[jQuery(this).parents(\'div.w2ui-grid\').attr(\'name\')]; obj.searchShowFields();"></div>'
                          },
            'search-go': { type: 'drop',  id: 'w2ui-search-advanced', icon: 'w2ui-icon-search', text: 'Search', tooltip: 'Open Search Fields' },
            'add'      : { type: 'button', id: 'w2ui-add', text: 'Add New', tooltip: 'Add new record', icon: 'w2ui-icon-plus' },
            'edit'     : { type: 'button', id: 'w2ui-edit', text: 'Edit', tooltip: 'Edit selected record', icon: 'w2ui-icon-pencil', disabled: true },
            'delete'   : { type: 'button', id: 'w2ui-delete', text: 'Delete', tooltip: 'Delete selected records', icon: 'w2ui-icon-cross', disabled: true },
            'save'     : { type: 'button', id: 'w2ui-save', text: 'Save', tooltip: 'Save changed records', icon: 'w2ui-icon-check' }
        },

        operators: { // for search fields
            "text"    : ['is', 'begins', 'contains', 'ends'],
            "number"  : ['is', 'between', { oper: 'less', text: 'less than'}, { oper: 'more', text: 'more than' }],
            "date"    : ['is', 'between', { oper: 'less', text: 'before'}, { oper: 'more', text: 'after' }],
            "list"    : ['is'],
            "hex"     : ['is', 'between'],
            "color"   : ['is', 'begins', 'contains', 'ends'],
            "enum"    : ['in', 'not in']
            // -- all posible
            // "text"    : ['is', 'begins', 'contains', 'ends'],
            // "number"  : ['is', 'between', 'less:less than', 'more:more than', 'null:is null', 'not null:is not null'],
            // "list"    : ['is', 'null:is null', 'not null:is not null'],
            // "enum"    : ['in', 'not in', 'null:is null', 'not null:is not null']
        },

        operatorsMap: {
            "text"         : "text",
            "int"          : "number",
            "float"        : "number",
            "money"        : "number",
            "currency"     : "number",
            "percent"      : "number",
            "hex"          : "hex",
            "alphanumeric" : "text",
            "color"        : "color",
            "date"         : "date",
            "time"         : "date",
            "datetime"     : "date",
            "list"         : "list",
            "combo"        : "text",
            "enum"         : "enum",
            "file"         : "enum",
            "select"       : "list",
            "radio"        : "list",
            "checkbox"     : "list",
            "toggle"       : "list"
        },

        // events
        onAdd              : null,
        onEdit             : null,
        onRequest          : null,        // called on any server event
        onLoad             : null,
        onDelete           : null,
        onSave             : null,
        onSelect           : null,
        onUnselect         : null,
        onClick            : null,
        onDblClick         : null,
        onContextMenu      : null,
        onMenuClick        : null,        // when context menu item selected
        onColumnClick      : null,
        onColumnDblClick   : null,
        onColumnResize     : null,
        onSort             : null,
        onSearch           : null,
        onSearchOpen       : null,
        onChange           : null,        // called when editable record is changed
        onRestore          : null,        // called when editable record is restored
        onExpand           : null,
        onCollapse         : null,
        onError            : null,
        onKeydown          : null,
        onToolbar          : null,        // all events from toolbar
        onColumnOnOff      : null,
        onCopy             : null,
        onPaste            : null,
        onSelectionExtend  : null,
        onEditField        : null,
        onRender           : null,
        onRefresh          : null,
        onReload           : null,
        onResize           : null,
        onDestroy          : null,
        onStateSave        : null,
        onStateRestore     : null,
        onFocus            : null,
        onBlur             : null,
        onReorderRow       : null,

        add: function (record, first) {
            if (!$.isArray(record)) record = [record];
            var added = 0;
            for (var i = 0; i < record.length; i++) {
                var rec = record[i];
                if (rec.recid == null && rec[this.recid] == null) {
                    console.log('ERROR: Cannot add record without recid. (obj: '+ this.name +')');
                    continue;
                }
                if (rec.w2ui && rec.w2ui.summary === true) {
                    if (first) this.summary.unshift(rec); else this.summary.push(rec);
                } else {
                    if (first) this.records.unshift(rec); else this.records.push(rec);
                }
                added++;
            }
            var url = (typeof this.url != 'object' ? this.url : this.url.get);
            if (!url) {
                this.total = this.records.length;
                this.localSort(false, true);
                this.localSearch();
                // do not call this.refresh(), this is unnecessary, heavy, and messes with the toolbar.
                this.refreshBody();
                this.resizeRecords();
                return added;
            }
            this.refresh(); // ??  should it be reload?
            return added;
        },

        find: function (obj, returnIndex) {
            if (obj == null) obj = {};
            var recs    = [];
            var hasDots = false;
            // check if property is nested - needed for speed
            for (var o in obj) if (String(o).indexOf('.') != -1) hasDots = true;
            // look for an item
            for (var i = 0; i < this.records.length; i++) {
                var match = true;
                for (var o in obj) {
                    var val = this.records[i][o];
                    if (hasDots && String(o).indexOf('.') != -1) val = this.parseField(this.records[i], o);
                    if (obj[o] == 'not-null') {
                        if (val == null || val === '') match = false;
                    } else {
                        if (obj[o] != val) match = false;
                    }
                }
                if (match && returnIndex !== true) recs.push(this.records[i].recid);
                if (match && returnIndex === true) recs.push(i);
            }
            return recs;
        },

        set: function (recid, record, noRefresh) { // does not delete existing, but overrides on top of it
            if (typeof recid == 'object') {
                noRefresh = record;
                record    = recid;
                recid     = null;
            }
            // update all records
            if (recid == null) {
                for (var i = 0; i < this.records.length; i++) {
                    $.extend(true, this.records[i], record); // recid is the whole record
                }
                if (noRefresh !== true) this.refresh();
            } else { // find record to update
                var ind = this.get(recid, true);
                if (ind == null) return false;
                var isSummary = (this.records[ind] && this.records[ind].recid == recid ? false : true);
                if (isSummary) {
                    $.extend(true, this.summary[ind], record);
                } else {
                    $.extend(true, this.records[ind], record);
                }
                if (noRefresh !== true) this.refreshRow(recid, ind); // refresh only that record
            }
            return true;
        },

        get: function (recid, returnIndex) {
            // search records
            if ($.isArray(recid)) {
                var recs = [];
                for (var i = 0; i < this.records.length; i++) {
                    if ($.inArray(this.records[i].recid, recid) != -1) {
                        if (returnIndex === true) {
                            recs.push(i);
                        } else {
                            recs.push(this.records[i]);
                        }
                    }
                }
                for (var i = 0; i < this.summary.length; i++) {
                    if ($.inArray(this.summary[i].recid, recid) != -1) {
                        if (returnIndex === true) {
                            recs.push(i);
                        } else {
                            recs.push(this.summary[i]);
                        }
                    }
                }
                return recs;
            } else {
                for (var i = 0; i < this.records.length; i++) {
                    if (this.records[i].recid == recid) {
                        if (returnIndex === true) return i; else return this.records[i];
                    }
                }
                // search summary
                for (var i = 0; i < this.summary.length; i++) {
                    if (this.summary[i].recid == recid) {
                        if (returnIndex === true) return i; else return this.summary[i];
                    }
                }
                return null;
            }
        },

        remove: function () {
            var removed = 0;
            for (var a = 0; a < arguments.length; a++) {
                for (var r = this.records.length-1; r >= 0; r--) {
                    if (this.records[r].recid == arguments[a]) { this.records.splice(r, 1); removed++; }
                }
                for (var r = this.summary.length-1; r >= 0; r--) {
                    if (this.summary[r].recid == arguments[a]) { this.summary.splice(r, 1); removed++; }
                }
            }
            var url = (typeof this.url != 'object' ? this.url : this.url.get);
            if (!url) {
                this.localSort(false, true);
                this.localSearch();
            }
            this.refresh();
            return removed;
        },

        addColumn: function (before, columns) {
            var added = 0;
            if (arguments.length == 1) {
                columns = before;
                before  = this.columns.length;
            } else {
                if (typeof before == 'string') before = this.getColumn(before, true);
                if (before == null) before = this.columns.length;
            }
            if (!$.isArray(columns)) columns = [columns];
            for (var i = 0; i < columns.length; i++) {
                this.columns.splice(before, 0, columns[i]);
                // if column is searchable, add search field
                if (columns[i].searchable) {
                    var stype = columns[i].searchable;
                    var attr  = '';
                    if (columns[i].searchable === true) { stype = 'text'; attr = 'size="20"'; }
                    this.addSearch({ field: columns[i].field, caption: columns[i].caption, type: stype, attr: attr });
                }
                before++;
                added++;
            }
            this.refresh();
            return added;
        },

        removeColumn: function () {
            var removed = 0;
            for (var a = 0; a < arguments.length; a++) {
                for (var r = this.columns.length-1; r >= 0; r--) {
                    if (this.columns[r].field == arguments[a]) {
                        if (this.columns[r].searchable) this.removeSearch(arguments[a]);
                        this.columns.splice(r, 1);
                        removed++;
                    }
                }
            }
            this.refresh();
            return removed;
        },

        getColumn: function (field, returnIndex) {
            // no arguments - return fields of all columns
            if (arguments.length === 0) {
                var ret = [];
                for (var i = 0; i < this.columns.length; i++) ret.push(this.columns[i].field);
                return ret;
            }
            // find column
            for (var i = 0; i < this.columns.length; i++) {
                if (this.columns[i].field == field) {
                    if (returnIndex === true) return i; else return this.columns[i];
                }
            }
            return null;
        },

        toggleColumn: function () {
            var effected = 0;
            for (var a = 0; a < arguments.length; a++) {
                for (var r = this.columns.length-1; r >= 0; r--) {
                    var col = this.columns[r];
                    if (col.field == arguments[a]) {
                        col.hidden = !col.hidden;
                        effected++;
                    }
                }
            }
            this.refreshBody();
            this.resizeRecords();
            return effected;
        },

        showColumn: function () {
            var shown = 0;
            for (var a = 0; a < arguments.length; a++) {
                for (var r = this.columns.length-1; r >= 0; r--) {
                    var col = this.columns[r];
                    if (col.gridMinWidth) delete col.gridMinWidth;
                    if (col.field == arguments[a] && col.hidden !== false) {
                        col.hidden = false;
                        shown++;
                    }
                }
            }
            this.refreshBody();
            this.resizeRecords();
            return shown;
        },

        hideColumn: function () {
            var hidden = 0;
            for (var a = 0; a < arguments.length; a++) {
                for (var r = this.columns.length-1; r >= 0; r--) {
                    var col = this.columns[r];
                    if (col.field == arguments[a] && col.hidden !== true) {
                        col.hidden = true;
                        hidden++;
                    }
                }
            }
            this.refreshBody();
            this.resizeRecords();
            return hidden;
        },

        addSearch: function (before, search) {
            var added = 0;
            if (arguments.length == 1) {
                search = before;
                before = this.searches.length;
            } else {
                if (typeof before == 'string') before = this.getSearch(before, true);
                if (before == null) before = this.searches.length;
            }
            if (!$.isArray(search)) search = [search];
            for (var i = 0; i < search.length; i++) {
                this.searches.splice(before, 0, search[i]);
                before++;
                added++;
            }
            this.searchClose();
            return added;
        },

        removeSearch: function () {
            var removed = 0;
            for (var a = 0; a < arguments.length; a++) {
                for (var r = this.searches.length-1; r >= 0; r--) {
                    if (this.searches[r].field == arguments[a]) { this.searches.splice(r, 1); removed++; }
                }
            }
            this.searchClose();
            return removed;
        },

        getSearch: function (field, returnIndex) {
            // no arguments - return fields of all searches
            if (arguments.length === 0) {
                var ret = [];
                for (var i = 0; i < this.searches.length; i++) ret.push(this.searches[i].field);
                return ret;
            }
            // find search
            for (var i = 0; i < this.searches.length; i++) {
                if (this.searches[i].field == field) {
                    if (returnIndex === true) return i; else return this.searches[i];
                }
            }
            return null;
        },

        toggleSearch: function () {
            var effected = 0;
            for (var a = 0; a < arguments.length; a++) {
                for (var r = this.searches.length-1; r >= 0; r--) {
                    if (this.searches[r].field == arguments[a]) {
                        this.searches[r].hidden = !this.searches[r].hidden;
                        effected++;
                    }
                }
            }
            this.searchClose();
            return effected;
        },

        showSearch: function () {
            var shown = 0;
            for (var a = 0; a < arguments.length; a++) {
                for (var r = this.searches.length-1; r >= 0; r--) {
                    if (this.searches[r].field == arguments[a] && this.searches[r].hidden !== false) {
                        this.searches[r].hidden = false;
                        shown++;
                    }
                }
            }
            this.searchClose();
            return shown;
        },

        hideSearch: function () {
            var hidden = 0;
            for (var a = 0; a < arguments.length; a++) {
                for (var r = this.searches.length-1; r >= 0; r--) {
                    if (this.searches[r].field == arguments[a] && this.searches[r].hidden !== true) {
                        this.searches[r].hidden = true;
                        hidden++;
                    }
                }
            }
            this.searchClose();
            return hidden;
        },

        getSearchData: function (field) {
            for (var i = 0; i < this.searchData.length; i++) {
                if (this.searchData[i].field == field) return this.searchData[i];
            }
            return null;
        },

        localSort: function (silent, noResetRefresh) {
            var url = (typeof this.url != 'object' ? this.url : this.url.get);
            if (url) {
                console.log('ERROR: grid.localSort can only be used on local data source, grid.url should be empty.');
                return;
            }
            if ($.isEmptyObject(this.sortData)) return;
            var time = (new Date()).getTime();
            var obj  = this;
            // process date fields
            obj.selectionSave();
            obj.prepareData();
            if (!noResetRefresh) {
                obj.reset();
            }
            // process sortData
            for (var i = 0; i < this.sortData.length; i++) {
                var column = this.getColumn(this.sortData[i].field);
                if (!column) return;
                if (typeof column.render == 'string') {
                    if (['date', 'age'].indexOf(column.render.split(':')[0]) != -1) {
                        this.sortData[i]['field_'] = column.field + '_';
                    }
                    if (['time'].indexOf(column.render.split(':')[0]) != -1) {
                        this.sortData[i]['field_'] = column.field + '_';
                    }
                }
            }

            // prepare paths and process sort
            preparePaths();
            this.records.sort(function (a, b) {
                return compareRecordPaths(a, b);
            });
            cleanupPaths();

            obj.selectionRestore(noResetRefresh);
            time = (new Date()).getTime() - time;
            if (silent !== true && obj.show.statusSort) {
                setTimeout(function () {
                    obj.status(w2utils.lang('Sorting took') + ' ' + time/1000 + ' ' + w2utils.lang('sec'));
                }, 10);
            }
            return time;

            // grab paths before sorting for efficiency and because calling obj.get()
            // while sorting 'obj.records' is unsafe, at least on webkit
            function preparePaths() {
                for (var i = 0; i < obj.records.length; i++) {
                    var rec = obj.records[i];
                    if (rec.w2ui && rec.w2ui.parent_recid != null)
                        rec.w2ui._path = getRecordPath(rec);
                }
            }

            // cleanup and release memory allocated by preparePaths()
            function cleanupPaths() {
                for (var i = 0; i < obj.records.length; i++) {
                    var rec = obj.records[i];
                    if (rec.w2ui && rec.w2ui.parent_recid != null)
                        rec.w2ui._path = null;
                }
            }

            // compare two paths, from root of tree to given records
            function compareRecordPaths(a, b) {
                if ((!a.w2ui || a.w2ui.parent_recid == null) && (!b.w2ui || b.w2ui.parent_recid == null)) {
                    return compareRecords(a, b);    // no tree, fast path
                }
                var pa = getRecordPath(a);
                var pb = getRecordPath(b);
                for (var i = 0; i < Math.min(pa.length, pb.length); i++) {
                    var diff = compareRecords(pa[i], pb[i]);
                    if (diff !== 0) return diff;     // different subpath
                }
                if (pa.length > pb.length) return 1;
                if (pa.length < pb.length) return -1;
                console.log('ERROR: two paths should not be equal.');
                return 0;
            }

            // return an array of all records from root to and including 'rec'
            function getRecordPath(rec) {
                if (!rec.w2ui || rec.w2ui.parent_recid == null) return [rec];
                if (rec.w2ui._path)
                    return rec.w2ui._path;
                // during actual sort, we should never reach this point
                var subrec = obj.get(rec.w2ui.parent_recid);
                if (!subrec) {
                    console.log('ERROR: no parent record: '+rec.w2ui.parent_recid);
                    return [rec];
                }
                return (getRecordPath(subrec).concat(rec));
            }

            // compare two records according to sortData and finally recid
            function compareRecords(a, b) {
                if (a === b) return 0; // optimize, same object
                for (var i = 0; i < obj.sortData.length; i++) {
                    var fld = obj.sortData[i].field;
                    if (obj.sortData[i].field_) fld = obj.sortData[i].field_;
                    var aa = a[fld];
                    var bb = b[fld];
                    if (String(fld).indexOf('.') != -1) {
                        aa = obj.parseField(a, fld);
                        bb = obj.parseField(b, fld);
                    }
                    var col = obj.getColumn(fld);
                    if (col && col.editable != null) { // for drop editable fields and drop downs
                        if ($.isPlainObject(aa) && aa.text) aa = aa.text;
                        if ($.isPlainObject(bb) && bb.text) bb = bb.text;
                    }
                    var ret = compareCells(aa, bb, i, obj.sortData[i].direction);
                    if (ret !== 0) return ret;
                }
                // break tie for similar records,
                // required to have consistent ordering for tree paths
                var ret = compareCells(a.recid, b.recid, -1, 'asc');
                if (ret !== 0) return ret;
                return 0;
            }

            // compare two values, aa and bb, producing consistent ordering
            function compareCells(aa, bb, i, direction) {
                // if both objects are strictly equal, we're done
                if (aa === bb)
                    return 0;
                // all nulls, empty and undefined on bottom
                if ((aa == null || aa === "") && (bb != null && bb !== ""))
                    return 1;
                if ((aa != null && aa !== "") && (bb == null || bb === ""))
                    return -1;
                var dir = (direction == 'asc') ? 1 : -1;
                // for different kind of objects, sort by object type
                if (typeof aa != typeof bb)
                    return (typeof aa > typeof bb) ? dir : -dir;
                // for different kind of classes, sort by classes
                if (aa.constructor.name != bb.constructor.name)
                    return (aa.constructor.name > bb.constructor.name) ? dir : -dir;
                // if we're dealing with non-null objects, call valueOf().
                // this mean that Date() or custom objects will compare properly.
                if (aa && typeof aa == 'object')
                    aa = aa.valueOf();
                if (bb && typeof bb == 'object')
                    bb = bb.valueOf();
                // if we're still dealing with non-null objects that have
                // a useful Object => String conversion, convert to string.
                var defaultToString = {}.toString;
                if (aa && typeof aa == 'object' && aa.toString != defaultToString)
                    aa = String(aa);
                if (bb && typeof bb == 'object' && bb.toString != defaultToString)
                    bb = String(bb);
                // do case-insensitive string comparaison
                if (typeof aa == 'string')
                    aa = $.trim(aa.toLowerCase());
                if (typeof bb == 'string')
                    bb = $.trim(bb.toLowerCase());
                // compare both objects
                if (aa > bb)
                    return dir;
                if (aa < bb)
                    return -dir;
                return 0;
            }
        },

        localSearch: function (silent) {
            var url = (typeof this.url != 'object' ? this.url : this.url.get);
            if (url) {
                console.log('ERROR: grid.localSearch can only be used on local data source, grid.url should be empty.');
                return;
            }
            var time = (new Date()).getTime();
            var obj = this;
            var defaultToString = {}.toString;
            var duplicateMap = {};
            this.total = this.records.length;
            // mark all records as shown
            this.last.searchIds = [];
            // prepare date/time fields
            this.prepareData();
            // hide records that did not match
            if (this.searchData.length > 0 && !url) {
                this.total = 0;
                for (var i = 0; i < this.records.length; i++) {
                    var rec = this.records[i];
                    var match = searchRecord(rec);
                    if (match) {
                        if (rec && rec.w2ui)
                            addParent(rec.w2ui.parent_recid);
                        this.last.searchIds.push(i);
                    }
                }
                this.total = this.last.searchIds.length;
            }
            time = (new Date()).getTime() - time;
            if (silent !== true && obj.show.statusSearch) {
                setTimeout(function () {
                    obj.status(w2utils.lang('Search took') + ' ' + time/1000 + ' ' + w2utils.lang('sec'));
                }, 10);
            }
            return time;

            // check if a record (or one of its closed children) matches the search data
            function searchRecord(rec) {
                var fl  = 0;
                for (var j = 0; j < obj.searchData.length; j++) {
                    var sdata  = obj.searchData[j];
                    var search = obj.getSearch(sdata.field);
                    if (sdata  == null) continue;
                    if (search == null) search = { field: sdata.field, type: sdata.type };
                    var val1b = obj.parseField(rec, search.field);
                    var val1 = (val1b !== null && val1b !== undefined &&
                        (typeof val1b != "object" || val1b.toString != defaultToString)) ?
                        String(val1b).toLowerCase() : "";  // do not match a bogus string
                    if (sdata.value != null) {
                        if (!$.isArray(sdata.value)) {
                            var val2 = String(sdata.value).toLowerCase();
                        } else {
                            var val2 = sdata.value[0];
                            var val3 = sdata.value[1];
                        }
                    }
                    switch (sdata.operator) {
                    case 'is':
                        if (obj.parseField(rec, search.field) == sdata.value) fl++; // do not hide record
                        else if (search.type == 'date') {
                            var tmp  = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field));
                            var val1 = w2utils.formatDate(tmp, 'yyyy-mm-dd');
                            var val2 = w2utils.formatDate(w2utils.isDate(val2, w2utils.settings.dateFormat, true), 'yyyy-mm-dd');
                            if (val1 == val2) fl++;
                        }
                        else if (search.type == 'time') {
                            var tmp  = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field));
                            var val1 = w2utils.formatTime(tmp, 'hh24:mi');
                            var val2 = w2utils.formatTime(val2, 'hh24:mi');
                            if (val1 == val2) fl++;
                        }
                        else if (search.type == 'datetime') {
                            var tmp  = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field));
                            var val1 = w2utils.formatDateTime(tmp, 'yyyy-mm-dd|hh24:mm:ss');
                            var val2 = w2utils.formatDateTime(w2utils.isDateTime(val2, w2utils.settings.datetimeFormat, true), 'yyyy-mm-dd|hh24:mm:ss');
                            if (val1 == val2) fl++;
                        }
                        break;
                    case 'between':
                        if (['int', 'float', 'money', 'currency', 'percent'].indexOf(search.type) != -1) {
                            if (parseFloat(obj.parseField(rec, search.field)) >= parseFloat(val2) && parseFloat(obj.parseField(rec, search.field)) <= parseFloat(val3)) fl++;
                        }
                        else if (search.type == 'date') {
                            var val1 = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field));
                            var val2 = w2utils.isDate(val2, w2utils.settings.dateFormat, true);
                            var val3 = w2utils.isDate(val3, w2utils.settings.dateFormat, true);
                            if (val3 != null) val3 = new Date(val3.getTime() + 86400000); // 1 day
                            if (val1 >= val2 && val1 < val3) fl++;
                        }
                        else if (search.type == 'time') {
                            var val1 = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field));
                            var val2 = w2utils.isTime(val2, true);
                            var val3 = w2utils.isTime(val3, true);
                            val2 = (new Date()).setHours(val2.hours, val2.minutes, val2.seconds ? val2.seconds : 0, 0);
                            val3 = (new Date()).setHours(val3.hours, val3.minutes, val3.seconds ? val3.seconds : 0, 0);
                            if (val1 >= val2 && val1 < val3) fl++;
                        }
                        else if (search.type == 'datetime') {
                            var val1 = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field));
                            var val2 = w2utils.isDateTime(val2, w2utils.settings.datetimeFormat, true);
                            var val3 = w2utils.isDateTime(val3, w2utils.settings.datetimeFormat, true);
                            if (val3) val3 = new Date(val3.getTime() + 86400000); // 1 day
                            if (val1 >= val2 && val1 < val3) fl++;
                        }
                        break;
                    case 'less':
                        if (['int', 'float', 'money', 'currency', 'percent'].indexOf(search.type) != -1) {
                            if (parseFloat(obj.parseField(rec, search.field)) <= parseFloat(sdata.value)) fl++;
                        }
                        else if (search.type == 'date') {
                            var tmp  = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field));
                            var val1 = w2utils.formatDate(tmp, 'yyyy-mm-dd');
                            var val2 = w2utils.formatDate(w2utils.isDate(val2, w2utils.settings.dateFormat, true), 'yyyy-mm-dd');
                            if (val1 <= val2) fl++;
                        }
                        else if (search.type == 'time') {
                            var tmp  = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field));
                            var val1 = w2utils.formatTime(tmp, 'hh24:mi');
                            var val2 = w2utils.formatTime(val2, 'hh24:mi');
                            if (val1 <= val2) fl++;
                        }
                        else if (search.type == 'datetime') {
                            var tmp  = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field));
                            var val1 = w2utils.formatDateTime(tmp, 'yyyy-mm-dd|hh24:mm:ss');
                            var val2 = w2utils.formatDateTime(w2utils.isDateTime(val2, w2utils.settings.datetimeFormat, true), 'yyyy-mm-dd|hh24:mm:ss');
                            if ( (val1.length == val2.length) && (val1 <= val2) ) fl++;
                        }
                        break;
                    case 'more':
                        if (['int', 'float', 'money', 'currency', 'percent'].indexOf(search.type) != -1) {
                            if (parseFloat(obj.parseField(rec, search.field)) >= parseFloat(sdata.value)) fl++;
                        }
                        else if (search.type == 'date') {
                            var tmp  = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field));
                            var val1 = w2utils.formatDate(tmp, 'yyyy-mm-dd');
                            var val2 = w2utils.formatDate(w2utils.isDate(val2, w2utils.settings.dateFormat, true), 'yyyy-mm-dd');
                            if (val1 >= val2) fl++;
                        }
                        else if (search.type == 'time') {
                            var tmp  = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field));
                            var val1 = w2utils.formatTime(tmp, 'hh24:mi');
                            var val2 = w2utils.formatTime(val2, 'hh24:mi');
                            if (val1 >= val2) fl++;
                        }
                        else if (search.type == 'datetime') {
                            var tmp  = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field));
                            var val1 = w2utils.formatDateTime(tmp, 'yyyy-mm-dd|hh24:mm:ss');
                            var val2 = w2utils.formatDateTime(w2utils.isDateTime(val2, w2utils.settings.datetimeFormat, true), 'yyyy-mm-dd|hh24:mm:ss');
                            if ( (val1.length == val2.length) && (val1 >= val2) ) fl++;
                        }
                        break;
                    case 'in':
                        var tmp = sdata.value;
                        if (sdata.svalue) tmp = sdata.svalue;
                        if (tmp.indexOf(w2utils.isFloat(val1) ? parseFloat(val1) : val1) !== -1) fl++;
                        if (tmp.indexOf(w2utils.isFloat(val1b) ? parseFloat(val1b) : val1b) !== -1) fl++;
                        break;
                    case 'not in':
                        var tmp = sdata.value;
                        if (sdata.svalue) tmp = sdata.svalue;
                        if (tmp.indexOf(w2utils.isFloat(val1) ? parseFloat(val1) : val1) == -1) fl++;
                        if (tmp.indexOf(w2utils.isFloat(val1b) ? parseFloat(val1b) : val1b) == -1) fl++;
                        break;
                    case 'begins':
                    case 'begins with': // need for back compatib.
                        if (val1.indexOf(val2) === 0) fl++; // do not hide record
                        break;
                    case 'contains':
                        if (val1.indexOf(val2) >= 0) fl++; // do not hide record
                        break;
                    case 'null':
                        if (obj.parseField(rec, search.field) == null) fl++; // do not hide record
                        break;
                    case 'not null':
                        if (obj.parseField(rec, search.field) != null) fl++; // do not hide record
                        break;
                    case 'ends':
                    case 'ends with': // need for back compatib.
                        var lastIndex = val1.lastIndexOf(val2);
                        if (lastIndex !== -1 && lastIndex == val1.length - val2.length) fl++; // do not hide record
                        break;
                    }
                }
                if ((obj.last.logic == 'OR' && fl !== 0) ||
                    (obj.last.logic == 'AND' && fl == obj.searchData.length))
                    return true;
                if (rec.w2ui && rec.w2ui.children && rec.w2ui.expanded !== true) {
                    // there are closed children, search them too.
                    for (var r = 0; r < rec.w2ui.children.length; r++) {
                        var subRec = rec.w2ui.children[r];
                        if (searchRecord(subRec))
                            return true;
                    }
                }
                return false;
            }

            // add parents nodes recursively
            function addParent(recid) {
                if (recid === undefined)
                    return;
                if (duplicateMap[recid])
                    return; // already visited
                duplicateMap[recid] = true;
                var i = obj.get(recid, true);
                if (i == null)
                    return;
                if ($.inArray(i, obj.last.searchIds) != -1)
                    return;
                var rec = obj.records[i];
                if (rec && rec.w2ui)
                    addParent(rec.w2ui.parent_recid);
                obj.last.searchIds.push(i);
            }
        },

        getRangeData: function (range, extra) {
            var rec1 = this.get(range[0].recid, true);
            var rec2 = this.get(range[1].recid, true);
            var col1 = range[0].column;
            var col2 = range[1].column;

            var res = [];
            if (col1 == col2) { // one row
                for (var r = rec1; r <= rec2; r++) {
                    var record = this.records[r];
                    var dt = record[this.columns[col1].field] || null;
                    if (extra !== true) {
                        res.push(dt);
                    } else {
                        res.push({ data: dt, column: col1, index: r, record: record });
                    }
                }
            } else if (rec1 == rec2) { // one line
                var record = this.records[rec1];
                for (var i = col1; i <= col2; i++) {
                    var dt = record[this.columns[i].field] || null;
                    if (extra !== true) {
                        res.push(dt);
                    } else {
                        res.push({ data: dt, column: i, index: rec1, record: record });
                    }
                }
            } else {
                for (var r = rec1; r <= rec2; r++) {
                    var record = this.records[r];
                    res.push([]);
                    for (var i = col1; i <= col2; i++) {
                        var dt = record[this.columns[i].field];
                        if (extra !== true) {
                            res[res.length-1].push(dt);
                        } else {
                            res[res.length-1].push({ data: dt, column: i, index: r, record: record });
                        }
                    }
                }
            }
            return res;
        },

        addRange: function (ranges) {
            var added = 0;
            if (this.selectType == 'row') return added;
            if (!$.isArray(ranges)) ranges = [ranges];
            // if it is selection
            for (var i = 0; i < ranges.length; i++) {
                if (typeof ranges[i] != 'object') ranges[i] = { name: 'selection' };
                if (ranges[i].name == 'selection') {
                    if (this.show.selectionBorder === false) continue;
                    var sel = this.getSelection();
                    if (sel.length === 0) {
                        this.removeRange('selection');
                        continue;
                    } else {
                        var first = sel[0];
                        var last  = sel[sel.length-1];
                    }
                } else { // other range
                    var first = ranges[i].range[0];
                    var last  = ranges[i].range[1];
                }
                if (first) {
                    var rg = {
                        name: ranges[i].name,
                        range: [{ recid: first.recid, column: first.column }, { recid: last.recid, column: last.column }],
                        style: ranges[i].style || ''
                    };
                    // add range
                    var ind = false;
                    for (var j = 0; j < this.ranges.length; j++) if (this.ranges[j].name == ranges[i].name) { ind = j; break; }
                    if (ind !== false) {
                        this.ranges[ind] = rg;
                    } else {
                        this.ranges.push(rg);
                    }
                    added++;
                }
            }
            this.refreshRanges();
            return added;
        },

        removeRange: function () {
            var removed = 0;
            for (var a = 0; a < arguments.length; a++) {
                var name = arguments[a];
                $('#grid_'+ this.name +'_'+ name).remove();
                $('#grid_'+ this.name +'_f'+ name).remove();
                for (var r = this.ranges.length-1; r >= 0; r--) {
                    if (this.ranges[r].name == name) {
                        this.ranges.splice(r, 1);
                        removed++;
                    }
                }
            }
            return removed;
        },

        refreshRanges: function () {
            if (this.ranges.length === 0) return;
            var obj  = this;
            var time = (new Date()).getTime();
            var rec1 = $('#grid_'+ this.name +'_frecords');
            var rec2 = $('#grid_'+ this.name +'_records');
            for (var i = 0; i < this.ranges.length; i++) {
                var rg    = this.ranges[i];
                var first = rg.range[0];
                var last  = rg.range[1];
                if (first.index == null) first.index = this.get(first.recid, true);
                if (last.index == null) last.index = this.get(last.recid, true);
                var td1   = $('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(first.recid) + ' td[col="'+ first.column +'"]');
                var td2   = $('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(last.recid) + ' td[col="'+ last.column +'"]');
                var td1f  = $('#grid_'+ this.name +'_frec_'+ w2utils.escapeId(first.recid) + ' td[col="'+ first.column +'"]');
                var td2f  = $('#grid_'+ this.name +'_frec_'+ w2utils.escapeId(last.recid) + ' td[col="'+ last.column +'"]');
                var _lastColumn = last.column;
                // adjustment due to column virtual scroll
                if (first.column < this.last.colStart && last.column > this.last.colStart) {
                    td1 = $('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(first.recid) + ' td[col="start"]');
                }
                if (first.column < this.last.colEnd && last.column > this.last.colEnd) {
                    _lastColumn = '"end"';
                    td2 = $('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(last.recid) + ' td[col="end"]');
                }
                // if virtual scrolling kicked in
                var index_top     = parseInt($('#grid_'+ this.name +'_rec_top').next().attr('index'));
                var index_bottom  = parseInt($('#grid_'+ this.name +'_rec_bottom').prev().attr('index'));
                var index_ftop    = parseInt($('#grid_'+ this.name +'_frec_top').next().attr('index'));
                var index_fbottom = parseInt($('#grid_'+ this.name +'_frec_bottom').prev().attr('index'));
                if (td1.length === 0 && first.index < index_top && last.index > index_top) {
                    td1 = $('#grid_'+ this.name +'_rec_top').next().find('td[col='+ first.column +']');
                }
                if (td2.length === 0 && last.index > index_bottom && first.index < index_bottom) {
                    td2 = $('#grid_'+ this.name +'_rec_bottom').prev().find('td[col='+ _lastColumn +']');
                }
                if (td1f.length === 0 && first.index < index_ftop && last.index > index_ftop) { // frozen
                    td1f = $('#grid_'+ this.name +'_frec_top').next().find('td[col='+ first.column +']');
                }
                if (td2f.length === 0 && last.index > index_fbottom && first.index < index_fbottom) {  // frozen
                    td2f = $('#grid_'+ this.name +'_frec_bottom').prev().find('td[col='+ last.column +']');
                }

                // do not show selection cell if it is editable
                var edit  = $(this.box).find('#grid_'+ this.name + '_editable');
                var tmp   = edit.find('.w2ui-input');
                var tmp1  = tmp.attr('recid');
                var tmp2  = tmp.attr('column');
                if (rg.name == 'selection' && rg.range[0].recid == tmp1 && rg.range[0].column == tmp2) continue;

                // frozen regular columns range
                var $range = $('#grid_'+ this.name +'_f'+ rg.name);
                if (td1f.length > 0 || td2f.length > 0) {
                    if ($range.length === 0) {
                        rec1.append('<div id="grid_'+ this.name +'_f' + rg.name +'" class="w2ui-selection" style="'+ rg.style +'">'+
                                        (rg.name == 'selection' ?  '<div id="grid_'+ this.name +'_resizer" class="w2ui-selection-resizer"></div>' : '')+
                                    '</div>');
                        $range = $('#grid_'+ this.name +'_f'+ rg.name);
                    } else {
                        $range.attr('style', rg.style);
                        $range.find('.w2ui-selection-resizer').show();
                    }
                    if (td2f.length === 0) {
                        td2f  = $('#grid_'+ this.name +'_frec_'+ w2utils.escapeId(last.recid) +' td:last-child');
                        if (td2f.length === 0) td2f = $('#grid_'+ this.name +'_frec_bottom td:first-child');
                        $range.css('border-right', '0px');
                        $range.find('.w2ui-selection-resizer').hide();
                    }
                    if (first.recid != null && last.recid != null && td1f.length > 0 && td2f.length > 0) {
                        var _left = (td1f.position().left - 1 + rec1.scrollLeft());
                        var _top  = (td1f.position().top - 1 + rec1.scrollTop());
                        $range.show().css({
                            left    : (_left > 0 ? _left : 0) + 'px',
                            top     : (_top > 0 ? _top : 0) + 'px',
                            width   : (td2f.position().left - td1f.position().left + td2f.width() + 3) + 'px',
                            height  : (td2f.position().top - td1f.position().top + td2f.height() + 3) + 'px'
                        });
                    } else {
                        $range.hide();
                    }
                } else {
                    $range.hide();
                }
                // regular columns range
                var $range = $('#grid_'+ this.name +'_'+ rg.name);
                if (td1.length > 0 || td2.length > 0) {
                    if ($range.length === 0) {
                        rec2.append('<div id="grid_'+ this.name +'_' + rg.name +'" class="w2ui-selection" style="'+ rg.style +'">'+
                                        (rg.name == 'selection' ?  '<div id="grid_'+ this.name +'_resizer" class="w2ui-selection-resizer"></div>' : '')+
                                    '</div>');
                        $range = $('#grid_'+ this.name +'_'+ rg.name);
                    } else {
                        $range.attr('style', rg.style);
                    }
                    if (td1.length === 0) {
                        td1 = $('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(first.recid) +' td:first-child');
                        if (td1.length === 0) td1 = $('#grid_'+ this.name +'_rec_top td:first-child');
                    }
                    if (td2f.length !== 0) {
                        $range.css('border-left', '0px');
                    }
                    if (first.recid != null && last.recid != null && td1.length > 0 && td2.length > 0) {
                        var _left = (td1.position().left - 1 + rec2.scrollLeft());
                        var _top  = (td1.position().top - 1 + rec2.scrollTop());
                        $range.show().css({
                            left    : (_left > 0 ? _left : 0) + 'px',
                            top     : (_top > 0 ? _top : 0) + 'px',
                            width   : (td2.position().left - td1.position().left + td2.width() + 3) + 'px',
                            height  : (td2.position().top - td1.position().top + td2.height() + 3) + 'px'
                        });
                    } else {
                        $range.hide();
                    }
                } else {
                    $range.hide();
                }
            }

            // add resizer events
            $(this.box).find('.w2ui-selection-resizer')
                .off('mousedown').on('mousedown', mouseStart)
                .off('dblclick').on('dblclick', function (event) {
                    var edata = obj.trigger({ phase: 'before', type: 'resizerDblClick', target: obj.name, originalEvent: event });
                    if (edata.isCancelled === true) return;
                    obj.trigger($.extend(edata, { phase: 'after' }));
                });
            var edata = { phase: 'before', type: 'selectionExtend', target: obj.name, originalRange: null, newRange: null };

            return (new Date()).getTime() - time;

            function mouseStart (event) {
                var sel = obj.getSelection();
                obj.last.move = {
                    type   : 'expand',
                    x      : event.screenX,
                    y      : event.screenY,
                    divX   : 0,
                    divY   : 0,
                    recid  : sel[0].recid,
                    column : sel[0].column,
                    originalRange : [{ recid: sel[0].recid, column: sel[0].column }, { recid: sel[sel.length-1].recid, column: sel[sel.length-1].column }],
                    newRange      : [{ recid: sel[0].recid, column: sel[0].column }, { recid: sel[sel.length-1].recid, column: sel[sel.length-1].column }]
                };
                $(document).off('mousemove', mouseMove).on('mousemove', mouseMove);
                $(document).off('mouseup', mouseStop).on('mouseup', mouseStop);
                // do not blur grid
                event.preventDefault();
            }

            function mouseMove (event) {
                var mv = obj.last.move;
                if (!mv || mv.type != 'expand') return;
                mv.divX = (event.screenX - mv.x);
                mv.divY = (event.screenY - mv.y);
                // find new cell
                var recid, column;
                var tmp = event.originalEvent.target;
                if (tmp.tagName.toUpperCase() != 'TD') tmp = $(tmp).parents('td')[0];
                if ($(tmp).attr('col') != null) column = parseInt($(tmp).attr('col'));
                tmp = $(tmp).parents('tr')[0];
                recid = $(tmp).attr('recid');
                // new range
                if (mv.newRange[1].recid == recid && mv.newRange[1].column == column) return;
                var prevNewRange = $.extend({}, mv.newRange);
                mv.newRange = [{ recid: mv.recid, column: mv.column }, { recid: recid, column: column }];
                // event before
                edata = obj.trigger($.extend(edata, { originalRange: mv.originalRange, newRange : mv.newRange }));
                if (edata.isCancelled === true) {
                    mv.newRange        = prevNewRange;
                    edata.newRange = prevNewRange;
                    return;
                } else {
                    // default behavior
                    obj.removeRange('grid-selection-expand');
                    obj.addRange({
                        name  : 'grid-selection-expand',
                        range : edata.newRange,
                        style : 'background-color: rgba(100,100,100,0.1); border: 2px dotted rgba(100,100,100,0.5);'
                    });
                }
            }

            function mouseStop (event) {
                // default behavior
                obj.removeRange('grid-selection-expand');
                delete obj.last.move;
                $(document).off('mousemove', mouseMove);
                $(document).off('mouseup', mouseStop);
                // event after
                obj.trigger($.extend(edata, { phase: 'after' }));
            }
        },

        select: function () {
            if (arguments.length === 0) return 0;
            var time = (new Date).getTime();
            var selected = 0;
            var sel = this.last.selection;
            if (!this.multiSelect) this.selectNone();

            // event before
            var tmp = { phase: 'before', type: 'select', target: this.name };
            if (arguments.length == 1) {
                tmp.multiple = false;
                if ($.isPlainObject(arguments[0])) {
                    tmp.recid  = arguments[0].recid;
                    tmp.column = arguments[0].column;
                } else {
                    tmp.recid = arguments[0];
                }
            } else {
                tmp.multiple = true;
                tmp.recids   = Array.prototype.slice.call(arguments, 0);
            }
            var edata = this.trigger(tmp);
            if (edata.isCancelled === true) return 0;

            // default action
            if (this.selectType == 'row') {
                for (var a = 0; a < arguments.length; a++) {
                    var recid  = typeof arguments[a] == 'object' ? arguments[a].recid : arguments[a];
                    var index = this.get(recid, true);
                    if (index == null) continue;
                    var recEl1 = null;
                    var recEl2 = null;
                    if (this.searchData.length !== 0 || (index + 1 >= this.last.range_start && index + 1 <= this.last.range_end)) {
                        recEl1 = $('#grid_'+ this.name +'_frec_'+ w2utils.escapeId(recid));
                        recEl2 = $('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(recid));
                    }
                    if (this.selectType == 'row') {
                        if (sel.indexes.indexOf(index) != -1) continue;
                        sel.indexes.push(index);
                        if (recEl1 && recEl2) {
                            recEl1.addClass('w2ui-selected').data('selected', 'yes').find('.w2ui-col-number').addClass('w2ui-row-selected');
                            recEl2.addClass('w2ui-selected').data('selected', 'yes').find('.w2ui-col-number').addClass('w2ui-row-selected');
                            recEl1.find('.w2ui-grid-select-check').prop("checked", true);
                        }
                        selected++;
                    }
                }
            } else {
                // normalize for performance
                var new_sel = {};
                for (var a = 0; a < arguments.length; a++) {
                    var recid  = typeof arguments[a] == 'object' ? arguments[a].recid : arguments[a];
                    var column = typeof arguments[a] == 'object' ? arguments[a].column : null;
                    new_sel[recid] = new_sel[recid] || [];
                    if ($.isArray(column)) {
                        new_sel[recid] = column;
                    } else if (w2utils.isInt(column)) {
                        new_sel[recid].push(column);
                    } else {
                        for (var i = 0; i < this.columns.length; i++) { if (this.columns[i].hidden) continue; new_sel[recid].push(parseInt(i)); }
                    }
                }
                // add all
                var col_sel = [];
                for (var recid in new_sel) {
                    var index = this.get(recid, true);
                    if (index == null) continue;
                    var recEl1 = null;
                    var recEl2 = null;
                    if (index + 1 >= this.last.range_start && index + 1 <= this.last.range_end) {
                        recEl1 = $('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(recid));
                        recEl2 = $('#grid_'+ this.name +'_frec_'+ w2utils.escapeId(recid));
                    }
                    var s = sel.columns[index] || [];
                    // default action
                    if (sel.indexes.indexOf(index) == -1) {
                        sel.indexes.push(index);
                    }
                    // anly only those that are new
                    for (var t = 0; t < new_sel[recid].length; t++) {
                        if (s.indexOf(new_sel[recid][t]) == -1) s.push(new_sel[recid][t]);
                    }
                    s.sort(function(a, b) { return a-b; }); // sort function must be for numerical sort
                    for (var t = 0; t < new_sel[recid].length; t++) {
                        var col = new_sel[recid][t];
                        if (col_sel.indexOf(col) == -1) col_sel.push(col);
                        if (recEl1) {
                            recEl1.find('#grid_'+ this.name +'_data_'+ index +'_'+ col).addClass('w2ui-selected');
                            recEl1.find('.w2ui-col-number').addClass('w2ui-row-selected');
                            recEl1.data('selected', 'yes');
                            recEl1.find('.w2ui-grid-select-check').prop("checked", true);
                        }
                        if (recEl2) {
                            recEl2.find('#grid_'+ this.name +'_data_'+ index +'_'+ col).addClass('w2ui-selected');
                            recEl2.find('.w2ui-col-number').addClass('w2ui-row-selected');
                            recEl2.data('selected', 'yes');
                            recEl2.find('.w2ui-grid-select-check').prop("checked", true);
                        }
                        selected++;
                    }
                    // save back to selection object
                    sel.columns[index] = s;
                }
                // select columns (need here for speed)
                for (var c = 0; c < col_sel.length; c++) {
                    $(this.box).find('#grid_'+ this.name +'_column_'+ col_sel[c] +' .w2ui-col-header').addClass('w2ui-col-selected');
                }
            }
            // need to sort new selection for speed
            sel.indexes.sort(function(a, b) { return a-b; });
            // all selected?
            var areAllSelected = (this.records.length > 0 && sel.indexes.length == this.records.length),
                areAllSearchedSelected = (sel.indexes.length > 0 && this.searchData.length !== 0 && sel.indexes.length == this.last.searchIds.length);
            if (areAllSelected || areAllSearchedSelected) {
                $('#grid_'+ this.name +'_check_all').prop('checked', true);
            } else {
                $('#grid_'+ this.name +'_check_all').prop('checked', false);
            }
            this.status();
            this.addRange('selection');
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            return selected;
        },

        unselect: function () {
            var unselected = 0;
            var sel = this.last.selection;
            for (var a = 0; a < arguments.length; a++) {
                var recid  = typeof arguments[a] == 'object' ? arguments[a].recid : arguments[a];
                var record = this.get(recid);
                if (record == null) continue;
                var index  = this.get(record.recid, true);
                var recEl1 = $('#grid_'+ this.name +'_frec_'+ w2utils.escapeId(recid));
                var recEl2 = $('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(recid));
                if (this.selectType == 'row') {
                    if (sel.indexes.indexOf(index) == -1) continue;
                    // event before
                    var edata = this.trigger({ phase: 'before', type: 'unselect', target: this.name, recid: recid, index: index });
                    if (edata.isCancelled === true) continue;
                    // default action
                    sel.indexes.splice(sel.indexes.indexOf(index), 1);
                    recEl1.removeClass('w2ui-selected w2ui-inactive').removeData('selected').find('.w2ui-col-number').removeClass('w2ui-row-selected');
                    recEl2.removeClass('w2ui-selected w2ui-inactive').removeData('selected').find('.w2ui-col-number').removeClass('w2ui-row-selected');
                    if (recEl1.length != 0) {
                        recEl1[0].style.cssText = 'height: '+ this.recordHeight +'px; ' + recEl1.attr('custom_style');
                        recEl2[0].style.cssText = 'height: '+ this.recordHeight +'px; ' + recEl2.attr('custom_style');
                    }
                    recEl1.find('.w2ui-grid-select-check').prop("checked", false);
                    unselected++;
                } else {
                    var col  = arguments[a].column;
                    if (!w2utils.isInt(col)) { // unselect all columns
                        var cols = [];
                        for (var i = 0; i < this.columns.length; i++) { if (this.columns[i].hidden) continue; cols.push({ recid: recid, column: i }); }
                        return this.unselect.apply(this, cols);
                    }
                    var s = sel.columns[index];
                    if (!$.isArray(s) || s.indexOf(col) == -1) continue;
                    // event before
                    var edata = this.trigger({ phase: 'before', type: 'unselect', target: this.name, recid: recid, column: col });
                    if (edata.isCancelled === true) continue;
                    // default action
                    s.splice(s.indexOf(col), 1);
                    $('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(recid)).find(' > td[col='+ col +']').removeClass('w2ui-selected w2ui-inactive');
                    $('#grid_'+ this.name +'_frec_'+ w2utils.escapeId(recid)).find(' > td[col='+ col +']').removeClass('w2ui-selected w2ui-inactive');
                    // check if any row/column still selected
                    var isColSelected = false;
                    var isRowSelected = false;
                    var tmp = this.getSelection();
                    for (var i = 0; i < tmp.length; i++) {
                        if (tmp[i].column == col) isColSelected = true;
                        if (tmp[i].recid == recid) isRowSelected = true;
                    }
                    if (!isColSelected) {
                       $(this.box).find('.w2ui-grid-columns td[col='+ col +'] .w2ui-col-header, .w2ui-grid-fcolumns td[col='+ col +'] .w2ui-col-header').removeClass('w2ui-col-selected');
                    }
                    if (!isRowSelected) {
                        $('#grid_'+ this.name +'_frec_'+ w2utils.escapeId(recid)).find('.w2ui-col-number').removeClass('w2ui-row-selected');
                    }
                    unselected++;
                    if (s.length === 0) {
                        delete sel.columns[index];
                        sel.indexes.splice(sel.indexes.indexOf(index), 1);
                        recEl1.removeData('selected');
                        recEl1.find('.w2ui-grid-select-check').prop("checked", false);
                        recEl2.removeData('selected');
                    }
                }
                // event after
                this.trigger($.extend(edata, { phase: 'after' }));
            }
            // all selected?
            var areAllSelected = (this.records.length > 0 && sel.indexes.length == this.records.length),
                areAllSearchedSelected = (sel.indexes.length > 0 && this.searchData.length !== 0 && sel.indexes.length == this.last.searchIds.length);
            if (areAllSelected || areAllSearchedSelected) {
                $('#grid_'+ this.name +'_check_all').prop('checked', true);
            } else {
                $('#grid_'+ this.name +'_check_all').prop('checked', false);
            }
            // show number of selected
            this.status();
            this.addRange('selection');
            return unselected;
        },

        selectAll: function () {
            var time = (new Date()).getTime();
            if (this.multiSelect === false) return;
            // event before
            var edata = this.trigger({ phase: 'before', type: 'select', target: this.name, all: true });
            if (edata.isCancelled === true) return;
            // default action
            var url  = (typeof this.url != 'object' ? this.url : this.url.get);
            var sel  = this.last.selection;
            var cols = [];
            for (var i = 0; i < this.columns.length; i++) cols.push(i);
            // if local data source and searched
            sel.indexes = [];
            if (!url && this.searchData.length !== 0) {
                // local search applied
                for (var i = 0; i < this.last.searchIds.length; i++) {
                    sel.indexes.push(this.last.searchIds[i]);
                    if (this.selectType != 'row') sel.columns[this.last.searchIds[i]] = cols.slice(); // .slice makes copy of the array
                }
            } else {
                var buffered = this.records.length;
                if (this.searchData.length != 0 && !url) buffered = this.last.searchIds.length;
                for (var i = 0; i < buffered; i++) {
                    sel.indexes.push(i);
                    if (this.selectType != 'row') sel.columns[i] = cols.slice(); // .slice makes copy of the array
                }
            }
            // add selected class
            if (this.selectType == 'row') {
                $(this.box).find('.w2ui-grid-records tr').not('.w2ui-empty-record')
                    .addClass('w2ui-selected').data('selected', 'yes').find('.w2ui-col-number').addClass('w2ui-row-selected');
                $(this.box).find('.w2ui-grid-frecords tr').not('.w2ui-empty-record')
                    .addClass('w2ui-selected').data('selected', 'yes').find('.w2ui-col-number').addClass('w2ui-row-selected');
                $(this.box).find('input.w2ui-grid-select-check').prop('checked', true);
            } else {
                $(this.box).find('.w2ui-grid-columns td .w2ui-col-header, .w2ui-grid-fcolumns td .w2ui-col-header').addClass('w2ui-col-selected');
                $(this.box).find('.w2ui-grid-records tr .w2ui-col-number').addClass('w2ui-row-selected');
                $(this.box).find('.w2ui-grid-records tr').not('.w2ui-empty-record')
                    .find('.w2ui-grid-data').not('.w2ui-col-select').addClass('w2ui-selected').data('selected', 'yes');
                $(this.box).find('.w2ui-grid-frecords tr .w2ui-col-number').addClass('w2ui-row-selected');
                $(this.box).find('.w2ui-grid-frecords tr').not('.w2ui-empty-record')
                    .find('.w2ui-grid-data').not('.w2ui-col-select').addClass('w2ui-selected').data('selected', 'yes');
                $(this.box).find('input.w2ui-grid-select-check').prop('checked', true);
            }
            // enable/disable toolbar buttons
            var sel = this.getSelection();
            if (sel.length == 1) this.toolbar.enable('w2ui-edit'); else this.toolbar.disable('w2ui-edit');
            if (sel.length >= 1) this.toolbar.enable('w2ui-delete'); else this.toolbar.disable('w2ui-delete');
            this.addRange('selection');
            $('#grid_'+ this.name +'_check_all').prop('checked', true);
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            return (new Date()).getTime() - time;
        },

        selectNone: function () {
            var time = (new Date()).getTime();
            // event before
            var edata = this.trigger({ phase: 'before', type: 'unselect', target: this.name, all: true });
            if (edata.isCancelled === true) return;
            // default action
            var sel = this.last.selection;
            // remove selected class
            if (this.selectType == 'row') {
                $(this.box).find('.w2ui-grid-records tr.w2ui-selected').removeClass('w2ui-selected w2ui-inactive').removeData('selected')
                    .find('.w2ui-col-number').removeClass('w2ui-row-selected');
                $(this.box).find('.w2ui-grid-frecords tr.w2ui-selected').removeClass('w2ui-selected w2ui-inactive').removeData('selected')
                    .find('.w2ui-col-number').removeClass('w2ui-row-selected');
                $(this.box).find('input.w2ui-grid-select-check').prop('checked', false);
            } else {
                $(this.box).find('.w2ui-grid-columns td .w2ui-col-header, .w2ui-grid-fcolumns td .w2ui-col-header').removeClass('w2ui-col-selected');
                $(this.box).find('.w2ui-grid-records tr .w2ui-col-number').removeClass('w2ui-row-selected');
                $(this.box).find('.w2ui-grid-frecords tr .w2ui-col-number').removeClass('w2ui-row-selected');
                $(this.box).find('.w2ui-grid-data.w2ui-selected').removeClass('w2ui-selected w2ui-inactive').removeData('selected');
                $(this.box).find('input.w2ui-grid-select-check').prop('checked', false);
            }
            sel.indexes = [];
            sel.columns = {};
            this.toolbar.disable('w2ui-edit', 'w2ui-delete');
            this.removeRange('selection');
            $('#grid_'+ this.name +'_check_all').prop('checked', false);
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            return (new Date()).getTime() - time;
        },

        getSelection: function (returnIndex) {
            var ret = [];
            var sel = this.last.selection;
            if (this.selectType == 'row') {
                for (var i = 0; i < sel.indexes.length; i++) {
                    if (!this.records[sel.indexes[i]]) continue;
                    if (returnIndex === true) ret.push(sel.indexes[i]); else ret.push(this.records[sel.indexes[i]].recid);
                }
                return ret;
            } else {
                for (var i = 0; i < sel.indexes.length; i++) {
                    var cols = sel.columns[sel.indexes[i]];
                    if (!this.records[sel.indexes[i]]) continue;
                    for (var j = 0; j < cols.length; j++) {
                        ret.push({ recid: this.records[sel.indexes[i]].recid, index: parseInt(sel.indexes[i]), column: cols[j] });
                    }
                }
                return ret;
            }
        },

        search: function (field, value) {
            var obj         = this;
            var url         = (typeof this.url != 'object' ? this.url : this.url.get);
            var searchData  = [];
            var last_multi  = this.last.multi;
            var last_logic  = this.last.logic;
            var last_field  = this.last.field;
            var last_search = this.last.search;
            var hasHiddenSearches = false;
            // add hidden searches
            for (var i = 0; i < this.searches.length; i++) {
                if (!this.searches[i].hidden) continue;
                searchData.push({
                    field    : this.searches[i].field,
                    operator : this.searches[i].operator || 'is',
                    type     : this.searches[i].type,
                    value    : this.searches[i].value || ''
                });
                hasHiddenSearches = true;
            }
            // 1: search() - advanced search (reads from popup)
            if (arguments.length === 0) {
                last_search = '';
                // advanced search
                for (var i = 0; i < this.searches.length; i++) {
                    var search   = this.searches[i];
                    var operator = $('#grid_'+ this.name + '_operator_'+ i).val();
                    var field1   = $('#grid_'+ this.name + '_field_'+ i);
                    var field2   = $('#grid_'+ this.name + '_field2_'+ i);
                    var value1   = field1.val();
                    var value2   = field2.val();
                    var svalue   = null;
                    var text     = null;

                    if (['int', 'float', 'money', 'currency', 'percent'].indexOf(search.type) != -1) {
                        var fld1 = field1.data('w2field');
                        var fld2 = field2.data('w2field');
                        if (fld1) value1 = fld1.clean(value1);
                        if (fld2) value2 = fld2.clean(value2);
                    }
                    if (['list', 'enum'].indexOf(search.type) != -1) {
                        value1 = field1.data('selected') || {};
                        if ($.isArray(value1)) {
                            svalue = [];
                            for (var j = 0; j < value1.length; j++) {
                                svalue.push(w2utils.isFloat(value1[j].id) ? parseFloat(value1[j].id) : String(value1[j].id).toLowerCase());
                                delete value1[j].hidden;
                            }
                            if ($.isEmptyObject(value1)) value1 = '';
                        } else {
                            text = value1.text || '';
                            value1 = value1.id || '';
                        }
                    }
                    if ((value1 !== '' && value1 != null) || (value2 != null && value2 !== '')) {
                        var tmp = {
                            field    : search.field,
                            type     : search.type,
                            operator : operator
                        };
                        if (operator == 'between') {
                            $.extend(tmp, { value: [value1, value2] });
                        } else if (operator == 'in' && typeof value1 == 'string') {
                            $.extend(tmp, { value: value1.split(',') });
                        } else if (operator == 'not in' && typeof value1 == 'string') {
                            $.extend(tmp, { value: value1.split(',') });
                        } else {
                            $.extend(tmp, { value: value1 });
                        }
                        if (svalue) $.extend(tmp, { svalue: svalue });
                        if (text) $.extend(tmp, { text: text });

                        // conver date to unix time
                        try {
                            if (search.type == 'date' && operator == 'between') {
                                tmp.value[0] = value1; // w2utils.isDate(value1, w2utils.settings.dateFormat, true).getTime();
                                tmp.value[1] = value2; // w2utils.isDate(value2, w2utils.settings.dateFormat, true).getTime();
                            }
                            if (search.type == 'date' && operator == 'is') {
                                tmp.value = value1; // w2utils.isDate(value1, w2utils.settings.dateFormat, true).getTime();
                            }
                        } catch (e) {

                        }
                        searchData.push(tmp);
                    }
                }
                last_multi = true;
                last_logic = 'AND';
            }
            // 2: search(field, value) - regular search
            if (typeof field == 'string') {
                // if only one argument - search all
                if (arguments.length == 1) {
                    value = field;
                    field = 'all';
                }
                last_field  = field;
                last_search = value;
                last_multi  = false;
                last_logic  = (hasHiddenSearches ? 'AND' : 'OR');
                // loop through all searches and see if it applies
                if (value != null) {
                    if (field.toLowerCase() == 'all') {
                        // if there are search fields loop thru them
                        if (this.searches.length > 0) {
                            for (var i = 0; i < this.searches.length; i++) {
                                var search = this.searches[i];
                                if (    search.type == 'text' || (search.type == 'alphanumeric' && w2utils.isAlphaNumeric(value))
                                        || (search.type == 'int' && w2utils.isInt(value)) || (search.type == 'float' && w2utils.isFloat(value))
                                        || (search.type == 'percent' && w2utils.isFloat(value)) || ((search.type == 'hex' || search.type == 'color') && w2utils.isHex(value))
                                        || (search.type == 'currency' && w2utils.isMoney(value)) || (search.type == 'money' && w2utils.isMoney(value))
                                        || (search.type == 'date' && w2utils.isDate(value)) || (search.type == 'time' && w2utils.isTime(value))
                                        || (search.type == 'datetime' && w2utils.isDateTime(value)) || (search.type == 'enum' && w2utils.isAlphaNumeric(value))
                                        || (search.type == 'list' && w2utils.isAlphaNumeric(value))
                                    ) {
                                    var tmp = {
                                        field    : search.field,
                                        type     : search.type,
                                        operator : (search.operator != null ? search.operator : (search.type == 'text' ? this.textSearch : 'is')),
                                        value    : value
                                    };
                                    if ($.trim(value) != '') searchData.push(tmp);
                                }
                                // range in global search box
                                if (['int', 'float', 'money', 'currency', 'percent'].indexOf(search.type) != -1 && $.trim(String(value)).split('-').length == 2) {
                                    var t = $.trim(String(value)).split('-');
                                    var tmp = {
                                        field    : search.field,
                                        type     : search.type,
                                        operator : (search.operator != null ? search.operator : 'between'),
                                        value    : [t[0], t[1]]
                                    };
                                    searchData.push(tmp);
                                }
                                // lists fiels
                                if (['list', 'enum'].indexOf(search.type) != -1) {
                                    var new_values = [];
                                    for (var j = 0; j < search.options.items; j++) {
                                        var tmp = search.options.items[j];
                                        try {
                                            var re = new RegExp(value, 'i');
                                            if (re.test(tmp)) new_values.push(j);
                                            if (tmp.text && re.test(tmp.text)) new_values.push(tmp.id);
                                        } catch (e) {}
                                    }
                                    if (new_values.length > 0) {
                                        var tmp = {
                                            field    : search.field,
                                            type     : search.type,
                                            operator : (search.operator != null ? search.operator : 'in'),
                                            value    : new_values
                                        };
                                        searchData.push(tmp);
                                    }
                                }
                            }
                        } else {
                            // no search fields, loop thru columns
                            for (var i = 0; i < this.columns.length; i++) {
                                var tmp = {
                                    field    : this.columns[i].field,
                                    type     : 'text',
                                    operator : this.textSearch,
                                    value    : value
                                };
                                searchData.push(tmp);
                            }
                        }
                    } else {
                        var el = $('#grid_'+ this.name +'_search_all');
                        var search = this.getSearch(field);
                        if (search == null) search = { field: field, type: 'text' };
                        if (search.field == field) this.last.caption = search.caption;
                        if (value !== '') {
                            var op  = this.textSearch;
                            var val = value;
                            if (['date', 'time', 'datetime'].indexOf(search.type) != -1) op = 'is';
                            if (['list', 'enum'].indexOf(search.type) != -1) {
                                op = 'is';
                                var tmp = el.data('selected');
                                if (tmp && !$.isEmptyObject(tmp)) val = tmp.id; else val = '';
                            }
                            if (search.type == 'int' && value !== '') {
                                op = 'is';
                                if (String(value).indexOf('-') != -1) {
                                    var tmp = value.split('-');
                                    if (tmp.length == 2) {
                                        op = 'between';
                                        val = [parseInt(tmp[0]), parseInt(tmp[1])];
                                    }
                                }
                                if (String(value).indexOf(',') != -1) {
                                    var tmp = value.split(',');
                                    op  = 'in';
                                    val = [];
                                    for (var i = 0; i < tmp.length; i++) val.push(tmp[i]);
                                }
                            }
                            if (search.operator != null) op = search.operator;
                            var tmp = {
                                field    : search.field,
                                type     : search.type,
                                operator : op,
                                value    : val
                            };
                            searchData.push(tmp);
                        }
                    }
                }
            }
            // 3: search([ { field, value, [operator,] [type] }, { field, value, [operator,] [type] } ], logic) - submit whole structure
            if ($.isArray(field)) {
                var logic = 'AND';
                if (typeof value == 'string') {
                    logic = value.toUpperCase();
                    if (logic != 'OR' && logic != 'AND') logic = 'AND';
                }
                last_search = '';
                last_multi  = true;
                last_logic  = logic;
                for (var i = 0; i < field.length; i++) {
                    var data   = field[i];
                    var search = this.getSearch(data.field);
                    if (search == null) search = { type: 'text', operator: 'begins' };
                    if ($.isArray(data.value)) {
                        for (var j = 0; j < data.value.length; j++) {
                            if (typeof data.value[j] == 'string') data.value[j] = data.value[j].toLowerCase();
                        }
                    }
                    // merge current field and search if any
                    searchData.push($.extend(true, {}, search, data));
                }
            }
            // event before
            var edata = this.trigger({ phase: 'before', type: 'search', multi: (arguments.length === 0 ? true : false), target: this.name, searchData: searchData,
                    searchField: (field ? field : 'multi'), searchValue: (field ? value : 'multi') });
            if (edata.isCancelled === true) return;
            // default action
            this.searchData  = edata.searchData;
            this.last.field  = last_field;
            this.last.search = last_search;
            this.last.multi  = last_multi;
            this.last.logic  = last_logic;
            this.last.scrollTop         = 0;
            this.last.scrollLeft        = 0;
            this.last.selection.indexes = [];
            this.last.selection.columns = {};
            // -- clear all search field
            this.searchClose();
            // apply search
            if (url) {
                this.last.xhr_offset = 0;
                this.reload();
            } else {
                // local search
                this.localSearch();
                this.refresh();
            }
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        searchOpen: function () {
            if (!this.box) return;
            if (this.searches.length === 0) return;
            var obj = this;
            // event before
            var edata = this.trigger({ phase: 'before', type: 'searchOpen', target: this.name });
            if (edata.isCancelled === true) {
                setTimeout(function () { obj.toolbar.uncheck('w2ui-search-advanced'); }, 1);
                return;
            }
            // show search
            $('#tb_'+ this.name +'_toolbar_item_w2ui-search-advanced').w2overlay({
                html    : this.getSearchesHTML(),
                name    : this.name + '-searchOverlay',
                left    : -10,
                'class' : 'w2ui-grid-searches',
                onShow  : function () {
                    obj.initSearches();
                    $('#w2ui-overlay-'+ obj.name +'-searchOverlay .w2ui-grid-searches').data('grid-name', obj.name);
                    var sfields = $('#w2ui-overlay-'+ this.name +'-searchOverlay .w2ui-grid-searches *[rel=search]');
                    if (sfields.length > 0) sfields[0].focus();
                    // event after
                    obj.trigger($.extend(edata, { phase: 'after' }));
                }
            });
        },

        searchClose: function () {
            var obj = this;
            if (!this.box) return;
            if (this.searches.length === 0) return;
            if (this.toolbar) this.toolbar.uncheck('w2ui-search-advanced');
            // hide search
            $().w2overlay({ name: this.name + '-searchOverlay' });
            $().w2overlay({ name: this.name + '-searchOverlay' }); // need to call twice as first ignored after click
        },

        searchReset: function (noRefresh) {
            var searchData = [];
            var hasHiddenSearches = false;
            // add hidden searches
            for (var i = 0; i < this.searches.length; i++) {
                if (!this.searches[i].hidden) continue;
                searchData.push({
                    field    : this.searches[i].field,
                    operator : this.searches[i].operator || 'is',
                    type     : this.searches[i].type,
                    value    : this.searches[i].value || ''
                });
                hasHiddenSearches = true;
            }
            // event before
            var edata = this.trigger({ phase: 'before', type: 'search', reset: true, target: this.name, searchData: searchData });
            if (edata.isCancelled === true) return;
            // default action
            this.searchData  = edata.searchData;
            this.last.search = '';
            this.last.logic  = (hasHiddenSearches ? 'AND' : 'OR');
            // --- do not reset to All Fields (I think)
            if (this.searches.length > 0) {
                if (!this.multiSearch || !this.show.searchAll) {
                    var tmp = 0;
                    while (tmp < this.searches.length && (this.searches[tmp].hidden || this.searches[tmp].simple === false)) tmp++;
                    if (tmp >= this.searches.length) {
                        // all searches are hidden
                        this.last.field   = '';
                        this.last.caption = '';
                    } else {
                        this.last.field   = this.searches[tmp].field;
                        this.last.caption = this.searches[tmp].caption;
                    }
                } else {
                    this.last.field   = 'all';
                    this.last.caption = w2utils.lang('All Fields');
                }
            }
            this.last.multi      = false;
            this.last.xhr_offset = 0;
            // reset scrolling position
            this.last.scrollTop  = 0;
            this.last.scrollLeft = 0;
            this.last.selection.indexes = [];
            this.last.selection.columns = {};
            // -- clear all search field
            this.searchClose();
            $('#grid_'+ this.name +'_search_all').val('').removeData('selected');
            // apply search
            if (!noRefresh) this.reload();
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        searchShowFields: function () {
            var obj  = this;
            var el   = $('#grid_'+ this.name +'_search_all');
            var html = '<div class="w2ui-select-field"><table><tbody>';
            for (var s = -1; s < this.searches.length; s++) {
                var search = this.searches[s];
                if (s == -1) {
                    if (!this.multiSearch || !this.show.searchAll) continue;
                    search = { field: 'all', caption: w2utils.lang('All Fields') };
                } else {
                    if (this.searches[s].hidden === true || this.searches[s].simple === false) continue;
                }
                html += '<tr '+ (w2utils.isIOS ? 'onTouchStart' : 'onClick') +'="w2ui[\''+ this.name +'\'].initAllField(\''+ search.field +'\');'+
                        '      event.stopPropagation(); jQuery(\'#grid_'+ this.name +'_search_all\').w2overlay({ name: \''+ this.name +'-searchFields\' });">'+
                        '   <td>'+
                        '       <span class="w2ui-column-check w2ui-icon-'+ (search.field == this.last.field ? 'check' : 'empty') +'"></span>'+
                        '   </td>'+
                        '   <td>'+ search.caption +'</td>'+
                        '</tr>';
            }
            html += "</tbody></table></div>";
            // need timer otherwise does nto show with list type
            setTimeout(function () {
                $(el).w2overlay({ html: html, name: obj.name + '-searchFields', left: -10 });
            }, 1);
        },

        initAllField: function (field, value) {
            var el = $('#grid_'+ this.name +'_search_all');
            if (field == 'all') {
                var search = { field: 'all', caption: w2utils.lang('All Fields') };
                el.w2field('clear');
                el.change();
            } else {
                var search = this.getSearch(field);
                if (search == null) return;
                var st = search.type;
                if (['enum', 'select'].indexOf(st) != -1) st = 'list';
                el.w2field(st, $.extend({}, search.options, { suffix: '', autoFormat: false, selected: value }));
                if (['list', 'enum', 'date', 'time', 'datetime'].indexOf(search.type) != -1) {
                    this.last.search = '';
                    this.last.item   = '';
                    el.val('');
                }
            }
            // update field
            if (this.last.search != '') {
                this.last.caption = search.caption;
                this.search(search.field, this.last.search);
            } else {
                this.last.field   = search.field;
                this.last.caption = search.caption;
            }
            el.attr('placeholder', w2utils.lang(search.caption));
            $().w2overlay({ name: this.name + '-searchFields' });
        },

        // clears records and related params
        clear: function (noRefresh) {
            this.total            = 0;
            this.records          = [];
            this.summary          = [];
            this.last.xhr_offset  = 0;   // need this for reload button to work on remote data set
            this.reset(true);
            // refresh
            if (!noRefresh) this.refresh();
        },

        // clears scroll position, selection, ranges
        reset: function (noRefresh) {
            // position
            this.last.scrollTop   = 0;
            this.last.scrollLeft  = 0;
            this.last.selection   = { indexes: [], columns: {} };
            this.last.range_start = null;
            this.last.range_end   = null;
            // additional
            $('#grid_'+ this.name +'_records').prop('scrollTop',  0);
            // refresh
            if (!noRefresh) this.refresh();
        },

        skip: function (offset, callBack) {
            var url = (typeof this.url != 'object' ? this.url : this.url.get);
            if (url) {
                this.offset = parseInt(offset);
                if (this.offset > this.total) this.offset = this.total - this.limit;
                if (this.offset < 0 || !w2utils.isInt(this.offset)) this.offset = 0;
                this.clear(true);
                this.reload(callBack);
            } else {
                console.log('ERROR: grid.skip() can only be called when you have remote data source.');
            }
        },

        load: function (url, callBack) {
            if (url == null) {
                console.log('ERROR: You need to provide url argument when calling .load() method of "'+ this.name +'" object.');
                return;
            }
            // default action
            this.clear(true);
            this.request('get', {}, url, callBack);
        },

        reload: function (callBack) {
            var grid = this;
            var url  = (typeof this.url != 'object' ? this.url : this.url.get);
            grid.selectionSave();
            if (url) {
                // need to remember selection (not just last.selection object)
                this.load(url, function () {
                    grid.selectionRestore();
                    if (typeof callBack == 'function') callBack();
                });
            } else {
                this.reset(true);
                this.localSearch();
                this.selectionRestore();
                if (typeof callBack == 'function') callBack({ status: 'success' });
            }
        },

        request: function (cmd, add_params, url, callBack) {
            if (add_params == null) add_params = {};
            if (url == '' || url == null) url = this.url;
            if (url == '' || url == null) return;
            // build parameters list
            var params = {};
            if (!w2utils.isInt(this.offset)) this.offset = 0;
            if (!w2utils.isInt(this.last.xhr_offset)) this.last.xhr_offset = 0;
            // add list params
            params['cmd']         = cmd;
            params['selected']    = this.getSelection();
            params['limit']       = this.limit;
            params['offset']      = parseInt(this.offset) + parseInt(this.last.xhr_offset);
            params['search']      = this.searchData;
            params['searchLogic'] = this.last.logic;
            params['sort']        = this.sortData;
            if (this.searchData.length === 0) {
                delete params['search'];
                delete params['searchLogic'];
            }
            if (this.sortData.length === 0) {
                delete params['sort'];
            }
            // append other params
            $.extend(params, this.postData);
            $.extend(params, add_params);
            // event before
            if (cmd == 'get') {
                var edata = this.trigger({ phase: 'before', type: 'request', target: this.name, url: url, postData: params, httpHeaders: this.httpHeaders });
                if (edata.isCancelled === true) { if (typeof callBack == 'function') callBack({ status: 'error', message: 'Request aborted.' }); return; }
            } else {
                var edata = { url: url, postData: params, httpHeaders: this.httpHeaders };
            }
            // call server to get data
            var obj = this;
            if (this.last.xhr_offset === 0) {
                obj.lock(w2utils.lang(obj.msgRefresh), true);
            } else {
                var more = $('#grid_'+ this.name +'_rec_more, #grid_'+ this.name +'_frec_more');
                if (this.autoLoad === true) {
                    more.show().find('td').html('<div><div style="width: 20px; height: 20px;" class="w2ui-spinner"></div></div>');
                } else {
                    more.find('td').html('<div>'+ w2utils.lang('Load') + ' ' + obj.limit + ' ' + w2utils.lang('More') + '...</div>');
                }
            }
            if (this.last.xhr) try { this.last.xhr.abort(); } catch (e) {}
            // URL
            url = (typeof edata.url != 'object' ? edata.url : edata.url.get);
            if (params.cmd == 'save' && typeof edata.url == 'object')   url = edata.url.save;
            if (params.cmd == 'delete' && typeof edata.url == 'object') url = edata.url.remove;
            // process url with routeData
            if (!$.isEmptyObject(obj.routeData)) {
                var info  = w2utils.parseRoute(url);
                if (info.keys.length > 0) {
                    for (var k = 0; k < info.keys.length; k++) {
                        if (obj.routeData[info.keys[k].name] == null) continue;
                        url = url.replace((new RegExp(':'+ info.keys[k].name, 'g')), obj.routeData[info.keys[k].name]);
                    }
                }
            }
            // ajax ptions
            var ajaxOptions = {
                type     : 'POST',
                url      : url,
                data     : edata.postData,
                headers  : edata.httpHeaders,
                dataType : 'text'  // expected data type from server
            };
           if (w2utils.settings.dataType == 'HTTP') {
                ajaxOptions.data = (typeof ajaxOptions.data == 'object' ? String($.param(ajaxOptions.data, false)).replace(/%5B/g, '[').replace(/%5D/g, ']') : ajaxOptions.data);
            }
            if (w2utils.settings.dataType == 'HTTPJSON') {
                ajaxOptions.data = { request: JSON.stringify(ajaxOptions.data) };
            }
            if (w2utils.settings.dataType == 'RESTFULL') {
                ajaxOptions.type = 'GET';
                if (params.cmd == 'save')   ajaxOptions.type = 'PUT';  // so far it is always update
                if (params.cmd == 'delete') ajaxOptions.type = 'DELETE';
                ajaxOptions.data = (typeof ajaxOptions.data == 'object' ? String($.param(ajaxOptions.data, false)).replace(/%5B/g, '[').replace(/%5D/g, ']') : ajaxOptions.data);
            }
            if (w2utils.settings.dataType == 'RESTFULLJSON') {
                ajaxOptions.type = 'GET';
                if (params.cmd == 'save')   ajaxOptions.type = 'PUT';  // so far it is always update
                if (params.cmd == 'delete') ajaxOptions.type = 'DELETE';
                ajaxOptions.data        = JSON.stringify(ajaxOptions.data);
                ajaxOptions.contentType = 'application/json';
            }
            if (w2utils.settings.dataType == 'JSON') {
                ajaxOptions.type        = 'POST';
                ajaxOptions.data        = JSON.stringify(ajaxOptions.data);
                ajaxOptions.contentType = 'application/json';
            }
            if (this.method) ajaxOptions.type = this.method;

            this.last.xhr_cmd   = params.cmd;
            this.last.xhr_start = (new Date()).getTime();
            this.last.xhr = $.ajax(ajaxOptions)
                .done(function (data, status, xhr) {
                    obj.requestComplete(status, cmd, callBack);
                })
                .fail(function (xhr, status, error) {
                    // trigger event
                    var errorObj = { status: status, error: error, rawResponseText: xhr.responseText };
                    var edata2 = obj.trigger({ phase: 'before', type: 'error', error: errorObj, xhr: xhr });
                    if (edata2.isCancelled === true) return;
                    // default behavior
                    if (status != 'abort') { // it can be aborted by the grid itself
                        var data;
                        try { data = $.parseJSON(xhr.responseText); } catch (e) {}
                        console.log('ERROR: Server communication failed.',
                            '\n   EXPECTED:', { status: 'success', total: 5, records: [{ recid: 1, field: 'value' }] },
                            '\n         OR:', { status: 'error', message: 'error message' },
                            '\n   RECEIVED:', typeof data == 'object' ? data : xhr.responseText);
                        obj.requestComplete('error', cmd, callBack);
                    }
                    // event after
                    obj.trigger($.extend(edata2, { phase: 'after' }));
                });
            if (cmd == 'get') {
                // event after
                this.trigger($.extend(edata, { phase: 'after' }));
            }
        },

        requestComplete: function(status, cmd, callBack) {
            var obj = this;
            this.unlock();
            setTimeout(function () {
                if (obj.show.statusResponse) obj.status(w2utils.lang('Server Response') + ' ' + ((new Date()).getTime() - obj.last.xhr_start)/1000 +' ' + w2utils.lang('sec'));
            }, 10);
            this.last.pull_more    = false;
            this.last.pull_refresh = true;

            // event before
            var event_name = 'load';
            if (this.last.xhr_cmd == 'save') event_name   = 'save';
            if (this.last.xhr_cmd == 'delete') event_name = 'delete';
            var edata = this.trigger({ phase: 'before', target: this.name, type: event_name, xhr: this.last.xhr, status: status });
            if (edata.isCancelled === true) {
                if (typeof callBack == 'function') callBack({ status: 'error', message: 'Request aborted.' });
                return;
            }
            // parse server response
            var data;
            var responseText = this.last.xhr.responseText;
            if (status != 'error') {
                // default action
                if (responseText != null && responseText != '') {
                    // check if the onLoad handler has not already parsed the data
                    if (typeof responseText == "object") {
                        data = responseText;
                    } else {
                        if (typeof obj.parser == 'function') {
                            data = obj.parser(responseText);
                            if (typeof data != 'object') {
                                console.log('ERROR: Your parser did not return proper object');
                            }
                        } else {
                            // $.parseJSON or $.getJSON did not work because those expect perfect JSON data - where everything is in double quotes
                            //
                            // TODO: avoid (potentially malicious) code injection from the response.
                            try { eval('data = '+ responseText); } catch (e) { }
                        }
                    }
                    if (data == null) {
                        data = {
                            status       : 'error',
                            message      : w2utils.lang(this.msgNotJSON),
                            responseText : responseText
                        };
                    } else if (Array.isArray(data)) {
                        // if it is plain array, assume these are records
                        data = {
                            status  : 'success',
                            records : data
                        }
                    }
                    if (obj.recid && data.records) {
                        // convert recids
                        for (var i = 0; i < data.records.length; i++) {
                            data.records[i]['recid'] = data.records[i][obj.recid];
                        }
                    }
                    if (data['status'] == 'error') {
                        obj.error(data['message']);
                    } else {
                        if (cmd == 'get') {
                            if (data.total == null) data.total = -1;
                            if (data.records.length == this.limit) {
                                this.last.xhr_hasMore = true;
                            } else {
                                this.last.xhr_hasMore = false;
                                this.total = this.last.xhr_offset + data.records.length;
                            }
                            if (this.last.xhr_offset === 0) {
                                this.records = [];
                                this.summary = [];
                                if (w2utils.isInt(data.total)) this.total = parseInt(data.total);
                            } else {
                                if (data.total != -1 && parseInt(data.total) != parseInt(this.total)) {
                                    this.message(w2utils.lang(this.msgNeedReload), function () {
                                        delete this.last.xhr_offset;
                                        this.reload();
                                    }.bind(this));
                                    return;
                                }
                            }
                            // records
                            if (data.records) {
                                for (var r = 0; r < data.records.length; r++) {
                                    this.records.push(data.records[r]);
                                }
                            }
                            // summary records (if any)
                            if (data.summary) {
                                this.summary = [];
                                for (var r = 0; r < data.summary.length; r++) {
                                    this.summary.push(data.summary[r]);
                                }
                            }
                        }
                        if (cmd == 'delete') {
                            this.reset(); // unselect old selections
                            this.reload();
                            return;
                        }
                    }
                }
            } else {
                data = {
                    status       : 'error',
                    message      : w2utils.lang(this.msgAJAXerror),
                    responseText : responseText
                };
                obj.error(w2utils.lang(this.msgAJAXerror));
            }
            // event after
            var url = (typeof this.url != 'object' ? this.url : this.url.get);
            if (!url) {
                this.localSort();
                this.localSearch();
            }
            this.total = parseInt(this.total);
            // do not refresh if loading on infinite scroll
            if (this.last.xhr_offset === 0) {
                this.refresh();
            } else {
                this.scroll();
                this.resize();
            }
            // call back
            if (typeof callBack == 'function') callBack(data); // need to be befor event:after
            // after event
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        error: function (msg) {
            var obj = this;
            // let the management of the error outside of the grid
            var edata = this.trigger({ target: this.name, type: 'error', message: msg , xhr: this.last.xhr });
            if (edata.isCancelled === true) {
                if (typeof callBack == 'function') callBack({ status: 'error', message: 'Request aborted.' });
                return;
            }
            this.message(msg);
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        getChanges: function () {
            var changes = [];
            for (var r = 0; r < this.records.length; r++) {
                var rec = this.records[r];
                if (rec.w2ui && rec.w2ui.changes != null) {
                    changes.push($.extend(true, { recid: rec.recid }, rec.w2ui.changes));
                }
            }
            return changes;
        },

        mergeChanges: function () {
            var changes = this.getChanges();
            for (var c = 0; c < changes.length; c++) {
                var record = this.get(changes[c].recid);
                for (var s in changes[c]) {
                    if (s == 'recid') continue; // do not allow to change recid
                    if (typeof changes[c][s] === "object") changes[c][s] = changes[c][s].text;
                    try {
                        if (s.indexOf('.') != -1) {
                            eval("record['" + s.replace(/\./g, "']['") + "'] = changes[c][s]")
                        } else {
                            record[s] = changes[c][s];
                        }
                    } catch (e) {
                        console.log('ERROR: Cannot merge. ', e.message || '', e);
                    }
                    if (record.w2ui) delete record.w2ui.changes;
                }
            }
            this.refresh();
        },

        // ===================================================
        // --  Action Handlers

        save: function () {
            var obj = this;
            var changes = this.getChanges();
            // event before
            var edata = this.trigger({ phase: 'before', target: this.name, type: 'save', changes: changes });
            if (edata.isCancelled === true) return;
            var url = (typeof this.url != 'object' ? this.url : this.url.save);
            if (url) {
                this.request('save', { 'changes' : edata.changes }, null,
                    function (data) {
                        if (data.status !== 'error') {
                            // only merge changes, if save was successful
                            obj.mergeChanges();
                        }
                        // event after
                        obj.trigger($.extend(edata, { phase: 'after' }));
                    }
                );
            } else {
                this.mergeChanges();
                // event after
                this.trigger($.extend(edata, { phase: 'after' }));
            }
        },

        editField: function (recid, column, value, event) {
            var obj    = this;
            var index  = obj.get(recid, true);
            var edit   = obj.getCellEditable(index, column);
            if (!edit) return;
            var rec    = obj.records[index];
            var col    = obj.columns[column];
            var prefix = (col.frozen === true ? '_f' : '_');
            if (['enum', 'file'].indexOf(edit.type) != -1) {
                console.log('ERROR: input types "enum" and "file" are not supported in inline editing.');
                return;
            }
            // event before
            var edata = obj.trigger({ phase: 'before', type: 'editField', target: obj.name, recid: recid, column: column, value: value,
                index: index, originalEvent: event });
            if (edata.isCancelled === true) return;
            value = edata.value;
            // default behaviour
            this.selectNone();
            this.select({ recid: recid, column: column });
            this.last.edit_col = column;
            if (['checkbox', 'check'].indexOf(edit.type) != -1) return;
            // create input element
            var tr = $('#grid_'+ obj.name + prefix +'rec_' + w2utils.escapeId(recid));
            var el = tr.find('[col='+ column +'] > div');
            // clear previous if any
            $(this.box).find('div.w2ui-edit-box').remove();
            // for spreadsheet - insert into selection
            if (this.selectType != 'row') {
                $('#grid_'+ this.name + prefix + 'selection')
                    .attr('id', 'grid_'+ this.name + '_editable')
                    .removeClass('w2ui-selection')
                    .addClass('w2ui-edit-box')
                    .prepend('<div style="position: absolute; top: 0px; bottom: 0px; left: 0px; right: 0px;"></div>')
                    .find('.w2ui-selection-resizer')
                    .remove();
                el = $('#grid_'+ this.name + '_editable >div:first-child');
            }
            if (edit.inTag   == null) edit.inTag   = '';
            if (edit.outTag  == null) edit.outTag  = '';
            if (edit.style   == null) edit.style   = '';
            if (edit.items   == null) edit.items   = [];
            var val = (rec.w2ui && rec.w2ui.changes && rec.w2ui.changes[col.field] != null ? w2utils.stripTags(rec.w2ui.changes[col.field]) : w2utils.stripTags(rec[col.field]));
            if (val == null) val = '';
            var old_value = (typeof val != 'object' ? val : '');
            if (edata.old_value != null) old_value = edata.old_value;
            if (value != null) val = value;
            var addStyle = (col.style != null ? col.style + ';' : '');
            if (typeof col.render == 'string' && ['number', 'int', 'float', 'money', 'percent', 'size'].indexOf(col.render.split(':')[0]) != -1) {
                addStyle += 'text-align: right;';
            }
            // normalize items
            if (edit.items.length > 0 && !$.isPlainObject(edit.items[0])) {
                edit.items = w2obj.field.prototype.normMenu(edit.items);
            }
            switch (edit.type) {

                case 'select':
                    var html = '';
                    for (var i = 0; i < edit.items.length; i++) {
                        html += '<option value="'+ edit.items[i].id +'"'+ (edit.items[i].id == val ? ' selected="selected"' : '') +'>'+ edit.items[i].text +'</option>';
                    }
                    el.addClass('w2ui-editable')
                        .html('<select id="grid_'+ obj.name +'_edit_'+ recid +'_'+ column +'" column="'+ column +'" class="w2ui-input"'+
                            '    style="width: 100%; pointer-events: auto; padding: 0 0 0 3px; margin: 0px; border-left: 0; border-right: 0; border-radius: 0px; '+
                            '           outline: none; font-family: inherit;'+ addStyle + edit.style +'" '+
                            '    field="'+ col.field +'" recid="'+ recid +'" '+
                            '    '+ edit.inTag +
                            '>'+ html +'</select>' + edit.outTag);
                    setTimeout(function () {
                        el.find('select')
                            .on('change', function (event) {
                                delete obj.last.move;
                            })
                            .on('blur', function (event) {
                                if ($(this).data('keep-open') == true) return;
                                obj.editChange.call(obj, this, index, column, event);
                            });
                    }, 10);
                    break;

                case 'div':
                    var $tmp = tr.find('[col='+ column +'] > div');
                    var font = 'font-family: '+ $tmp.css('font-family') + '; font-size: '+ $tmp.css('font-size') + ';';
                    el.addClass('w2ui-editable')
                        .html('<div id="grid_'+ obj.name +'_edit_'+ recid +'_'+ column +'" class="w2ui-input"'+
                            '    contenteditable style="'+ font + addStyle + edit.style +'" autocorrect="off" autocomplete="off" spellcheck="false" '+
                            '    field="'+ col.field +'" recid="'+ recid +'" column="'+ column +'" '+ edit.inTag +
                            '></div>' + edit.outTag);
                    if (value == null) el.find('div.w2ui-input').text(typeof val != 'object' ? val : '');
                    // add blur listener
                    var input = el.find('div.w2ui-input').get(0);
                    setTimeout(function () {
                        var tmp = input;
                        $(tmp).on('blur', function (event) {
                            if ($(this).data('keep-open') == true) return;
                            obj.editChange.call(obj, tmp, index, column, event);
                        });
                    }, 10);
                    if (value != null) $(input).text(typeof val != 'object' ? val : '');
                    break;

                default:
                    var $tmp = tr.find('[col='+ column +'] > div');
                    var font = 'font-family: '+ $tmp.css('font-family') + '; font-size: '+ $tmp.css('font-size');
                    el.addClass('w2ui-editable')
                        .html('<input id="grid_'+ obj.name +'_edit_'+ recid +'_'+ column +'" autocorrect="off" autocomplete="off" spellcheck="false" type="text" '+
                            '    style="'+ font +'; width: 100%; height: 100%; padding: 3px; border-color: transparent; outline: none; border-radius: 0; '+
                            '       pointer-events: auto; '+ addStyle + edit.style +'" '+
                            '    field="'+ col.field +'" recid="'+ recid +'" column="'+ column +'" class="w2ui-input"'+ edit.inTag +
                            '/>' + edit.outTag);
                    // issue #499
                    if (edit.type == 'number') {
                        val = w2utils.formatNumber(val);
                    }
                    if (edit.type == 'date') {
                        val = w2utils.formatDate(w2utils.isDate(val, edit.format, true), edit.format);
                    }
                    if (value == null) el.find('input').val(typeof val != 'object' ? val : '');
                    // init w2field
                    var input = el.find('input').get(0);
                    $(input).w2field(edit.type, $.extend(edit, { selected: val }));
                    // add blur listener
                    setTimeout(function () {
                        var tmp = input;
                        if (edit.type == 'list') {
                            tmp = $($(input).data('w2field').helpers.focus).find('input');
                            if (typeof val != 'object' && val != '') tmp.val(val).css({ opacity: 1 }).prev().css({ opacity: 1 });
                            el.find('input').on('change', function (event) {
                                obj.editChange.call(obj, input, index, column, event);
                            });
                        }
                        $(tmp).on('blur', function (event) {
                            if ($(this).data('keep-open') == true) return;
                            obj.editChange.call(obj, input, index, column, event);
                        });
                    }, 10);
                    if (value != null) $(input).val(typeof val != 'object' ? val : '');
            }

            setTimeout(function () {
                el.find('input, select, div.w2ui-input')
                    .data('old_value', old_value)
                    .on('mousedown', function (event) {
                        event.stopPropagation();
                    })
                    .on('click', function (event) {
                        if (edit.type == 'div') {
                            expand.call(el.find('div.w2ui-input')[0], null);
                        } else {
                            expand.call(el.find('input, select')[0], null);
                        }
                    })
                    .on('paste', function (event) {
                        // clean paste to be plain text
                        var e = event.originalEvent;
                        event.preventDefault();
                        var text = e.clipboardData.getData("text/plain");
                        document.execCommand("insertHTML", false, text);
                    })
                    .on('keydown', function (event) {
                        var el  = this;
                        var val = (el.tagName.toUpperCase() == 'DIV' ? $(el).text() : $(el).val());
                        switch (event.keyCode) {
                            case 8: // backspace;
                                if (edit.type == 'list' && !$(input).data('w2field')) { // cancel backspace when deleting element
                                    event.preventDefault();
                                }
                                break;
                            case 9:
                            case 13:
                                event.preventDefault();
                                break;
                            case 37:
                                if (w2utils.getCursorPosition(el) === 0) {
                                    event.preventDefault();
                                }
                                break;
                            case 39:
                                if (w2utils.getCursorPosition(el) == val.length) {
                                    w2utils.setCursorPosition(el, val.length);
                                    event.preventDefault();
                                }
                                break;
                        }
                        // need timeout so, this handler is executed last
                        setTimeout(function () {
                            switch (event.keyCode) {
                                case 9:  // tab
                                    var next_rec = recid;
                                    var next_col = event.shiftKey ? obj.prevCell(index, column, true) : obj.nextCell(index, column, true);
                                    // next or prev row
                                    if (next_col == null) {
                                        var tmp = event.shiftKey ? obj.prevRow(index, column) : obj.nextRow(index, column);
                                        if (tmp != null && tmp != index) {
                                            next_rec = obj.records[tmp].recid;
                                            // find first editable row
                                            for (var c = 0; c < obj.columns.length; c++) {
                                                var edit = obj.getCellEditable(index, c);
                                                if (edit != null && ['checkbox', 'check'].indexOf(edit.type) == -1) {
                                                    next_col = parseInt(c);
                                                    if (!event.shiftKey) break;
                                                }
                                            }
                                        }

                                    }
                                    if (next_rec === false) next_rec = recid;
                                    if (next_col == null) next_col = column;
                                    // init new or same record
                                    el.blur();
                                    setTimeout(function () {
                                        if (obj.selectType != 'row') {
                                            obj.selectNone();
                                            obj.select({ recid: next_rec, column: next_col });
                                        } else {
                                            obj.editField(next_rec, next_col, null, event);
                                        }
                                    }, 1);
                                    if (event.preventDefault) event.preventDefault();
                                    break;

                                case 13: // enter
                                    el.blur();
                                    var next = event.shiftKey ? obj.prevRow(index, column) : obj.nextRow(index, column);
                                    if (next != null && next != index) {
                                        setTimeout(function () {
                                            if (obj.selectType != 'row') {
                                                obj.selectNone();
                                                obj.select({ recid: obj.records[next].recid, column: column });
                                            } else {
                                                obj.editField(obj.records[next].recid, column, null, event);
                                            }
                                        }, 1);
                                    }
                                    if (el.tagName.toUpperCase() == 'DIV') {
                                        event.preventDefault();
                                    }
                                    break;

                                case 27: // escape
                                    var old = obj.parseField(rec, col.field);
                                    if (rec.w2ui && rec.w2ui.changes && rec.w2ui.changes[col.field] != null) old = rec.w2ui.changes[col.field];
                                    if ($(el).data('old_value') != null) old = $(el).data('old_value');
                                    if (el.tagName.toUpperCase() == 'DIV') {
                                        $(el).text(old != null ? old : '');
                                    } else {
                                        el.value = old != null ? old : '';
                                    }
                                    el.blur();
                                    setTimeout(function () { obj.select({ recid: recid, column: column }); }, 1);
                                    break;
                            }
                            // if input too small - expand
                            expand.call(el, event);
                        }, 1);
                    })
                    .on('keyup', function (event) {
                        expand.call(this, event);
                    });
                // focus and select
                setTimeout(function () {
                    var tmp = el.find('.w2ui-input');
                    var len = $(tmp).val().length;
                    if (edit.type == 'div') len = $(tmp).text().length;
                    if (tmp.length > 0) {
                        tmp.focus();
                        clearTimeout(obj.last.kbd_timer); // keep focus
                        if (tmp[0].tagName != 'SELECT') w2utils.setCursorPosition(tmp[0], len);
                        tmp[0].resize = expand;
                        expand.call(tmp[0], null);
                    }
                }, 50);
                // event after
                obj.trigger($.extend(edata, { phase: 'after', input: el.find('input, select, div.w2ui-input') }));
            }, 5); // needs to be 5-10
            return;

            function expand(event) {
                try {
                    var val   = (this.tagName.toUpperCase() == 'DIV' ? $(this).text() : this.value);
                    var $sel  = $('#grid_'+ obj.name + '_editable');
                    var style = 'font-family: '+ $(this).css('font-family') + '; font-size: '+ $(this).css('font-size') + '; white-space: pre;';
                    var width = w2utils.getStrWidth(val, style);
                    if (width + 20 > $sel.width()) {
                        $sel.width(width + 20);
                    }
                } catch (e) {
                }
            }
        },

        editChange: function (el, index, column, event) {
            var obj = this;
            // keep focus
            setTimeout(function () {
                var $input = $(obj.box).find('#grid_'+ obj.name + '_focus');
                if (!$input.is(':focus')) $input.focus();
            }, 10);
            // all other fields
            var summary = index < 0;
            index = index < 0 ? -index - 1 : index;
            var records = summary ? this.summary : this.records;
            var rec     = records[index];
            var col     = this.columns[column];
            var tr      = $('#grid_'+ this.name + (col.frozen === true ? '_frec_' : '_rec_') + w2utils.escapeId(rec.recid));
            var new_val = (el.tagName && el.tagName.toUpperCase() == 'DIV' ? $(el).text() : el.value);
            var old_val = this.parseField(rec, col.field);
            var tmp = $(el).data('w2field');
            if (tmp) {
                if (tmp.type == 'list') new_val = $(el).data('selected');
                if ($.isEmptyObject(new_val) || new_val == null) new_val = '';
                if (!$.isPlainObject(new_val)) new_val = tmp.clean(new_val);
            }
            if (el.type == 'checkbox') {
                if (rec.w2ui && rec.w2ui.editable === false) el.checked = !el.checked;
                new_val = el.checked;
            }
            // change/restore event
            var edata = {
                phase: 'before', type: 'change', target: this.name, input_id: el.id, recid: rec.recid, index: index, column: column,
                originalEvent: (event.originalEvent ? event.originalEvent : event),
                value_new: new_val,
                value_previous: (rec.w2ui && rec.w2ui.changes && rec.w2ui.changes.hasOwnProperty(col.field) ? rec.w2ui.changes[col.field]: old_val),
                value_original: old_val
            };
            if ($(event.target).data('old_value') != null) edata.value_previous = $(event.target).data('old_value');
            // if (old_val == null) old_val = ''; -- do not uncomment, error otherwise
            while (true) {
                new_val = edata.value_new;
                if ((typeof new_val != 'object' && String(old_val) != String(new_val)) ||
                    (typeof new_val == 'object' && new_val.id != old_val && (typeof old_val != 'object' || old_val == null || new_val.id != old_val.id))) {
                    // change event
                    edata = this.trigger($.extend(edata, { type: 'change', phase: 'before' }));
                    if (edata.isCancelled !== true) {
                        if (new_val !== edata.value_new) {
                            // re-evaluate the type of change to be made
                            continue;
                        }
                        // default action
                        rec.w2ui = rec.w2ui || {};
                        rec.w2ui.changes = rec.w2ui.changes || {};
                        rec.w2ui.changes[col.field] = edata.value_new;
                        // event after
                        this.trigger($.extend(edata, { phase: 'after' }));
                    }
                } else {
                    // restore event
                    edata = this.trigger($.extend(edata, { type: 'restore', phase: 'before' }));
                    if (edata.isCancelled !== true) {
                        if (new_val !== edata.value_new) {
                            // re-evaluate the type of change to be made
                            continue;
                        }
                        // default action
                        if (rec.w2ui && rec.w2ui.changes) delete rec.w2ui.changes[col.field];
                        if (rec.w2ui && $.isEmptyObject(rec.w2ui.changes)) delete rec.w2ui.changes;
                        // event after
                        this.trigger($.extend(edata, { phase: 'after' }));
                    }
                }
                break;
            }
            // refresh cell
            var cell = $(tr).find('[col='+ column +']');
            if (!summary) {
                if (rec.w2ui && rec.w2ui.changes && rec.w2ui.changes[col.field] != null) {
                    cell.addClass('w2ui-changed');
                } else {
                    cell.removeClass('w2ui-changed');
                }
                // update cell data
                cell.replaceWith(this.getCellHTML(index, column, summary));
            }
            // remove
            $(this.box).find('div.w2ui-edit-box').remove();
            // enable/disable toolbar search button
            if (this.show.toolbarSave) {
                if (this.getChanges().length > 0) this.toolbar.enable('w2ui-save'); else this.toolbar.disable('w2ui-save');
            }
        },

        "delete": function (force) {
            var time = (new Date()).getTime();
            var obj = this;
            // event before
            var edata = this.trigger({ phase: 'before', target: this.name, type: 'delete', force: force });
            if (edata.isCancelled === true) return;
            force = edata.force;
            // hide all tooltips
            setTimeout(function () { $().w2tag(); }, 20);
            // default action
            var recs = this.getSelection();
            if (recs.length === 0) return;
            if (this.msgDelete != '' && !force) {
                this.message({
                    width   : 350,
                    height  : 170,
                    body    : '<div class="w2ui-centered">' + w2utils.lang(obj.msgDelete) + '</div>',
                    buttons : '<button class="w2ui-btn w2ui-btn-red" onclick="w2ui[\''+ this.name +'\'].delete(true)">' + w2utils.lang('Yes') + '</button>'+
                              '<button class="w2ui-btn" onclick="w2ui[\''+ this.name +'\'].message()">' + w2utils.lang('No') + '</button>',
                    onOpen: function (event) {
                        var inputs = $(this.box).find('input, textarea, select, button');
                        inputs.off('.message')
                            .on('blur.message', function (evt) {
                                // last input
                                if (inputs.index(evt.target) + 1 === inputs.length) {
                                    inputs.get(0).focus();
                                    evt.preventDefault();
                                }
                            })
                            .on('keydown.message', function (evt) {
                                if (evt.keyCode == 27) obj.message(); // esc
                            });
                        setTimeout(function () {
                            $(this.box).find('.w2ui-btn:last-child').focus();
                            clearTimeout(obj.last.kbd_timer);
                        }, 25);
                    }
                });
                return;
            }
            this.message(); // hides confirmation message
            // call delete script
            var url = (typeof this.url != 'object' ? this.url : this.url.remove);
            if (url) {
                this.request('delete');
            } else {
                if (typeof recs[0] != 'object') {
                    this.selectNone();
                    this.remove.apply(this, recs);
                } else {
                    // clear cells
                    for (var r = 0; r < recs.length; r++) {
                        var fld = this.columns[recs[r].column].field;
                        var ind = this.get(recs[r].recid, true);
                        var rec = this.records[ind];
                        if (ind != null && fld != 'recid') {
                            this.records[ind][fld] = '';
                            if (rec.w2ui && rec.w2ui.changes) delete rec.w2ui.changes[fld];
                            // -- style should not be deleted
                            // if (rec.style != null && $.isPlainObject(rec.style) && rec.style[recs[r].column]) {
                            //     delete rec.style[recs[r].column];
                            // }
                        }
                    }
                    this.update();
                }
            }
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        click: function (recid, event) {
            var time   = (new Date()).getTime();
            var column = null;
            var obj    = this;
            if (this.last.cancelClick == true || (event && event.altKey)) return;
            if (typeof recid == 'object') {
                column = recid.column;
                recid  = recid.recid;
            }
            if (event == null) event = {};
            // check for double click
            if (time - parseInt(this.last.click_time) < 350 && this.last.click_recid == recid && event.type == 'click') {
                this.dblClick(recid, event);
                return;
            }
            // hide bubble
            if (this.last.bubbleEl) {
                $(this.last.bubbleEl).w2tag();
                this.last.bubbleEl = null;
            }
            this.last.click_time  = time;
            var last_recid = this.last.click_recid;
            this.last.click_recid = recid;
            // column user clicked on
            if (column == null && event.target) {
                var tmp = event.target;
                if (tmp.tagName.toUpperCase() != 'TD') tmp = $(tmp).parents('td')[0];
                if ($(tmp).attr('col') != null) column = parseInt($(tmp).attr('col'));
            }
            // event before
            var edata = this.trigger({ phase: 'before', target: this.name, type: 'click', recid: recid, column: column, originalEvent: event });
            if (edata.isCancelled === true) return;
            // default action
            var obj = this;
            var sel = this.getSelection();
            $('#grid_'+ this.name +'_check_all').prop("checked", false);
            var ind    = this.get(recid, true);
            var record = this.records[ind];
            var selectColumns  = [];
            obj.last.sel_ind   = ind;
            obj.last.sel_col   = column;
            obj.last.sel_recid = recid;
            obj.last.sel_type  = 'click';
            // multi select with shif key
            if (event.shiftKey && sel.length > 0 && obj.multiSelect) {
                if (sel[0].recid) {
                    var start = this.get(sel[0].recid, true);
                    var end   = this.get(recid, true);
                    if (column > sel[0].column) {
                        var t1 = sel[0].column;
                        var t2 = column;
                    } else {
                        var t1 = column;
                        var t2 = sel[0].column;
                    }
                    for (var c = t1; c <= t2; c++) selectColumns.push(c);
                } else {
                    var start = this.get(last_recid, true);
                    var end   = this.get(recid, true);
                }
                var sel_add = [];
                if (start > end) { var tmp = start; start = end; end = tmp; }
                var url = (typeof this.url != 'object' ? this.url : this.url.get);
                for (var i = start; i <= end; i++) {
                    if (this.searchData.length > 0 && !url && $.inArray(i, this.last.searchIds) == -1) continue;
                    if (this.selectType == 'row') {
                        sel_add.push(this.records[i].recid);
                    } else {
                        for (var sc = 0; sc < selectColumns.length; sc++) {
                            sel_add.push({ recid: this.records[i].recid, column: selectColumns[sc] });
                        }
                    }
                    //sel.push(this.records[i].recid);
                }
                this.select.apply(this, sel_add);
            } else {
                var last = this.last.selection;
                var flag = (last.indexes.indexOf(ind) != -1 ? true : false);
                var fselect = false;
                // if clicked on the checkbox
                if ($(event.target).parents('td').hasClass('w2ui-col-select')) fselect = true;
                // clear other if necessary
                if (((!event.ctrlKey && !event.shiftKey && !event.metaKey && !fselect) || !this.multiSelect) && !this.showSelectColumn) {
                    if (this.selectType != 'row' && $.inArray(column, last.columns[ind]) == -1) flag = false;
                    if (sel.length > 300) this.selectNone(); else this.unselect.apply(this, sel);
                    if (flag === true && sel.length == 1) {
                        this.unselect({ recid: recid, column: column });
                    } else {
                        this.select({ recid: recid, column: column });
                    }
                } else {
                    if (this.selectType != 'row' && $.inArray(column, last.columns[ind]) == -1) flag = false;
                    if (flag === true) {
                        this.unselect({ recid: recid, column: column });
                    } else {
                        this.select({ recid: recid, column: column });
                    }
                }
            }
            this.status();
            obj.initResize();
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        columnClick: function (field, event) {
            // event before
            var edata = this.trigger({ phase: 'before', type: 'columnClick', target: this.name, field: field, originalEvent: event });
            if (edata.isCancelled === true) return;
            // default behaviour
            if (this.selectType == 'row') {
                var column = this.getColumn(field);
                if (column && column.sortable) this.sort(field, null, (event && (event.ctrlKey || event.metaKey) ? true : false) );
                if (edata.field == 'line-number') {
                    if (this.getSelection().length >= this.records.length) {
                        this.selectNone();
                    } else {
                        this.selectAll();
                    }
                }
            } else {
                // select entire column
                if (edata.field == 'line-number') {
                    if (this.getSelection().length >= this.records.length) {
                        this.selectNone();
                    } else {
                        this.selectAll();
                    }
                } else {
                    if (!event.shiftKey && !event.metaKey && !event.ctrlKey) {
                        this.selectNone();
                    }
                    var tmp     = this.getSelection();
                    var column  = this.getColumn(edata.field, true);
                    var sel     = [];
                    var cols    = [];
                    // check if there was a selection before
                    if (tmp.length != 0 && event.shiftKey) {
                        var start = column;
                        var end = tmp[0].column;
                        if (start > end) {
                            start = tmp[0].column;
                            end = column;
                        }
                        for (var i=start; i<=end; i++) cols.push(i);
                    } else {
                        cols.push(column);
                    }
                    var edata = this.trigger({ phase: 'before', type: 'columnSelect', target: this.name, columns: cols });
                    if (edata.isCancelled !== true) {
                        for (var i = 0; i < this.records.length; i++) {
                            sel.push({ recid: this.records[i].recid, column: cols });
                        }
                        this.select.apply(this, sel);
                    }
                    this.trigger($.extend(edata, { phase: 'after' }));
                }
            }
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        columnDblClick: function (field, event) {
            // event before
            var edata = this.trigger({ phase: 'before', type: 'columnDblClick', target: this.name, field: field, originalEvent: event });
            if (edata.isCancelled === true) return;
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        focus: function (event) {
            var obj = this;
            // event before
            var edata = this.trigger({ phase: 'before', type: 'focus', target: this.name, originalEvent: event });
            if (edata.isCancelled === true) return false;
            // default behaviour
            this.hasFocus = true;
            $(this.box).find('.w2ui-inactive').removeClass('w2ui-inactive');
            setTimeout(function () {
                var $input = $(obj.box).find('#grid_'+ obj.name + '_focus');
                if (!$input.is(':focus')) $input.focus();
            }, 10);
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        blur: function (event) {
            // event before
            var edata = this.trigger({ phase: 'before', type: 'blur', target: this.name, originalEvent: event });
            if (edata.isCancelled === true) return false;
            // default behaviour
            this.hasFocus = false;
            $(this.box).find('.w2ui-selected').addClass('w2ui-inactive');
            $(this.box).find('.w2ui-selection').addClass('w2ui-inactive');
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        keydown: function (event) {
            // this method is called from w2utils
            var obj = this;
            var url = (typeof this.url != 'object' ? this.url : this.url.get);
            if (obj.keyboard !== true) return;
            // trigger event
            var edata = obj.trigger({ phase: 'before', type: 'keydown', target: obj.name, originalEvent: event });
            if (edata.isCancelled === true) return;
            // default behavior
            if ($(this.box).find('>.w2ui-message').length > 0) {
                // if there are messages
                if (event.keyCode == 27) this.message();
                return
            }
            var empty   = false;
            var records = $('#grid_'+ obj.name +'_records');
            var sel     = obj.getSelection();
            if (sel.length === 0) empty = true;
            var recid   = sel[0] || null;
            var columns = [];
            var recid2  = sel[sel.length-1];
            if (typeof recid == 'object' && recid != null) {
                recid   = sel[0].recid;
                columns = [];
                var ii  = 0;
                while (true) {
                    if (!sel[ii] || sel[ii].recid != recid) break;
                    columns.push(sel[ii].column);
                    ii++;
                }
                recid2 = sel[sel.length-1].recid;
            }
            var ind      = obj.get(recid, true);
            var ind2     = obj.get(recid2, true);
            var rec      = obj.get(recid);
            var recEL    = $('#grid_'+ obj.name +'_rec_'+ (ind != null ? w2utils.escapeId(obj.records[ind].recid) : 'none'));
            var cancel   = false;
            var key      = event.keyCode;
            var shiftKey = event.shiftKey;

            switch (key) {
                case 8:  // backspace
                case 46: // delete
                    if (this.show.toolbarDelete || this.onDelete) obj["delete"]();
                    cancel = true;
                    event.stopPropagation();
                    break;

                case 27: // escape
                    obj.selectNone();
                    cancel = true;
                    break;

                case 65: // cmd + A
                    if (!event.metaKey && !event.ctrlKey) break;
                    obj.selectAll();
                    cancel = true;
                    break;

                case 13: // enter
                    // if expandable columns - expand it
                    if (this.selectType == 'row' && obj.show.expandColumn === true) {
                        if (recEL.length <= 0) break;
                        obj.toggle(recid, event);
                        cancel = true;
                    } else { // or enter edit
                        for (var c = 0; c < this.columns.length; c++) {
                            var edit = this.getCellEditable(ind, c);
                            if (edit) {
                                columns.push(parseInt(c));
                                break;
                            }
                        }
                        // edit last column that was edited
                        if (this.selectType == 'row' && this.last.edit_col) columns = [this.last.edit_col];
                        if (columns.length > 0) {
                            obj.editField(recid, columns[0], null, event);
                            cancel = true;
                        }
                    }
                    break;

                case 37: // left
                    if (empty) { // no selection
                        selectTopRecord();
                        break;
                    }
                    if (this.selectType == 'row') {
                        if (recEL.length <= 0) break;
                        var tmp = this.records[ind].w2ui || {};
                        if (tmp && tmp.parent_recid != null && (!Array.isArray(tmp.children) || tmp.children.length === 0 || !tmp.expanded)) {
                            obj.unselect(recid);
                            obj.collapse(tmp.parent_recid, event);
                            obj.select(tmp.parent_recid);
                        } else {
                            obj.collapse(recid, event);
                        }
                    } else {
                        var prev = obj.prevCell(ind, columns[0]);
                        if (!shiftKey && prev == null) {
                            this.selectNone();
                            prev = 0;
                        }
                        if (prev != null) {
                            if (shiftKey && obj.multiSelect) {
                                if (tmpUnselect()) return;
                                var tmp    = [];
                                var newSel = [];
                                var unSel  = [];
                                if (columns.indexOf(this.last.sel_col) === 0 && columns.length > 1) {
                                    for (var i = 0; i < sel.length; i++) {
                                        if (tmp.indexOf(sel[i].recid) == -1) tmp.push(sel[i].recid);
                                        unSel.push({ recid: sel[i].recid, column: columns[columns.length-1] });
                                    }
                                    obj.unselect.apply(obj, unSel);
                                    obj.scrollIntoView(ind, columns[columns.length-1], true);
                                } else {
                                    for (var i = 0; i < sel.length; i++) {
                                        if (tmp.indexOf(sel[i].recid) == -1) tmp.push(sel[i].recid);
                                        newSel.push({ recid: sel[i].recid, column: prev });
                                    }
                                    obj.select.apply(obj, newSel);
                                    obj.scrollIntoView(ind, prev, true);
                                }
                            } else {
                                event.metaKey = false;
                                obj.click({ recid: recid, column: prev }, event);
                                obj.scrollIntoView(ind, prev, true);
                            }
                        } else {
                            // if selected more then one, then select first
                            if (!shiftKey) {
                                if (sel.length > 1) {
                                    obj.selectNone();
                                } else {
                                    for (var s = 1; s < sel.length; s++) obj.unselect(sel[s]);
                                }
                            }
                        }
                    }
                    cancel = true;
                    break;

                case 39: // right
                    if (empty) {
                        selectTopRecord();
                        break;
                    }
                    if (this.selectType == 'row') {
                        if (recEL.length <= 0) break;
                        obj.expand(recid, event);
                    } else {
                        var next = obj.nextCell(ind, columns[columns.length-1]); // columns is an array of selected columns
                        if (!shiftKey && next == null) {
                            this.selectNone();
                            next = this.columns.length-1;
                        }
                        if (next != null) {
                            if (shiftKey && key == 39 && obj.multiSelect) {
                                if (tmpUnselect()) return;
                                var tmp    = [];
                                var newSel = [];
                                var unSel  = [];
                                if (columns.indexOf(this.last.sel_col) == columns.length-1 && columns.length > 1) {
                                    for (var i = 0; i < sel.length; i++) {
                                        if (tmp.indexOf(sel[i].recid) == -1) tmp.push(sel[i].recid);
                                        unSel.push({ recid: sel[i].recid, column: columns[0] });
                                    }
                                    obj.unselect.apply(obj, unSel);
                                    obj.scrollIntoView(ind, columns[0], true);
                                } else {
                                    for (var i = 0; i < sel.length; i++) {
                                        if (tmp.indexOf(sel[i].recid) == -1) tmp.push(sel[i].recid);
                                        newSel.push({ recid: sel[i].recid, column: next });
                                    }
                                    obj.select.apply(obj, newSel);
                                    obj.scrollIntoView(ind, next, true);
                                }
                            } else {
                                event.metaKey = false;
                                obj.click({ recid: recid, column: next }, event);
                                obj.scrollIntoView(ind, next, true);
                            }
                        } else {
                            // if selected more then one, then select first
                            if (!shiftKey) {
                                if (sel.length > 1) {
                                    obj.selectNone();
                                } else {
                                    for (var s = 0; s < sel.length-1; s++) obj.unselect(sel[s]);
                                }
                            }
                        }
                    }
                    cancel = true;
                    break;

                case 38: // up
                    if (empty) selectTopRecord();
                    if (recEL.length <= 0) break;
                    // move to the previous record
                    var prev = obj.prevRow(ind, columns[0]);
                    if (!shiftKey && prev == null) {
                        if (this.searchData.length != 0 && !url) {
                            prev = this.last.searchIds[0];
                        } else {
                            prev = 0;
                        }
                    }
                    if (prev != null) {
                        if (shiftKey && obj.multiSelect) { // expand selection
                            if (tmpUnselect()) return;
                            if (obj.selectType == 'row') {
                                if (obj.last.sel_ind > prev && obj.last.sel_ind != ind2) {
                                    obj.unselect(obj.records[ind2].recid);
                                } else {
                                    obj.select(obj.records[prev].recid);
                                }
                            } else {
                                if (obj.last.sel_ind > prev && obj.last.sel_ind != ind2) {
                                    prev = ind2;
                                    var tmp = [];
                                    for (var c = 0; c < columns.length; c++) tmp.push({ recid: obj.records[prev].recid, column: columns[c] });
                                    obj.unselect.apply(obj, tmp);
                                } else {
                                    var tmp = [];
                                    for (var c = 0; c < columns.length; c++) tmp.push({ recid: obj.records[prev].recid, column: columns[c] });
                                    obj.select.apply(obj, tmp);
                                }
                            }
                        } else { // move selected record
                            if (sel.length > 300) this.selectNone(); else this.unselect.apply(this, sel);
                            obj.click({ recid: obj.records[prev].recid, column: columns[0] }, event);
                        }
                        obj.scrollIntoView(prev);
                        if (event.preventDefault) event.preventDefault();
                    } else {
                        // if selected more then one, then select first
                        if (!shiftKey) {
                            if (sel.length > 1) {
                                obj.selectNone();
                            } else {
                                for (var s = 1; s < sel.length; s++) obj.unselect(sel[s]);
                            }
                        }
                    }
                    break;

                case 40: // down
                    if (empty) selectTopRecord();
                    if (recEL.length <= 0) break;
                    // move to the next record
                    var next = obj.nextRow(ind2, columns[0]);
                    if (!shiftKey && next == null) {
                        if (this.searchData.length != 0 && !url) {
                            next = this.last.searchIds[this.last.searchIds.length - 1];
                        } else {
                            next = this.records.length - 1;
                        }
                    }
                    if (next != null) {
                        if (shiftKey && obj.multiSelect) { // expand selection
                            if (tmpUnselect()) return;
                            if (obj.selectType == 'row') {
                                if (this.last.sel_ind < next && this.last.sel_ind != ind) {
                                    obj.unselect(obj.records[ind].recid);
                                } else {
                                    obj.select(obj.records[next].recid);
                                }
                            } else {
                                if (this.last.sel_ind < next && this.last.sel_ind != ind) {
                                    next = ind;
                                    var tmp = [];
                                    for (var c = 0; c < columns.length; c++) tmp.push({ recid: obj.records[next].recid, column: columns[c] });
                                    obj.unselect.apply(obj, tmp);
                                } else {
                                    var tmp = [];
                                    for (var c = 0; c < columns.length; c++) tmp.push({ recid: obj.records[next].recid, column: columns[c] });
                                    obj.select.apply(obj, tmp);
                                }
                            }
                        } else { // move selected record
                            if (sel.length > 300) this.selectNone(); else this.unselect.apply(this, sel);
                            obj.click({ recid: obj.records[next].recid, column: columns[0] }, event);
                        }
                        obj.scrollIntoView(next);
                        cancel = true;
                    } else {
                        // if selected more then one, then select first
                        if (!shiftKey) {
                            if (sel.length > 1) {
                                obj.selectNone();
                            } else {
                                for (var s = 0; s < sel.length-1; s++) obj.unselect(sel[s]);
                            }
                        }
                    }
                    break;

                // copy & paste

                case 17: // ctrl key
                case 91: // cmd key
                    // SLOW: 10k records take 7.0
                    if (empty) break;
                    // in Safari need to copy to buffer on cmd or ctrl key (otherwise does not work)
                    if (obj.last.isSafari) {
                        obj.last.copy_event = obj.copy(false, event);
                        $('#grid_'+ obj.name + '_focus').val(obj.last.copy_event.text).select();
                    }
                    break;

                case 67: // - c
                    // this fill trigger event.onComplete
                    if (event.metaKey || event.ctrlKey) {
                        if (obj.last.isSafari) {
                            obj.copy(obj.last.copy_event, event);
                        } else {
                            obj.last.copy_event = obj.copy(false, event);
                            $('#grid_'+ obj.name + '_focus').val(obj.last.copy_event.text).select();
                            obj.copy(obj.last.copy_event, event);
                        }
                    }
                    break;

                case 88: // x - cut
                    if (empty) break;
                    if (event.ctrlKey || event.metaKey) {
                        if (obj.last.isSafari) {
                            obj.copy(obj.last.copy_event, event);
                        } else {
                            obj.last.copy_event = obj.copy(false, event);
                            $('#grid_'+ obj.name + '_focus').val(obj.last.copy_event.text).select();
                            obj.copy(obj.last.copy_event, event);
                        }
                        // clear
                        setTimeout(function () { obj["delete"](true); }, 100);
                    }
                    break;
            }
            var tmp = [32, 187, 189, 192, 219, 220, 221, 186, 222, 188, 190, 191]; // other typable chars
            for (var i=48; i<=111; i++) tmp.push(i); // 0-9,a-z,A-Z,numpad
            if (tmp.indexOf(key) != -1 && !event.ctrlKey && !event.metaKey && !cancel) {
                if (columns.length === 0) columns.push(0);
                cancel = false;
                // move typed key into edit
                setTimeout(function () {
                    var focus = $('#grid_'+ obj.name + '_focus');
                    var key   = focus.val();
                    focus.val('');
                    obj.editField(recid, columns[0], key, event);
                }, 1);
            }
            if (cancel) { // cancel default behaviour
                if (event.preventDefault) event.preventDefault();
            }
            // event after
            obj.trigger($.extend(edata, { phase: 'after' }));

            function selectTopRecord() {
                var ind = Math.floor(records[0].scrollTop / obj.recordHeight) + 1;
                if (!obj.records[ind] || ind < 2) ind = 0;
                obj.select({ recid: obj.records[ind].recid, column: 0});
            }

            function tmpUnselect () {
                if (obj.last.sel_type != 'click') return false;
                if (obj.selectType != 'row') {
                    obj.last.sel_type = 'key';
                    if (sel.length > 1) {
                        for (var s = 0; s < sel.length; s++) {
                            if (sel[s].recid == obj.last.sel_recid && sel[s].column == obj.last.sel_col) {
                                sel.splice(s, 1);
                                break;
                            }
                        }
                        obj.unselect.apply(obj, sel);
                        return true;
                    }
                    return false;
                } else {
                    obj.last.sel_type = 'key';
                    if (sel.length > 1) {
                        sel.splice(sel.indexOf(obj.records[obj.last.sel_ind].recid), 1);
                        obj.unselect.apply(obj, sel);
                        return true;
                    }
                    return false;
                }
            }
        },

        scrollIntoView: function (ind, column, instant) {
            var buffered = this.records.length;
            if (this.searchData.length != 0 && !this.url) buffered = this.last.searchIds.length;
            if (buffered === 0) return;
            if (ind == null) {
                var sel = this.getSelection();
                if (sel.length === 0) return;
                if ($.isPlainObject(sel[0])) {
                    ind     = sel[0].index;
                    column  = sel[0].column;
                } else {
                    ind = this.get(sel[0], true);
                }
            }
            var records = $('#grid_'+ this.name +'_records');
            // if all records in view
            var len = this.last.searchIds.length;
            if (len > 0) ind = this.last.searchIds.indexOf(ind); // if search is applied

            // vertical
            if (records.height() < this.recordHeight * (len > 0 ? len : buffered) && records.length > 0) {
                // scroll to correct one
                var t1 = Math.floor(records[0].scrollTop / this.recordHeight);
                var t2 = t1 + Math.floor(records.height() / this.recordHeight);
                if (ind == t1) {
                    if (instant === true) {
                        records.prop({ 'scrollTop': records.scrollTop() - records.height() / 1.3 });
                    } else {
                        records.stop();
                        records.animate({ 'scrollTop': records.scrollTop() - records.height() / 1.3 }, 250, 'linear');
                    }
                }
                if (ind == t2) {
                    if (instant === true) {
                        records.prop({ 'scrollTop': records.scrollTop() + records.height() / 1.3 });
                    } else {
                        records.stop();
                        records.animate({ 'scrollTop': records.scrollTop() + records.height() / 1.3 }, 250, 'linear');
                    }
                }
                if (ind < t1 || ind > t2) {
                    if (instant === true) {
                        records.prop({ 'scrollTop': (ind - 1) * this.recordHeight });
                    } else {
                        records.stop();
                        records.animate({ 'scrollTop': (ind - 1) * this.recordHeight }, 250, 'linear');
                    }
                }
            }

            // horizontal
            if (column != null) {
                var x1 = 0;
                var x2 = 0;
                var sb = w2utils.scrollBarSize();
                for (var i = 0; i <= column; i++) {
                    var col = this.columns[i];
                    if (col.frozen || col.hidden) continue;
                    x1 = x2;
                    x2 += parseInt(col.sizeCalculated);
                }
                if (records.width() < x2 - records.scrollLeft()) { // right
                    if (instant === true) {
                        records.prop({ 'scrollLeft': x1 - sb });
                    } else {
                        records.animate({ 'scrollLeft': x1 - sb }, 250, 'linear');
                    }
                } else if (x1 < records.scrollLeft()) { // left
                    if (instant === true) {
                        records.prop({ 'scrollLeft': x2 - records.width() + sb * 2 });
                    } else {
                        records.animate({ 'scrollLeft': x2 - records.width() + sb * 2 }, 250, 'linear');
                    }
                }
            }
        },

        dblClick: function (recid, event) {
            // find columns
            var column = null;
            if (typeof recid == 'object') {
                column = recid.column;
                recid  = recid.recid;
            }
            if (event == null) event = {};
            // column user clicked on
            if (column == null && event.target) {
                var tmp = event.target;
                if (tmp.tagName.toUpperCase() != 'TD') tmp = $(tmp).parents('td')[0];
                column = parseInt($(tmp).attr('col'));
            }
            var index = this.get(recid, true);
            var rec = this.records[index];
            // event before
            var edata = this.trigger({ phase: 'before', target: this.name, type: 'dblClick', recid: recid, column: column, originalEvent: event });
            if (edata.isCancelled === true) return;
            // default action
            this.selectNone();
            var edit = this.getCellEditable(index, column);
            if (edit) {
                this.editField(recid, column, null, event);
            } else {
                this.select({ recid: recid, column: column });
                if (this.show.expandColumn || (rec.w2ui && Array.isArray(rec.w2ui.children))) this.toggle(recid);
            }
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        contextMenu: function (recid, column, event) {
            var obj = this;
            if (obj.last.userSelect == 'text') return;
            if (event == null) event = { offsetX: 0, offsetY: 0, target: $('#grid_'+ obj.name +'_rec_'+ recid)[0] };
            if (event.offsetX == null) {
                event.offsetX = event.layerX - event.target.offsetLeft;
                event.offsetY = event.layerY - event.target.offsetTop;
            }
            if (w2utils.isFloat(recid)) recid = parseFloat(recid);
            var sel = this.getSelection();
            if (this.selectType == 'row') {
                if (sel.indexOf(recid) == -1) obj.click(recid);
            } else {
                var $tmp = $(event.target);
                if ($tmp[0].tagName.toUpperCase() != 'TD') $tmp = $(event.target).parents('td');
                var selected = false;
                column = $tmp.attr('col');
                // check if any selected sel in the right row/column
                for (var i=0; i<sel.length; i++) {
                    if (sel[i].recid == recid || sel[i].column == column) selected = true;
                }
                if (!selected && recid != null) obj.click({ recid: recid, column: column });
                if (!selected && column != null) obj.columnClick(this.columns[column].field, event);
            }
            // event before
            var edata = obj.trigger({ phase: 'before', type: 'contextMenu', target: obj.name, originalEvent: event, recid: recid, column: column });
            if (edata.isCancelled === true) return;
            // default action
            if (obj.menu.length > 0) {
                $(obj.box).find(event.target)
                    .w2menu(obj.menu, {
                        originalEvent: event,
                        contextMenu: true,
                        onSelect: function (event) {
                            obj.menuClick(recid, parseInt(event.index), event.originalEvent);
                        }
                    }
                );
            }
            // cancel event
            if (event.preventDefault) event.preventDefault();
            // event after
            obj.trigger($.extend(edata, { phase: 'after' }));
        },

        menuClick: function (recid, index, event) {
            var obj = this;
            // event before
            var edata = obj.trigger({ phase: 'before', type: 'menuClick', target: obj.name, originalEvent: event,
                recid: recid, menuIndex: index, menuItem: obj.menu[index] });
            if (edata.isCancelled === true) return;
            // default action
            // -- empty
            // event after
            obj.trigger($.extend(edata, { phase: 'after' }));
        },

        toggle: function (recid) {
            var rec = this.get(recid);
            rec.w2ui = rec.w2ui || {};
            if (rec.w2ui.expanded === true) return this.collapse(recid); else return this.expand(recid);
        },

        expand: function (recid) {
            var obj  = this;
            var ind  = this.get(recid, true);
            var rec  = this.records[ind];
            rec.w2ui = rec.w2ui || {};
            var id   = w2utils.escapeId(recid);
            var children = rec.w2ui.children;
            if (Array.isArray(children)) {
                if (rec.w2ui.expanded === true || children.length === 0) return false; // already shown
                var edata = this.trigger({ phase: 'before', type: 'expand', target: this.name, recid: recid });
                if (edata.isCancelled === true) return false;
                rec.w2ui.expanded = true;
                children.forEach(function (child) {
                    child.w2ui = child.w2ui || {};
                    child.w2ui.parent_recid = rec.recid;
                    if (child.w2ui.children == null) child.w2ui.children = [];
                });
                this.records.splice.apply(this.records, [ind + 1, 0].concat(children));
                this.total += children.length;
                var url = (typeof this.url != 'object' ? this.url : this.url.get);
                if (!url) {
                    this.localSort(true, true);
                    if (this.searchData.length > 0) {
                        this.localSearch(true);
                    }
                }
                this.refresh();
                this.trigger($.extend(edata, { phase: 'after' }));
            } else {
                if ($('#grid_'+ this.name +'_rec_'+ id +'_expanded_row').length > 0 || this.show.expandColumn !== true) return false;
                if (rec.w2ui.expanded == 'none') return false;
                // insert expand row
                $('#grid_'+ this.name +'_rec_'+ id).after(
                        '<tr id="grid_'+ this.name +'_rec_'+ recid +'_expanded_row" class="w2ui-expanded-row">'+
                        '    <td colspan="100" class="w2ui-expanded2">'+
                        '        <div id="grid_'+ this.name +'_rec_'+ recid +'_expanded"></div>'+
                        '    </td>'+
                        '    <td class="w2ui-grid-data-last"></td>'+
                        '</tr>');

                $('#grid_'+ this.name +'_frec_'+ id).after(
                        '<tr id="grid_'+ this.name +'_frec_'+ recid +'_expanded_row" class="w2ui-expanded-row">'+
                            (this.show.lineNumbers ? '<td class="w2ui-col-number"></td>' : '') +
                        '    <td class="w2ui-grid-data w2ui-expanded1" colspan="100">'+
                        '       <div id="grid_'+ this.name +'_frec_'+ recid +'_expanded"></div>'+
                        '   </td>'+
                        '</tr>');

                // event before
                var edata = this.trigger({ phase: 'before', type: 'expand', target: this.name, recid: recid,
                    box_id: 'grid_'+ this.name +'_rec_'+ recid +'_expanded', fbox_id: 'grid_'+ this.name +'_frec_'+ id +'_expanded' });
                if (edata.isCancelled === true) {
                    $('#grid_'+ this.name +'_rec_'+ id +'_expanded_row').remove();
                    $('#grid_'+ this.name +'_frec_'+ id +'_expanded_row').remove();
                    return false;
                }
                // expand column
                var row1 = $(this.box).find('#grid_'+ this.name +'_rec_'+ recid +'_expanded');
                var row2 = $(this.box).find('#grid_'+ this.name +'_frec_'+ recid +'_expanded');
                var innerHeight = row1.find('> div:first-child').height();
                if (row1.height() < innerHeight) {
                    row1.css({ height: innerHeight + 'px' });
                }
                if (row2.height() < innerHeight) {
                    row2.css({ height: innerHeight + 'px' });
                }
                // default action
                $('#grid_'+ this.name +'_rec_'+ id).attr('expanded', 'yes').addClass('w2ui-expanded');
                $('#grid_'+ this.name +'_frec_'+ id).attr('expanded', 'yes').addClass('w2ui-expanded');
                // $('#grid_'+ this.name +'_rec_'+ id +'_expanded_row').show();
                $('#grid_'+ this.name +'_cell_'+ this.get(recid, true) +'_expand div').html('-');
                rec.w2ui.expanded = true;
                // event after
                this.trigger($.extend(edata, { phase: 'after' }));
                this.resizeRecords();
            }
            return true;
        },

        collapse: function (recid) {
            var obj  = this;
            var ind  = this.get(recid, true);
            var rec  = this.records[ind];
            rec.w2ui = rec.w2ui || {};
            var id   = w2utils.escapeId(recid);
            var children = rec.w2ui.children;
            if (Array.isArray(children)) {
                if (rec.w2ui.expanded !== true) return false; // already hidden
                var edata = this.trigger({ phase: 'before', type: 'collapse', target: this.name, recid: recid });
                if (edata.isCancelled === true) return false;
                clearExpanded(rec);
                var stops = [];
                for (var r = rec; r != null; r = this.get(r.w2ui.parent_recid))
                    stops.push(r.w2ui.parent_recid);
                // stops contains 'undefined' plus the ID of all nodes in the path from 'rec' to the tree root
                var start = ind + 1;
                var end   = start;
                while (true) {
                    if (this.records.length <= end + 1 || this.records[end+1].w2ui == null ||
                        stops.indexOf(this.records[end+1].w2ui.parent_recid) >= 0) {
                        break;
                    }
                    end++;
                }
                this.records.splice(start, end - start + 1);
                this.total -= end - start + 1;
                var url = (typeof this.url != 'object' ? this.url : this.url.get);
                if (!url) {
                    if (this.searchData.length > 0) {
                        this.localSearch(true);
                    }
                }
                this.refresh();
                obj.trigger($.extend(edata, { phase: 'after' }));
            } else {
                if ($('#grid_'+ this.name +'_rec_'+ id +'_expanded_row').length === 0 || this.show.expandColumn !== true) return false;
                // event before
                var edata = this.trigger({ phase: 'before', type: 'collapse', target: this.name, recid: recid,
                    box_id: 'grid_'+ this.name +'_rec_'+ id +'_expanded', fbox_id: 'grid_'+ this.name +'_frec_'+ id +'_expanded' });
                if (edata.isCancelled === true) return false;
                // default action
                $('#grid_'+ this.name +'_rec_'+ id).removeAttr('expanded').removeClass('w2ui-expanded');
                $('#grid_'+ this.name +'_frec_'+ id).removeAttr('expanded').removeClass('w2ui-expanded');
                $('#grid_'+ this.name +'_cell_'+ this.get(recid, true) +'_expand div').html('+');
                $('#grid_'+ obj.name +'_rec_'+ id +'_expanded').css('height', '0px');
                $('#grid_'+ obj.name +'_frec_'+ id +'_expanded').css('height', '0px');
                setTimeout(function () {
                    $('#grid_'+ obj.name +'_rec_'+ id +'_expanded_row').remove();
                    $('#grid_'+ obj.name +'_frec_'+ id +'_expanded_row').remove();
                    rec.w2ui.expanded = false;
                    // event after
                    obj.trigger($.extend(edata, { phase: 'after' }));
                    obj.resizeRecords();
                }, 300);
            }
            return true;

            function clearExpanded(rec) {
                rec.w2ui.expanded = false;
                for (var i = 0; i < rec.w2ui.children.length; i++) {
                    var subRec = rec.w2ui.children[i];
                    if (subRec.w2ui.expanded) {
                        clearExpanded(subRec);
                    }
                }
            }
        },

        sort: function (field, direction, multiField) { // if no params - clears sort
            // event before
            var edata = this.trigger({ phase: 'before', type: 'sort', target: this.name, field: field, direction: direction, multiField: multiField });
            if (edata.isCancelled === true) return;
            // check if needed to quit
            if (field != null) {
                // default action
                var sortIndex = this.sortData.length;
                for (var s = 0; s < this.sortData.length; s++) {
                    if (this.sortData[s].field == field) { sortIndex = s; break; }
                }
                if (direction == null) {
                    if (this.sortData[sortIndex] == null) {
                        direction = 'asc';
                    } else {
                        switch (String(this.sortData[sortIndex].direction)) {
                            case 'asc'  : direction = 'desc'; break;
                            case 'desc' : direction = 'asc';  break;
                            default     : direction = 'asc';  break;
                        }
                    }
                }
                if (this.multiSort === false) { this.sortData = []; sortIndex = 0; }
                if (multiField != true) { this.sortData = []; sortIndex = 0; }
                // set new sort
                if (this.sortData[sortIndex] == null) this.sortData[sortIndex] = {};
                this.sortData[sortIndex].field        = field;
                this.sortData[sortIndex].direction = direction;
            } else {
                this.sortData = [];
            }
            // if local
            var url = (typeof this.url != 'object' ? this.url : this.url.get);
            if (!url) {
                this.localSort(true, true);
                if (this.searchData.length > 0) this.localSearch(true);
                // reset vertical scroll
                this.last.scrollTop = 0;
                $('#grid_'+ this.name +'_records').prop('scrollTop',  0);
                // event after
                this.trigger($.extend(edata, { phase: 'after' }));
                this.refresh();
            } else {
                // event after
                this.trigger($.extend(edata, { phase: 'after' }));
                this.last.xhr_offset = 0;
                this.reload();
            }
        },

        copy: function (flag, oEvent) {
            if ($.isPlainObject(flag)) {
                // event after
                this.trigger($.extend(flag, { phase: 'after' }));
                return flag.text;
            }
            // generate text to copy
            var sel = this.getSelection();
            if (sel.length === 0) return '';
            var text = '';
            if (typeof sel[0] == 'object') { // cell copy
                // find min/max column
                var minCol = sel[0].column;
                var maxCol = sel[0].column;
                var recs   = [];
                for (var s = 0; s < sel.length; s++) {
                    if (sel[s].column < minCol) minCol = sel[s].column;
                    if (sel[s].column > maxCol) maxCol = sel[s].column;
                    if (recs.indexOf(sel[s].index) == -1) recs.push(sel[s].index);
                }
                recs.sort(function(a, b) { return a-b; }); // sort function must be for numerical sort
                for (var r = 0 ; r < recs.length; r++) {
                    var ind = recs[r];
                    for (var c = minCol; c <= maxCol; c++) {
                        var col = this.columns[c];
                        if (col.hidden === true) continue;
                        text += w2utils.stripTags(this.getCellHTML(ind, c)) + '\t';
                    }
                    text = text.substr(0, text.length-1); // remove last \t
                    text += '\n';
                }
            } else { // row copy
                // copy headers
                for (var c = 0; c < this.columns.length; c++) {
                    var col = this.columns[c];
                    if (col.hidden === true) continue;
                    var colName = (col.caption ? col.caption : col.field);
                    if (col.caption && col.caption.length < 3 && col.tooltip) colName = col.tooltip; // if column name is less then 3 char and there is tooltip - use it
                    text += '"' + w2utils.stripTags(colName) + '"\t';
                }
                text = text.substr(0, text.length-1); // remove last \t
                text += '\n';
                // copy selected text
                for (var s = 0; s < sel.length; s++) {
                    var ind = this.get(sel[s], true);
                    for (var c = 0; c < this.columns.length; c++) {
                        var col = this.columns[c];
                        if (col.hidden === true) continue;
                        text += '"' + w2utils.stripTags(this.getCellHTML(ind, c)) + '"\t';
                    }
                    text = text.substr(0, text.length-1); // remove last \t
                    text += '\n';
                }
            }
            text = text.substr(0, text.length - 1);

            // if called without params
            if (flag == null) {
                // before event
                var edata = this.trigger({ phase: 'before', type: 'copy', target: this.name, text: text, originalEvent: oEvent });
                if (edata.isCancelled === true) return '';
                text = edata.text;
                // event after
                this.trigger($.extend(edata, { phase: 'after' }));
                return text;
            } else if (flag === false) { // only before event
                // before event
                var edata = this.trigger({ phase: 'before', type: 'copy', target: this.name, text: text, originalEvent: oEvent });
                if (edata.isCancelled === true) return '';
                text = edata.text;
                return edata;
            }
        },

        paste: function (text) {
            var sel = this.getSelection();
            var ind = this.get(sel[0].recid, true);
            var col = sel[0].column;
            // before event
            var edata = this.trigger({ phase: 'before', type: 'paste', target: this.name, text: text, index: ind, column: col });
            if (edata.isCancelled === true) return;
            text = edata.text;
            // default action
            if (this.selectType == 'row' || sel.length === 0) {
                console.log('ERROR: You can paste only if grid.selectType = \'cell\' and when at least one cell selected.');
                // event after
                this.trigger($.extend(edata, { phase: 'after' }));
                return;
            }
            var newSel = [];
            var text   = text.split('\n');
            for (var t = 0; t < text.length; t++) {
                var tmp  = text[t].split('\t');
                var cnt  = 0;
                var rec  = this.records[ind];
                var cols = [];
                if (rec == null) continue;
                for (var dt = 0; dt < tmp.length; dt++) {
                    if (!this.columns[col + cnt]) continue;
                    var field = this.columns[col + cnt].field;
                    rec.w2ui = rec.w2ui || {};
                    rec.w2ui.changes = rec.w2ui.changes || {};
                    rec.w2ui.changes[field] = tmp[dt];
                    cols.push(col + cnt);
                    cnt++;
                }
                for (var c = 0; c < cols.length; c++) newSel.push({ recid: rec.recid, column: cols[c] });
                ind++;
            }
            this.selectNone();
            this.select.apply(this, newSel);
            this.refresh();
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        // ==================================================
        // --- Common functions

        resize: function () {
            var obj  = this;
            var time = (new Date()).getTime();
            // make sure the box is right
            if (!this.box || $(this.box).attr('name') != this.name) return;
            // determine new width and height
            $(this.box).find('> div.w2ui-grid-box')
                .css('width', $(this.box).width())
                .css('height', $(this.box).height());
            // event before
            var edata = this.trigger({ phase: 'before', type: 'resize', target: this.name });
            if (edata.isCancelled === true) return;
            // resize
            obj.resizeBoxes();
            obj.resizeRecords();
            if (obj.toolbar && obj.toolbar.resize) obj.toolbar.resize();
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            return (new Date()).getTime() - time;
        },

        update: function (cells) {
            var time = (new Date()).getTime();
            if (this.box == null) return 0;
            if (cells == null) {
                for (var index = this.last.range_start - 1; index <= this.last.range_end - 1; index++) {
                    if (index < 0) continue;
                    var rec = this.records[index] || {};
                    if (!rec.w2ui) rec.w2ui = {};
                    for (var column = 0; column < this.columns.length; column++) {
                        var row  = $(this.box).find('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(rec.recid));
                        var cell = $(this.box).find('#grid_'+ this.name + '_data_'+ index +'_'+ column);
                        cell.replaceWith(this.getCellHTML(index, column, false));
                        cell = $(this.box).find('#grid_'+ this.name + '_data_'+ index +'_'+ column); // need to reselect as it was replaced
                        // assign style
                        if (rec.w2ui.style != null && !$.isEmptyObject(rec.w2ui.style)) {
                            if (typeof rec.w2ui.style == 'string') {
                                row.attr('style', rec.w2ui.style);
                            }
                            if ($.isPlainObject(rec.w2ui.style) && typeof rec.w2ui.style[column] == 'string') {
                                cell.attr('style', rec.w2ui.style[column]);
                            }
                        } else {
                            cell.attr('style', '');
                        }
                        // assign class
                        if (rec.w2ui.class != null && !$.isEmptyObject(rec.w2ui.class)) {
                            if (typeof rec.w2ui.class == 'string') {
                                row.addClass(rec.w2ui.class);
                            }
                            if ($.isPlainObject(rec.w2ui.class) && typeof rec.w2ui.class[column] == 'string') {
                                cell.addClass(rec.w2ui.class[column]);
                            }
                        }
                    }
                }

            } else {

                for (var i = 0; i < cells.length; i++) {
                    var index  = cells[i].index;
                    var column = cells[i].column;
                    if (index < 0) continue;
                    if (index == null || column == null) {
                        console.log('ERROR: Wrong argument for grid.update(cells), cells should be [{ index: X, column: Y }, ...]');
                        continue;
                    }
                    var rec  = this.records[index] || {};
                    var row  = $(this.box).find('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(rec.recid));
                    var cell = $(this.box).find('#grid_'+ this.name + '_data_'+ index +'_'+ column);
                    if (!rec.w2ui) rec.w2ui = {};
                    cell.replaceWith(this.getCellHTML(index, column, false));
                    cell = $(this.box).find('#grid_'+ this.name + '_data_'+ index +'_'+ column); // need to reselect as it was replaced
                    // assign style
                    if (rec.w2ui.style != null && !$.isEmptyObject(rec.w2ui.style)) {
                        if (typeof rec.w2ui.style == 'string') {
                            row.attr('style', rec.w2ui.style);
                        }
                        if ($.isPlainObject(rec.w2ui.style) && typeof rec.w2ui.style[column] == 'string') {
                            cell.attr('style', rec.w2ui.style[column]);
                        }
                    } else {
                        cell.attr('style', '');
                    }
                    // assign class
                    if (rec.w2ui.class != null && !$.isEmptyObject(rec.w2ui.class)) {
                        if (typeof rec.w2ui.class == 'string') {
                            row.addClass(rec.w2ui.class);
                        }
                        if ($.isPlainObject(rec.w2ui.class) && typeof rec.w2ui.class[column] == 'string') {
                            cell.addClass(rec.w2ui.class[column]);
                        }
                    }
                }
            }
            return (new Date()).getTime() - time;
        },

        refreshCell: function (recid, field) {
            var index     = this.get(recid, true);
            var isSummary = (this.records[index] && this.records[index].recid == recid ? false : true);
            var col_ind   = this.getColumn(field, true);
            var rec       = (isSummary ? this.summary[index] : this.records[index]);
            var col       = this.columns[col_ind];
            var cell      = $(this.box).find('#grid_'+ this.name + '_data_'+ index +'_'+ col_ind);
            if (rec == null) return false;
            // set cell html and changed flag
            cell.replaceWith(this.getCellHTML(index, col_ind, isSummary));
            cell = $(this.box).find('#grid_'+ this.name + '_data_'+ index +'_'+ col_ind); // need to recelect as it was replaced
            if (rec.w2ui && rec.w2ui.changes && rec.w2ui.changes[col.field] != null) {
                cell.addClass('w2ui-changed');
            } else {
                cell.removeClass('w2ui-changed');
            }
            // assign style
            if (rec.w2ui && rec.w2ui.style != null && !$.isEmptyObject(rec.w2ui.style)) {
                if (typeof rec.w2ui.style == 'string') {
                    $(this.box).find('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(rec.recid)).attr('style', rec.w2ui.style);
                }
                if ($.isPlainObject(rec.w2ui.style) && typeof rec.w2ui.style[col_ind] == 'string') {
                    cell.attr('style', rec.w2ui.style[col_ind]);
                }
            } else {
                cell.attr('style', '');
            }
            // assign class
            if (rec.w2ui && rec.w2ui.class != null && !$.isEmptyObject(rec.w2ui.class)) {
                if (typeof rec.w2ui.class == 'string') {
                    $(this.box).find('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(rec.recid)).addClass(rec.w2ui.class);
                }
                if ($.isPlainObject(rec.w2ui.class) && typeof rec.w2ui.class[col_ind] == 'string') {
                    cell.addClass(rec.w2ui.class[col_ind]);
                }
            }
        },

        refreshRow: function (recid, ind) {
            var tr1 = $(this.box).find('#grid_'+ this.name +'_frec_'+ w2utils.escapeId(recid));
            var tr2 = $(this.box).find('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(recid));
            if (tr1.length > 0) {
                if (ind == null) ind = this.get(recid, true);
                var line = tr1.attr('line');
                var isSummary = (this.records[ind] && this.records[ind].recid == recid ? false : true);
                // if it is searched, find index in search array
                var url = (typeof this.url != 'object' ? this.url : this.url.get);
                if (this.searchData.length > 0 && !url) for (var s = 0; s < this.last.searchIds.length; s++) if (this.last.searchIds[s] == ind) ind = s;
                var rec_html = this.getRecordHTML(ind, line, isSummary);
                $(tr1).replaceWith(rec_html[0]);
                $(tr2).replaceWith(rec_html[1]);
                // apply style to row if it was changed in render functions
                var st = (this.records[ind].w2ui ? this.records[ind].w2ui.style : '');
                if (typeof st == 'string') {
                    var tr1 = $(this.box).find('#grid_'+ this.name +'_frec_'+ w2utils.escapeId(recid));
                    var tr2 = $(this.box).find('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(recid));
                    tr1.attr('custom_style', st);
                    tr2.attr('custom_style', st);
                    if (tr1.hasClass('w2ui-selected')) {
                        st = st.replace('background-color', 'none');
                    }
                    tr1[0].style.cssText = 'height: '+ this.recordHeight + 'px;' + st;
                    tr2[0].style.cssText = 'height: '+ this.recordHeight + 'px;' + st;
                }
                if (isSummary) {
                    this.resize();
                }
            }
        },

        refresh: function () {
            var obj  = this;
            var time = (new Date()).getTime();
            var url = (typeof this.url != 'object' ? this.url : this.url.get);
            if (this.total <= 0 && !url && this.searchData.length === 0) {
                this.total = this.records.length;
            }
            this.toolbar.disable('w2ui-edit', 'w2ui-delete');
            if (!this.box) return;
            // event before
            var edata = this.trigger({ phase: 'before', target: this.name, type: 'refresh' });
            if (edata.isCancelled === true) return;
            // -- header
            if (this.show.header) {
                $('#grid_'+ this.name +'_header').html(this.header +'&#160;').show();
            } else {
                $('#grid_'+ this.name +'_header').hide();
            }
            // -- toolbar
            if (this.show.toolbar) {
                // if select-collumn is checked - no toolbar refresh
                if (this.toolbar && this.toolbar.get('w2ui-column-on-off') && this.toolbar.get('w2ui-column-on-off').checked) {
                    // no action
                } else {
                    $('#grid_'+ this.name +'_toolbar').show();
                    // refresh toolbar all but search field
                    if (typeof this.toolbar == 'object') {
                        var tmp = this.toolbar.items;
                        for (var t = 0; t < tmp.length; t++) {
                            if (tmp[t].id == 'w2ui-search' || tmp[t].type == 'break') continue;
                            this.toolbar.refresh(tmp[t].id);
                        }
                    }
                }
            } else {
                $('#grid_'+ this.name +'_toolbar').hide();
            }
            // -- make sure search is closed
            this.searchClose();
            // search placeholder
            var el = $('#grid_'+ obj.name +'_search_all');
            if (!this.multiSearch && this.last.field == 'all' && this.searches.length > 0) {
                this.last.field   = this.searches[0].field;
                this.last.caption = this.searches[0].caption;
            }
            for (var s = 0; s < this.searches.length; s++) {
                if (this.searches[s].field == this.last.field) this.last.caption = this.searches[s].caption;
            }
            if (this.last.multi) {
                el.attr('placeholder', '[' + w2utils.lang('Multiple Fields') + ']');
                el.w2field('clear');
            } else {
                el.attr('placeholder', w2utils.lang(this.last.caption));
            }
            if (el.val() != this.last.search) {
                var val = this.last.search;
                var tmp = el.data('w2field');
                if (tmp) val = tmp.format(val);
                el.val(val);
            }

            // -- body
            obj.refreshBody();

            // -- footer
            if (this.show.footer) {
                $('#grid_'+ this.name +'_footer').html(this.getFooterHTML()).show();
            } else {
                $('#grid_'+ this.name +'_footer').hide();
            }
            // show/hide clear search link
            var $clear = $('#grid_'+ this.name +'_searchClear');
            $clear.hide();
            this.searchData.some(function (item) {
                var tmp = obj.getSearch(item.field);
                if (obj.last.multi || (tmp && !tmp.hidden && tmp.type != 'list')) {
                    $clear.show();
                    return true;
                }
            });
            // all selected?
            var sel = this.last.selection,
                areAllSelected = (this.records.length > 0 && sel.indexes.length == this.records.length),
                areAllSearchedSelected = (sel.indexes.length > 0 && this.searchData.length !== 0 && sel.indexes.length == this.last.searchIds.length);
            if (areAllSelected || areAllSearchedSelected) {
                $('#grid_'+ this.name +'_check_all').prop('checked', true);
            } else {
                $('#grid_'+ this.name +'_check_all').prop('checked', false);
            }
            // show number of selected
            this.status();
            // collapse all records
            var rows = obj.find({ 'w2ui.expanded': true }, true);
            for (var r = 0; r < rows.length; r++) {
                var tmp = obj.records[rows[r]].w2ui;
                if (tmp && !Array.isArray(tmp.children)) {
                    tmp.expanded = false;
                }
            }
            // mark selection
            if (obj.markSearch) {
                setTimeout(function () {
                    // mark all search strings
                    var str = [];
                    for (var s = 0; s < obj.searchData.length; s++) {
                        var sdata = obj.searchData[s];
                        var fld = obj.getSearch(sdata.field);
                        if (!fld || fld.hidden) continue;
                        if (str.indexOf(sdata.value) == -1) str.push(sdata.value);
                    }
                    if (str.length > 0) $(obj.box).find('.w2ui-grid-data > div').w2marker(str);
                }, 50);
            }
            // enable/disable toolbar search button
            if (this.show.toolbarSave) {
                if (this.getChanges().length > 0) this.toolbar.enable('w2ui-save'); else this.toolbar.disable('w2ui-save');
            }
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            obj.resize();
            obj.addRange('selection');
            setTimeout(function () { // allow to render first
                obj.resize(); // needed for horizontal scroll to show (do not remove)
                obj.scroll();
            }, 1);

            if ( obj.reorderColumns && !obj.last.columnDrag ) {
                obj.last.columnDrag = obj.initColumnDrag();
            } else if ( !obj.reorderColumns && obj.last.columnDrag ) {
                obj.last.columnDrag.remove();
            }
            return (new Date()).getTime() - time;
        },

        refreshBody: function () {
            // -- separate summary
            var tmp = this.find({ 'w2ui.summary': true }, true);
            if (tmp.length > 0) {
                for (var t = 0; t < tmp.length; t++) this.summary.push(this.records[tmp[t]]);
                for (var t = tmp.length-1; t >= 0; t--) this.records.splice(tmp[t], 1);
            }

            // -- body
            this.scroll(); // need to calculate virtual scolling for columns
            var recHTML  = this.getRecordsHTML();
            var colHTML  = this.getColumnsHTML();
            var bodyHTML =
                '<div id="grid_'+ this.name +'_frecords" class="w2ui-grid-frecords" style="margin-bottom: '+ (w2utils.scrollBarSize() - 1) +'px;">'+
                    recHTML[0] +
                '</div>'+
                '<div id="grid_'+ this.name +'_records" class="w2ui-grid-records" onscroll="w2ui[\''+ this.name +'\'].scroll(event);">' +
                    recHTML[1] +
                '</div>'+
                '<div id="grid_'+ this.name +'_scroll1" class="w2ui-grid-scroll1" style="height: '+ w2utils.scrollBarSize() +'px"></div>'+
                // Columns need to be after to be able to overlap
                '<div id="grid_'+ this.name +'_fcolumns" class="w2ui-grid-fcolumns">'+
                '    <table><tbody>'+ colHTML[0] +'</tbody></table>'+
                '</div>'+
                '<div id="grid_'+ this.name +'_columns" class="w2ui-grid-columns">'+
                '    <table><tbody>'+ colHTML[1] +'</tbody></table>'+
                '</div>';
            $('#grid_'+ this.name +'_body').html(bodyHTML);
            if (this.records.length === 0 && this.msgEmpty) {
                $('#grid_'+ this.name +'_body')
                    .append('<div id="grid_'+ this.name + '_empty_msg" class="w2ui-grid-empty-msg"><div>'+ this.msgEmpty +'</div></div>');
            } else if ($('#grid_'+ this.name +'_empty_msg').length > 0) {
                $('#grid_'+ this.name +'_empty_msg').remove();
            }
            // show summary records
            if (this.summary.length > 0) {
                var sumHTML = this.getSummaryHTML();
                $('#grid_'+ this.name +'_fsummary').html(sumHTML[0]).show();
                $('#grid_'+ this.name +'_summary').html(sumHTML[1]).show();
            } else {
                $('#grid_'+ this.name +'_fsummary').hide();
                $('#grid_'+ this.name +'_summary').hide();
            }
        },

        render: function (box) {
            var obj  = this;
            var time = (new Date()).getTime();
            if (box != null) {
                if ($(this.box).find('#grid_'+ this.name +'_body').length > 0) {
                    $(this.box)
                        .removeAttr('name')
                        .removeClass('w2ui-reset w2ui-grid')
                        .html('');
                }
                this.box = box;
            }
            if (!this.box) return;
            var url = (typeof this.url != 'object' ? this.url : this.url.get);
            // event before
            var edata = this.trigger({ phase: 'before', target: this.name, type: 'render', box: box });
            if (edata.isCancelled === true) return;
            // reset needed if grid existed
            this.reset(true);
            // --- default search field
            if (!this.last.field) {
                if (!this.multiSearch || !this.show.searchAll) {
                    var tmp = 0;
                    while (tmp < this.searches.length && (this.searches[tmp].hidden || this.searches[tmp].simple === false)) tmp++;
                    if (tmp >= this.searches.length) {
                        // all searches are hidden
                        this.last.field   = '';
                        this.last.caption = '';
                    } else {
                        this.last.field   = this.searches[tmp].field;
                        this.last.caption = this.searches[tmp].caption;
                    }
                } else {
                    this.last.field   = 'all';
                    this.last.caption = w2utils.lang('All Fields');
                }
            }
            // insert elements
            $(this.box)
                .attr('name', this.name)
                .addClass('w2ui-reset w2ui-grid')
                .html('<div class="w2ui-grid-box">'+
                      '    <div id="grid_'+ this.name +'_header" class="w2ui-grid-header"></div>'+
                      '    <div id="grid_'+ this.name +'_toolbar" class="w2ui-grid-toolbar"></div>'+
                      '    <div id="grid_'+ this.name +'_body" class="w2ui-grid-body"></div>'+
                      '    <div id="grid_'+ this.name +'_fsummary" class="w2ui-grid-body w2ui-grid-summary"></div>'+
                      '    <div id="grid_'+ this.name +'_summary" class="w2ui-grid-body w2ui-grid-summary"></div>'+
                      '    <div id="grid_'+ this.name +'_footer" class="w2ui-grid-footer"></div>'+
                      '    <textarea id="grid_'+ this.name +'_focus" class="w2ui-grid-focus-input"></textarea>'+
                      '</div>');
            if (this.selectType != 'row') $(this.box).addClass('w2ui-ss');
            if ($(this.box).length > 0) $(this.box)[0].style.cssText += this.style;
            // init toolbar
            this.initToolbar();
            if (this.toolbar != null) this.toolbar.render($('#grid_'+ this.name +'_toolbar')[0]);
            // reinit search_all
            if (this.last.field && this.last.field != 'all') {
                var sd = this.searchData;
                setTimeout(function () { obj.initAllField(obj.last.field, (sd.length == 1 ? sd[0].value : null)); }, 1);
            }
            // init footer
            $('#grid_'+ this.name +'_footer').html(this.getFooterHTML());
            // refresh
            if (!this.last.state) this.last.state = this.stateSave(true); // initial default state
            this.stateRestore();
            if (url) this.refresh(); // show empty grid (need it) - should it be only for remote data source
            // if hidden searches - apply it
            var hasHiddenSearches = false;
            for (var i = 0; i < this.searches.length; i++) {
                if (this.searches[i].hidden) { hasHiddenSearches = true; break; }
            }
            if (hasHiddenSearches) {
                this.searchReset(false); // will call reload
                if (!url) setTimeout(function () { obj.searchReset(); }, 1);
            } else {
                this.reload();
            }
            // focus
            $(this.box).find('#grid_'+ this.name + '_focus')
                .on('focus', function (event) {
                    clearTimeout(obj.last.kbd_timer);
                    if (!obj.hasFocus) obj.focus();
                })
                .on('blur', function (event) {
                    clearTimeout(obj.last.kbd_timer);
                    obj.last.kbd_timer = setTimeout(function () {
                        if (obj.hasFocus) { obj.blur(); }
                    }, 100); // need this timer to be 100 ms
                })
                .on('paste', function (event) {
                    var el = this;
                    setTimeout(function () { w2ui[obj.name].paste(el.value); el.value = ''; }, 1)
                })
                .on('keydown', function (event) {
                    w2ui[obj.name].keydown.call(w2ui[obj.name], event);
                });
            // init mouse events for mouse selection
            var edataCol; // event for column select
            $(this.box).on('mousedown', mouseStart);
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            // attach to resize event
            if ($('.w2ui-layout').length === 0) { // if there is layout, it will send a resize event
                $(window).off('resize.w2ui-'+ this.name)
                    .on('resize.w2ui-'+ this.name, function (event) {
                        w2ui[obj.name].resize();
                    });
            }
            return (new Date()).getTime() - time;

            function mouseStart (event) {
                if (event.which != 1) return; // if not left mouse button
                // restore css user-select
                if (obj.last.userSelect == 'text') {
                    delete obj.last.userSelect;
                    $(obj.box).find('.w2ui-grid-body').css(w2utils.cssPrefix('user-select', 'none'));
                }
                // regular record select
                if (obj.selectType == 'row' && ($(event.target).parents().hasClass('w2ui-head') || $(event.target).hasClass('w2ui-head'))) return;
                if (obj.last.move && obj.last.move.type == 'expand') return;
                // if altKey - alow text selection
                if (event.altKey) {
                    $(obj.box).find('.w2ui-grid-body').css(w2utils.cssPrefix('user-select', 'text'));
                    obj.selectNone();
                    obj.last.move = { type: 'text-select' };
                    obj.last.userSelect = 'text';
                } else if (obj.multiSelect || obj.reorderRows) {
                    var tmp = event.target;
                    var pos = {
                        x: event.offsetX - 10,
                        y: event.offsetY - 10
                    }
                    var tmps = false;
                    while (tmp) {
                        if (tmp.classList && tmp.classList.contains('w2ui-grid')) break;
                        if (tmp.tagName && tmp.tagName.toUpperCase() == 'TD') tmps = true;
                        if (tmp.tagName && tmp.tagName.toUpperCase() != 'TR' && tmps == true) {
                            pos.x += tmp.offsetLeft;
                            pos.y += tmp.offsetTop;
                        }
                        tmp = tmp.parentNode;
                    }

                    obj.last.move = {
                        x      : event.screenX,
                        y      : event.screenY,
                        divX   : 0,
                        divY   : 0,
                        focusX : pos.x,
                        focusY : pos.y,
                        recid  : $(event.target).parents('tr').attr('recid'),
                        column : parseInt(event.target.tagName.toUpperCase() == 'TD' ? $(event.target).attr('col') : $(event.target).parents('td').attr('col')),
                        type   : 'select',
                        ghost  : false,
                        start  : true
                    };
                    if (obj.last.move.recid == null) obj.last.move.type = 'select-column';
                    // set focus to grid
                    var target = event.target;
                    var $input = $(obj.box).find('#grid_'+ obj.name + '_focus');
                    // move input next to cursor so screen does not jump
                    if (obj.last.move) {
                        var sLeft  = obj.last.move.focusX;
                        var sTop   = obj.last.move.focusY;
                        var $owner = $(target).parents('table').parent();
                        if ($owner.hasClass('w2ui-grid-records') || $owner.hasClass('w2ui-grid-frecords')
                                || $owner.hasClass('w2ui-grid-columns') || $owner.hasClass('w2ui-grid-fcolumns')
                                || $owner.hasClass('w2ui-grid-summary')) {
                            sLeft = obj.last.move.focusX - $(obj.box).find('#grid_'+ obj.name +'_records').scrollLeft();
                            sTop  = obj.last.move.focusY - $(obj.box).find('#grid_'+ obj.name +'_records').scrollTop();
                        }
                        if ($(target).hasClass('w2ui-grid-footer') || $(target).parents('div.w2ui-grid-footer').length > 0) {
                            sTop = $(obj.box).find('#grid_'+ obj.name +'_footer').position().top;
                        }
                        $input.css({
                            left: sLeft - 10,
                            top : sTop
                        });
                    }
                    // if toolbar input is clicked
                    setTimeout(function () {
                        if (['INPUT', 'TEXTAREA', 'SELECT'].indexOf(target.tagName.toUpperCase()) != -1) {
                            $(target).focus();
                        } else {
                            if (!$input.is(':focus')) $input.focus();
                        }
                    }, 50);
                }
                if (obj.reorderRows == true) {
                    var el = event.target;
                    if (el.tagName.toUpperCase() != 'TD') el = $(el).parents('td')[0];
                    if ($(el).hasClass('w2ui-col-number')) {
                        obj.selectNone();
                        obj.last.move.reorder = true;
                        // supress hover
                        var eColor = $(obj.box).find('.w2ui-even.w2ui-empty-record').css('background-color');
                        var oColor = $(obj.box).find('.w2ui-odd.w2ui-empty-record').css('background-color');
                        $(obj.box).find('.w2ui-even td').not('.w2ui-col-number').css('background-color', eColor);
                        $(obj.box).find('.w2ui-odd td').not('.w2ui-col-number').css('background-color', oColor);
                        // display empty record and ghost record
                        var mv = obj.last.move;
                        if (!mv.ghost) {
                            var row    = $('#grid_'+ obj.name + '_rec_'+ mv.recid);
                            var tmp    = row.parents('table').find('tr:first-child').clone();
                            mv.offsetY = event.offsetY;
                            mv.from    = mv.recid;
                            mv.pos     = row.position();
                            mv.ghost   = $(row).clone(true);
                            mv.ghost.removeAttr('id');
                            row.find('td').remove();
                            row.append('<td colspan="1000" style="height: '+ obj.recordHeight +'px; background-color: #eee; border-bottom: 1px dashed #aaa; border-top: 1px dashed #aaa;"></td>');
                            var recs = $(obj.box).find('.w2ui-grid-records');
                            recs.append('<table id="grid_'+ obj.name + '_ghost" style="position: absolute; z-index: 999999; opacity: 0.7; pointer-events: none;"></table>');
                            $('#grid_'+ obj.name + '_ghost').append(tmp).append(mv.ghost);
                        }
                        var ghost = $('#grid_'+ obj.name + '_ghost');
                        var recs  = $(obj.box).find('.w2ui-grid-records');
                        ghost.css({
                            top  : mv.pos.top + recs.scrollTop(),
                            left : mv.pos.left,
                            "border-top"    : '1px solid #aaa',
                            "border-bottom" : '1px solid #aaa'
                        });
                    } else {
                        obj.last.move.reorder = false;
                    }
                }
                $(document).on('mousemove', mouseMove);
                $(document).on('mouseup', mouseStop);
                // needed when grid grids are nested, see issue #1275
                event.stopPropagation();
            }

            function mouseMove (event) {
                var mv = obj.last.move;
                if (!mv || ['select', 'select-column'].indexOf(mv.type) == -1) return;
                mv.divX = (event.screenX - mv.x);
                mv.divY = (event.screenY - mv.y);
                if (Math.abs(mv.divX) <= 1 && Math.abs(mv.divY) <= 1) return; // only if moved more then 1px
                obj.last.cancelClick = true;
                if (obj.reorderRows == true && obj.last.move.reorder) {
                    var tmp   = $(event.target).parents('tr');
                    var recid = tmp.attr('recid');
                    if (recid != mv.from) {
                        var row1 = $('#grid_'+ obj.name + '_rec_'+ mv.recid);
                        var row2 = $('#grid_'+ obj.name + '_rec_'+ recid);
                        $(obj.box).find('.tmp-ghost').css('border-top', '0px');
                        row2.addClass('tmp-ghost').css('border-top', '2px solid #769EFC');
                        // MOVABLE GHOST
                        // if (event.screenY - mv.lastY < 0) row1.after(row2); else row2.after(row1);
                        mv.lastY = event.screenY;
                        mv.to      = recid;
                    }
                    var ghost = $('#grid_'+ obj.name + '_ghost');
                    var recs  = $(obj.box).find('.w2ui-grid-records');
                    ghost.css({
                        top  : mv.pos.top + mv.divY + recs.scrollTop(),
                        left : mv.pos.left
                    });
                    return;
                }
                if (mv.start && mv.recid) {
                    obj.selectNone();
                    mv.start = false;
                }
                var newSel= [];
                var recid = (event.target.tagName.toUpperCase() == 'TR' ? $(event.target).attr('recid') : $(event.target).parents('tr').attr('recid'));
                if (recid == null) {
                    // select by dragging columns
                    if (obj.selectType == 'row') return;
                    if (obj.last.move && obj.last.move.type == 'select') return;
                    var col = parseInt($(event.target).parents('td').attr('col'));
                    if (isNaN(col)) {
                        obj.removeRange('column-selection');
                        $(obj.box).find('.w2ui-grid-columns .w2ui-col-header, .w2ui-grid-fcolumns .w2ui-col-header').removeClass('w2ui-col-selected');
                        $(obj.box).find('.w2ui-col-number').removeClass('w2ui-row-selected');
                        delete mv.colRange;
                    } else {
                        // add all columns in between
                        var newRange = col + '-' + col;
                        if (mv.column < col) newRange = mv.column + '-' + col;
                        if (mv.column > col) newRange = col + '-' + mv.column;
                        // array of selected columns
                        var cols = [];
                        var tmp  = newRange.split('-');
                        for (var ii = parseInt(tmp[0]); ii <= parseInt(tmp[1]); ii++) {
                            cols.push(ii)
                        }
                        if (mv.colRange != newRange) {
                            edataCol = obj.trigger({ phase: 'before', type: 'columnSelect', target: obj.name, columns: cols, isCancelled: false }); // initial isCancelled
                            if (edataCol.isCancelled !== true) {
                                if (mv.colRange == null) obj.selectNone();
                                // highlight columns
                                var tmp = newRange.split('-');
                                $(obj.box).find('.w2ui-grid-columns .w2ui-col-header, .w2ui-grid-fcolumns .w2ui-col-header').removeClass('w2ui-col-selected');
                                for (var j = parseInt(tmp[0]); j <= parseInt(tmp[1]); j++) {
                                    $(obj.box).find('#grid_'+ obj.name +'_column_' + j + ' .w2ui-col-header').addClass('w2ui-col-selected');
                                }
                                $(obj.box).find('.w2ui-col-number').not('.w2ui-head').addClass('w2ui-row-selected');
                                // show new range
                                mv.colRange = newRange;
                                obj.removeRange('column-selection');
                                obj.addRange({
                                    name  : 'column-selection',
                                    range : [{ recid: obj.records[0].recid, column: tmp[0] }, { recid: obj.records[obj.records.length-1].recid, column: tmp[1] }],
                                    style : 'background-color: rgba(90, 145, 234, 0.1)'
                                });
                            }
                        }
                    }

                } else { // regular selection

                    var ind1  = obj.get(mv.recid, true);
                    // this happens when selection is started on summary row
                    if (ind1 == null || (obj.records[ind1] && obj.records[ind1].recid != mv.recid)) return;
                    var ind2  = obj.get(recid, true);
                    // this happens when selection is extended into summary row (a good place to implement scrolling)
                    if (ind2 == null) return;
                    var col1 = parseInt(mv.column);
                    var col2 = parseInt(event.target.tagName.toUpperCase() == 'TD' ? $(event.target).attr('col') : $(event.target).parents('td').attr('col'));
                    if (isNaN(col1) && isNaN(col2)) { // line number select entire record
                        col1 = 0;
                        col2 = obj.columns.length-1;
                    }
                    if (ind1 > ind2) { var tmp = ind1; ind1 = ind2; ind2 = tmp; }
                    // check if need to refresh
                    var tmp = 'ind1:'+ ind1 +',ind2;'+ ind2 +',col1:'+ col1 +',col2:'+ col2;
                    if (mv.range == tmp) return;
                    mv.range = tmp;
                    for (var i = ind1; i <= ind2; i++) {
                        if (obj.last.searchIds.length > 0 && obj.last.searchIds.indexOf(i) == -1) continue;
                        if (obj.selectType != 'row') {
                            if (col1 > col2) { var tmp = col1; col1 = col2; col2 = tmp; }
                            var tmp = [];
                            for (var c = col1; c <= col2; c++) {
                                if (obj.columns[c].hidden) continue;
                                newSel.push({ recid: obj.records[i].recid, column: parseInt(c) });
                            }
                        } else {
                            newSel.push(obj.records[i].recid);
                        }
                    }
                    if (obj.selectType != 'row') {
                        var sel = obj.getSelection();
                        // add more items
                        var tmp = [];
                        for (var ns = 0; ns < newSel.length; ns++) {
                            var flag = false;
                            for (var s = 0; s < sel.length; s++) if (newSel[ns].recid == sel[s].recid && newSel[ns].column == sel[s].column) flag = true;
                            if (!flag) tmp.push({ recid: newSel[ns].recid, column: newSel[ns].column });
                        }
                        obj.select.apply(obj, tmp);
                        // remove items
                        var tmp = [];
                        for (var s = 0; s < sel.length; s++) {
                            var flag = false;
                            for (var ns = 0; ns < newSel.length; ns++) if (newSel[ns].recid == sel[s].recid && newSel[ns].column == sel[s].column) flag = true;
                            if (!flag) tmp.push({ recid: sel[s].recid, column: sel[s].column });
                        }
                        obj.unselect.apply(obj, tmp);
                    } else {
                        if (obj.multiSelect) {
                            var sel = obj.getSelection();
                            for (var ns = 0; ns < newSel.length; ns++) {
                                if (sel.indexOf(newSel[ns]) == -1) obj.select(newSel[ns]); // add more items
                            }
                            for (var s = 0; s < sel.length; s++) {
                                if (newSel.indexOf(sel[s]) == -1) obj.unselect(sel[s]); // remove items
                            }
                        }
                    }
                }
            }

            function mouseStop (event) {
                var mv = obj.last.move;
                setTimeout(function () { delete obj.last.cancelClick; }, 1);
                if ($(event.target).parents().hasClass('.w2ui-head') || $(event.target).hasClass('.w2ui-head')) return;
                if (mv && ['select', 'select-column'].indexOf(mv.type) != -1) {
                    if (mv.colRange != null && edataCol.isCancelled !== true) {
                        var tmp = mv.colRange.split('-');
                        var sel = [];
                        for (var i = 0; i < obj.records.length; i++) {
                            var cols = []
                            for (var j = parseInt(tmp[0]); j <= parseInt(tmp[1]); j++) cols.push(j);
                            sel.push({ recid: obj.records[i].recid, column: cols });
                        }
                        obj.removeRange('column-selection');
                        obj.trigger($.extend(edataCol, { phase: 'after' }));
                        obj.select.apply(obj, sel);
                    }
                    if (obj.reorderRows == true && obj.last.move.reorder) {
                        // event
                        var edata = obj.trigger({ phase: 'before', target: obj.name, type: 'reorderRow', recid: mv.from, moveAfter: mv.to });
                        if (edata.isCancelled === true) {
                            $('#grid_'+ obj.name + '_ghost').remove();
                            obj.refresh();
                            return;
                        }
                        // default behavior
                        var ind1 = obj.get(mv.from, true);
                        var ind2 = obj.get(mv.to, true);
                        var tmp  = obj.records[ind1];
                        // swap records
                        if (ind1 != null && ind2 != null) {
                            obj.records.splice(ind1, 1);
                            if (ind1 > ind2) {
                                obj.records.splice(ind2, 0, tmp);
                            } else {
                                obj.records.splice(ind2 - 1, 0, tmp);
                            }
                        }
                        $('#grid_'+ obj.name + '_ghost').remove();
                        obj.refresh();
                        // event after
                        obj.trigger($.extend(edata, { phase: 'after' }));
                    }
                }
                delete obj.last.move;
                $(document).off('mousemove', mouseMove);
                $(document).off('mouseup', mouseStop);
            }
        },

        destroy: function () {
            // event before
            var edata = this.trigger({ phase: 'before', target: this.name, type: 'destroy' });
            if (edata.isCancelled === true) return;
            // remove events
            $(window).off('resize.w2ui-'+ this.name);
            // clean up
            if (typeof this.toolbar == 'object' && this.toolbar.destroy) this.toolbar.destroy();
            if ($(this.box).find('#grid_'+ this.name +'_body').length > 0) {
                $(this.box)
                    .removeAttr('name')
                    .removeClass('w2ui-reset w2ui-grid')
                    .html('');
            }
            delete w2ui[this.name];
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        // ===========================================
        // --- Internal Functions

        initColumnOnOff: function () {
            if (!this.show.toolbarColumns) return;
            var obj = this;
            // line number
            var col_html = '<div class="w2ui-col-on-off">'+
                '<table><tbody>'+
                '<tr id="grid_'+ this.name +'_column_ln_check" onclick="w2ui[\''+ obj.name +'\'].columnOnOff(event, \'line-numbers\'); event.stopPropagation();">'+
                '   <td style="width: 30px; text-align: center; padding-right: 3px; color: #888;">'+
                '      <span class="w2ui-column-check w2ui-icon-'+ (!obj.show.lineNumbers ? 'empty' : 'check') +'"></span>'+
                '   </td>'+
                '   <td onclick="jQuery(\'.w2ui-overlay\')[0].hide();">'+
                '      <label>'+ w2utils.lang('Line #') +'</label>'+
                '   </td>'+
                '</tr>';
            // columns
            for (var c = 0; c < this.columns.length; c++) {
                var col = this.columns[c];
                var tmp = this.columns[c].caption;
                if (col.hideable === false) continue;
                if (!tmp && this.columns[c].tooltip) tmp = this.columns[c].tooltip;
                if (!tmp) tmp = '- column '+ (parseInt(c) + 1) +' -';
                col_html +=
                    '<tr id="grid_'+ this.name +'_column_'+ c +'_check" '+
                    '       onclick="w2ui[\''+ obj.name +'\'].columnOnOff(event, \''+ col.field +'\'); event.stopPropagation();">'+
                    '   <td style="width: 30px; text-align: center; padding-right: 3px; color: #888;">'+
                    '      <span class="w2ui-column-check w2ui-icon-'+ (col.hidden ? 'empty' : 'check') +'"></span>'+
                    '   </td>'+
                    '   <td onclick="jQuery(\'.w2ui-overlay\')[0].hide();">'+
                    '       <label>'+ w2utils.stripTags(tmp) +'</label>'+
                    '   </td>'+
                    '</tr>';
            }
            var url = (typeof this.url != 'object' ? this.url : this.url.get);
            // devider
            if ((url && obj.show.skipRecords) || obj.show.saveRestoreState) {
                col_html += '<tr style="pointer-events: none"><td colspan="2"><div style="border-top: 1px solid #ddd;"></div></td></tr>';
            }
            // skip records
            if (url && obj.show.skipRecords) {
                col_html +=
                        '<tr><td colspan="2" style="padding: 0px">'+
                        '    <div style="cursor: pointer; padding: 2px 8px; cursor: default">'+ w2utils.lang('Skip') +
                        '        <input type="text" style="width: 60px" value="'+ this.offset +'" '+
                        '            onkeydown="if ([48,49,50,51,52,53,54,55,56,57,58,13,8,46,37,39].indexOf(event.keyCode) == -1) { event.preventDefault() }"'+
                        '            onkeypress="if (event.keyCode == 13) { '+
                        '               w2ui[\''+ obj.name +'\'].skip(this.value); '+
                        '               jQuery(\'.w2ui-overlay\')[0].hide(); '+
                        '            }"/> '+ w2utils.lang('Records')+
                        '    </div>'+
                        '</td></tr>';
            }
            // save/restore state
            if (obj.show.saveRestoreState) {
                col_html += '<tr><td colspan="2" onclick="var obj = w2ui[\''+ obj.name +'\']; obj.toolbar.uncheck(\'w2ui-column-on-off\'); obj.stateSave();">'+
                            '    <div style="cursor: pointer; padding: 4px 8px; cursor: default">'+ w2utils.lang('Save Grid State') + '</div>'+
                            '</td></tr>'+
                            '<tr><td colspan="2" onclick="var obj = w2ui[\''+ obj.name +'\']; obj.toolbar.uncheck(\'w2ui-column-on-off\'); obj.stateReset();">'+
                            '    <div style="cursor: pointer; padding: 4px 8px; cursor: default">'+ w2utils.lang('Restore Default State') + '</div>'+
                            '</td></tr>';
            }
            col_html += "</tbody></table></div>";
            this.toolbar.get('w2ui-column-on-off').html = col_html;
        },

        /**
         *
         * @param box, grid object
         * @returns {{remove: Function}} contains a closure around all events to ensure they are removed from the dom
         */
        initColumnDrag: function ( box ) {
            //throw error if using column groups
            if ( this.columnGroups && this.columnGroups.length ) throw 'Draggable columns are not currently supported with column groups.';

            var obj = this,
                _dragData = {};
                _dragData.lastInt = null;
                _dragData.pressed = false;
                _dragData.timeout = null;_dragData.columnHead = null;

            //attach original event listener
            $(obj.box).on('mousedown', dragColStart);
            $(obj.box).on('mouseup', catchMouseup);

            function catchMouseup(){
                _dragData.pressed = false;
                clearTimeout( _dragData.timeout );
            }
            /**
             *
             * @param event, mousedown
             * @returns {boolean} false, preventsDefault
             */
            function dragColStart ( event ) {
                if ( _dragData.timeout ) clearTimeout( _dragData.timeout );
                var self = this;
                _dragData.pressed = true;

                _dragData.timeout = setTimeout(function(){
                    if ( !_dragData.pressed ) return;

                    var edata,
                        columns,
                        selectedCol,
                        origColumn,
                        origColumnNumber,
                        invalidPreColumns = [ 'w2ui-col-number', 'w2ui-col-expand', 'w2ui-col-select' ],
                        invalidPostColumns = [ 'w2ui-head-last' ],
                        invalidColumns = invalidPreColumns.concat( invalidPostColumns ),
                        preColumnsSelector = '.w2ui-col-number, .w2ui-col-expand, .w2ui-col-select',
                        preColHeadersSelector = '.w2ui-head.w2ui-col-number, .w2ui-head.w2ui-col-expand, .w2ui-head.w2ui-col-select';

                    // do nothing if it is not a header
                    if ( !$( event.originalEvent.target ).parents().hasClass( 'w2ui-head' ) ) return;

                    // do nothing if it is an invalid column
                    for ( var i = 0, l = invalidColumns.length; i < l; i++ ){
                        if ( $( event.originalEvent.target ).parents().hasClass( invalidColumns[ i ] ) ) return;
                    }

                    _dragData.numberPreColumnsPresent = $( obj.box ).find( preColHeadersSelector ).length;

                    //start event for drag start
                    _dragData.columnHead = origColumn = $( event.originalEvent.target ).parents( '.w2ui-head' );
                    origColumnNumber = parseInt( origColumn.attr( 'col' ), 10);
                    edata = obj.trigger({ type: 'columnDragStart', phase: 'before', originalEvent: event, origColumnNumber: origColumnNumber, target: origColumn[0] });
                    if ( edata.isCancelled === true ) return false;

                    columns = _dragData.columns = $( obj.box ).find( '.w2ui-head:not(.w2ui-head-last)' );

                    //add events
                    $( document ).on( 'mouseup', dragColEnd );
                    $( document ).on( 'mousemove', dragColOver );

                    _dragData.originalPos = parseInt( $( event.originalEvent.target ).parent( '.w2ui-head' ).attr( 'col' ), 10 );
                    //_dragData.columns.css({ overflow: 'visible' }).children( 'div' ).css({ overflow: 'visible' });

                    //configure and style ghost image
                    _dragData.ghost = $( self ).clone( true );

                    //hide other elements on ghost except the grid body
                    $( _dragData.ghost ).find( '[col]:not([col="' + _dragData.originalPos + '"]), .w2ui-toolbar, .w2ui-grid-header' ).remove();
                    $( _dragData.ghost ).find( preColumnsSelector ).remove();
                    $( _dragData.ghost ).find( '.w2ui-grid-body' ).css({ top: 0 });

                    selectedCol = $( _dragData.ghost ).find( '[col="' + _dragData.originalPos + '"]' );
                    $( document.body ).append( _dragData.ghost );

                    $( _dragData.ghost ).css({
                        width: 0,
                        height: 0,
                        margin: 0,
                        position: 'fixed',
                        zIndex: 999999,
                        opacity: 0
                    }).addClass( '.w2ui-grid-ghost' ).animate({
                            width: selectedCol.width(),
                            height: $(obj.box).find('.w2ui-grid-body:first').height(),
                            left : event.pageX,
                            top : event.pageY,
                            opacity: 0.8
                        }, 0 );

                    //establish current offsets
                    _dragData.offsets = [];
                    for ( var i = 0, l = columns.length; i < l; i++ ) {
                        _dragData.offsets.push( $( columns[ i ] ).offset().left );
                    }

                    //conclude event
                    obj.trigger( $.extend( edata, { phase: 'after' } ) );
                }, 150 );//end timeout wrapper
            }

            function dragColOver ( event ) {
                if ( !_dragData.pressed ) return;

                var cursorX = event.originalEvent.pageX,
                    cursorY = event.originalEvent.pageY,
                    offsets = _dragData.offsets,
                    lastWidth = $( '.w2ui-head:not(.w2ui-head-last)' ).width();

                _dragData.targetInt = Math.max(_dragData.numberPreColumnsPresent,targetIntersection( cursorX, offsets, lastWidth ));

                markIntersection( _dragData.targetInt );
                trackGhost( cursorX, cursorY );
            }

            function dragColEnd ( event ) {
                _dragData.pressed = false;

                var edata,
                    target,
                    selected,
                    columnConfig,
                    targetColumn,
                    ghosts = $( '.w2ui-grid-ghost' );

                //start event for drag start
                edata = obj.trigger({ type: 'columnDragEnd', phase: 'before', originalEvent: event, target: _dragData.columnHead[0] });
                if ( edata.isCancelled === true ) return false;

                selected = obj.columns[ _dragData.originalPos ];
                columnConfig = obj.columns;
                targetColumn =  $( _dragData.columns[ Math.min(_dragData.lastInt, _dragData.columns.length - 1) ] );
                target = (_dragData.lastInt < _dragData.columns.length) ? parseInt(targetColumn.attr('col')) : columnConfig.length;

                if ( target !== _dragData.originalPos + 1 && target !== _dragData.originalPos && targetColumn && targetColumn.length ) {
                    $( _dragData.ghost ).animate({
                        top: $( obj.box ).offset().top,
                        left: targetColumn.offset().left,
                        width: 0,
                        height: 0,
                        opacity: 0.2
                    }, 300, function(){
                        $( this ).remove();
                        ghosts.remove();
                    });

                    columnConfig.splice( target, 0, $.extend( {}, selected ) );
                    columnConfig.splice( columnConfig.indexOf( selected ), 1);

                } else {
                    $( _dragData.ghost ).remove();
                    ghosts.remove();
                }

                //_dragData.columns.css({ overflow: '' }).children( 'div' ).css({ overflow: '' });

                $( document ).off( 'mouseup', dragColEnd );
                $( document ).off( 'mousemove', dragColOver );
                if ( _dragData.marker ) _dragData.marker.remove();
                _dragData = {};

                obj.refresh();

                //conclude event
                obj.trigger( $.extend( edata, { phase: 'after', targetColumnNumber: target - 1 } ) );
            }

            function markIntersection( intersection ){
                if ( !_dragData.marker && !_dragData.markerLeft ) {
                    _dragData.marker = $('<div class="col-intersection-marker">' +
                        '<div class="top-marker"></div>' +
                        '<div class="bottom-marker"></div>' +
                        '</div>');
                    _dragData.markerLeft = $('<div class="col-intersection-marker">' +
                        '<div class="top-marker"></div>' +
                        '<div class="bottom-marker"></div>' +
                        '</div>');
                }

                if ( !_dragData.lastInt || _dragData.lastInt !== intersection ){
                    _dragData.lastInt = intersection;
                    _dragData.marker.remove();
                    _dragData.markerLeft.remove();
                    $('.w2ui-head').removeClass('w2ui-col-intersection');

                    //if the current intersection is greater than the number of columns add the marker to the end of the last column only
                    if ( intersection >= _dragData.columns.length ) {
                        $( _dragData.columns[ _dragData.columns.length - 1 ] ).children( 'div:last' ).append( _dragData.marker.addClass( 'right' ).removeClass( 'left' ) );
                        $( _dragData.columns[ _dragData.columns.length - 1 ] ).addClass('w2ui-col-intersection');
                    } else if ( intersection <= _dragData.numberPreColumnsPresent ) {
                        //if the current intersection is on the column numbers place marker on first available column only
                        $( _dragData.columns[ _dragData.numberPreColumnsPresent ] ).prepend( _dragData.marker.addClass( 'left' ).removeClass( 'right' ) ).css({ position: 'relative' });
                        $( _dragData.columns[ _dragData.numberPreColumnsPresent ] ).prev().addClass('w2ui-col-intersection');
                    } else {
                        //otherwise prepend the marker to the targeted column and append it to the previous column
                        $( _dragData.columns[intersection] ).children( 'div:last' ).prepend( _dragData.marker.addClass( 'left' ).removeClass( 'right' ) );
                        $( _dragData.columns[intersection] ).prev().children( 'div:last' ).append( _dragData.markerLeft.addClass( 'right' ).removeClass( 'left' ) ).css({ position: 'relative' });
                        $( _dragData.columns[intersection - 1] ).addClass('w2ui-col-intersection');
                    }
                }
            }

            function targetIntersection( cursorX, offsets, lastWidth ){
                if ( cursorX <= offsets[0] ) {
                    return 0;
                } else if ( cursorX >= offsets[offsets.length - 1] + lastWidth ) {
                    return offsets.length;
                } else {
                    for ( var i = 0, l = offsets.length; i < l; i++ ) {
                        var thisOffset = offsets[ i ];
                        var nextOffset = offsets[ i + 1 ] || offsets[ i ] + lastWidth;
                        var midpoint = ( nextOffset - offsets[ i ]) / 2 + offsets[ i ];

                        if ( cursorX > thisOffset && cursorX <= midpoint ) {
                            return i;
                        } else if ( cursorX > midpoint && cursorX <= nextOffset ) {
                            return i + 1;
                        }
                    }
                    return intersection;
                }
            }

            function trackGhost( cursorX, cursorY ){
                $( _dragData.ghost ).css({
                    left: cursorX - 10,
                    top: cursorY - 10
                });
            }

            //return an object to remove drag if it has ever been enabled
            return {
                remove: function(){
                    $( obj.box ).off( 'mousedown', dragColStart );
                    $( obj.box ).off( 'mouseup', catchMouseup );
                    $( obj.box ).find( '.w2ui-head' ).removeAttr( 'draggable' );
                    obj.last.columnDrag = false;
                }
            };
        },

        columnOnOff: function (event, field) {
            var $el = $(event.target).parents('tr').find('.w2ui-column-check');
            // event before
            var edata = this.trigger({ phase: 'before', target: this.name, type: 'columnOnOff', field: field, originalEvent: event });
            if (edata.isCancelled === true) return;
            // regular processing
            var obj = this;
            // collapse expanded rows
            var rows = obj.find({ 'w2ui.expanded': true }, true);
            for (var r = 0; r < rows.length; r++) {
                var tmp = this.records[r].w2ui;
                if (tmp && !Array.isArray(tmp.children)) {
                    this.records[r].w2ui.expanded = false;
                }
            }
            // show/hide
            if (field == 'line-numbers') {
                this.show.lineNumbers = !this.show.lineNumbers;
                if (this.show.lineNumbers) {
                    $el.addClass('w2ui-icon-check').removeClass('w2ui-icon-empty');
                } else {
                    $el.addClass('w2ui-icon-empty').removeClass('w2ui-icon-check');
                }
                this.refreshBody();
                this.resizeRecords();
            } else {
                var col = this.getColumn(field);
                if (col.hidden) {
                    $el.addClass('w2ui-icon-check').removeClass('w2ui-icon-empty');
                    this.showColumn(col.field);
                } else {
                    $el.addClass('w2ui-icon-empty').removeClass('w2ui-icon-check');
                    this.hideColumn(col.field);
                }
            }
            if (!event.shiftKey && !event.metaKey && !event.ctrlKey) {
                // timeout needed for visual delay
                setTimeout(function () {
                    $().w2overlay({ name: obj.name + '_toolbar' });
                }, 150);
            }
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        scrollToColumn: function (field) {
            if (field == null)
                return;
            var sWidth = 0;
            var found = false;
            for (var i = 0; i < this.columns.length; i++) {
                var col = this.columns[i];
                if (col.field == field) {
                    found = true;
                    break;
                }
                if (col.frozen || col.hidden)
                    continue;
                var cSize = parseInt(col.sizeCalculated ? col.sizeCalculated : col.size);
                sWidth += cSize;
            }
            if (!found)
                return;
            this.last.scrollLeft = sWidth+1;
            this.scroll();
        },

        initToolbar: function () {
            var obj = this;
            // -- if toolbar is true
            if (this.toolbar['render'] == null) {
                var tmp_items = this.toolbar.items;
                this.toolbar.items = [];
                this.toolbar = $().w2toolbar($.extend(true, {}, this.toolbar, { name: this.name +'_toolbar', owner: this }));

                // =============================================
                // ------ Toolbar Generic buttons

                if (this.show.toolbarReload) {
                    this.toolbar.items.push($.extend(true, {}, this.buttons['reload']));
                }
                if (this.show.toolbarColumns) {
                    this.toolbar.items.push($.extend(true, {}, this.buttons['columns']));
                }
                if (this.show.toolbarReload || this.show.toolbarColumns) {
                    this.toolbar.items.push({ type: 'break', id: 'w2ui-break0' });
                }
                if (this.show.toolbarInput) {
                    var html =
                        '<div class="w2ui-toolbar-search">'+
                        '<table cellpadding="0" cellspacing="0"><tbody><tr>'+
                        '    <td>'+ this.buttons['search'].html +'</td>'+
                        '    <td>'+
                        '        <input type="text" id="grid_'+ this.name +'_search_all" class="w2ui-search-all" tabindex="-1" '+
                        '            placeholder="'+ w2utils.lang(this.last.caption) +'" value="'+ this.last.search +'"'+
                        '            onfocus="clearTimeout(w2ui[\''+ this.name +'\'].last.kbd_timer);"'+
                        '            onkeydown="if (event.keyCode == 13 &amp;&amp; w2utils.isIE) this.onchange();"'+
                        '            onchange="'+
                        '                var grid = w2ui[\''+ this.name +'\']; '+
                        '                var val = this.value; '+
                        '                var sel = jQuery(this).data(\'selected\');'+
                        '                var fld = jQuery(this).data(\'w2field\'); '+
                        '                if (fld) val = fld.clean(val);'+
                        '                if (fld &amp;&amp; fld.type == \'list\' &amp;&amp; sel &amp;&amp; typeof sel.id == \'undefined\') {'+
                        '                   grid.searchReset();'+
                        '                } else {'+
                        '                   grid.search(grid.last.field, val);'+
                        '                }'+
                        '            "/>'+
                        '    </td>'+
                        '    <td>'+
                        '        <div class="w2ui-search-clear" id="grid_'+ this.name +'_searchClear"  '+
                        '             onclick="var obj = w2ui[\''+ this.name +'\']; obj.searchReset();" style="display: none"'+
                        '        >&#160;&#160;</div>'+
                        '    </td>'+
                        '</tr></tbody></table>'+
                        '</div>';
                    this.toolbar.items.push({ type: 'html', id: 'w2ui-search', html: html });
                }
                if (this.show.toolbarSearch && this.multiSearch && this.searches.length > 0) {
                    this.toolbar.items.push($.extend(true, {}, this.buttons['search-go']));
                }
                if ((this.show.toolbarSearch || this.show.toolbarInput) && (this.show.toolbarAdd || this.show.toolbarEdit || this.show.toolbarDelete || this.show.toolbarSave)) {
                    this.toolbar.items.push({ type: 'break', id: 'w2ui-break1' });
                }
                if (this.show.toolbarAdd) {
                    this.toolbar.items.push($.extend(true, {}, this.buttons['add']));
                }
                if (this.show.toolbarEdit) {
                    this.toolbar.items.push($.extend(true, {}, this.buttons['edit']));
                }
                if (this.show.toolbarDelete) {
                    this.toolbar.items.push($.extend(true, {}, this.buttons['delete']));
                }
                if (this.show.toolbarSave) {
                    if (this.show.toolbarAdd || this.show.toolbarDelete || this.show.toolbarEdit) {
                        this.toolbar.items.push({ type: 'break', id: 'w2ui-break2' });
                    }
                    this.toolbar.items.push($.extend(true, {}, this.buttons['save']));
                }
                // add original buttons
                if (tmp_items) for (var i = 0; i < tmp_items.length; i++) this.toolbar.items.push(tmp_items[i]);

                // =============================================
                // ------ Toolbar onClick processing

                var obj = this;
                this.toolbar.on('click', function (event) {
                    var edata = obj.trigger({ phase: 'before', type: 'toolbar', target: event.target, originalEvent: event });
                    if (edata.isCancelled === true) return;
                    var id = event.target;
                    switch (id) {
                        case 'w2ui-reload':
                            var edata2 = obj.trigger({ phase: 'before', type: 'reload', target: obj.name });
                            if (edata2.isCancelled === true) return false;
                            obj.reload();
                            obj.trigger($.extend(edata2, { phase: 'after' }));
                            break;
                        case 'w2ui-column-on-off':
                            obj.initColumnOnOff();
                            obj.initResize();
                            obj.resize();
                            break;
                        case 'w2ui-search-advanced':
                            var tb = this;
                            var it = this.get(id);
                            if (it.checked) {
                                obj.searchClose();
                                setTimeout(function () { tb.uncheck(id); }, 1);
                            } else {
                                obj.searchOpen();
                                event.originalEvent.stopPropagation();
                                function tmp_close() {
                                    if ($('#w2ui-overlay-'+ obj.name + '-searchOverlay').data('keepOpen') === true) return;
                                    tb.uncheck(id);
                                    $(document).off('click', 'body', tmp_close);
                                }
                                $(document).on('click', 'body', tmp_close);
                            }
                            break;
                        case 'w2ui-add':
                            // events
                            var edata = obj.trigger({ phase: 'before', target: obj.name, type: 'add', recid: null });
                            obj.trigger($.extend(edata, { phase: 'after' }));
                            // hide all tooltips
                            setTimeout(function () { $().w2tag(); }, 20);
                            break;
                        case 'w2ui-edit':
                            var sel   = obj.getSelection();
                            var recid = null;
                            if (sel.length == 1) recid = sel[0];
                            // events
                            var edata = obj.trigger({ phase: 'before', target: obj.name, type: 'edit', recid: recid });
                            obj.trigger($.extend(edata, { phase: 'after' }));
                            // hide all tooltips
                            setTimeout(function () { $().w2tag(); }, 20);
                            break;
                        case 'w2ui-delete':
                            obj["delete"]();
                            break;
                        case 'w2ui-save':
                            obj.save();
                            break;
                    }
                    // no default action
                    obj.trigger($.extend(edata, { phase: 'after' }));
                });
            }
        },

        initResize: function () {
            var obj = this;
            //if (obj.resizing === true) return;
            $(this.box).find('.w2ui-resizer')
                .off('click')
                .on('click', function (event) {
                    if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true;
                    if (event.preventDefault) event.preventDefault();
                })
                .off('mousedown')
                .on('mousedown', function (event) {
                    if (!event) event = window.event;
                    obj.resizing = true;
                    obj.last.tmp = {
                        x   : event.screenX,
                        y   : event.screenY,
                        gx  : event.screenX,
                        gy  : event.screenY,
                        col : parseInt($(this).attr('name'))
                    };
                    if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true;
                    if (event.preventDefault) event.preventDefault();
                    // fix sizes
                    for (var c = 0; c < obj.columns.length; c++) {
                        if (obj.columns[c].hidden) continue;
                        if (obj.columns[c].sizeOriginal == null) obj.columns[c].sizeOriginal = obj.columns[c].size;
                        obj.columns[c].size = obj.columns[c].sizeCalculated;
                    }
                    var edata = { phase: 'before', type: 'columnResize', target: obj.name, column: obj.last.tmp.col, field: obj.columns[obj.last.tmp.col].field };
                    edata = obj.trigger($.extend(edata, { resizeBy: 0, originalEvent: event }));
                    // set move event
                    var mouseMove = function (event) {
                        if (obj.resizing != true) return;
                        if (!event) event = window.event;
                        // event before
                        edata = obj.trigger($.extend(edata, { resizeBy: (event.screenX - obj.last.tmp.gx), originalEvent: event }));
                        if (edata.isCancelled === true) { edata.isCancelled = false; return; }
                        // default action
                        obj.last.tmp.x = (event.screenX - obj.last.tmp.x);
                        obj.last.tmp.y = (event.screenY - obj.last.tmp.y);
                        obj.columns[obj.last.tmp.col].size = (parseInt(obj.columns[obj.last.tmp.col].size) + obj.last.tmp.x) + 'px';
                        obj.resizeRecords();
                        obj.scroll();
                        // reset
                        obj.last.tmp.x = event.screenX;
                        obj.last.tmp.y = event.screenY;
                    };
                    var mouseUp = function (event) {
                        delete obj.resizing;
                        $(document).off('mousemove', 'body');
                        $(document).off('mouseup', 'body');
                        obj.resizeRecords();
                        obj.scroll();
                        // event before
                        obj.trigger($.extend(edata, { phase: 'after', originalEvent: event }));
                    };
                    $(document).on('mousemove', 'body', mouseMove);
                    $(document).on('mouseup', 'body', mouseUp);
                })
                .each(function (index, el) {
                    var td  = $(el).parent();
                    $(el).css({
                        "height"         : '25px',
                        "margin-left"     : (td.width() - 3) + 'px'
                    });
                });
        },

        resizeBoxes: function () {
            // elements
            var header   = $('#grid_'+ this.name +'_header');
            var toolbar  = $('#grid_'+ this.name +'_toolbar');
            var fsummary = $('#grid_'+ this.name +'_fsummary');
            var summary  = $('#grid_'+ this.name +'_summary');
            var footer   = $('#grid_'+ this.name +'_footer');
            var body     = $('#grid_'+ this.name +'_body');

            if (this.show.header) {
                header.css({
                    top:   '0px',
                    left:  '0px',
                    right: '0px'
                });
            }

            if (this.show.toolbar) {
                toolbar.css({
                    top:   ( 0 + (this.show.header ? w2utils.getSize(header, 'height') : 0) ) + 'px',
                    left:  '0px',
                    right: '0px'
                });
            }
            if (this.summary.length > 0) {
                fsummary.css({
                    bottom: ( 0 + (this.show.footer ? w2utils.getSize(footer, 'height') : 0) ) + 'px'
                });
                summary.css({
                    bottom: ( 0 + (this.show.footer ? w2utils.getSize(footer, 'height') : 0) ) + 'px',
                    right: '0px'
                });
            }
            if (this.show.footer) {
                footer.css({
                    bottom: '0px',
                    left:  '0px',
                    right: '0px'
                });
            }
            body.css({
                top: ( 0 + (this.show.header ? w2utils.getSize(header, 'height') : 0) + (this.show.toolbar ? w2utils.getSize(toolbar, 'height') : 0) ) + 'px',
                bottom: ( 0 + (this.show.footer ? w2utils.getSize(footer, 'height') : 0) + (this.summary.length > 0 ? w2utils.getSize(summary, 'height') : 0) ) + 'px',
                left:   '0px',
                right:  '0px'
            });
        },

        resizeRecords: function () {
            var obj = this;
            // remove empty records
            $(this.box).find('.w2ui-empty-record').remove();
            // -- Calculate Column size in PX
            var box      = $(this.box);
            var grid     = $(this.box).find('> div.w2ui-grid-box');
            var header   = $('#grid_'+ this.name +'_header');
            var toolbar  = $('#grid_'+ this.name +'_toolbar');
            var summary  = $('#grid_'+ this.name +'_summary');
            var fsummary = $('#grid_'+ this.name +'_fsummary');
            var footer   = $('#grid_'+ this.name +'_footer');
            var body     = $('#grid_'+ this.name +'_body');
            var columns  = $('#grid_'+ this.name +'_columns');
            var fcolumns = $('#grid_'+ this.name +'_fcolumns');
            var records  = $('#grid_'+ this.name +'_records');
            var frecords = $('#grid_'+ this.name +'_frecords');
            var scroll1  = $('#grid_'+ this.name +'_scroll1');
            var lineNumberWidth = String(this.total).length * 8 + 10;
            if (lineNumberWidth < 34) lineNumberWidth = 34; // 3 digit width
            if (this.lineNumberWidth != null) lineNumberWidth = this.lineNumberWidth;

            var bodyOverflowX = false;
            var bodyOverflowY = false;
            var sWidth = 0;
            for (var i = 0; i < obj.columns.length; i++) {
                if (obj.columns[i].frozen || obj.columns[i].hidden) continue;
                var cSize = parseInt(obj.columns[i].sizeCalculated ? obj.columns[i].sizeCalculated : obj.columns[i].size);
                sWidth += cSize;
            }
            if (records.width() < sWidth) bodyOverflowX = true;
            if (body.height() - columns.height() < $(records).find('>table').height() + (bodyOverflowX ? w2utils.scrollBarSize() : 0)) bodyOverflowY = true;

            // body might be expanded by data
            if (!this.fixedBody) {
                // allow it to render records, then resize
                var calculatedHeight = w2utils.getSize(columns, 'height')
                    + w2utils.getSize($('#grid_'+ obj.name +'_records table'), 'height')
                    + (bodyOverflowX ? w2utils.scrollBarSize() : 0);
                obj.height = calculatedHeight
                    + w2utils.getSize(grid, '+height')
                    + (obj.show.header ? w2utils.getSize(header, 'height') : 0)
                    + (obj.show.toolbar ? w2utils.getSize(toolbar, 'height') : 0)
                    + (summary.css('display') != 'none' ? w2utils.getSize(summary, 'height') : 0)
                    + (obj.show.footer ? w2utils.getSize(footer, 'height') : 0);
                grid.css('height', obj.height);
                body.css('height', calculatedHeight);
                box.css('height', w2utils.getSize(grid, 'height') + w2utils.getSize(box, '+height'));
            } else {
                // fixed body height
                var calculatedHeight =  grid.height()
                    - (this.show.header ? w2utils.getSize(header, 'height') : 0)
                    - (this.show.toolbar ? w2utils.getSize(toolbar, 'height') : 0)
                    - (summary.css('display') != 'none' ? w2utils.getSize(summary, 'height') : 0)
                    - (this.show.footer ? w2utils.getSize(footer, 'height') : 0);
                body.css('height', calculatedHeight);
            }

            var buffered = this.records.length;
            var url = (typeof this.url != 'object' ? this.url : this.url.get);
            if (this.searchData.length != 0 && !url) buffered = this.last.searchIds.length;
            // apply overflow
            if (!this.fixedBody) { bodyOverflowY = false; }
            if (bodyOverflowX || bodyOverflowY) {
                columns.find('> table > tbody > tr:nth-child(1) td.w2ui-head-last').css('width', w2utils.scrollBarSize()).show();
                records.css({
                    top: ((this.columnGroups.length > 0 && this.show.columns ? 1 : 0) + w2utils.getSize(columns, 'height')) +'px',
                    "-webkit-overflow-scrolling": "touch",
                    "overflow-x": (bodyOverflowX ? 'auto' : 'hidden'),
                    "overflow-y": (bodyOverflowY ? 'auto' : 'hidden')
                });
            } else {
                columns.find('> table > tbody > tr:nth-child(1) td.w2ui-head-last').hide();
                records.css({
                    top: ((this.columnGroups.length > 0 && this.show.columns ? 1 : 0) + w2utils.getSize(columns, 'height')) +'px',
                    overflow: 'hidden'
                });
                if (records.length > 0) { this.last.scrollTop  = 0; this.last.scrollLeft = 0; } // if no scrollbars, always show top
            }
            if (bodyOverflowX) {
                frecords.css('margin-bottom', w2utils.scrollBarSize());
                scroll1.show();
            } else {
                frecords.css('margin-bottom', 0);
                scroll1.hide();
            }
            frecords.css({ overflow: 'hidden', top: records.css('top') });
            if (this.show.emptyRecords && !bodyOverflowY) {
                var max      = Math.floor(records.height() / this.recordHeight) - 1;
                var leftover = 0;
                if (records[0]) leftover = records[0].scrollHeight - max * this.recordHeight;
                if (leftover >= this.recordHeight) {
                    leftover -= this.recordHeight;
                    max++;
                }
                if (this.fixedBody) {
                    for (var di = buffered; di < max; di++) {
                        addEmptyRow(di, this.recordHeight, this);
                    }
                    addEmptyRow(max, leftover, this);
                }
            }

            function addEmptyRow(row, height, grid) {
                var html1 = '';
                var html2 = '';
                var htmlp = '';
                html1 += '<tr class="'+ (row % 2 ? 'w2ui-even' : 'w2ui-odd') + ' w2ui-empty-record" style="height: '+ height +'px">';
                html2 += '<tr class="'+ (row % 2 ? 'w2ui-even' : 'w2ui-odd') + ' w2ui-empty-record" style="height: '+ height +'px">';
                if (grid.show.lineNumbers)  html1 += '<td class="w2ui-col-number"></td>';
                if (grid.show.selectColumn) html1 += '<td class="w2ui-grid-data w2ui-col-select"></td>';
                if (grid.show.expandColumn) html1 += '<td class="w2ui-grid-data w2ui-col-expand"></td>';
                html2 += '<td class="w2ui-grid-data-spacer" col="start" style="border-right: 0"></td>';
                for (var j = 0; j < grid.columns.length; j++) {
                    var col = grid.columns[j];
                    if ((col.hidden || j < grid.last.colStart || j > grid.last.colEnd) && !col.frozen) continue;
                    htmlp = '<td class="w2ui-grid-data" '+ (col.attr != null ? col.attr : '') +' col="'+ j +'"></td>';
                    if (col.frozen) html1 += htmlp; else html2 += htmlp;
                }
                html1 += '<td class="w2ui-grid-data-last"></td> </tr>';
                html2 += '<td class="w2ui-grid-data-last" col="end"></td> </tr>';
                $('#grid_'+ grid.name +'_frecords > table').append(html1);
                $('#grid_'+ grid.name +'_records > table').append(html2);
            }
            if (body.length > 0) {
                var width_max = parseInt(body.width())
                    - (bodyOverflowY ? w2utils.scrollBarSize() : 0)
                    - (this.show.lineNumbers ? lineNumberWidth : 0)
                    - (this.show.selectColumn ? 26 : 0)
                    - (this.show.expandColumn ? 26 : 0)
                    - 1; // left is 1xp due to border width
                var width_box = width_max;
                var percent = 0;
                // gridMinWidth processiong
                var restart = false;
                for (var i = 0; i < this.columns.length; i++) {
                    var col = this.columns[i];
                    if (col.gridMinWidth > 0) {
                        if (col.gridMinWidth > width_box && col.hidden !== true) {
                            col.hidden = true;
                            restart = true;
                        }
                        if (col.gridMinWidth < width_box && col.hidden === true) {
                            col.hidden = false;
                            restart = true;
                        }
                    }
                }
                if (restart === true) {
                    this.refresh();
                    return;
                }
                // assign PX column s
                for (var i = 0; i < this.columns.length; i++) {
                    var col = this.columns[i];
                    if (col.hidden) continue;
                    if (String(col.size).substr(String(col.size).length-2).toLowerCase() == 'px') {
                        width_max -= parseFloat(col.size);
                        this.columns[i].sizeCalculated = col.size;
                        this.columns[i].sizeType = 'px';
                    } else {
                        percent += parseFloat(col.size);
                        this.columns[i].sizeType = '%';
                        delete col.sizeCorrected;
                    }
                }
                // if sum != 100% -- reassign proportionally
                if (percent != 100 && percent > 0) {
                    for (var i = 0; i < this.columns.length; i++) {
                        var col = this.columns[i];
                        if (col.hidden) continue;
                        if (col.sizeType == '%') {
                            col.sizeCorrected = Math.round(parseFloat(col.size) * 100 * 100 / percent) / 100 + '%';
                        }
                    }
                }
                // calculate % columns
                for (var i = 0; i < this.columns.length; i++) {
                    var col = this.columns[i];
                    if (col.hidden) continue;
                    if (col.sizeType == '%') {
                        if (this.columns[i].sizeCorrected != null) {
                            // make it 1px smaller, so margin of error can be calculated correctly
                            this.columns[i].sizeCalculated = Math.floor(width_max * parseFloat(col.sizeCorrected) / 100) - 1 + 'px';
                        } else {
                            // make it 1px smaller, so margin of error can be calculated correctly
                            this.columns[i].sizeCalculated = Math.floor(width_max * parseFloat(col.size) / 100) - 1 + 'px';
                        }
                    }
                }
            }
            // fix margin of error that is due percentage calculations
            var width_cols = 0;
            for (var i = 0; i < this.columns.length; i++) {
                var col = this.columns[i];
                if (col.hidden) continue;
                if (col.min == null) col.min = 20;
                if (parseInt(col.sizeCalculated) < parseInt(col.min)) col.sizeCalculated = col.min + 'px';
                if (parseInt(col.sizeCalculated) > parseInt(col.max)) col.sizeCalculated = col.max + 'px';
                width_cols += parseInt(col.sizeCalculated);
            }
            var width_diff = parseInt(width_box) - parseInt(width_cols);
            if (width_diff > 0 && percent > 0) {
                var i = 0;
                while (true) {
                    var col = this.columns[i];
                    if (col == null) { i = 0; continue; }
                    if (col.hidden || col.sizeType == 'px') { i++; continue; }
                    col.sizeCalculated = (parseInt(col.sizeCalculated) + 1) + 'px';
                    width_diff--;
                    if (width_diff === 0) break;
                    i++;
                }
            } else if (width_diff > 0) {
                columns.find('> table > tbody > tr:nth-child(1) td.w2ui-head-last').css('width', w2utils.scrollBarSize()).show();
            }

            // find width of frozen columns
            var fwidth = 1;
            if (this.show.lineNumbers)  fwidth += lineNumberWidth;
            if (this.show.selectColumn) fwidth += 26;
            if (this.show.expandColumn) fwidth += 26;
            for (var i = 0; i < this.columns.length; i++) {
                if (this.columns[i].hidden) continue;
                if (this.columns[i].frozen) fwidth += parseInt(this.columns[i].sizeCalculated);
            }
            fcolumns.css('width', fwidth);
            frecords.css('width', fwidth);
            fsummary.css('width', fwidth);
            scroll1.css('width', fwidth);
            columns.css('left', fwidth);
            records.css('left', fwidth);
            summary.css('left', fwidth);

            // resize columns
            columns.find('> table > tbody > tr:nth-child(1) td')
                .add(fcolumns.find('> table > tbody > tr:nth-child(1) td'))
                .each(function (index, el) {
                    // line numbers
                    if ($(el).hasClass('w2ui-col-number')) {
                        $(el).css('width', lineNumberWidth);
                    }
                    // records
                    var ind = $(el).attr('col');
                    if (ind != null) {
                        if (ind == 'start') {
                            var width = 0;
                            for (var i = 0; i < obj.last.colStart; i++) {
                                if (!obj.columns[i] || obj.columns[i].frozen || obj.columns[i].hidden) continue;
                                width += parseInt(obj.columns[i].sizeCalculated);
                            }
                            $(el).css('width', width + 'px');
                        }
                        if (obj.columns[ind]) $(el).css('width', obj.columns[ind].sizeCalculated);
                    }
                    // last column
                    if ($(el).hasClass('w2ui-head-last')) {
                        if (obj.last.colEnd + 1 < obj.columns.length) {
                            var width = 0;
                            for (var i = obj.last.colEnd + 1; i < obj.columns.length; i++) {
                                if (!obj.columns[i] || obj.columns[i].frozen || obj.columns[i].hidden) continue;
                                width += parseInt(obj.columns[i].sizeCalculated);
                            }
                            $(el).css('width', width + 'px');
                        } else {
                            $(el).css('width', w2utils.scrollBarSize() + (width_diff > 0 && percent === 0 ? width_diff : 0) + 'px');
                        }
                    }
                });
            // if there are column groups - hide first row (needed for sizing)
            if (columns.find('> table > tbody > tr').length == 3) {
                columns.find('> table > tbody > tr:nth-child(1) td')
                    .add(fcolumns.find('> table > tbody > tr:nth-child(1) td'))
                    .html('').css({
                        'height' : '0px',
                        'border' : '0px',
                        'padding': '0px',
                        'margin' : '0px'
                    });
            }
            // resize records
            records.find('> table > tbody > tr:nth-child(1) td')
                .add(frecords.find('> table > tbody > tr:nth-child(1) td'))
                .each(function (index, el) {
                    // line numbers
                    if ($(el).hasClass('w2ui-col-number')) {
                        $(el).css('width', lineNumberWidth);
                    }
                    // records
                    var ind = $(el).attr('col');
                    if (ind != null) {
                        if (ind == 'start') {
                            var width = 0;
                            for (var i = 0; i < obj.last.colStart; i++) {
                                if (!obj.columns[i] || obj.columns[i].frozen || obj.columns[i].hidden) continue;
                                width += parseInt(obj.columns[i].sizeCalculated);
                            }
                            $(el).css('width', width + 'px');
                        }
                        if (obj.columns[ind]) $(el).css('width', obj.columns[ind].sizeCalculated);
                    }
                    // last column
                    if ($(el).hasClass('w2ui-grid-data-last') && $(el).parents('.w2ui-grid-frecords').length === 0) { // not in frecords
                        if (obj.last.colEnd + 1 < obj.columns.length) {
                            var width = 0;
                            for (var i = obj.last.colEnd + 1; i < obj.columns.length; i++) {
                                if (!obj.columns[i] || obj.columns[i].frozen || obj.columns[i].hidden) continue;
                                width += parseInt(obj.columns[i].sizeCalculated);
                            }
                            $(el).css('width', width + 'px');
                        } else {
                            $(el).css('width', (width_diff > 0 && percent === 0 ? width_diff : 0) + 'px');
                        }
                    }
                });
            // resize summary
            summary.find('> table > tbody > tr:nth-child(1) td')
                .add(fsummary.find('> table > tbody > tr:nth-child(1) td'))
                .each(function (index, el) {
                    // line numbers
                    if ($(el).hasClass('w2ui-col-number')) {
                        $(el).css('width', lineNumberWidth);
                    }
                    // records
                    var ind = $(el).attr('col');
                    if (ind != null) {
                        if (ind == 'start') {
                            var width = 0;
                            for (var i = 0; i < obj.last.colStart; i++) {
                                if (!obj.columns[i] || obj.columns[i].frozen || obj.columns[i].hidden) continue;
                                width += parseInt(obj.columns[i].sizeCalculated);
                            }
                            $(el).css('width', width + 'px');
                        }
                        if (obj.columns[ind]) $(el).css('width', obj.columns[ind].sizeCalculated);
                    }
                    // last column
                    if ($(el).hasClass('w2ui-grid-data-last') && $(el).parents('.w2ui-grid-frecords').length === 0) { // not in frecords
                        $(el).css('width', w2utils.scrollBarSize() + (width_diff > 0 && percent === 0 ? width_diff : 0) + 'px');
                    }
                });
            this.initResize();
            this.refreshRanges();
            // apply last scroll if any
            if ((this.last.scrollTop || this.last.scrollLeft) && records.length > 0) {
                columns.prop('scrollLeft', this.last.scrollLeft);
                records.prop('scrollTop',  this.last.scrollTop);
                records.prop('scrollLeft', this.last.scrollLeft);
            }
        },

        getSearchesHTML: function () {
            var obj  = this;
            var html = '<table cellspacing="0" onclick="event.stopPropagation()"><tbody>';
            var showBtn = false;
            for (var i = 0; i < this.searches.length; i++) {
                var s = this.searches[i];
                s.type = String(s.type).toLowerCase();
                if (s.hidden) continue;
                var btn = '';
                if (showBtn == false) {
                    btn = '<button class="w2ui-btn close-btn" onclick="obj = w2ui[\''+ this.name +'\']; if (obj) obj.searchClose()">X</button>';
                    showBtn = true;
                }
                if (s.inTag   == null) s.inTag  = '';
                if (s.outTag  == null) s.outTag = '';
                if (s.style   == null) s.style = '';
                if (s.type    == null) s.type   = 'text';

                var operator =
                    '<select id="grid_'+ this.name +'_operator_'+ i +'" class="w2ui-input" onclick="event.stopPropagation();"' +
                    '   onchange="w2ui[\''+ this.name + '\'].initOperator(this, '+ i +')">' +
                        getOperators(s.type, s.operators) +
                    '</select>';

                html += '<tr>'+
                        '    <td class="close-btn">'+ btn +'</td>' +
                        '    <td class="caption">'+ (s.caption || '') +'</td>' +
                        '    <td class="operator">'+ operator +'</td>'+
                        '    <td class="value">';

                switch (s.type) {
                    case 'text':
                    case 'alphanumeric':
                    case 'hex':
                    case 'color':
                    case 'list':
                    case 'combo':
                    case 'enum':
                        var tmpStyle = 'width: 250px;';
                        if (['hex', 'color'].indexOf(s.type) != -1) tmpStyle = 'width: 90px;';
                        html += '<input rel="search" type="text" id="grid_'+ this.name +'_field_'+ i +'" name="'+ s.field +'" '+
                                '   class="w2ui-input" style="'+ tmpStyle + s.style +'" '+ s.inTag +'/>';
                        break;

                    case 'int':
                    case 'float':
                    case 'money':
                    case 'currency':
                    case 'percent':
                    case 'date':
                    case 'time':
                    case 'datetime':
                        var tmpStyle = 'width: 90px';
                        if (s.type == 'datetime') tmpStyle = 'width: 140px;';
                        html += '<input rel="search" type="text" class="w2ui-input" style="'+ tmpStyle + s.style +'" id="grid_'+ this.name +'_field_'+ i +'" name="'+ s.field +'" '+ s.inTag +'/>'+
                                '<span id="grid_'+ this.name +'_range_'+ i +'" style="display: none">&#160;-&#160;&#160;'+
                                '<input rel="search" type="text" class="w2ui-input" style="'+ tmpStyle + s.style +'" id="grid_'+ this.name +'_field2_'+ i +'" name="'+ s.field +'" '+ s.inTag +'/>'+
                                '</span>';
                        break;

                    case 'select':
                        html += '<select rel="search" class="w2ui-input" style="'+ s.style +'" id="grid_'+ this.name +'_field_'+ i +'" '+
                                ' name="'+ s.field +'" '+ s.inTag +'  onclick="event.stopPropagation();"></select>';
                        break;

                }
                html += s.outTag +
                        '    </td>' +
                        '</tr>';
            }
            html += '<tr>'+
                    '    <td colspan="4" class="actions">'+
                    '        <div>'+
                    '        <button class="w2ui-btn" onclick="obj = w2ui[\''+ this.name +'\']; if (obj) { obj.searchReset(); }">'+ w2utils.lang('Reset') + '</button>'+
                    '        <button class="w2ui-btn w2ui-btn-blue" onclick="obj = w2ui[\''+ this.name +'\']; if (obj) { obj.search(); }">'+ w2utils.lang('Search') + '</button>'+
                    '        </div>'+
                    '    </td>'+
                    '</tr></tbody></table>';
            return html;

            function getOperators(type, fieldOperators) {
                var html = '';
                var operators = obj.operators[obj.operatorsMap[type]];
                if (fieldOperators != null) operators = fieldOperators;
                for (var i = 0; i < operators.length; i++) {
                    var oper = operators[i];
                    var text = oper;
                    if (Array.isArray(oper)) {
                        text = oper[1];
                        oper = oper[0];
                        if (text == null) text = oper;
                    } else if ($.isPlainObject(oper)) {
                        text = oper.text;
                        oper = oper.oper;
                    }
                    html += '<option value="'+ oper +'">'+ w2utils.lang(text) +'</option>\n';
                }
                return html;
            }
        },

        initOperator: function (el, search_ind) {
            var obj     = this;
            var search  = obj.searches[search_ind];
            var range   = $('#grid_'+ obj.name + '_range_'+ search_ind);
            var fld1    = $('#grid_'+ obj.name +'_field_'+ search_ind);
            var fld2    = fld1.parent().find('span input');
            fld1.show();
            range.hide();
            // fld1.w2field(search.type);
            switch ($(el).val()) {
//                case 'in':
//                case 'not in':
//                    fld1.w2field('clear');
//                    break;
                case 'between':
                    range.show();
                    fld2.w2field(search.type, search.options);
                    break;
                case 'not null':
                case 'null':
                    fld1.hide();
                    fld1.val('1'); // need to insert something for search to activate
                    fld1.change();
                    break;
            }
        },

        initSearches: function () {
            var obj = this;
            // init searches
            for (var s = 0; s < this.searches.length; s++) {
                var search    = this.searches[s];
                var sdata     = this.getSearchData(search.field);
                search.type   = String(search.type).toLowerCase();
                var operators = obj.operators[obj.operatorsMap[search.type]];
                if (search.operators) operators = search.operators;
                var operator  = operators[0]; // default operator
                if ($.isPlainObject(operator)) operator = operator.oper;
                if (typeof search.options != 'object') search.options = {};
                if (search.type == 'text') operator = 'begins'; // default operator for text
                // only accept search.operator if it is valid
                for (var i = 0; i < operators.length; i++) {
                    var oper = operators[i];
                    if ($.isPlainObject(oper)) oper = oper.oper;
                    if (search.operator == oper) {
                        operator = search.operator;
                        break;
                    }
                }
                // init types
                switch (search.type) {
                    case 'text':
                    case 'alphanumeric':
                        $('#grid_'+ this.name +'_field_' + s).w2field(search.type, search.options);
                        break;

                    case 'int':
                    case 'float':
                    case 'hex':
                    case 'color':
                    case 'money':
                    case 'currency':
                    case 'percent':
                    case 'date':
                    case 'time':
                    case 'datetime':
                        $('#grid_'+ this.name +'_field_'+s).w2field(search.type, search.options);
                        $('#grid_'+ this.name +'_field2_'+s).w2field(search.type, search.options);
                        setTimeout(function () { // convert to date if it is number
                            $('#grid_'+ obj.name +'_field_'+s).keydown();
                            $('#grid_'+ obj.name +'_field2_'+s).keydown();
                        }, 1);
                        break;

                    case 'list':
                    case 'combo':
                    case 'enum':
                        var options = search.options;
                        if (search.type == 'list') options.selected = {};
                        if (search.type == 'enum') options.selected = [];
                        if (sdata) options.selected = sdata.value;
                        $('#grid_'+ this.name +'_field_'+s).w2field(search.type, $.extend({ openOnFocus: true }, options));
                        if (sdata && sdata.text != null) $('#grid_'+ this.name +'_field_'+s).data('selected', {id: sdata.value, text: sdata.text});
                        break;

                    case 'select':
                        // build options
                        var options = '<option value="">--</option>';
                        for (var i = 0; i < search.options.items.length; i++) {
                            var si = search.options.items[i];
                            if ($.isPlainObject(search.options.items[i])) {
                                var val = si.id;
                                var txt = si.text;
                                if (val == null && si.value != null)   val = si.value;
                                if (txt == null && si.caption != null) txt = si.caption;
                                if (val == null) val = '';
                                options += '<option value="'+ val +'">'+ txt +'</option>';
                            } else {
                                options += '<option value="'+ si +'">'+ si +'</option>';
                            }
                        }
                        $('#grid_'+ this.name +'_field_'+s).html(options);
                        break;
                }
                if (sdata != null) {
                    if (sdata.type == 'int' && ['in', 'not in'].indexOf(sdata.operator) != -1) {
                        $('#grid_'+ this.name +'_field_'+ s).w2field('clear').val(sdata.value);
                    }
                    $('#grid_'+ this.name +'_operator_'+ s).val(sdata.operator).trigger('change');
                    if (!$.isArray(sdata.value)) {
                        if (sdata.value != null) $('#grid_'+ this.name +'_field_'+ s).val(sdata.value).trigger('change');
                    } else {
                        if (['in', 'not in'].indexOf(sdata.operator) != -1) {
                            $('#grid_'+ this.name +'_field_'+ s).val(sdata.value).trigger('change');
                        } else {
                            $('#grid_'+ this.name +'_field_'+ s).val(sdata.value[0]).trigger('change');
                            $('#grid_'+ this.name +'_field2_'+ s).val(sdata.value[1]).trigger('change');
                        }
                    }
                } else {
                    $('#grid_'+ this.name +'_operator_'+s).val(operator).trigger('change');
                }
            }
            // add on change event
            $('#w2ui-overlay-'+ this.name +'-searchOverlay .w2ui-grid-searches *[rel=search]').on('keypress', function (evnt) {
                if (evnt.keyCode == 13) {
                    obj.search();
                    $().w2overlay({ name: obj.name + '-searchOverlay' });
                }
            });
        },

        getColumnsHTML: function () {
            var obj  = this;
            var html1 = '';
            var html2 = '';
            if (this.show.columnHeaders) {
                if (this.columnGroups.length > 0) {
                    var tmp1 = getColumns(true);
                    var tmp2 = getGroups();
                    var tmp3 = getColumns(false);
                    html1 = tmp1[0] + tmp2[0] + tmp3[0];
                    html2 = tmp1[1] + tmp2[1] + tmp3[1];
                } else {
                    var tmp = getColumns(true);
                    html1 = tmp[0];
                    html2 = tmp[1];
                }
            }
            return [html1, html2];

            function getGroups () {
                var html1 = '<tr>';
                var html2 = '<tr>';
                var tmpf  = '';
                // add empty group at the end
                if (obj.columnGroups[obj.columnGroups.length-1].caption != '') obj.columnGroups.push({ caption: '' });

                if (obj.show.lineNumbers) {
                    html1 += '<td class="w2ui-head w2ui-col-number">'+
                            '    <div style="height: '+ (obj.recordHeight+1) +'px">&#160;</div>'+
                            '</td>';
                }
                if (obj.show.selectColumn) {
                    html1 += '<td class="w2ui-head w2ui-col-select">'+
                            '    <div style="height: 25px">&#160;</div>'+
                            '</td>';
                }
                if (obj.show.expandColumn) {
                    html1 += '<td class="w2ui-head w2ui-col-expand">'+
                            '    <div style="height: 25px">&#160;</div>'+
                            '</td>';
                }
                var ii = 0;
                html2 += '<td id="grid_'+ obj.name + '_column_start" class="w2ui-head" col="start" style="border-right: 0"></td>';
                for (var i=0; i<obj.columnGroups.length; i++) {
                    var colg = obj.columnGroups[i];
                    var col  = obj.columns[ii];
                    if (colg.colspan != null) colg.span = colg.colspan;
                    if (colg.span == null || colg.span != parseInt(colg.span)) colg.span = 1;
                    var colspan = 0;
                    for (var jj = ii; jj < ii + colg.span; jj++) {
                        if (obj.columns[jj] && !obj.columns[jj].hidden)
                            colspan++;
                    }
                    if (i == obj.columnGroups.length-1)
                        colspan++;      // XXX
                    if (colspan <= 0) {
                        // do nothing here, all columns in the group are hidden.
                    } else if (colg.master === true) {
                        var sortStyle = '';
                        for (var si = 0; si < obj.sortData.length; si++) {
                            if (obj.sortData[si].field == col.field) {
                                if (new RegExp('asc', 'i').test(obj.sortData[si].direction))  sortStyle = 'w2ui-sort-up';
                                if (new RegExp('desc', 'i').test(obj.sortData[si].direction)) sortStyle = 'w2ui-sort-down';
                            }
                        }
                        var resizer = "";
                        if (col.resizable !== false) {
                            resizer = '<div class="w2ui-resizer" name="'+ ii +'"></div>';
                        }
                        tmpf = '<td id="grid_'+ obj.name + '_column_' + ii +'" class="w2ui-head '+ sortStyle +'" col="'+ ii + '" '+
                               '    rowspan="2" colspan="'+ colspan +'" '+
                               '    oncontextmenu = "w2ui[\''+ obj.name +'\'].contextMenu(null, '+ ii +', event);"'+
                               '    onclick="w2ui[\''+ obj.name +'\'].columnClick(\''+ col.field +'\', event);"'+
                               '    ondblclick="w2ui[\''+ obj.name +'\'].columnDblClick(\''+ col.field +'\', event);">'+
                                   resizer +
                               '    <div class="w2ui-col-group w2ui-col-header '+ (sortStyle ? 'w2ui-col-sorted' : '') +'">'+
                               '        <div class="'+ sortStyle +'"></div>'+
                                       (!col.caption ? '&#160;' : col.caption) +
                               '    </div>'+
                               '</td>';
                        if (col && col.frozen) html1 += tmpf; else html2 += tmpf;
                    } else {
                        tmpf = '<td id="grid_'+ obj.name + '_column_' + ii +'" class="w2ui-head" col="'+ ii + '" '+
                               '        colspan="'+ colspan +'">'+
                               '    <div class="w2ui-col-group">'+
                                   (!colg.caption ? '&#160;' : colg.caption) +
                               '    </div>'+
                               '</td>';
                        if (col && col.frozen) html1 += tmpf; else html2 += tmpf;
                    }
                    ii += colg.span;
                }
                html1 += '<td></td></tr>'; // need empty column for border-right
                html2 += '<td id="grid_'+ obj.name + '_column_end" class="w2ui-head" col="end"></td></tr>';
                return [html1, html2];
            }

            function getColumns (master) {
                var html1 = '<tr>';
                var html2 = '<tr>';
                if (obj.show.lineNumbers) {
                    html1 += '<td class="w2ui-head w2ui-col-number" '+
                            '       onclick="w2ui[\''+ obj.name +'\'].columnClick(\'line-number\', event);"'+
                            '       ondblclick="w2ui[\''+ obj.name +'\'].columnDblClick(\'line-number\', event);">'+
                            '    <div>#</div>'+
                            '</td>';
                }
                if (obj.show.selectColumn) {
                    html1 += '<td class="w2ui-head w2ui-col-select"'+
                            '       onclick="if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true;">'+
                            '    <div>'+
                            '        <input type="checkbox" id="grid_'+ obj.name +'_check_all" tabindex="-1"'+
                            '            style="' + (obj.multiSelect == false ? 'display: none;' : '') + '"'+
                            '            onmousedown="if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true;"'+
                            '            onclick="var grid = w2ui[\''+ obj.name +'\'];'+
                            '               if (this.checked) grid.selectAll(); else grid.selectNone();'+
                            '               if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true;'+
                            '               clearTimeout(grid.last.kbd_timer); /* keep focus */' +
                            '            "/>'+
                            '    </div>'+
                            '</td>';
                }
                if (obj.show.expandColumn) {
                    html1 += '<td class="w2ui-head w2ui-col-expand">'+
                            '    <div>&#160;</div>'+
                            '</td>';
                }
                var ii = 0;
                var id = 0;
                var colg;
                html2 += '<td id="grid_'+ obj.name + '_column_start" class="w2ui-head" col="start" style="border-right: 0"></td>';
                for (var i = 0; i < obj.columns.length; i++) {
                    var col  = obj.columns[i];
                    if (i == id) {      // always true on first iteration
                        colg = obj.columnGroups[ii++] || {};
                        id = id + colg.span;
                    }
                    if ((i < obj.last.colStart || i > obj.last.colEnd) && !col.frozen)
                        continue;
                    if (col.hidden)
                        continue;
                    if (colg.master !== true || master) { // grouping of columns
                        var colCellHTML = obj.getColumnCellHTML(i);
                        if (col && col.frozen) html1 += colCellHTML; else html2 += colCellHTML;
                    }
                }
                html1 += '<td class="w2ui-head w2ui-head-last"><div>&#160;</div></td>';
                html2 += '<td class="w2ui-head w2ui-head-last" col="end"><div>&#160;</div></td>';
                html1 += '</tr>';
                html2 += '</tr>';
                return [html1, html2];
            }
        },

        getColumnCellHTML: function (i) {
            var col = this.columns[i];
            if (col == null) return '';
            // reorder style
            var reorderCols = (this.reorderColumns && (!this.columnGroups || !this.columnGroups.length)) ? ' w2ui-reorder-cols-head ' : '';
            // sort style
            var sortStyle = '';
            for (var si = 0; si < this.sortData.length; si++) {
                if (this.sortData[si].field == col.field) {
                    if (new RegExp('asc', 'i').test(this.sortData[si].direction))  sortStyle = 'w2ui-sort-up';
                    if (new RegExp('desc', 'i').test(this.sortData[si].direction)) sortStyle = 'w2ui-sort-down';
                }
            }
            // col selected
            var tmp = this.last.selection.columns;
            var selected = false;
            for (var t in tmp) {
                for (var si = 0; si < tmp[t].length; si++) {
                    if (tmp[t][si] == i) selected = true;
                }
            }
            var html = '<td id="grid_'+ this.name + '_column_' + i +'" col="'+ i +'" class="w2ui-head '+ sortStyle + reorderCols + '" ' +
                             (this.columnTooltip == 'normal' && col.tooltip ? 'title="'+ col.tooltip +'" ' : '') +
                        '    onmouseover = "w2ui[\''+ this.name +'\'].columnTooltipShow(\''+ i +'\', event);"'+
                        '    onmouseout  = "w2ui[\''+ this.name +'\'].columnTooltipHide(\''+ i +'\', event);"'+
                        '    oncontextmenu = "w2ui[\''+ this.name +'\'].contextMenu(null, '+ i +', event);"'+
                        '    onclick="w2ui[\''+ this.name +'\'].columnClick(\''+ col.field +'\', event);"'+
                        '    ondblclick="w2ui[\''+ this.name +'\'].columnDblClick(\''+ col.field +'\', event);">'+
                             (col.resizable !== false ? '<div class="w2ui-resizer" name="'+ i +'"></div>' : '') +
                        '    <div class="w2ui-col-header '+ (sortStyle ? 'w2ui-col-sorted' : '') +' '+ (selected ? 'w2ui-col-selected' : '') +'">'+
                        '        <div class="'+ sortStyle +'"></div>'+
                                (!col.caption ? '&#160;' : col.caption) +
                        '    </div>'+
                        '</td>';

            return html
        },

        columnTooltipShow: function (ind) {
            if (this.columnTooltip == 'normal') return;
            var $el  = $(this.box).find('#grid_'+ this.name + '_column_'+ ind);
            var item = this.columns[ind];
            var pos  = this.columnTooltip;
            $el.prop('_mouse_over', true);
            setTimeout(function () {
                if ($el.prop('_mouse_over') === true && $el.prop('_mouse_tooltip') !== true) {
                    $el.prop('_mouse_tooltip', true);
                    // show tooltip
                    $el.w2tag(item.tooltip, { position: pos });
                }
            }, 1);
        },

        columnTooltipHide: function (ind) {
            if (this.columnTooltip == 'normal') return;
            var $el  = $(this.box).find('#grid_'+ this.name + '_column_'+ ind);
            var item = this.columns[ind];
            $el.removeProp('_mouse_over');
            setTimeout(function () {
                if ($el.prop('_mouse_over') !== true && $el.prop('_mouse_tooltip') === true) {
                    $el.removeProp('_mouse_tooltip');
                    // hide tooltip
                    $el.w2tag();
                }
            }, 1);
        },

        getRecordsHTML: function () {
            var buffered = this.records.length;
            var url = (typeof this.url != 'object' ? this.url : this.url.get);
            if (this.searchData.length != 0 && !url) buffered = this.last.searchIds.length;
            // larger number works better with chrome, smaller with FF.
            if (buffered > this.vs_start) this.last.show_extra = this.vs_extra; else this.last.show_extra = this.vs_start;
            var records  = $('#grid_'+ this.name +'_records');
            var limit    = Math.floor(records.height() / this.recordHeight) + this.last.show_extra + 1;
            if (!this.fixedBody || limit > buffered) limit = buffered;
            // always need first record for resizing purposes
            var rec_html = this.getRecordHTML(-1, 0);
            var html1 = '<table><tbody>' + rec_html[0];
            var html2 = '<table><tbody>' + rec_html[1];
            // first empty row with height
            html1 += '<tr id="grid_'+ this.name + '_frec_top" line="top" style="height: '+ 0 +'px">'+
                     '    <td colspan="2000"></td>'+
                     '</tr>';
            html2 += '<tr id="grid_'+ this.name + '_rec_top" line="top" style="height: '+ 0 +'px">'+
                     '    <td colspan="2000"></td>'+
                     '</tr>';
            for (var i = 0; i < limit; i++) {
                rec_html = this.getRecordHTML(i, i+1);
                html1 += rec_html[0];
                html2 += rec_html[1];
            }
            html1 += '<tr id="grid_'+ this.name + '_frec_bottom" line="bottom" style="height: '+ ((buffered - limit) * this.recordHeight) +'px">'+
                    '    <td colspan="2000" style="border: 0"></td>'+
                    '</tr>'+
                    '<tr id="grid_'+ this.name +'_frec_more" style="display: none; visibility: hidden">'+
                    '    <td colspan="2000" class="w2ui-load-more"></td>'+
                    '</tr>'+
                    '</tbody></table>';
            html2 += '<tr id="grid_'+ this.name + '_rec_bottom" line="bottom" style="height: '+ ((buffered - limit) * this.recordHeight) +'px">'+
                    '    <td colspan="2000" style="border: 0"></td>'+
                    '</tr>'+
                    '<tr id="grid_'+ this.name +'_rec_more" style="display: none">'+
                    '    <td colspan="2000" class="w2ui-load-more"></td>'+
                    '</tr>'+
                    '</tbody></table>';
            this.last.range_start = 0;
            this.last.range_end   = limit;
            return [html1, html2];
        },

        getSummaryHTML: function () {
            if (this.summary.length === 0) return;
            var rec_html = this.getRecordHTML(-1, 0); // need this in summary too for colspan to work properly
            var html1 = '<table><tbody>' + rec_html[0];
            var html2 = '<table><tbody>' + rec_html[1];
            for (var i = 0; i < this.summary.length; i++) {
                rec_html = this.getRecordHTML(i, i+1, true);
                html1 += rec_html[0];
                html2 += rec_html[1];
            }
            html1 += '</tbody></table>';
            html2 += '</tbody></table>';
            return [html1, html2];
        },

        scroll: function (event) {
            var time = (new Date()).getTime();
            var obj  = this;
            var url  = (typeof this.url != 'object' ? this.url : this.url.get);
            var records  = $('#grid_'+ this.name +'_records');
            var frecords = $('#grid_'+ this.name +'_frecords');
            // sync scroll positions
            if (event) {
                var sTop  = event.target.scrollTop;
                var sLeft = event.target.scrollLeft;
                obj.last.scrollTop  = sTop;
                obj.last.scrollLeft = sLeft;
                $('#grid_'+ obj.name +'_columns')[0].scrollLeft = sLeft;
                $('#grid_'+ obj.name +'_summary')[0].scrollLeft = sLeft;
                frecords[0].scrollTop = sTop;
            }
            // hide bubble
            if (this.last.bubbleEl) {
                $(this.last.bubbleEl).w2tag();
                this.last.bubbleEl = null;
            }
            // column virtual scroll
            var colStart = null;
            var colEnd   = null;
            if (obj.disableCVS || obj.columnGroups.length > 0) {
                // disable virtual scroll
                colStart = 0;
                colEnd = obj.columns.length - 1;
            } else {
                var sWidth = records.width();
                var cLeft  = 0;
                for (var i = 0; i < obj.columns.length; i++) {
                    if (obj.columns[i].frozen || obj.columns[i].hidden) continue;
                    var cSize = parseInt(obj.columns[i].sizeCalculated ? obj.columns[i].sizeCalculated : obj.columns[i].size);
                    if (cLeft + cSize + 30 > obj.last.scrollLeft && colStart == null) colStart = i;
                    if (cLeft + cSize - 30 > obj.last.scrollLeft + sWidth && colEnd == null) colEnd = i;
                    cLeft += cSize;
                }
                if (colEnd == null) colEnd = obj.columns.length - 1;
            }
            if (colStart != null) {
                if (colStart < 0) colStart = 0;
                if (colEnd < 0) colEnd = 0;
                if (colStart == colEnd) {
                    if (colStart > 0) colStart--; else colEnd++; // show at least one column
                }
                // ---------
                if (colStart != obj.last.colStart || colEnd != obj.last.colEnd) {
                    var $box = $(obj.box);
                    var deltaStart = Math.abs(colStart - obj.last.colStart);
                    var deltaEnd   = Math.abs(colEnd - obj.last.colEnd)
                    // add/remove columns for small jumps
                    if (deltaStart < 5 && deltaEnd < 5) {
                        var $cfirst = $box.find('.w2ui-grid-columns #grid_'+ obj.name +'_column_start');
                        var $clast  = $box.find('.w2ui-grid-columns .w2ui-head-last');
                        var $rfirst = $box.find('#grid_'+ obj.name +'_records .w2ui-grid-data-spacer');
                        var $rlast  = $box.find('#grid_'+ obj.name +'_records .w2ui-grid-data-last');
                        var $sfirst = $box.find('#grid_'+ obj.name +'_summary .w2ui-grid-data-spacer');
                        var $slast  = $box.find('#grid_'+ obj.name +'_summary .w2ui-grid-data-last');
                        // remove on left
                        if (colStart > obj.last.colStart) {
                            for (var i = obj.last.colStart; i < colStart; i++) {
                                $box.find('#grid_'+ obj.name +'_columns #grid_'+ obj.name +'_column_'+ i).remove(); // column
                                $box.find('#grid_'+ obj.name +'_records td[col="'+ i +'"]').remove(); // record
                                $box.find('#grid_'+ obj.name +'_summary td[col="'+ i +'"]').remove(); // summary
                            }
                        }
                        // remove on right
                        if (colEnd < obj.last.colEnd) {
                            for (var i = obj.last.colEnd; i > colEnd; i--) {
                                $box.find('#grid_'+ obj.name +'_columns #grid_'+ obj.name +'_column_'+ i).remove(); // column
                                $box.find('#grid_'+ obj.name +'_records td[col="'+ i +'"]').remove(); // record
                                $box.find('#grid_'+ obj.name +'_summary td[col="'+ i +'"]').remove(); // summary
                            }
                        }
                        // add on left
                        if (colStart < obj.last.colStart) {
                            for (var i = obj.last.colStart - 1; i >= colStart; i--) {
                                if (obj.columns[i] && (obj.columns[i].frozen || obj.columns[i].hidden)) continue;
                                $cfirst.after(obj.getColumnCellHTML(i)); // column
                                // record
                                $rfirst.each(function (ind, el) {
                                    var index = $(el).parent().attr('index');
                                    var td    = '<td class="w2ui-grid-data" col="'+ i +'" style="height: 0px"></td>'; // width column
                                    if (index != null) td = obj.getCellHTML(parseInt(index), i, false);
                                    $(el).after(td);
                                });
                                // summary
                                $sfirst.each(function (ind, el) {
                                    var index = $(el).parent().attr('index');
                                    var td    = '<td class="w2ui-grid-data" col="'+ i +'" style="height: 0px"></td>'; // width column
                                    if (index != null) td = obj.getCellHTML(parseInt(index), i, true);
                                    $(el).after(td);
                                });
                            }
                        }
                        // add on right
                        if (colEnd > obj.last.colEnd) {
                            for (var i = obj.last.colEnd + 1; i <= colEnd; i++) {
                                if (obj.columns[i] && (obj.columns[i].frozen || obj.columns[i].hidden)) continue;
                                $clast.before(obj.getColumnCellHTML(i)); // column
                                // record
                                $rlast.each(function (ind, el) {
                                    var index = $(el).parent().attr('index');
                                    var td    = '<td class="w2ui-grid-data" col="'+ i +'" style="height: 0px"></td>'; // width column
                                    if (index != null) td = obj.getCellHTML(parseInt(index), i, false);
                                    $(el).before(td);
                                });
                                // summary
                                $slast.each(function (ind, el) {
                                    var index = $(el).parent().attr('index');
                                    var td = obj.getCellHTML(parseInt(index), i, true);
                                    $(el).before(td);
                                });
                            }
                        }
                        obj.last.colStart = colStart;
                        obj.last.colEnd   = colEnd;
                        obj.resizeRecords();
                    } else {
                        obj.last.colStart = colStart;
                        obj.last.colEnd   = colEnd;
                        // dot not just call obj.refresh();
                        var colHTML   = this.getColumnsHTML();
                        var recHTML   = this.getRecordsHTML();
                        var sumHTML   = this.getSummaryHTML();
                        var $columns  = $box.find('#grid_'+ this.name +'_columns');
                        var $records  = $box.find('#grid_'+ this.name +'_records');
                        var $frecords = $box.find('#grid_'+ this.name +'_frecords');
                        var $summary  = $box.find('#grid_'+ this.name +'_summary');
                        $columns.find('tbody').html(colHTML[1]);
                        $frecords.html(recHTML[0]);
                        $records.prepend(recHTML[1]);
                        if (sumHTML != null) $summary.html(sumHTML[1]);
                        // need timeout to clean up (otherwise scroll problem)
                        setTimeout(function () {
                            $records.find('> table').not('table:first-child').remove();
                            if ($summary[0]) $summary[0].scrollLeft = obj.last.scrollLeft;
                        }, 1);
                        obj.resizeRecords();
                    }
                }
            }
            // perform virtual scroll
            var buffered = this.records.length;
            if (this.searchData.length != 0 && !url) buffered = this.last.searchIds.length;
            if (buffered === 0 || records.length === 0 || records.height() === 0) return;
            if (buffered > this.vs_start) this.last.show_extra = this.vs_extra; else this.last.show_extra = this.vs_start;
            // need this to enable scrolling when this.limit < then a screen can fit
            if (records.height() < buffered * this.recordHeight && records.css('overflow-y') == 'hidden') {
                // TODO: is this needed?
                // if (this.total > 0) this.refresh();
                return;
            }
            // update footer
            var t1 = Math.round(records[0].scrollTop / this.recordHeight + 1);
            var t2 = t1 + (Math.round(records.height() / this.recordHeight) - 1);
            if (t1 > buffered) t1 = buffered;
            if (t2 >= buffered - 1) t2 = buffered;
            $('#grid_'+ this.name + '_footer .w2ui-footer-right').html(
                (obj.show.statusRange ? w2utils.formatNumber(this.offset + t1) + '-' + w2utils.formatNumber(this.offset + t2) +
                        (this.total != -1 ? ' ' + w2utils.lang('of') + ' ' +    w2utils.formatNumber(this.total) : '') : '') +
                (url && obj.show.statusBuffered ? ' ('+ w2utils.lang('buffered') + ' '+ w2utils.formatNumber(buffered) +
                        (this.offset > 0 ? ', skip ' + w2utils.formatNumber(this.offset) : '') + ')' : '')
            );
            // only for local data source, else no extra records loaded
            if (!url && (!this.fixedBody || (this.total != -1 && this.total <= this.vs_start))) return;
            // regular processing
            var start   = Math.floor(records[0].scrollTop / this.recordHeight) - this.last.show_extra;
            var end     = start + Math.floor(records.height() / this.recordHeight) + this.last.show_extra * 2 + 1;
            // var div  = start - this.last.range_start;
            if (start < 1) start = 1;
            if (end > this.total && this.total != -1) end = this.total;
            var tr1  = records.find('#grid_'+ this.name +'_rec_top');
            var tr2  = records.find('#grid_'+ this.name +'_rec_bottom');
            var tr1f = frecords.find('#grid_'+ this.name +'_frec_top');
            var tr2f = frecords.find('#grid_'+ this.name +'_frec_bottom');
            // if row is expanded
            if (String(tr1.next().prop('id')).indexOf('_expanded_row') != -1) {
                tr1.next().remove();
                tr1f.next().remove();
            }
            if (this.total > end && String(tr2.prev().prop('id')).indexOf('_expanded_row') != -1) {
                tr2.prev().remove();
                tr2f.prev().remove();
            }
            var first = parseInt(tr1.next().attr('line'));
            var last  = parseInt(tr2.prev().attr('line'));
            //$('#log').html('buffer: '+ this.buffered +' start-end: ' + start + '-'+ end + ' ===> first-last: ' + first + '-' + last);
            if (first < start || first == 1 || this.last.pull_refresh) { // scroll down
                if (end <= last + this.last.show_extra - 2 && end != this.total) return;
                this.last.pull_refresh = false;
                // remove from top
                while (true) {
                    var tmp1 = frecords.find('#grid_'+ this.name +'_frec_top').next();
                    var tmp2 = records.find('#grid_'+ this.name +'_rec_top').next();
                    if (tmp2.attr('line') == 'bottom') break;
                    if (parseInt(tmp2.attr('line')) < start) { tmp1.remove(); tmp2.remove(); } else break;
                }
                // add at bottom
                var tmp = records.find('#grid_'+ this.name +'_rec_bottom').prev();
                var rec_start = tmp.attr('line');
                if (rec_start == 'top') rec_start = start;
                for (var i = parseInt(rec_start) + 1; i <= end; i++) {
                    if (!this.records[i-1]) continue;
                    var tmp2 = this.records[i-1].w2ui;
                    if (tmp2 && !Array.isArray(tmp2.children)) {
                        tmp2.expanded = false;
                    }
                    var rec_html = this.getRecordHTML(i-1, i);
                    tr2.before(rec_html[1]);
                    tr2f.before(rec_html[0]);
                }
                markSearch();
                setTimeout(function() { obj.refreshRanges(); }, 0);
            } else { // scroll up
                if (start >= first - this.last.show_extra + 2 && start > 1) return;
                // remove from bottom
                while (true) {
                    var tmp1 = frecords.find('#grid_'+ this.name +'_frec_bottom').prev();
                    var tmp2 = records.find('#grid_'+ this.name +'_rec_bottom').prev();
                    if (tmp2.attr('line') == 'top') break;
                    if (parseInt(tmp2.attr('line')) > end) { tmp1.remove(); tmp2.remove(); } else break;
                }
                // add at top
                var tmp = records.find('#grid_'+ this.name +'_rec_top').next();
                var rec_start = tmp.attr('line');
                if (rec_start == 'bottom') rec_start = end;
                for (var i = parseInt(rec_start) - 1; i >= start; i--) {
                    if (!this.records[i-1]) continue;
                    var tmp2 = this.records[i-1].w2ui;
                    if (tmp2 && !Array.isArray(tmp2.children)) {
                        tmp2.expanded = false;
                    }
                    var rec_html = this.getRecordHTML(i-1, i);
                    tr1.after(rec_html[1]);
                    tr1f.after(rec_html[0]);
                }
                markSearch();
                setTimeout(function() { obj.refreshRanges(); }, 0);
            }
            // first/last row size
            var h1 = (start - 1) * obj.recordHeight;
            var h2 = (buffered - end) * obj.recordHeight;
            if (h2 < 0) h2 = 0;
            tr1.css('height', h1 + 'px');
            tr1f.css('height', h1 + 'px');
            tr2.css('height', h2 + 'px');
            tr2f.css('height', h2 + 'px');
            obj.last.range_start = start;
            obj.last.range_end   = end;
            // load more if needed
            var s = Math.floor(records[0].scrollTop / this.recordHeight);
            var e = s + Math.floor(records.height() / this.recordHeight);
            if (e + 10 > buffered && this.last.pull_more !== true && (buffered < this.total - this.offset || (this.total == -1 && this.last.xhr_hasMore))) {
                if (this.autoLoad === true) {
                    this.last.pull_more = true;
                    this.last.xhr_offset += this.limit;
                    this.request('get');
                } else {
                    var more = $('#grid_'+ this.name +'_rec_more, #grid_'+ this.name +'_frec_more');
                    if (more.css('display') == 'none') {
                        more.show()
                            .on('click', function () {
                                obj.last.pull_more = true;
                                obj.last.xhr_offset += obj.limit;
                                obj.request('get');
                                // show spinner the last
                                $(this).find('td').html('<div><div style="width: 20px; height: 20px;" class="w2ui-spinner"></div></div>');
                            });
                    }
                    if (more.find('td .w2ui-spinner').length > 0 || more.find('td').text().indexOf('Load') == -1) {
                        more.find('td').html('<div>'+ w2utils.lang('Load') + ' ' + obj.limit + ' ' + w2utils.lang('More') + '...</div>');
                    }
                }
            }
            // check for grid end
            if (buffered >= this.total - this.offset && this.total != -1) $('#grid_'+ this.name +'_rec_more, #grid_'+ this.name +'_frec_more').hide();

            function markSearch() {
                // mark search
                if (!obj.markSearch) return;
                clearTimeout(obj.last.marker_timer);
                obj.last.marker_timer = setTimeout(function () {
                    // mark all search strings
                    var str = [];
                    for (var s = 0; s < obj.searchData.length; s++) {
                        var sdata = obj.searchData[s];
                        var fld = obj.getSearch(sdata.field);
                        if (!fld || fld.hidden) continue;
                        if (str.indexOf(sdata.value) == -1) str.push(sdata.value);
                    }
                    if (str.length > 0) $(obj.box).find('.w2ui-grid-data > div').w2marker(str);
                }, 50);
            }
        },

        getRecordHTML: function (ind, lineNum, summary) {
            var tmph = '';
            var rec_html1 = '';
            var rec_html2 = '';
            var sel = this.last.selection;
            var record;
            // first record needs for resize purposes
            if (ind == -1) {
                rec_html1 += '<tr line="0">';
                rec_html2 += '<tr line="0">';
                if (this.show.lineNumbers)  rec_html1 += '<td class="w2ui-col-number" style="height: 0px;"></td>';
                if (this.show.selectColumn) rec_html1 += '<td class="w2ui-col-select" style="height: 0px;"></td>';
                if (this.show.expandColumn) rec_html1 += '<td class="w2ui-col-expand" style="height: 0px;"></td>';
                rec_html2 += '<td class="w2ui-grid-data w2ui-grid-data-spacer" col="start" style="height: 0px; width: 0px;"></td>';
                for (var i = 0; i < this.columns.length; i++) {
                    var col = this.columns[i];
                    tmph = '<td class="w2ui-grid-data" col="'+ i +'" style="height: 0px;"></td>';
                    if (col.frozen && !col.hidden) {
                        rec_html1 += tmph;
                    } else {
                        if (col.hidden || i < this.last.colStart || i > this.last.colEnd) continue;
                        rec_html2 += tmph;
                    }
                }
                rec_html1 += '<td class="w2ui-grid-data-last" style="height: 0px"></td>';
                rec_html2 += '<td class="w2ui-grid-data-last" col="end" style="height: 0px"></td>';
                rec_html1 += '</tr>';
                rec_html2 += '</tr>';
                return [rec_html1, rec_html2];
            }
            // regular record
            var url = (typeof this.url != 'object' ? this.url : this.url.get);
            if (summary !== true) {
                if (this.searchData.length > 0 && !url) {
                    if (ind >= this.last.searchIds.length) return '';
                    ind = this.last.searchIds[ind];
                    record = this.records[ind];
                } else {
                    if (ind >= this.records.length) return '';
                    record = this.records[ind];
                }
            } else {
                if (ind >= this.summary.length) return '';
                record = this.summary[ind];
            }
            if (!record) return '';
            if (record.recid == null && this.recid != null && record[this.recid] != null) record.recid = record[this.recid];
            var id = w2utils.escapeId(record.recid);
            var isRowSelected = false;
            if (sel.indexes.indexOf(ind) != -1) isRowSelected = true;
            var rec_style = (record.w2ui ? record.w2ui.style : '');
            if (rec_style == null || typeof rec_style != 'string') rec_style = '';
            var rec_class = (record.w2ui ? record.w2ui.class : '');
            if (rec_class == null || typeof rec_class != 'string') rec_class = '';
            // render TR
            rec_html1 += '<tr id="grid_'+ this.name +'_frec_'+ record.recid +'" recid="'+ record.recid +'" line="'+ lineNum +'" index="'+ ind +'" '+
                ' class="'+ (lineNum % 2 === 0 ? 'w2ui-even' : 'w2ui-odd') + ' ' + rec_class +
                    (isRowSelected && this.selectType == 'row' ? ' w2ui-selected' : '') +
                    (record.w2ui && record.w2ui.editable === false ? ' w2ui-no-edit' : '') +
                    (record.w2ui && record.w2ui.expanded === true ? ' w2ui-expanded' : '') + '" ' +
                (summary !== true ?
                    (w2utils.isIOS ?
                        '    onclick  = "w2ui[\''+ this.name +'\'].dblClick(jQuery(this).attr(\'recid\'), event);"'
                        :
                        '    onclick  = "w2ui[\''+ this.name +'\'].click(jQuery(this).attr(\'recid\'), event);"'+
                        '    oncontextmenu = "w2ui[\''+ this.name +'\'].contextMenu(jQuery(this).attr(\'recid\'), null, event);"'
                     )
                    : ''
                ) +
                (this.selectType == 'row' ?
                    ' onmouseover="jQuery(\'#grid_'+ this.name +'_rec_\'+ w2utils.escapeId(jQuery(this).attr(\'recid\'))).addClass(\'w2ui-record-hover\')"'+
                    ' onmouseout ="jQuery(\'#grid_'+ this.name +'_rec_\'+ w2utils.escapeId(jQuery(this).attr(\'recid\'))).removeClass(\'w2ui-record-hover\')"'
                    :
                    '') +
                ' style="height: '+ this.recordHeight +'px; '+ (!isRowSelected && rec_style != '' ? rec_style : rec_style.replace('background-color', 'none')) +'" '+
                    (rec_style != '' ? 'custom_style="'+ rec_style +'"' : '') +
                '>';
            rec_html2 += '<tr id="grid_'+ this.name +'_rec_'+ record.recid +'" recid="'+ record.recid +'" line="'+ lineNum +'" index="'+ ind +'" '+
                ' class="'+ (lineNum % 2 === 0 ? 'w2ui-even' : 'w2ui-odd') + ' ' + rec_class +
                    (isRowSelected && this.selectType == 'row' ? ' w2ui-selected' : '') +
                    (record.w2ui && record.w2ui.editable === false ? ' w2ui-no-edit' : '') +
                    (record.w2ui && record.w2ui.expanded === true ? ' w2ui-expanded' : '') + '" ' +
                (summary !== true ?
                    (w2utils.isIOS ?
                        '    onclick  = "var obj = w2ui[\''+ this.name +'\']; obj.dblClick(jQuery(this).attr(\'recid\'), event);"'
                        :
                        '    onclick  = "var obj = w2ui[\''+ this.name +'\']; obj.click(jQuery(this).attr(\'recid\'), event);"'+
                        '    oncontextmenu = "var obj = w2ui[\''+ this.name +'\']; obj.contextMenu(jQuery(this).attr(\'recid\'), null, event);"'
                     )
                    : ''
                ) +
                (this.selectType == 'row' ?
                    ' onmouseover="jQuery(\'#grid_'+ this.name +'_frec_\' + w2utils.escapeId(jQuery(this).attr(\'recid\'))).addClass(\'w2ui-record-hover\')"'+
                    ' onmouseout ="jQuery(\'#grid_'+ this.name +'_frec_\' + w2utils.escapeId(jQuery(this).attr(\'recid\'))).removeClass(\'w2ui-record-hover\')"'
                    :
                    '') +
                ' style="height: '+ this.recordHeight +'px; '+ (!isRowSelected && rec_style != '' ? rec_style : rec_style.replace('background-color', 'none')) +'" '+
                    (rec_style != '' ? 'custom_style="'+ rec_style +'"' : '') +
                '>';
            if (this.show.lineNumbers) {
                rec_html1 += '<td id="grid_'+ this.name +'_cell_'+ ind +'_number' + (summary ? '_s' : '') + '" '+
                            '   class="w2ui-col-number '+ (isRowSelected  ? ' w2ui-row-selected' : '') +'"'+
                                (this.reorderRows ? ' style="cursor: move"' : '') + '>'+
                                (summary !== true ? this.getLineHTML(lineNum, record) : '') +
                            '</td>';
            }
            if (this.show.selectColumn) {
                rec_html1 +=
                        '<td id="grid_'+ this.name +'_cell_'+ ind +'_select' + (summary ? '_s' : '') + '" class="w2ui-grid-data w2ui-col-select">'+
                            (summary !== true ?
                            '    <div>'+
                            '        <input class="w2ui-grid-select-check" type="checkbox" tabindex="-1" '+
                                        (isRowSelected ? 'checked="checked"' : '') + ' style="pointer-events: none"/>'+
                            '    </div>'
                            :
                            '' ) +
                        '</td>';
            }
            if (this.show.expandColumn) {
                var tmp_img = '';
                if (record.w2ui && record.w2ui.expanded === true)  tmp_img = '-'; else tmp_img = '+';
                if (record.w2ui && record.w2ui.expanded == 'none') tmp_img = '';
                if (record.w2ui && record.w2ui.expanded == 'spinner') tmp_img = '<div class="w2ui-spinner" style="width: 16px; margin: -2px 2px;"></div>';
                rec_html1 +=
                        '<td id="grid_'+ this.name +'_cell_'+ ind +'_expand' + (summary ? '_s' : '') + '" class="w2ui-grid-data w2ui-col-expand">'+
                            (summary !== true ?
                            '    <div ondblclick="if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true;" '+
                            '            onclick="w2ui[\''+ this.name +'\'].toggle(jQuery(this).parents(\'tr\').attr(\'recid\')); '+
                            '                if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true;">'+
                            '        '+ tmp_img +' </div>'
                            :
                            '' ) +
                        '</td>';
            }
            // insert empty first column
            rec_html2 += '<td class="w2ui-grid-data-spacer" col="start" style="border-right: 0"></td>';
            var col_ind   = 0;
            var col_skip  = 0;
            while (true) {
                var col_span  = 1;
                var col = this.columns[col_ind];
                if (col == null) break;
                if (col.hidden) {
                    col_ind++;
                    if (col_skip > 0) col_skip--;
                    continue;
                }
                if (col_skip > 0) {
                    col_ind++;
                    if (this.columns[col_ind] == null) break;
                    record.w2ui.colspan[this.columns[col_ind-1].field] = 0; // need it for other methods
                    col_skip--;
                    continue;
                } else if (record.w2ui) {
                    var tmp1 = record.w2ui.colspan;
                    var tmp2 = this.columns[col_ind].field;
                    if (tmp1 && tmp1[tmp2] === 0) {
                        delete tmp1[tmp2]; // if no longer colspan then remove 0
                    }
                }
                // column virtual scroll
                if ((col_ind < this.last.colStart || col_ind > this.last.colEnd) && !col.frozen) {
                    col_ind++;
                    continue;
                }
                if (record.w2ui) {
                    if (typeof record.w2ui.colspan == 'object') {
                        var span = parseInt(record.w2ui.colspan[col.field]) || null;
                        if (span > 1) {
                            // if there are hidden columns, then no colspan on them
                            var hcnt = 0;
                            for (var i = col_ind; i < col_ind + span; i++) {
                                if (i >= this.columns.length) break;
                                if (this.columns[i].hidden) hcnt++;
                            }
                            col_span = span - hcnt;
                            col_skip = span - 1;
                        }
                    }
                }
                var rec_cell = this.getCellHTML(ind, col_ind, summary, col_span);
                if (col.frozen) rec_html1 += rec_cell; else rec_html2 += rec_cell;
                col_ind++;
            }
            rec_html1 += '<td class="w2ui-grid-data-last"></td>';
            rec_html2 += '<td class="w2ui-grid-data-last" col="end"></td>';
            rec_html1 += '</tr>';
            rec_html2 += '</tr>';
            return [rec_html1, rec_html2];
        },

        getLineHTML: function(lineNum) {
            return '<div>' + lineNum + '</div>';
        },

        getCellHTML: function (ind, col_ind, summary, col_span) {
            var col = this.columns[col_ind];
            if (col == null) return '';
            var record        = (summary !== true ? this.records[ind] : this.summary[ind]);
            var data          = this.getCellValue(ind, col_ind, summary);
            var edit          = this.getCellEditable(ind, col_ind);
            var style         = 'max-height: '+ parseInt(this.recordHeight) +'px;';
            var isChanged     = !summary && record && record.w2ui && record.w2ui.changes && record.w2ui.changes[col.field] != null;
            var addStyle      = '';
            var addClass      = '';
            var sel           = this.last.selection;
            var isRowSelected = false;
            var infoBubble    = '';
            if (sel.indexes.indexOf(ind) != -1) isRowSelected = true;
            if (col_span == null) {
                if (record && record.w2ui && record.w2ui.colspan && record.w2ui.colspan[col.field]) {
                    col_span = record.w2ui.colspan[col.field];
                } else {
                    col_span = 1;
                }
            }
            // expand icon
            if (col_ind === 0 && record && record.w2ui && Array.isArray(record.w2ui.children)) {
                var level  = 0;
                var subrec = this.get(record.w2ui.parent_recid, true);
                while (true) {
                    if (subrec != null) {
                        level++
                        var tmp = this.records[subrec].w2ui;
                        if (tmp != null && tmp.parent_recid != null) {
                            subrec = this.get(tmp.parent_recid, true);
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
                if (record.w2ui.parent_recid){
                        for (var i = 0; i < level; i++) {
                        infoBubble += '<span class="w2ui-show-children w2ui-icon-empty"></span>';
                        }
                }
                infoBubble += '<span class="w2ui-show-children '+
                        (record.w2ui.children.length > 0
                            ? (record.w2ui.expanded ? 'w2ui-icon-collapse' : 'w2ui-icon-expand')
                            : 'w2ui-icon-empty'
                        ) +'" '+
                    ' onclick="event.stopPropagation(); w2ui[\''+ this.name + '\'].toggle(jQuery(this).parents(\'tr\').attr(\'recid\'))"></span>';
            }
            // info bubble
            if (col.info === true) col.info = {};
            if (col.info != null) {
                if (!col.info.icon) col.info.icon = 'w2ui-icon-info';
                infoBubble += '<span class="w2ui-info '+ col.info.icon +'" style="'+ (col.info.style || '') + '" '+
                    ' onclick="event.stopPropagation(); w2ui[\''+ this.name + '\'].showBubble('+ ind +', '+ col_ind +')"></span>';
            }
            // various renderers
            if (col.render != null) {
                if (typeof col.render == 'function') {
                    data = $.trim(col.render.call(this, record, ind, col_ind, data));
                    if (data.length < 4 || data.substr(0, 4).toLowerCase() != '<div') {
                        data = '<div style="'+ style +'">' + infoBubble + String(data) + '</div>';
                    }
                }
                if (typeof col.render == 'object') {
                    data = '<div style="'+ style +'">' + infoBubble + (col.render[data] || '') + '</div>';
                }
                if (typeof col.render == 'string') {
                    var t   = col.render.toLowerCase().indexOf(':');
                    var tmp = [];
                    if (t == -1) {
                        tmp[0] = col.render.toLowerCase();
                        tmp[1] = '';
                    } else {
                        tmp[0] = col.render.toLowerCase().substr(0, t);
                        tmp[1] = col.render.toLowerCase().substr(t+1);
                    }
                    // formatters
                    var func = w2utils.formatters[tmp[0]];
                    data = '<div style="'+ style +'">' + infoBubble + (typeof func == 'function' ? func(data, tmp[1]) : '') + '</div>';
                }
            } else {
                // if editable checkbox
                if (edit && ['checkbox', 'check'].indexOf(edit.type) != -1) {
                    var changeInd = summary ? -(ind + 1) : ind;
                    style += 'text-align: center;';
                    data = '<input tabindex="-1" type="checkbox" '+ (data ? 'checked="checked"' : '') +' onclick="' +
                           '    var obj = w2ui[\''+ this.name + '\']; '+
                           '    obj.editChange.call(obj, this, '+ changeInd +', '+ col_ind +', event); ' +
                           '"/>';
                    infoBubble = '';
                }
                if (this.show.recordTitles) {
                    // title overwrite
                    var title = w2utils.stripTags(String(data).replace(/"/g, "''"));
                    if (col.title != null) {
                        if (typeof col.title == 'function') title = col.title.call(this, record, ind, col_ind);
                        if (typeof col.title == 'string')   title = col.title;
                    }
                }
                data = '<div style="'+ style +'" title="'+ (title || '') +'">'+ infoBubble + String(data) +'</div>';
            }
            if (data == null) data = '';
            // --> cell TD
            if (typeof col.render == 'string') {
                var tmp = col.render.toLowerCase().split(':');
                if (['number', 'int', 'float', 'money', 'currency', 'percent', 'size'].indexOf(tmp[0]) != -1) addStyle += 'text-align: right;';
            }
            if (record && record.w2ui) {
                if (typeof record.w2ui.style == 'object') {
                    if (typeof record.w2ui.style[col_ind] == 'string') addStyle += record.w2ui.style[col_ind] + ';';
                    if (typeof record.w2ui.style[col.field] == 'string') addStyle += record.w2ui.style[col.field] + ';';
                }
                if (typeof record.w2ui.class == 'object') {
                    if (typeof record.w2ui.class[col_ind] == 'string') addClass += record.w2ui.class[col_ind] + ' ';
                    if (typeof record.w2ui.class[col.field] == 'string') addClass += record.w2ui.class[col.field] + ' ';
                }
            }
            var isCellSelected = false;
            if (isRowSelected && $.inArray(col_ind, sel.columns[ind]) != -1) isCellSelected = true;
            // data
            data =  '<td class="w2ui-grid-data'+ (isCellSelected ? ' w2ui-selected' : '') + ' ' + addClass +
                        (isChanged ? ' w2ui-changed' : '') +
                        '" '+
                    '   id="grid_'+ this.name +'_data_'+ ind +'_'+ col_ind +'" col="'+ col_ind +'" '+
                    '   style="'+ addStyle + (col.style != null ? col.style : '') +'" '+
                        (col.attr != null ? col.attr : '') +
                        (col_span > 1 ? 'colspan="'+ col_span + '"' : '') +
                    '>' + data + '</td>';

            return data;
        },

        showBubble: function (ind, col_ind) {
            var html = '';
            var info = this.columns[col_ind].info;
            var rec  = this.records[ind];
            var el   = $(this.box).find('#grid_'+ this.name +'_data_'+ ind +'_'+ col_ind + ' .w2ui-info');
            if (this.last.bubbleEl) $(this.last.bubbleEl).w2tag();
            this.last.bubbleEl = el;
            // if no fields defined - show all
            if (info.fields == null) {
                info.fields = [];
                for (var i = 0; i < this.columns.length; i++) {
                    var col = this.columns[i];
                    info.fields.push(col.field + (typeof col.render == 'string' ? ':' + col.render : ''));
                }
            }
            var fields = info.fields;
            if (typeof fields == 'function') {
                fields = fields(rec, ind, col_ind); // custom renderer
            }
            // generate html
            if (typeof info.render == 'function') {
                html = info.render(rec, ind, col_ind);

            } else if ($.isArray(fields)) {
                // display mentioned fields
                html = '<table cellpadding="0" cellspacing="0">';
                for (var i = 0; i < fields.length; i++) {
                    var tmp = String(fields[i]).split(':');
                    if (tmp[0] == '' || tmp[0] == '-' || tmp[0] == '--' || tmp[0] == '---') {
                        html += '<tr><td colspan=2><div style="border-top: '+ (tmp[0] == '' ? '0' : '1') +'px solid #C1BEBE; margin: 6px 0px;"></div></td></tr>';
                        continue;
                    }
                    var col = this.getColumn(tmp[0]);
                    if (col == null) col = { field: tmp[0], caption: tmp[0] }; // if not found in columns
                    var val = (col ? this.parseField(rec, col.field) : '');
                    if (tmp.length > 1) {
                        if (w2utils.formatters[tmp[1]]) {
                            val = w2utils.formatters[tmp[1]](val, tmp[2] || null);
                        } else {
                            console.log('ERROR: w2utils.formatters["'+ tmp[1] + '"] does not exists.')
                        }
                    }
                    if (info.showEmpty !== true && (val == null || val == '')) continue;
                    if (info.maxLength != null && typeof val == 'string' && val.length > info.maxLength) val = val.substr(0, info.maxLength) + '...';
                    html += '<tr><td>' + col.caption + '</td><td>' + ((val === 0 ? '0' : val) || '') + '</td></tr>';
                }
                html += '</table>';
            } else if ($.isPlainObject(fields)) {
                // display some fields
                html = '<table cellpadding="0" cellspacing="0">';
                for (var caption in fields) {
                    var fld = fields[caption];
                    if (fld == '' || fld == '-' || fld == '--' || fld == '---') {
                        html += '<tr><td colspan=2><div style="border-top: '+ (fld == '' ? '0' : '1') +'px solid #C1BEBE; margin: 6px 0px;"></div></td></tr>';
                        continue;
                    }
                    var tmp = String(fld).split(':');
                    var col = this.getColumn(tmp[0]);
                    if (col == null) col = { field: tmp[0], caption: tmp[0] }; // if not found in columns
                    var val = (col ? this.parseField(rec, col.field) : '');
                    if (tmp.length > 1) {
                        if (w2utils.formatters[tmp[1]]) {
                            val = w2utils.formatters[tmp[1]](val, tmp[2] || null);
                        } else {
                            console.log('ERROR: w2utils.formatters["'+ tmp[1] + '"] does not exists.')
                        }
                    }
                    if (typeof fld == 'function') {
                        val = fld(rec, ind, col_ind);
                    }
                    if (info.showEmpty !== true && (val == null || val == '')) continue;
                    if (info.maxLength != null && typeof val == 'string' && val.length > info.maxLength) val = val.substr(0, info.maxLength) + '...';
                    html += '<tr><td>' + caption + '</td><td>' + (val || '') + '</td></tr>';
                }
                html += '</table>';
            }
            $(el).w2tag($.extend({
                html        : html,
                left        : -4,
                position    : 'bottom|top',
                className   : 'w2ui-info-bubble',
                style       : '',
                hideOnClick : true
            }, info.options || {}));
        },

        // return null or the editable object if the given cell is editable
        getCellEditable: function (ind, col_ind) {
            var col = this.columns[col_ind];
            var rec = this.records[ind];
            if (!rec || !col) return null;
            var edit = (rec.w2ui ? rec.w2ui.editable : null);
            if (edit === false) return null;
            if (edit == null || edit === true) {
                edit = (col ? col.editable : null);
                if (typeof(edit) === 'function') {
                    var data = this.getCellValue(ind, col_ind, false);
                    // same arguments as col.render()
                    edit = edit.call(this, rec, ind, col_ind, data);
                }
            }
            return edit;
        },

        getCellValue: function (ind, col_ind, summary) {
            var col    = this.columns[col_ind];
            var record = (summary !== true ? this.records[ind] : this.summary[ind]);
            var data   = this.parseField(record, col.field);
            if (record && record.w2ui && record.w2ui.changes && record.w2ui.changes[col.field] != null) {
                data = record.w2ui.changes[col.field];
            }
            if ($.isPlainObject(data) && col.editable) {
                if (data.text != null) data = data.text;
                if (data.id != null) data = data.id;
            }
            if (data == null) data = '';
            return data;
        },

        getFooterHTML: function () {
            return '<div>'+
                '    <div class="w2ui-footer-left"></div>'+
                '    <div class="w2ui-footer-right"></div>'+
                '    <div class="w2ui-footer-center"></div>'+
                '</div>';
        },

        status: function (msg) {
            if (msg != null) {
                $('#grid_'+ this.name +'_footer').find('.w2ui-footer-left').html(msg);
            } else {
                // show number of selected
                var msgLeft = '';
                var sel = this.getSelection();
                if (sel.length > 0) {
                    if (this.show.statusSelection && sel.length > 1) {
                        msgLeft = String(sel.length).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,") + ' ' + w2utils.lang('selected');
                    }
                    if (this.show.statusRecordID && sel.length == 1) {
                        var tmp = sel[0];
                        if (typeof tmp == 'object') tmp = tmp.recid + ', '+ w2utils.lang('Column') +': '+ tmp.column;
                        msgLeft = w2utils.lang('Record ID') + ': '+ tmp + ' ';
                    }
                }
                $('#grid_'+ this.name +'_footer .w2ui-footer-left').html(msgLeft);
                // toolbar
                if (sel.length == 1) this.toolbar.enable('w2ui-edit'); else this.toolbar.disable('w2ui-edit');
                if (sel.length >= 1) this.toolbar.enable('w2ui-delete'); else this.toolbar.disable('w2ui-delete');
            }
        },

        lock: function (msg, showSpinner) {
            var obj  = this;
            var args = Array.prototype.slice.call(arguments, 0);
            args.unshift(this.box);
            setTimeout(function () {
                // hide empty msg if any
                $(obj.box).find('#grid_'+ obj.name +'_empty_msg').remove();
                w2utils.lock.apply(window, args);
            }, 10);
        },

        unlock: function (speed) {
            var box = this.box;
            setTimeout(function () {
                // do not unlock if there is a message
                if ($(box).find('.w2ui-message').not('.w2ui-closing').length > 0) return;
                w2utils.unlock(box, speed);
            }, 25); // needed timer so if server fast, it will not flash
        },

        stateSave: function (returnOnly) {
            var obj = this;
            if (!w2utils.hasLocalStorage) return null;
            var state = {
                columns     : [],
                show        : $.extend({}, this.show),
                last        : {
                    search      : this.last.search,
                    multi       : this.last.multi,
                    logic       : this.last.logic,
                    caption     : this.last.caption,
                    field       : this.last.field,
                    scrollTop   : this.last.scrollTop,
                    scrollLeft  : this.last.scrollLeft
                },
                sortData    : [],
                searchData  : []
            };
            for (var i = 0; i < this.columns.length; i++) {
                var col = this.columns[i];
                state.columns.push({
                    field           : col.field,
                    hidden          : col.hidden ? true : false,
                    frozen          : col.frozen ? true : false,
                    size            : col.size ? col.size : null,
                    sizeCalculated  : col.sizeCalculated ? col.sizeCalculated : null,
                    sizeOriginal    : col.sizeOriginal ? col.sizeOriginal : null,
                    sizeType        : col.sizeType ? col.sizeType : null
                });
            }
            for (var i = 0; i < this.sortData.length; i++) state.sortData.push($.extend({}, this.sortData[i]));
            for (var i = 0; i < this.searchData.length; i++) state.searchData.push($.extend({}, this.searchData[i]));
            // save into local storage
            if (returnOnly !== true) {
                // event before
                var edata = this.trigger({ phase: 'before', type: 'stateSave', target: this.name, state: state });
                if (edata.isCancelled === true) { if (typeof callBack == 'function') callBack({ status: 'error', message: 'Request aborted.' }); return; }
                try {
                    var savedState = $.parseJSON(localStorage.w2ui || '{}');
                    if (!savedState) savedState = {};
                    if (!savedState.states) savedState.states = {};
                    savedState.states[(this.stateId || this.name)] = state;
                    localStorage.w2ui = JSON.stringify(savedState);
                } catch (e) {
                    delete localStorage.w2ui;
                    return null;
                }
                // event after
                this.trigger($.extend(edata, { phase: 'after' }));
            }
            return state;
        },

        stateRestore: function (newState) {
            var obj = this;
            var url = (typeof this.url != 'object' ? this.url : this.url.get);
            if (!newState) {
                // read it from local storage
                try {
                    if (!w2utils.hasLocalStorage) return false;
                    var tmp = $.parseJSON(localStorage.w2ui || '{}');
                    if (!tmp) tmp = {};
                    if (!tmp.states) tmp.states = {};
                    newState = tmp.states[(this.stateId || this.name)];
                } catch (e) {
                    delete localStorage.w2ui;
                    return null;
                }
            }
            // event before
            var edata = this.trigger({ phase: 'before', type: 'stateRestore', target: this.name, state: newState });
            if (edata.isCancelled === true) { if (typeof callBack == 'function') callBack({ status: 'error', message: 'Request aborted.' }); return; }
            // default behavior
            if ($.isPlainObject(newState)) {
                $.extend(this.show, newState.show);
                $.extend(this.last, newState.last);
                var sTop  = this.last.scrollTop;
                var sLeft = this.last.scrollLeft;
                for (var c = 0; c < newState.columns.length; c++) {
                    var tmp = newState.columns[c];
                    var col_index = this.getColumn(tmp.field, true);
                    if (col_index !== null) {
                       $.extend(this.columns[col_index], tmp);
                       // restore column order from saved state
                       if (c !== col_index) this.columns.splice(c, 0, this.columns.splice(col_index, 1)[0]);
                    }
                }
                this.sortData.splice(0, this.sortData.length);
                for (var c = 0; c < newState.sortData.length; c++) this.sortData.push(newState.sortData[c]);
                this.searchData.splice(0, this.searchData.length);
                for (var c = 0; c < newState.searchData.length; c++) this.searchData.push(newState.searchData[c]);
                // apply sort and search
                setTimeout(function () {
                    // needs timeout as records need to be populated
                    // ez 10.09.2014 this -->
                    if (!url) {
                        if (obj.sortData.length > 0) obj.localSort();
                        if (obj.searchData.length > 0) obj.localSearch();
                    }
                    obj.last.scrollTop  = sTop;
                    obj.last.scrollLeft = sLeft;
                    obj.refresh();
                }, 1);
            }
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            return true;
        },

        stateReset: function () {
            var obj = this;
            this.stateRestore(this.last.state);
            // remove from local storage
            if (w2utils.hasLocalStorage) {
                try {
                    var tmp = $.parseJSON(localStorage.w2ui || '{}');
                    if (tmp.states && tmp.states[(this.stateId || this.name)]) {
                        delete tmp.states[(this.stateId || this.name)];
                    }
                    localStorage.w2ui = JSON.stringify(tmp);
                } catch (e) {
                    delete localStorage.w2ui;
                    return null;
                }
            }
        },

        parseField: function (obj, field) {
            var val = '';
            try { // need this to make sure no error in fields
                val = obj;
                var tmp = String(field).split('.');
                for (var i = 0; i < tmp.length; i++) {
                    val = val[tmp[i]];
                }
            } catch (event) {
                val = '';
            }
            return val;
        },

        prepareData: function () {
            var obj = this;

            // loops thru records and prepares date and time objects
            for (var r = 0; r < this.records.length; r++) {
                var rec = this.records[r];
                prepareRecord(rec);
            }

            // prepare date and time objects for the 'rec' record and its closed children
            function prepareRecord(rec) {
                for (var c = 0; c < obj.columns.length; c++) {
                    var column = obj.columns[c];
                    if (rec[column.field] == null || typeof column.render != 'string') continue;
                    // number
                    if (['number', 'int', 'float', 'money', 'currency', 'percent'].indexOf(column.render.split(':')[0])  != -1) {
                        if (typeof rec[column.field] != 'number') rec[column.field] = parseFloat(rec[column.field]);
                    }
                    // date
                    if (['date', 'age'].indexOf(column.render.split(':')[0]) != -1) {
                        if (!rec[column.field + '_']) {
                            var dt = rec[column.field];
                            if (w2utils.isInt(dt)) dt = parseInt(dt);
                            rec[column.field + '_'] = new Date(dt);
                        }
                    }
                    // time
                    if (['time'].indexOf(column.render) != -1) {
                        if (w2utils.isTime(rec[column.field])) { // if string
                            var tmp = w2utils.isTime(rec[column.field], true);
                            var dt = new Date();
                            dt.setHours(tmp.hours, tmp.minutes, (tmp.seconds ? tmp.seconds : 0), 0); // sets hours, min, sec, mills
                            if (!rec[column.field + '_']) rec[column.field + '_'] = dt;
                        } else { // if date object
                            var tmp = rec[column.field];
                            if (w2utils.isInt(tmp)) tmp = parseInt(tmp);
                            var tmp = (tmp != null ? new Date(tmp) : new Date());
                            var dt  = new Date();
                            dt.setHours(tmp.getHours(), tmp.getMinutes(), tmp.getSeconds(), 0); // sets hours, min, sec, mills
                            if (!rec[column.field + '_']) rec[column.field + '_'] = dt;
                        }
                    }
                }

                if (rec.w2ui && rec.w2ui.children && rec.w2ui.expanded !== true) {
                    // there are closed children, prepare them too.
                    for (var r = 0; r < rec.w2ui.children.length; r++) {
                        var subRec = rec.w2ui.children[r];
                        prepareRecord(subRec);
                    }
                }
            }
        },

        nextCell: function (index, col_ind, editable) {
            var check = col_ind + 1;
            if (check >= this.columns.length) return null;
            var tmp  = this.records[index].w2ui;
            var ccol = this.columns[col_ind];
            // if (tmp && tmp.colspan[ccol.field]) check += parseInt(tmp.colspan[ccol.field]) -1; // colspan of a column
            var col  = this.columns[check];
            var span = (tmp && tmp.colspan && !isNaN(tmp.colspan[col.field]) ? parseInt(tmp.colspan[col.field]) : 1);
            if (col == null) return null;
            if (col && col.hidden || span === 0) return this.nextCell(index, check, editable);
            if (editable) {
                var edit = this.getCellEditable(index, col_ind);
                if (edit == null || ['checkbox', 'check'].indexOf(edit.type) != -1) {
                    return this.nextCell(index, check, editable);
                }
            }
            return check;
        },

        prevCell: function (index, col_ind, editable) {
            var check = col_ind - 1;
            if (check < 0) return null;
            var tmp  = this.records[index].w2ui;
            var col  = this.columns[check];
            var span = (tmp && tmp.colspan && !isNaN(tmp.colspan[col.field]) ? parseInt(tmp.colspan[col.field]) : 1);
            if (col == null) return null;
            if (col && col.hidden || span === 0) return this.prevCell(index, check, editable);
            if (editable) {
                var edit = this.getCellEditable(index, col_ind);
                if (edit == null || ['checkbox', 'check'].indexOf(edit.type) != -1) {
                    return this.prevCell(index, check, editable);
                }
            }
            return check;
        },

        nextRow: function (ind, col_ind) {
            var sids = this.last.searchIds;
            var ret  = null;
            if ((ind + 1 < this.records.length && sids.length === 0) // if there are more records
                    || (sids.length > 0 && ind < sids[sids.length-1])) {
                ind++;
                if (sids.length > 0) while (true) {
                    if ($.inArray(ind, sids) != -1 || ind > this.records.length) break;
                    ind++;
                }
                // colspan
                var tmp  = this.records[ind].w2ui;
                var col  = this.columns[col_ind];
                var span = (tmp && tmp.colspan && col != null && !isNaN(tmp.colspan[col.field]) ? parseInt(tmp.colspan[col.field]) : 1);
                if (span === 0) {
                    ret = this.nextRow(ind, col_ind);
                } else {
                    ret = ind;
                }
            }
            return ret;
        },

        prevRow: function (ind, col_ind) {
            var sids = this.last.searchIds;
            var ret  = null;
            if ((ind > 0 && sids.length === 0)  // if there are more records
                    || (sids.length > 0 && ind > sids[0])) {
                ind--;
                if (sids.length > 0) while (true) {
                    if ($.inArray(ind, sids) != -1 || ind < 0) break;
                    ind--;
                }
                // colspan
                var tmp  = this.records[ind].w2ui;
                var col  = this.columns[col_ind];
                var span = (tmp && tmp.colspan && col != null && !isNaN(tmp.colspan[col.field]) ? parseInt(tmp.colspan[col.field]) : 1);
                if (span === 0) {
                    ret = this.prevRow(ind, col_ind);
                } else {
                    ret = ind;
                }
            }
            return ret;
        },

        selectionSave: function () {
            this.last._selection = this.getSelection();
            return this.last._selection;
        },

        selectionRestore: function (noRefresh) {
            var time = (new Date()).getTime();
            this.last.selection = { indexes: [], columns: {} };
            var sel = this.last.selection;
            var lst = this.last._selection;
            for (var i = 0; i < lst.length; i++) {
                if ($.isPlainObject(lst[i])) {
                    // selectType: cell
                    var tmp = this.get(lst[i].recid, true);
                    if (tmp != null) {
                        if (sel.indexes.indexOf(tmp) == -1) sel.indexes.push(tmp);
                        if (!sel.columns[tmp]) sel.columns[tmp] = [];
                        sel.columns[tmp].push(lst[i].column);
                    }
                } else {
                    // selectType: row
                    var tmp = this.get(lst[i], true);
                    if (tmp != null) sel.indexes.push(tmp);
                }
            }
            delete this.last._selection;
            if (noRefresh !== true) this.refresh();
            return (new Date()).getTime() - time;
        },

        message: function(options, callBack) {
            if (typeof options == 'string') {
                options = {
                    width   : (options.length < 300 ? 350 : 550),
                    height  : (options.length < 300 ? 170: 250),
                    body    : '<div class="w2ui-centered">' + options + '</div>',
                    buttons : '<button class="w2ui-btn" onclick="w2ui[\''+ this.name +'\'].message()">Ok</button>',
                    onOpen  : function (event) {
                        setTimeout(function () {
                            $(this.box).find('.w2ui-btn').focus();
                        }, 25);
                    },
                    onClose: function (even) {
                        if (typeof callBack == 'function') callBack();
                    }
                };
            }
            w2utils.message.call(this, {
                box   : this.box,
                path  : 'w2ui.' + this.name,
                title : '.w2ui-grid-header:visible',
                body  : '.w2ui-grid-box'
            }, options);
        }
    };

    $.extend(w2grid.prototype, w2utils.event);
    w2obj.grid = w2grid;
})(jQuery);

/************************************************************************
*   Library: Web 2.0 UI for jQuery (using prototypical inheritance)
*   - Following objects defined
*        - w2layout        - layout widget
*        - $().w2layout    - jQuery wrapper
*   - Dependencies: jQuery, w2utils, w2toolbar, w2tabs
*
* == NICE TO HAVE ==
*   - onResize for the panel
*   - add more panel title positions (left=rotated, right=rotated, bottom)
*   - bug: when you assign content before previous transition completed.
*
************************************************************************/

(function ($) {
    var w2layout = function (options) {
        this.box     = null;     // DOM Element that holds the element
        this.name    = null;     // unique name for w2ui
        this.panels  = [];
        this.tmp     = {};
        this.padding = 1;        // panel padding
        this.resizer = 4;        // resizer width or height
        this.style   = '';

        $.extend(true, this, w2obj.layout, options);
    };

    var w2panels = ['top', 'left', 'main', 'preview', 'right', 'bottom'];

    // ====================================================
    // -- Registers as a jQuery plugin

    $.fn.w2layout = function(method) {
        if ($.isPlainObject(method)) {
            // check name parameter
            if (!w2utils.checkName(method, 'w2layout')) return;
            var panels = method.panels || [];
            var object = new w2layout(method);
            $.extend(object, { handlers: [], panels: [] });
            // add defined panels
            for (var p = 0, len = panels.length; p < len; p++) {
                object.panels[p] = $.extend(true, {}, w2layout.prototype.panel, panels[p]);
                if ($.isPlainObject(object.panels[p].tabs) || $.isArray(object.panels[p].tabs)) initTabs(object, panels[p].type);
                if ($.isPlainObject(object.panels[p].toolbar) || $.isArray(object.panels[p].toolbar)) initToolbar(object, panels[p].type);
            }
            // add all other panels
            for (var p1 = 0; p1 < w2panels.length; p1++) {
                if (object.get(w2panels[p1]) != null) continue;
                object.panels.push($.extend(true, {}, w2layout.prototype.panel, { type: w2panels[p1], hidden: (w2panels[p1] !== 'main'), size: 50 }));
            }
            if ($(this).length > 0) {
                object.render($(this)[0]);
            }
            w2ui[object.name] = object;
            return object;

        } else {
            var obj = w2ui[$(this).attr('name')];
            if (!obj) return null;
            if (arguments.length > 0) {
                if (obj[method]) obj[method].apply(obj, Array.prototype.slice.call(arguments, 1));
                return this;
            } else {
                return obj;
            }
        }

        function initTabs(object, panel, tabs) {
            var pan = object.get(panel);
            if (pan != null && tabs == null) tabs = pan.tabs;
            if (pan == null || tabs == null) return false;
            // instanciate tabs
            if ($.isArray(tabs)) tabs = { tabs: tabs };
            $().w2destroy(object.name + '_' + panel + '_tabs'); // destroy if existed
            pan.tabs = $().w2tabs($.extend({}, tabs, { owner: object, name: object.name + '_' + panel + '_tabs' }));
            pan.show.tabs = true;
            return true;
        }

        function initToolbar(object, panel, toolbar) {
            var pan = object.get(panel);
            if (pan != null && toolbar == null) toolbar = pan.toolbar;
            if (pan == null || toolbar == null) return false;
            // instanciate toolbar
            if ($.isArray(toolbar)) toolbar = { items: toolbar };
            $().w2destroy(object.name + '_' + panel + '_toolbar'); // destroy if existed
            pan.toolbar = $().w2toolbar($.extend({}, toolbar, { owner: object, name: object.name + '_' + panel + '_toolbar' }));
            pan.show.toolbar = true;
            return true;
        }
    };

    // ====================================================
    // -- Implementation of core functionality

    w2layout.prototype = {
        onShow        : null,
        onHide        : null,
        onResizing    : null,
        onResizerClick: null,
        onRender      : null,
        onRefresh     : null,
        onContent     : null,
        onResize      : null,
        onDestroy     : null,

        // default setting for a panel
        panel: {
            type      : null,       // left, right, top, bottom
            title     : '',
            size      : 100,        // width or height depending on panel name
            minSize   : 20,
            maxSize   : false,
            hidden    : false,
            resizable : false,
            overflow  : 'auto',
            style     : '',
            content   : '',         // can be String or Object with .render(box) method
            tabs      : null,
            toolbar   : null,
            width     : null,       // read only
            height    : null,       // read only
            show : {
                toolbar : false,
                tabs    : false
            },
            onRefresh : null,
            onShow    : null,
            onHide    : null
        },

        // alias for content
        html: function (panel, data, transition) {
            return this.content(panel, data, transition);
        },

        content: function (panel, data, transition) {
            var obj = this;
            var p = this.get(panel);
            // if it is CSS panel
            if (panel == 'css') {
                $('#layout_'+ obj.name +'_panel_css').html('<style>'+ data +'</style>');
                return true;
            }
            if (p == null) return false;
            if (data == null) {
                return p.content;
            }
            // event before
            var edata = this.trigger({ phase: 'before', type: 'content', target: panel, object: p, content: data, transition: transition });
            if (edata.isCancelled === true) return;

            if (data instanceof jQuery) {
                console.log('ERROR: You can not pass jQuery object to w2layout.content() method');
                return false;
            }
            var pname    = '#layout_'+ this.name + '_panel_'+ p.type;
            var current  = $(pname + '> .w2ui-panel-content');
            var panelTop = 0;
            if (current.length > 0) {
                $(pname).scrollTop(0);
                panelTop = $(current).position().top;
            }
            if (p.content === '') {
                p.content = data;
                this.refresh(panel);
            } else {
                p.content = data;
                if (!p.hidden) {
                    if (transition != null && transition !== '') {
                        // apply transition
                        var div1 = $(pname + '> .w2ui-panel-content');
                        div1.after('<div class="w2ui-panel-content new-panel" style="'+ div1[0].style.cssText +'"></div>');
                        var div2 = $(pname + '> .w2ui-panel-content.new-panel');
                        div1.css('top', panelTop);
                        div2.css('top', panelTop);
                        if (typeof data == 'object') {
                            data.box = div2[0]; // do not do .render(box);
                            data.render();
                        } else {
                            div2.html(data);
                        }
                        w2utils.transition(div1[0], div2[0], transition, function () {
                            div1.remove();
                            div2.removeClass('new-panel');
                            div2.css('overflow', p.overflow);
                            // IE Hack
                            obj.resize();
                            if (window.navigator.userAgent.indexOf('MSIE') != -1) setTimeout(function () { obj.resize(); }, 100);
                        });
                    }
                }
                this.refresh(panel);
            }
            // event after
            obj.trigger($.extend(edata, { phase: 'after' }));
            // IE Hack
            obj.resize();
            if (window.navigator.userAgent.indexOf('MSIE') != -1) setTimeout(function () { obj.resize(); }, 100);
            return true;
        },

        message: function(panel, options) {
            var obj = this;
            if (typeof options == 'string') {
                options = {
                    width   : (options.length < 300 ? 350 : 550),
                    height  : (options.length < 300 ? 170: 250),
                    body    : '<div class="w2ui-centered">' + options + '</div>',
                    buttons : '<button class="w2ui-btn" onclick="w2ui[\''+ this.name +'\'].message(\''+ panel +'\')">Ok</button>',
                    onOpen  : function (event) {
                        setTimeout(function () {
                            $(this.box).find('.w2ui-btn').focus();
                        }, 25);
                    }
                };
            }
            var p   = this.get(panel);
            var $el = $('#layout_'+ this.name + '_panel_'+ p.type);
            var oldOverflow = $el.css('overflow');
            var oldOnClose;
            if (options) {
                if (options.onClose) oldOnClose = options.onClose;
                options.onClose = function (event) {
                    if (typeof oldOnClose == 'function') oldOnClose(event);
                    event.done(function () {
                        $('#layout_'+ obj.name + '_panel_'+ p.type).css('overflow', oldOverflow);
                    });
                };
            }
            $('#layout_'+ this.name + '_panel_'+ p.type).css('overflow', 'hidden');
            w2utils.message.call(this, {
                box   : $('#layout_'+ this.name + '_panel_'+ p.type),
                param : panel,
                path  : 'w2ui.' + this.name,
                title : '.w2ui-panel-title:visible',
                body  : '.w2ui-panel-content'
            }, options);
        },

        load: function (panel, url, transition, onLoad) {
            var obj = this;
            if (panel == 'css') {
                $.get(url, function (data, status, xhr) { // should always be $.get as it is template
                    obj.content(panel, xhr.responseText);
                    if (onLoad) onLoad();
                });
                return true;
            }
            if (this.get(panel) != null) {
                $.get(url, function (data, status, xhr) { // should always be $.get as it is template
                    obj.content(panel, xhr.responseText, transition);
                    if (onLoad) onLoad();
                    // IE Hack
                    obj.resize();
                    if (window.navigator.userAgent.indexOf('MSIE') != -1) setTimeout(function () { obj.resize(); }, 100);
                });
                return true;
            }
            return false;
        },

        sizeTo: function (panel, size, instant) {
            var obj = this;
            var pan = obj.get(panel);
            if (pan == null) return false;
            // resize
            $(obj.box).find(' > div > .w2ui-panel')
                .css(w2utils.cssPrefix('transition', (instant !== true ? '.2s' : '0s')));
            setTimeout(function () {
                obj.set(panel, { size: size });
            }, 1);
            // clean
            setTimeout(function () {
                $(obj.box).find(' > div > .w2ui-panel').css(w2utils.cssPrefix('transition', '0s'));
                obj.resize();
            }, 500);
            return true;
        },

        show: function (panel, immediate) {
            var obj = this;
            // event before
            var edata = this.trigger({ phase: 'before', type: 'show', target: panel, object: this.get(panel), immediate: immediate });
            if (edata.isCancelled === true) return;

            var p = obj.get(panel);
            if (p == null) return false;
            p.hidden = false;
            if (immediate === true) {
                $('#layout_'+ obj.name +'_panel_'+panel).css({ 'opacity': '1' });
                obj.trigger($.extend(edata, { phase: 'after' }));
                obj.resize();
            } else {
                // resize
                $('#layout_'+ obj.name +'_panel_'+panel).css({ 'opacity': '0' });
                $(obj.box).find(' > div > .w2ui-panel').css(w2utils.cssPrefix('transition', '.2s'));
                setTimeout(function () { obj.resize(); }, 1);
                // show
                setTimeout(function() {
                    $('#layout_'+ obj.name +'_panel_'+ panel).css({ 'opacity': '1' });
                }, 250);
                // clean
                setTimeout(function () {
                    $(obj.box).find(' > div > .w2ui-panel').css(w2utils.cssPrefix('transition', '0s'));
                    obj.trigger($.extend(edata, { phase: 'after' }));
                    obj.resize();
                }, 500);
            }
            return true;
        },

        hide: function (panel, immediate) {
            var obj = this;
            // event before
            var edata = this.trigger({ phase: 'before', type: 'hide', target: panel, object: this.get(panel), immediate: immediate });
            if (edata.isCancelled === true) return;

            var p = obj.get(panel);
            if (p == null) return false;
            p.hidden = true;
            if (immediate === true) {
                $('#layout_'+ obj.name +'_panel_'+panel).css({ 'opacity': '0'    });
                obj.trigger($.extend(edata, { phase: 'after' }));
                obj.resize();
            } else {
                // hide
                $(obj.box).find(' > div > .w2ui-panel').css(w2utils.cssPrefix('transition', '.2s'));
                $('#layout_'+ obj.name +'_panel_'+panel).css({ 'opacity': '0'    });
                setTimeout(function () { obj.resize(); }, 1);
                // clean
                setTimeout(function () {
                    $(obj.box).find(' > div > .w2ui-panel').css(w2utils.cssPrefix('transition', '0s'));
                    obj.trigger($.extend(edata, { phase: 'after' }));
                    obj.resize();
                }, 500);
            }
            return true;
        },

        toggle: function (panel, immediate) {
            var p = this.get(panel);
            if (p == null) return false;
            if (p.hidden) return this.show(panel, immediate); else return this.hide(panel, immediate);
        },

        set: function (panel, options) {
            var ind = this.get(panel, true);
            if (ind == null) return false;
            $.extend(this.panels[ind], options);
            // refresh only when content changed
            if (options.content != null || options.resizable != null) {
                this.refresh(panel);
            }
            // show/hide resizer
            this.resize(); // resize is needed when panel size is changed
            return true;
        },

        get: function (panel, returnIndex) {
            for (var p = 0; p < this.panels.length; p++) {
                if (this.panels[p].type == panel) {
                    if (returnIndex === true) return p; else return this.panels[p];
                }
            }
            return null;
        },

        el: function (panel) {
            var el = $('#layout_'+ this.name +'_panel_'+ panel +'> .w2ui-panel-content');
            if (el.length != 1) return null;
            return el[0];
        },

        hideToolbar: function (panel) {
            var pan = this.get(panel);
            if (!pan) return;
            pan.show.toolbar = false;
            $('#layout_'+ this.name +'_panel_'+ panel +'> .w2ui-panel-toolbar').hide();
            this.resize();
        },

        showToolbar: function (panel) {
            var pan = this.get(panel);
            if (!pan) return;
            pan.show.toolbar = true;
            $('#layout_'+ this.name +'_panel_'+ panel +'> .w2ui-panel-toolbar').show();
            this.resize();
        },

        toggleToolbar: function (panel) {
            var pan = this.get(panel);
            if (!pan) return;
            if (pan.show.toolbar) this.hideToolbar(panel); else this.showToolbar(panel);
        },

        assignToolbar: function (panel, toolbar) {
            if (typeof toolbar == 'string' && w2ui[toolbar] != null) toolbar = w2ui[toolbar];
            var pan = this.get(panel);
            pan.toolbar = toolbar;
            var tmp = $(this.box).find(panel +'> .w2ui-panel-toolbar');
            if (pan.toolbar != null) {
                if (tmp.find('[name='+ pan.toolbar.name +']').length === 0) {
                    tmp.w2render(pan.toolbar);
                } else if (pan.toolbar != null) {
                    pan.toolbar.refresh();
                }
                this.showToolbar(panel);
                this.refresh('main');
            } else {
                tmp.html('');
                this.hideToolbar(panel);
            }
        },

        hideTabs: function (panel) {
            var pan = this.get(panel);
            if (!pan) return;
            pan.show.tabs = false;
            $('#layout_'+ this.name +'_panel_'+ panel +'> .w2ui-panel-tabs').hide();
            this.resize();
        },

        showTabs: function (panel) {
            var pan = this.get(panel);
            if (!pan) return;
            pan.show.tabs = true;
            $('#layout_'+ this.name +'_panel_'+ panel +'> .w2ui-panel-tabs').show();
            this.resize();
        },

        toggleTabs: function (panel) {
            var pan = this.get(panel);
            if (!pan) return;
            if (pan.show.tabs) this.hideTabs(panel); else this.showTabs(panel);
        },

        render: function (box) {
            var obj = this;
            // if (window.getSelection) window.getSelection().removeAllRanges(); // clear selection
            var time = (new Date()).getTime();
            // event before
            var edata = obj.trigger({ phase: 'before', type: 'render', target: obj.name, box: box });
            if (edata.isCancelled === true) return;

            if (box != null) {
                if ($(obj.box).find('#layout_'+ obj.name +'_panel_main').length > 0) {
                    $(obj.box)
                        .removeAttr('name')
                        .removeClass('w2ui-layout')
                        .html('');
                }
                obj.box = box;
            }
            if (!obj.box) return false;
            $(obj.box)
                .attr('name', obj.name)
                .addClass('w2ui-layout')
                .html('<div></div>');
            if ($(obj.box).length > 0) $(obj.box)[0].style.cssText += obj.style;
            // create all panels
            for (var p1 = 0; p1 < w2panels.length; p1++) {
                var pan  = obj.get(w2panels[p1]);
                var html =  '<div id="layout_'+ obj.name + '_panel_'+ w2panels[p1] +'" class="w2ui-panel">'+
                            '    <div class="w2ui-panel-title"></div>'+
                            '    <div class="w2ui-panel-tabs"></div>'+
                            '    <div class="w2ui-panel-toolbar"></div>'+
                            '    <div class="w2ui-panel-content"></div>'+
                            '</div>'+
                            '<div id="layout_'+ obj.name + '_resizer_'+ w2panels[p1] +'" class="w2ui-resizer"></div>';
                $(obj.box).find(' > div').append(html);
                // tabs are rendered in refresh()
            }
            $(obj.box).find(' > div')
                .append('<div id="layout_'+ obj.name + '_panel_css" style="position: absolute; top: 10000px;"></div>');
            obj.refresh(); // if refresh is not called here, the layout will not be available right after initialization
            // process event
            obj.trigger($.extend(edata, { phase: 'after' }));
            // reinit events
            setTimeout(function () { // needed this timeout to allow browser to render first if there are tabs or toolbar
                initEvents();
                obj.resize();
            }, 0);
            return (new Date()).getTime() - time;

            function initEvents() {
                obj.tmp.events = {
                    resize : function (event) {
                        w2ui[obj.name].resize();
                    },
                    resizeStart : resizeStart,
                    mouseMove   : resizeMove,
                    mouseUp     : resizeStop
                };
                $(window).on('resize', obj.tmp.events.resize);
            }

            function resizeStart(type, evnt) {
                if (!obj.box) return;
                if (!evnt) evnt = window.event;
                $(document).off('mousemove', obj.tmp.events.mouseMove).on('mousemove', obj.tmp.events.mouseMove);
                $(document).off('mouseup', obj.tmp.events.mouseUp).on('mouseup', obj.tmp.events.mouseUp);
                obj.tmp.resize = {
                    type    : type,
                    x       : evnt.screenX,
                    y       : evnt.screenY,
                    diff_x  : 0,
                    diff_y  : 0,
                    value   : 0
                };
                // lock all panels
                for (var p1 = 0; p1 < w2panels.length; p1++) {
                    var $tmp = $(obj.el(w2panels[p1])).parent().find('.w2ui-lock');
                    if ($tmp.length > 0) {
                        $tmp.attr('locked', 'previous');
                    } else {
                        obj.lock(w2panels[p1], { opacity: 0 });
                    }
                }
                if (type == 'left' || type == 'right') {
                    obj.tmp.resize.value = parseInt($('#layout_'+ obj.name +'_resizer_'+ type)[0].style.left);
                }
                if (type == 'top' || type == 'preview' || type == 'bottom') {
                    obj.tmp.resize.value = parseInt($('#layout_'+ obj.name +'_resizer_'+ type)[0].style.top);
                }
            }

            function resizeStop(evnt) {
                if (!obj.box) return;
                if (!evnt) evnt = window.event;
                $(document).off('mousemove', obj.tmp.events.mouseMove);
                $(document).off('mouseup', obj.tmp.events.mouseUp);
                if (obj.tmp.resize == null) return;
                // unlock all panels
                for (var p1 = 0; p1 < w2panels.length; p1++) {
                    var $tmp = $(obj.el(w2panels[p1])).parent().find('.w2ui-lock');
                    if ($tmp.attr('locked') == 'previous') {
                        $tmp.removeAttr('locked');
                    } else {
                        obj.unlock(w2panels[p1]);
                    }
                }
                // set new size
                if (obj.tmp.diff_x !== 0 || obj.tmp.resize.diff_y !== 0) { // only recalculate if changed
                    var ptop    = obj.get('top');
                    var pbottom = obj.get('bottom');
                    var panel   = obj.get(obj.tmp.resize.type);
                    var height  = parseInt($(obj.box).height());
                    var width   = parseInt($(obj.box).width());
                    var str     = String(panel.size);
                    var ns, nd;
                    switch (obj.tmp.resize.type) {
                        case 'top':
                            ns = parseInt(panel.sizeCalculated) + obj.tmp.resize.diff_y;
                            nd = 0;
                            break;
                        case 'bottom':
                            ns = parseInt(panel.sizeCalculated) - obj.tmp.resize.diff_y;
                            nd = 0;
                            break;
                        case 'preview':
                            ns = parseInt(panel.sizeCalculated) - obj.tmp.resize.diff_y;
                            nd = (ptop && !ptop.hidden ? ptop.sizeCalculated : 0) +
                                (pbottom && !pbottom.hidden ? pbottom.sizeCalculated : 0);
                            break;
                        case 'left':
                            ns = parseInt(panel.sizeCalculated) + obj.tmp.resize.diff_x;
                            nd = 0;
                            break;
                        case 'right':
                            ns = parseInt(panel.sizeCalculated) - obj.tmp.resize.diff_x;
                            nd = 0;
                            break;
                    }
                    // set size
                    if (str.substr(str.length-1) == '%') {
                        panel.size = Math.floor(ns * 100 / (panel.type == 'left' || panel.type == 'right' ? width : height - nd) * 100) / 100 + '%';
                    } else {
                        if (String(panel.size).substr(0, 1) == '-') {
                            panel.size = parseInt(panel.size) - panel.sizeCalculated + ns;
                        } else {
                            panel.size = ns;
                        }
                    }
                    obj.resize();
                }
                $('#layout_'+ obj.name + '_resizer_'+ obj.tmp.resize.type).removeClass('active');
                delete obj.tmp.resize;
            }

            function resizeMove(evnt) {
                if (!obj.box) return;
                if (!evnt) evnt = window.event;
                if (obj.tmp.resize == null) return;
                var panel = obj.get(obj.tmp.resize.type);
                // event before
                var tmp = obj.tmp.resize;
                var edata = obj.trigger({ phase: 'before', type: 'resizing', target: obj.name, object: panel, originalEvent: evnt,
                    panel: tmp ? tmp.type : 'all', diff_x: tmp ? tmp.diff_x : 0, diff_y: tmp ? tmp.diff_y : 0 });
                if (edata.isCancelled === true) return;

                var p         = $('#layout_'+ obj.name + '_resizer_'+ tmp.type);
                var resize_x  = (evnt.screenX - tmp.x);
                var resize_y  = (evnt.screenY - tmp.y);
                var mainPanel = obj.get('main');

                if (!p.hasClass('active')) p.addClass('active');

                switch (tmp.type) {
                    case 'left':
                        if (panel.minSize - resize_x > panel.width) {
                            resize_x = panel.minSize - panel.width;
                        }
                        if (panel.maxSize && (panel.width + resize_x > panel.maxSize)) {
                            resize_x = panel.maxSize - panel.width;
                        }
                        if (mainPanel.minSize + resize_x > mainPanel.width) {
                            resize_x = mainPanel.width - mainPanel.minSize;
                        }
                        break;

                    case 'right':
                        if (panel.minSize + resize_x > panel.width) {
                            resize_x = panel.width - panel.minSize;
                        }
                        if (panel.maxSize && (panel.width - resize_x > panel.maxSize)) {
                            resize_x = panel.width - panel.maxSize;
                        }
                        if (mainPanel.minSize - resize_x > mainPanel.width) {
                            resize_x = mainPanel.minSize - mainPanel.width;
                        }
                        break;

                    case 'top':
                        if (panel.minSize - resize_y > panel.height) {
                            resize_y = panel.minSize - panel.height;
                        }
                        if (panel.maxSize && (panel.height + resize_y > panel.maxSize)) {
                            resize_y = panel.maxSize - panel.height;
                        }
                        if (mainPanel.minSize + resize_y > mainPanel.height) {
                            resize_y = mainPanel.height - mainPanel.minSize;
                        }
                        break;

                    case 'preview':
                    case 'bottom':
                        if (panel.minSize + resize_y > panel.height) {
                            resize_y = panel.height - panel.minSize;
                        }
                        if (panel.maxSize && (panel.height - resize_y > panel.maxSize)) {
                            resize_y = panel.height - panel.maxSize;
                        }
                        if (mainPanel.minSize - resize_y > mainPanel.height) {
                            resize_y = mainPanel.minSize - mainPanel.height;
                        }
                        break;
                }
                tmp.diff_x = resize_x;
                tmp.diff_y = resize_y;

                switch (tmp.type) {
                    case 'top':
                    case 'preview':
                    case 'bottom':
                        tmp.diff_x = 0;
                        if (p.length > 0) p[0].style.top = (tmp.value + tmp.diff_y) + 'px';
                        break;

                    case 'left':
                    case 'right':
                        tmp.diff_y = 0;
                        if (p.length > 0) p[0].style.left = (tmp.value + tmp.diff_x) + 'px';
                        break;
                }
                // event after
                obj.trigger($.extend(edata, { phase: 'after' }));
            }
        },

        refresh: function (panel) {
            var obj = this;
            // if (window.getSelection) window.getSelection().removeAllRanges(); // clear selection
            if (panel == null) panel = null;
            var time = (new Date()).getTime();
            // event before
            var edata = obj.trigger({ phase: 'before', type: 'refresh', target: (panel != null ? panel : obj.name), object: obj.get(panel) });
            if (edata.isCancelled === true) return;
            // obj.unlock(panel);
            if (typeof panel == 'string') {
                var p = obj.get(panel);
                if (p == null) return;
                var pname = '#layout_'+ obj.name + '_panel_'+ p.type;
                var rname = '#layout_'+ obj.name +'_resizer_'+ p.type;
                // apply properties to the panel
                $(pname).css({ display: p.hidden ? 'none' : 'block' });
                if (p.resizable) $(rname).show(); else $(rname).hide();
                // insert content
                if (typeof p.content == 'object' && typeof p.content.render === 'function') {
                    p.content.box = $(pname +'> .w2ui-panel-content')[0];
                    setTimeout(function () {
                        // need to remove unnecessary classes
                        if ($(pname +'> .w2ui-panel-content').length > 0) {
                            $(pname +'> .w2ui-panel-content')
                                .removeClass()
                                .removeAttr('name')
                                .addClass('w2ui-panel-content')
                                .css('overflow', p.overflow)[0].style.cssText += ';' + p.style;
                        }
                        if (p.content && typeof p.content.render == 'function') {
                           p.content.render(); // do not do .render(box);
                        }
                    }, 1);
                } else {
                    // need to remove unnecessary classes
                    if ($(pname +'> .w2ui-panel-content').length > 0) {
                        $(pname +'> .w2ui-panel-content')
                            .removeClass()
                            .removeAttr('name')
                            .addClass('w2ui-panel-content')
                            .html(p.content)
                            .css('overflow', p.overflow)[0].style.cssText += ';' + p.style;
                    }
                }
                // if there are tabs and/or toolbar - render it
                var tmp = $(obj.box).find(pname +'> .w2ui-panel-tabs');
                if (p.show.tabs) {
                    if (tmp.find('[name='+ p.tabs.name +']').length === 0 && p.tabs != null) tmp.w2render(p.tabs); else p.tabs.refresh();
                } else {
                    tmp.html('').removeClass('w2ui-tabs').hide();
                }
                tmp = $(obj.box).find(pname +'> .w2ui-panel-toolbar');
                if (p.show.toolbar) {
                    if (tmp.find('[name='+ p.toolbar.name +']').length === 0 && p.toolbar != null) tmp.w2render(p.toolbar); else p.toolbar.refresh();
                } else {
                    tmp.html('').removeClass('w2ui-toolbar').hide();
                }
                // show title
                tmp = $(obj.box).find(pname +'> .w2ui-panel-title');
                if (p.title) {
                    tmp.html(p.title).show();
                } else {
                    tmp.html('').hide();
                }
            } else {
                if ($('#layout_'+ obj.name +'_panel_main').length === 0) {
                    obj.render();
                    return;
                }
                obj.resize();
                // refresh all of them
                for (var p1 = 0; p1 < this.panels.length; p1++) { obj.refresh(this.panels[p1].type); }
            }
            obj.trigger($.extend(edata, { phase: 'after' }));
            return (new Date()).getTime() - time;
        },

        resize: function () {
            // if (window.getSelection) window.getSelection().removeAllRanges();    // clear selection
            if (!this.box) return false;
            var time = (new Date()).getTime();
            // event before
            var tmp = this.tmp.resize;
            var edata = this.trigger({ phase: 'before', type: 'resize', target: this.name,
                panel: tmp ? tmp.type : 'all', diff_x: tmp ? tmp.diff_x : 0, diff_y: tmp ? tmp.diff_y : 0  });
            if (edata.isCancelled === true) return;
            if (this.padding < 0) this.padding = 0;

            // layout itself
            var width  = parseInt($(this.box).width());
            var height = parseInt($(this.box).height());
            $(this.box).find(' > div').css({
                width    : width + 'px',
                height    : height + 'px'
            });
            var obj = this;
            // panels
            var pmain   = this.get('main');
            var pprev   = this.get('preview');
            var pleft   = this.get('left');
            var pright  = this.get('right');
            var ptop    = this.get('top');
            var pbottom = this.get('bottom');
            var smain   = true; // main always on
            var sprev   = (pprev != null && pprev.hidden !== true ? true : false);
            var sleft   = (pleft != null && pleft.hidden !== true ? true : false);
            var sright  = (pright != null && pright.hidden !== true ? true : false);
            var stop    = (ptop != null && ptop.hidden !== true ? true : false);
            var sbottom = (pbottom != null && pbottom.hidden !== true ? true : false);
            var l, t, w, h, e;
            // calculate %
            for (var p = 0; p < w2panels.length; p++) {
                if (w2panels[p] === 'main') continue;
                tmp = this.get(w2panels[p]);
                if (!tmp) continue;
                var str = String(tmp.size || 0);
                if (str.substr(str.length-1) == '%') {
                    var tmph = height;
                    if (tmp.type == 'preview') {
                        tmph = tmph -
                            (ptop && !ptop.hidden ? ptop.sizeCalculated : 0) -
                            (pbottom && !pbottom.hidden ? pbottom.sizeCalculated : 0);
                    }
                    tmp.sizeCalculated = parseInt((tmp.type == 'left' || tmp.type == 'right' ? width : tmph) * parseFloat(tmp.size) / 100);
                } else {
                    tmp.sizeCalculated = parseInt(tmp.size);
                }
                tmp.sizeCalculated = Math.max(tmp.sizeCalculated, parseInt(tmp.minSize));
            }
            // negative size
            if (String(pright.size).substr(0, 1) == '-') {
                if (sleft && pleft.size.substr(0, 1) == '-') {
                    console.log('ERROR: you cannot have both left panel.size and right panel.size be negative.');
                } else {
                    pright.sizeCalculated = width - (sleft ? pleft.sizeCalculated : 0) + parseInt(pright.size);
                }
            }
            if (String(pleft.size).substr(0, 1) == '-') {
                if (sright && pright.size.substr(0, 1) == '-') {
                    console.log('ERROR: you cannot have both left panel.size and right panel.size be negative.');
                } else {
                    pleft.sizeCalculated = width - (sright ? pright.sizeCalculated : 0) + parseInt(pleft.size);
                }
            }
            // top if any
            if (ptop != null && ptop.hidden !== true) {
                l = 0;
                t = 0;
                w = width;
                h = ptop.sizeCalculated;
                $('#layout_'+ this.name +'_panel_top').css({
                    'display': 'block',
                    'left': l + 'px',
                    'top': t + 'px',
                    'width': w + 'px',
                    'height': h + 'px'
                }).show();
                ptop.width  = w;
                ptop.height = h;
                // resizer
                if (ptop.resizable) {
                    t = ptop.sizeCalculated - (this.padding === 0 ? this.resizer : 0);
                    h = (this.resizer > this.padding ? this.resizer : this.padding);
                    $('#layout_'+ this.name +'_resizer_top').show().css({
                        'display': 'block',
                        'left': l + 'px',
                        'top': t + 'px',
                        'width': w + 'px',
                        'height': h + 'px',
                        'cursor': 'ns-resize'
                    }).off('mousedown').on('mousedown', function (event) {
                        // event before
                        var edata = obj.trigger({ phase: 'before', type: 'resizerClick', target: 'top', originalEvent: event });
                        if (edata.isCancelled === true) return;
                        // default action
                        w2ui[obj.name].tmp.events.resizeStart('top', event);
                        // event after
                        obj.trigger($.extend(edata, { phase: 'after' }));
                        return false;
                    });
                }
            } else {
                $('#layout_'+ this.name +'_panel_top').hide();
                $('#layout_'+ this.name +'_resizer_top').hide();
            }
            // left if any
            if (pleft != null && pleft.hidden !== true) {
                l = 0;
                t = 0 + (stop ? ptop.sizeCalculated + this.padding : 0);
                w = pleft.sizeCalculated;
                h = height - (stop ? ptop.sizeCalculated + this.padding : 0) -
                        (sbottom ? pbottom.sizeCalculated + this.padding : 0);
                e = $('#layout_'+ this.name +'_panel_left');
                if (window.navigator.userAgent.indexOf('MSIE') != -1 && e.length > 0 && e[0].clientHeight < e[0].scrollHeight) w += 17; // IE hack
                e.css({
                    'display': 'block',
                    'left': l + 'px',
                    'top': t + 'px',
                    'width': w + 'px',
                    'height': h + 'px'
                }).show();
                pleft.width  = w;
                pleft.height = h;
                // resizer
                if (pleft.resizable) {
                    l = pleft.sizeCalculated - (this.padding === 0 ? this.resizer : 0);
                    w = (this.resizer > this.padding ? this.resizer : this.padding);
                    $('#layout_'+ this.name +'_resizer_left').show().css({
                        'display': 'block',
                        'left': l + 'px',
                        'top': t + 'px',
                        'width': w + 'px',
                        'height': h + 'px',
                        'cursor': 'ew-resize'
                    }).off('mousedown').on('mousedown', function (event) {
                        // event before
                        var edata = obj.trigger({ phase: 'before', type: 'resizerClick', target: 'left', originalEvent: event });
                        if (edata.isCancelled === true) return;
                        // default action
                        w2ui[obj.name].tmp.events.resizeStart('left', event);
                        // event after
                        obj.trigger($.extend(edata, { phase: 'after' }));
                        return false;
                    });
                }
            } else {
                $('#layout_'+ this.name +'_panel_left').hide();
                $('#layout_'+ this.name +'_resizer_left').hide();
            }
            // right if any
            if (pright != null && pright.hidden !== true) {
                l = width - pright.sizeCalculated;
                t = 0 + (stop ? ptop.sizeCalculated + this.padding : 0);
                w = pright.sizeCalculated;
                h = height - (stop ? ptop.sizeCalculated + this.padding : 0) -
                    (sbottom ? pbottom.sizeCalculated + this.padding : 0);
                $('#layout_'+ this.name +'_panel_right').css({
                    'display': 'block',
                    'left': l + 'px',
                    'top': t + 'px',
                    'width': w + 'px',
                    'height': h + 'px'
                }).show();
                pright.width  = w;
                pright.height = h;
                // resizer
                if (pright.resizable) {
                    l = l - this.padding;
                    w = (this.resizer > this.padding ? this.resizer : this.padding);
                    $('#layout_'+ this.name +'_resizer_right').show().css({
                        'display': 'block',
                        'left': l + 'px',
                        'top': t + 'px',
                        'width': w + 'px',
                        'height': h + 'px',
                        'cursor': 'ew-resize'
                    }).off('mousedown').on('mousedown', function (event) {
                        // event before
                        var edata = obj.trigger({ phase: 'before', type: 'resizerClick', target: 'right', originalEvent: event });
                        if (edata.isCancelled === true) return;
                        // default action
                        w2ui[obj.name].tmp.events.resizeStart('right', event);
                        // event after
                        obj.trigger($.extend(edata, { phase: 'after' }));
                        return false;
                    });
                }
            } else {
                $('#layout_'+ this.name +'_panel_right').hide();
                $('#layout_'+ this.name +'_resizer_right').hide();
            }
            // bottom if any
            if (pbottom != null && pbottom.hidden !== true) {
                l = 0;
                t = height - pbottom.sizeCalculated;
                w = width;
                h = pbottom.sizeCalculated;
                $('#layout_'+ this.name +'_panel_bottom').css({
                    'display': 'block',
                    'left': l + 'px',
                    'top': t + 'px',
                    'width': w + 'px',
                    'height': h + 'px'
                }).show();
                pbottom.width  = w;
                pbottom.height = h;
                // resizer
                if (pbottom.resizable) {
                    t = t - (this.padding === 0 ? 0 : this.padding);
                    h = (this.resizer > this.padding ? this.resizer : this.padding);
                    $('#layout_'+ this.name +'_resizer_bottom').show().css({
                        'display': 'block',
                        'left': l + 'px',
                        'top': t + 'px',
                        'width': w + 'px',
                        'height': h + 'px',
                        'cursor': 'ns-resize'
                    }).off('mousedown').on('mousedown', function (event) {
                        // event before
                        var edata = obj.trigger({ phase: 'before', type: 'resizerClick', target: 'bottom', originalEvent: event });
                        if (edata.isCancelled === true) return;
                        // default action
                        w2ui[obj.name].tmp.events.resizeStart('bottom', event);
                        // event after
                        obj.trigger($.extend(edata, { phase: 'after' }));
                        return false;
                    });
                }
            } else {
                $('#layout_'+ this.name +'_panel_bottom').hide();
                $('#layout_'+ this.name +'_resizer_bottom').hide();
            }
            // main - always there
            l = 0 + (sleft ? pleft.sizeCalculated + this.padding : 0);
            t = 0 + (stop ? ptop.sizeCalculated + this.padding : 0);
            w = width  - (sleft ? pleft.sizeCalculated + this.padding : 0) -
                (sright ? pright.sizeCalculated + this.padding: 0);
            h = height - (stop ? ptop.sizeCalculated + this.padding : 0) -
                (sbottom ? pbottom.sizeCalculated + this.padding : 0) -
                (sprev ? pprev.sizeCalculated + this.padding : 0);
            e = $('#layout_'+ this.name +'_panel_main');
            if (window.navigator.userAgent.indexOf('MSIE') != -1 && e.length > 0 && e[0].clientHeight < e[0].scrollHeight) w += 17; // IE hack
            e.css({
                'display': 'block',
                'left': l + 'px',
                'top': t + 'px',
                'width': w + 'px',
                'height': h + 'px'
            });
            pmain.width  = w;
            pmain.height = h;

            // preview if any
            if (pprev != null && pprev.hidden !== true) {
                l = 0 + (sleft ? pleft.sizeCalculated + this.padding : 0);
                t = height - (sbottom ? pbottom.sizeCalculated + this.padding : 0) - pprev.sizeCalculated;
                w = width  - (sleft ? pleft.sizeCalculated + this.padding : 0) -
                    (sright ? pright.sizeCalculated + this.padding : 0);
                h = pprev.sizeCalculated;
                e = $('#layout_'+ this.name +'_panel_preview');
                if (window.navigator.userAgent.indexOf('MSIE') != -1 && e.length > 0 && e[0].clientHeight < e[0].scrollHeight) w += 17; // IE hack
                e.css({
                    'display': 'block',
                    'left': l + 'px',
                    'top': t + 'px',
                    'width': w + 'px',
                    'height': h + 'px'
                }).show();
                pprev.width  = w;
                pprev.height = h;
                // resizer
                if (pprev.resizable) {
                    t = t - (this.padding === 0 ? 0 : this.padding);
                    h = (this.resizer > this.padding ? this.resizer : this.padding);
                    $('#layout_'+ this.name +'_resizer_preview').show().css({
                        'display': 'block',
                        'left': l + 'px',
                        'top': t + 'px',
                        'width': w + 'px',
                        'height': h + 'px',
                        'cursor': 'ns-resize'
                    }).off('mousedown').on('mousedown', function (event) {
                        // event before
                        var edata = obj.trigger({ phase: 'before', type: 'resizerClick', target: 'preview', originalEvent: event });
                        if (edata.isCancelled === true) return;
                        // default action
                        w2ui[obj.name].tmp.events.resizeStart('preview', event);
                        // event after
                        obj.trigger($.extend(edata, { phase: 'after' }));
                        return false;
                    });
                }
            } else {
                $('#layout_'+ this.name +'_panel_preview').hide();
                $('#layout_'+ this.name +'_resizer_preview').hide();
            }

            // display tabs and toolbar if needed
            for (var p1 = 0; p1 < w2panels.length; p1++) {
                var pan = this.get(w2panels[p1]);
                var tmp2 = '#layout_'+ this.name +'_panel_'+ w2panels[p1] +' > .w2ui-panel-';
                var tabHeight = 0;
                if (pan) {
                    if (pan.title) {
                        tabHeight += w2utils.getSize($(tmp2 + 'title').css({ top: tabHeight + 'px', display: 'block' }), 'height');
                    }
                    if (pan.show.tabs) {
                        if (pan.tabs != null && w2ui[this.name +'_'+ w2panels[p1] +'_tabs']) w2ui[this.name +'_'+ w2panels[p1] +'_tabs'].resize();
                        tabHeight += w2utils.getSize($(tmp2 + 'tabs').css({ top: tabHeight + 'px', display: 'block' }), 'height');
                    }
                    if (pan.show.toolbar) {
                        if (pan.toolbar != null && w2ui[this.name +'_'+ w2panels[p1] +'_toolbar']) w2ui[this.name +'_'+ w2panels[p1] +'_toolbar'].resize();
                        tabHeight += w2utils.getSize($(tmp2 + 'toolbar').css({ top: tabHeight + 'px', display: 'block' }), 'height');
                    }
                }
                $(tmp2 + 'content').css({ display: 'block' }).css({ top: tabHeight + 'px' });
            }
            // send resize to all objects
            clearTimeout(this._resize_timer);
            this._resize_timer = setTimeout(function () {
                for (var e in w2ui) {
                    if (typeof w2ui[e].resize == 'function') {
                        // sent to all none-layouts
                        if (w2ui[e].panels == null) w2ui[e].resize();
                        // only send to nested layouts
                        var parent = $(w2ui[e].box).parents('.w2ui-layout');
                        if (parent.length > 0 && parent.attr('name') == obj.name) w2ui[e].resize();
                    }
                }
            }, 100);
            this.trigger($.extend(edata, { phase: 'after' }));
            return (new Date()).getTime() - time;
        },

        destroy: function () {
            // event before
            var edata = this.trigger({ phase: 'before', type: 'destroy', target: this.name });
            if (edata.isCancelled === true) return;
            if (w2ui[this.name] == null) return false;
            // clean up
            if ($(this.box).find('#layout_'+ this.name +'_panel_main').length > 0) {
                $(this.box)
                    .removeAttr('name')
                    .removeClass('w2ui-layout')
                    .html('');
            }
            delete w2ui[this.name];
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            if (this.tmp.events && this.tmp.events.resize) $(window).off('resize', this.tmp.events.resize);
            return true;
        },

        lock: function (panel, msg, showSpinner) {
            if (w2panels.indexOf(panel) == -1) {
                console.log('ERROR: First parameter needs to be the a valid panel name.');
                return;
            }
            var args = Array.prototype.slice.call(arguments, 0);
            args[0]  = '#layout_'+ this.name + '_panel_' + panel;
            w2utils.lock.apply(window, args);
        },

        unlock: function (panel, speed) {
            if (w2panels.indexOf(panel) == -1) {
                console.log('ERROR: First parameter needs to be the a valid panel name.');
                return;
            }
            var nm = '#layout_'+ this.name + '_panel_' + panel;
            w2utils.unlock(nm, speed);
        }
    };

    $.extend(w2layout.prototype, w2utils.event);
    w2obj.layout = w2layout;
})(jQuery);

/************************************************************************
*   Library: Web 2.0 UI for jQuery (using prototypical inheritance)
*   - Following objects defined
*        - w2popup      - popup widget
*        - $().w2popup  - jQuery wrapper
*   - Dependencies: jQuery, w2utils
*
* == NICE TO HAVE ==
*   - hide overlay on esc
*   - make popup width/height in %
*
************************************************************************/

var w2popup = {};

(function ($) {

    // ====================================================
    // -- Registers as a jQuery plugin

    $.fn.w2popup = function(method, options) {
        if (method == null) {
            options = {};
            method  = 'open';
        }
        if ($.isPlainObject(method)) {
            options = method;
            method  = 'open';
        }
        method = method.toLowerCase();
        if (method === 'load' && typeof options === 'string') {
            options = $.extend({ url: options }, arguments.length > 2 ? arguments[2] : {});
        }
        if (method === 'open' && options.url != null) method = 'load';
        options = options || {};
        // load options from markup
        var dlgOptions = {};
        if ($(this).length > 0 && method == 'open') {
            if ($(this).find('div[rel=title], div[rel=body], div[rel=buttons]').length > 0) {
                // remember previous tempalte
                if ($('#w2ui-popup').length > 0) {
                    var tmp  = $('#w2ui-popup').data('options');
                    w2popup._prev = {
                        template : w2popup._template,
                        title    : tmp.title,
                        body     : tmp.body,
                        buttons  : tmp.buttons
                    };
                }
                w2popup._template = this;

                if ($(this).find('div[rel=title]').length > 0) {
                    dlgOptions['title'] = $(this).find('div[rel=title]');
                }
                if ($(this).find('div[rel=body]').length > 0) {
                    dlgOptions['body']  = $(this).find('div[rel=body]');
                    dlgOptions['style'] = $(this).find('div[rel=body]')[0].style.cssText;
                }
                if ($(this).find('div[rel=buttons]').length > 0) {
                    dlgOptions['buttons'] = $(this).find('div[rel=buttons]');
                }
            } else {
                dlgOptions['title'] = '&#160;';
                dlgOptions['body']  = $(this).html();
            }
            if (parseInt($(this).css('width')) !== 0)  dlgOptions['width']  = parseInt($(this).css('width'));
            if (parseInt($(this).css('height')) !== 0) dlgOptions['height'] = parseInt($(this).css('height'));
        }
        // show popup
        return w2popup[method]($.extend({}, dlgOptions, options));
    };

    // ====================================================
    // -- Implementation of core functionality (SINGLETON)

    w2popup = {
        defaults: {
            title     : '',
            body      : '',
            buttons   : '',
            style     : '',
            color     : '#000',
            opacity   : 0.4,
            speed     : 0.3,
            modal     : false,
            maximized : false,
            keyboard  : true,     // will close popup on esc if not modal
            width     : 500,
            height    : 300,
            showClose : true,
            showMax   : false,
            transition: null
        },
        status    : 'closed',     // string that describes current status
        handlers  : [],
        onOpen    : null,
        onClose   : null,
        onMax     : null,
        onMin     : null,
        onToggle  : null,
        onKeydown : null,

        open: function (options) {
            var obj = this;
            if (w2popup.status == 'closing') {
                setTimeout(function () { obj.open.call(obj, options); }, 100);
                return;
            }
            // get old options and merge them
            var old_options = $('#w2ui-popup').data('options');
            var options = $.extend({}, this.defaults, old_options, { title: '', body : '', buttons: '' }, options, { maximized: false });
            // need timer because popup might not be open
            setTimeout(function () { $('#w2ui-popup').data('options', options); }, 100);
            // if new - reset event handlers
            if ($('#w2ui-popup').length === 0) {
                // w2popup.handlers  = []; // if commented, allows to add w2popup.on() for all
                w2popup.onMax     = null;
                w2popup.onMin     = null;
                w2popup.onToggle  = null;
                w2popup.onOpen    = null;
                w2popup.onClose   = null;
                w2popup.onKeydown = null;
            }
            if (options.onOpen)    w2popup.onOpen    = options.onOpen;
            if (options.onClose)   w2popup.onClose   = options.onClose;
            if (options.onMax)     w2popup.onMax     = options.onMax;
            if (options.onMin)     w2popup.onMin     = options.onMin;
            if (options.onToggle)  w2popup.onToggle  = options.onToggle;
            if (options.onKeydown) w2popup.onKeydown = options.onKeydown;
            options.width  = parseInt(options.width);
            options.height = parseInt(options.height);

            var maxW, maxH;
            if (window.innerHeight == undefined) {
                maxW  = parseInt(document.documentElement.offsetWidth);
                maxH = parseInt(document.documentElement.offsetHeight);
                if (w2utils.engine === 'IE7') { maxW += 21; maxH += 4; }
            } else {
                maxW  = parseInt(window.innerWidth);
                maxH = parseInt(window.innerHeight);
            }
            if (maxW  - 10 < options.width) options.width  = maxW  - 10;
            if (maxH - 10 < options.height) options.height = maxH - 10;
            var top  = (maxH - options.height) / 2 * 0.6;
            var left = (maxW - options.width) / 2;

            // check if message is already displayed
            if ($('#w2ui-popup').length === 0) {
                // trigger event
                var edata = this.trigger({ phase: 'before', type: 'open', target: 'popup', options: options, present: false });
                if (edata.isCancelled === true) return;
                w2popup.status = 'opening';
                // output message
                w2popup.lockScreen(options);
                var btn = '';
                if (options.showClose) {
                    btn += '<div class="w2ui-popup-button w2ui-popup-close" onmousedown="event.stopPropagation()" onclick="w2popup.close()">Close</div>';
                }
                if (options.showMax) {
                    btn += '<div class="w2ui-popup-button w2ui-popup-max" onmousedown="event.stopPropagation()" onclick="w2popup.toggle()">Max</div>';
                }
                // first insert just body
                var msg = '<div id="w2ui-popup" class="w2ui-popup" style="opacity: 0; left: '+ left +'px; top: '+ top +'px;'+
                          '     width: ' + parseInt(options.width) + 'px; height: ' + parseInt(options.height) + 'px; '+
                              w2utils.cssPrefix('transform', 'scale(0.8)', true) + '"></div>';
                $('body').append(msg);
                // parse rel=*
                var parts = $('#w2ui-popup');
                if (parts.find('div[rel=title], div[rel=body], div[rel=buttons]').length > 0) {
                    // title
                    var tmp = parts.find('div[rel=title]');
                    if (tmp.length > 0) { options.title = tmp.html(); tmp.remove(); }
                    // buttons
                    var tmp = parts.find('div[rel=buttons]');
                    if (tmp.length > 0) { options.buttons = tmp.html(); tmp.remove(); }
                    // body
                    var tmp = parts.find('div[rel=body]');
                    if (tmp.length > 0) options.body = tmp.html(); else options.body = parts.html();
                }
                // then content
                var msg = '<div class="w2ui-popup-title" style="'+ (!options.title ? 'display: none' : '') +'">' + btn + '</div>'+
                          '<div class="w2ui-box" style="'+ (!options.title ? 'top: 0px !important;' : '') +
                                    (!options.buttons ? 'bottom: 0px !important;' : '') + '">'+
                          '    <div class="w2ui-popup-body' + (!options.title !== '' ? ' w2ui-popup-no-title' : '') +
                                    (!options.buttons ? ' w2ui-popup-no-buttons' : '') + '" style="' + options.style + '">' +
                          '    </div>'+
                          '</div>'+
                          '<div class="w2ui-popup-buttons" style="'+ (!options.buttons ? 'display: none' : '') +'"></div>'+
                          '<input class="w2ui-popup-hidden" style="position: absolute; top: -100px"/>'; // this is needed to keep focus in popup
                $('#w2ui-popup').html(msg);

                if (options.title) $('#w2ui-popup .w2ui-popup-title').append(options.title);
                if (options.buttons) $('#w2ui-popup .w2ui-popup-buttons').append(options.buttons);
                if (options.body) $('#w2ui-popup .w2ui-popup-body').append(options.body);

                // allow element to render
                setTimeout(function () {
                    $('#w2ui-popup')
                        .css('opacity', '1')
                        .css(w2utils.cssPrefix({
                            'transition': options.speed + 's opacity, ' + options.speed + 's -webkit-transform',
                            'transform' : 'scale(1)'
                        }));
                        obj.focus();
                }, 1);
                // clean transform
                setTimeout(function () {
                    $('#w2ui-popup').css(w2utils.cssPrefix('transform', ''));
                    // event after
                    w2popup.status = 'open';
                    setTimeout(function () {
                        obj.trigger($.extend(edata, { phase: 'after' }));
                    }, 100);
                }, options.speed * 1000);

            } else {
                // if was from template and now not
                if (w2popup._prev == null && w2popup._template != null) obj.restoreTemplate();

                // trigger event
                var edata = this.trigger({ phase: 'before', type: 'open', target: 'popup', options: options, present: true });
                if (edata.isCancelled === true) return;
                // check if size changed
                w2popup.status = 'opening';
                if (old_options != null) {
                    if (!old_options.maximized && (old_options['width'] != options['width'] || old_options['height'] != options['height'])) {
                        w2popup.resize(options.width, options.height);
                    }
                    options.prevSize  = options.width + 'px:' + options.height + 'px';
                    options.maximized = old_options.maximized;
                }
                // show new items
                var cloned = $('#w2ui-popup .w2ui-box').clone();
                cloned.removeClass('w2ui-box').addClass('w2ui-box-temp').find('.w2ui-popup-body').empty().append(options.body);
                // parse rel=*
                if (typeof options.body == 'string' && cloned.find('div[rel=title], div[rel=body], div[rel=buttons]').length > 0) {
                    // title
                    var tmp = cloned.find('div[rel=title]');
                    if (tmp.length > 0) { options['title'] = tmp.html(); tmp.remove(); }
                    // buttons
                    var tmp = cloned.find('div[rel=buttons]');
                    if (tmp.length > 0) { options['buttons'] = tmp.html(); tmp.remove(); }
                    // body
                    var tmp = cloned.find('div[rel=body]');
                    if (tmp.length > 0) options['body'] = tmp.html(); else options['body'] = cloned.html();
                    // set proper body
                    cloned.html(options.body);
                }
                $('#w2ui-popup .w2ui-box').after(cloned);

                if (options.buttons) {
                    $('#w2ui-popup .w2ui-popup-buttons').show().html('').append(options.buttons);
                    $('#w2ui-popup .w2ui-popup-body').removeClass('w2ui-popup-no-buttons');
                    $('#w2ui-popup .w2ui-box, #w2ui-popup .w2ui-box-temp').css('bottom', '');
                } else {
                    $('#w2ui-popup .w2ui-popup-buttons').hide().html('');
                    $('#w2ui-popup .w2ui-popup-body').addClass('w2ui-popup-no-buttons');
                    $('#w2ui-popup .w2ui-box, #w2ui-popup .w2ui-box-temp').css('bottom', '0px');
                }
                if (options.title) {
                    $('#w2ui-popup .w2ui-popup-title')
                        .show()
                        .html((options.showClose ? '<div class="w2ui-popup-button w2ui-popup-close" onmousedown="event.stopPropagation()" onclick="w2popup.close()">Close</div>' : '') +
                              (options.showMax ? '<div class="w2ui-popup-button w2ui-popup-max" onmousedown="event.stopPropagation()" onclick="w2popup.toggle()">Max</div>' : ''))
                        .append(options.title);
                    $('#w2ui-popup .w2ui-popup-body').removeClass('w2ui-popup-no-title');
                    $('#w2ui-popup .w2ui-box, #w2ui-popup .w2ui-box-temp').css('top', '');
                } else {
                    $('#w2ui-popup .w2ui-popup-title').hide().html('');
                    $('#w2ui-popup .w2ui-popup-body').addClass('w2ui-popup-no-title');
                    $('#w2ui-popup .w2ui-box, #w2ui-popup .w2ui-box-temp').css('top', '0px');
                }
                // transition
                var div_old = $('#w2ui-popup .w2ui-box')[0];
                var div_new = $('#w2ui-popup .w2ui-box-temp')[0];
                w2utils.transition(div_old, div_new, options.transition, function () {
                    // clean up
                    obj.restoreTemplate();
                    $(div_old).remove();
                    $(div_new).removeClass('w2ui-box-temp').addClass('w2ui-box');
                    var $body = $(div_new).find('.w2ui-popup-body');
                    if ($body.length == 1) $body[0].style.cssText = options.style;
                    // remove max state
                    $('#w2ui-popup').data('prev-size', null);
                    // focus on first button
                    obj.focus();
                    // call event onChange
                    w2popup.status = 'open';
                    obj.trigger($.extend(edata, { phase: 'after' }));
                });
            }

            // save new options
            options._last_focus = $(':focus');
            // keyboard events
            if (options.keyboard) $(document).on('keydown', this.keydown);

            // initialize move
            var tmp = {
                resizing : false,
                mvMove   : mvMove,
                mvStop   : mvStop
            };
            $('#w2ui-popup .w2ui-popup-title').on('mousedown', function (event) {
                if (!w2popup.get().maximized) mvStart(event);
            });

            // handlers
            function mvStart(evnt) {
                if (!evnt) evnt = window.event;
                w2popup.status = 'moving';
                tmp.resizing = true;
                tmp.isLocked = $('#w2ui-popup > .w2ui-lock').length == 1 ? true : false;
                tmp.x = evnt.screenX;
                tmp.y = evnt.screenY;
                tmp.pos_x = $('#w2ui-popup').position().left;
                tmp.pos_y = $('#w2ui-popup').position().top;
                if (!tmp.isLocked) w2popup.lock({ opacity: 0 });
                $(document).on('mousemove', tmp.mvMove);
                $(document).on('mouseup', tmp.mvStop);
                if (evnt.stopPropagation) evnt.stopPropagation(); else evnt.cancelBubble = true;
                if (evnt.preventDefault) evnt.preventDefault(); else return false;
            }

            function mvMove(evnt) {
                if (tmp.resizing != true) return;
                if (!evnt) evnt = window.event;
                tmp.div_x = evnt.screenX - tmp.x;
                tmp.div_y = evnt.screenY - tmp.y;
                $('#w2ui-popup').css(w2utils.cssPrefix({
                    'transition': 'none',
                    'transform' : 'translate3d('+ tmp.div_x +'px, '+ tmp.div_y +'px, 0px)'
                }));
            }

            function mvStop(evnt) {
                if (tmp.resizing != true) return;
                if (!evnt) evnt = window.event;
                w2popup.status = 'open';
                tmp.div_x = (evnt.screenX - tmp.x);
                tmp.div_y = (evnt.screenY - tmp.y);
                $('#w2ui-popup').css({
                    'left': (tmp.pos_x + tmp.div_x) + 'px',
                    'top' : (tmp.pos_y  + tmp.div_y) + 'px'
                }).css(w2utils.cssPrefix({
                    'transition': 'none',
                    'transform' : 'translate3d(0px, 0px, 0px)'
                }));
                tmp.resizing = false;
                $(document).off('mousemove', tmp.mvMove);
                $(document).off('mouseup', tmp.mvStop);
                if (!tmp.isLocked) w2popup.unlock();
            }
            return this;
        },

        keydown: function (event) {
            var options = $('#w2ui-popup').data('options');
            if (options && !options.keyboard) return;
            // trigger event
            var edata = w2popup.trigger({ phase: 'before', type: 'keydown', target: 'popup', options: options, originalEvent: event });
            if (edata.isCancelled === true) return;
            // default behavior
            switch (event.keyCode) {
                case 27:
                    event.preventDefault();
                    if ($('#w2ui-popup .w2ui-message').length > 0) w2popup.message(); else w2popup.close();
                    break;
            }
            // event after
            w2popup.trigger($.extend(edata, { phase: 'after'}));
        },

        close: function (options) {
            var obj = this;
            var options = $.extend({}, $('#w2ui-popup').data('options'), options);
            if ($('#w2ui-popup').length === 0 || this.status == 'closed') return;
            if (this.status == 'opening') {
                setTimeout(function () { w2popup.close(); }, 100);
                return;
            }
            // trigger event
            var edata = this.trigger({ phase: 'before', type: 'close', target: 'popup', options: options });
            if (edata.isCancelled === true) return;
            // default behavior
            w2popup.status = 'closing';
            $('#w2ui-popup')
                .css('opacity', '0')
                .css(w2utils.cssPrefix({
                    'transition': options.speed + 's opacity, ' + options.speed + 's -webkit-transform',
                    'transform' : 'scale(0.9)'
                }));
            w2popup.unlockScreen(options);
            setTimeout(function () {
                // return template
                obj.restoreTemplate();
                $('#w2ui-popup').remove();
                w2popup.status = 'closed';
                // restore active
                if (options._last_focus.length > 0) options._last_focus.focus();
                // event after
                obj.trigger($.extend(edata, { phase: 'after'}));
            }, options.speed * 1000);
            // remove keyboard events
            if (options.keyboard) $(document).off('keydown', this.keydown);
        },

        toggle: function () {
            var obj     = this;
            var options = $('#w2ui-popup').data('options');
            // trigger event
            var edata = this.trigger({ phase: 'before', type: 'toggle', target: 'popup', options: options });
            if (edata.isCancelled === true) return;
            // defatul action
            if (options.maximized === true) w2popup.min(); else w2popup.max();
            // event after
            setTimeout(function () {
                obj.trigger($.extend(edata, { phase: 'after'}));
            }, (options.speed * 1000) + 50);
        },

        max: function () {
            var obj = this;
            var options = $('#w2ui-popup').data('options');
            if (options.maximized === true) return;
            // trigger event
            var edata = this.trigger({ phase: 'before', type: 'max', target: 'popup', options: options });
            if (edata.isCancelled === true) return;
            // default behavior
            w2popup.status   = 'resizing';
            options.prevSize = $('#w2ui-popup').css('width') + ':' + $('#w2ui-popup').css('height');
            // do resize
            w2popup.resize(10000, 10000, function () {
                w2popup.status    = 'open';
                options.maximized = true;
                obj.trigger($.extend(edata, { phase: 'after'}));
                // resize gird, form, layout inside popup
                $('#w2ui-popup .w2ui-grid, #w2ui-popup .w2ui-form, #w2ui-popup .w2ui-layout').each(function () {
                    var name = $(this).attr('name');
                    if (w2ui[name] && w2ui[name].resize) w2ui[name].resize();
                })
            });
        },

        min: function () {
            var obj = this;
            var options = $('#w2ui-popup').data('options');
            if (options.maximized !== true) return;
            var size = options.prevSize.split(':');
            // trigger event
            var edata = this.trigger({ phase: 'before', type: 'min', target: 'popup', options: options });
            if (edata.isCancelled === true) return;
            // default behavior
            w2popup.status = 'resizing';
            // do resize
            w2popup.resize(parseInt(size[0]), parseInt(size[1]), function () {
                w2popup.status = 'open';
                options.maximized = false;
                options.prevSize  = null;
                obj.trigger($.extend(edata, { phase: 'after'}));
                // resize gird, form, layout inside popup
                $('#w2ui-popup .w2ui-grid, #w2ui-popup .w2ui-form, #w2ui-popup .w2ui-layout').each(function () {
                    var name = $(this).attr('name');
                    if (w2ui[name] && w2ui[name].resize) w2ui[name].resize();
                })
            });
        },

        get: function () {
            return $('#w2ui-popup').data('options');
        },

        set: function (options) {
            w2popup.open(options);
        },

        clear: function() {
            $('#w2ui-popup .w2ui-popup-title').html('');
            $('#w2ui-popup .w2ui-popup-body').html('');
            $('#w2ui-popup .w2ui-popup-buttons').html('');
        },

        reset: function () {
            w2popup.open(w2popup.defaults);
        },

        load: function (options) {
            w2popup.status = 'loading';
            if (options.url == null) {
                console.log('ERROR: The url parameter is empty.');
                return;
            }
            var tmp = String(options.url).split('#');
            var url = tmp[0];
            var selector = tmp[1];
            if (options == null) options = {};
            // load url
            var html = $('#w2ui-popup').data(url);
            if (html != null) {
                popup(html, selector);
            } else {
                $.get(url, function (data, status, obj) { // should always be $.get as it is template
                    popup(obj.responseText, selector);
                    $('#w2ui-popup').data(url, obj.responseText); // remember for possible future purposes
                });
            }
            function popup(html, selector) {
                delete options.url;
                $('body').append('<div id="w2ui-tmp" style="display: none">' + html + '</div>');
                if (selector != null && $('#w2ui-tmp #'+selector).length > 0) {
                    $('#w2ui-tmp #' + selector).w2popup(options);
                } else {
                    $('#w2ui-tmp > div').w2popup(options);
                }
                // link styles
                if ($('#w2ui-tmp > style').length > 0) {
                    var style = $('<div>').append($('#w2ui-tmp > style').clone()).html();
                    if ($('#w2ui-popup #div-style').length === 0) {
                        $('#w2ui-popup').append('<div id="div-style" style="position: absolute; left: -100; width: 1px"></div>');
                    }
                    $('#w2ui-popup #div-style').html(style);
                }
                $('#w2ui-tmp').remove();
            }
        },

        message: function (options) {
            var obj = this;
            $().w2tag(); // hide all tags
            if (!options) options = { width: 200, height: 100 };
            var pWidth   = parseInt($('#w2ui-popup').width());
            var pHeight  = parseInt($('#w2ui-popup').height());
            options.originalWidth  = options.width;
            options.originalHeight = options.height;
            if (parseInt(options.width) < 10)  options.width  = 10;
            if (parseInt(options.height) < 10) options.height = 10;
            if (options.hideOnClick == null) options.hideOnClick = false;
            var poptions    = $('#w2ui-popup').data('options') || {};
            var titleHeight = parseInt($('#w2ui-popup > .w2ui-popup-title').css('height'));
            if (options.width == null || options.width > poptions.width - 10) {
                options.width = poptions.width - 10;
            }
            if (options.height == null || options.height > poptions.height - titleHeight - 5) {
                options.height = poptions.height - titleHeight - 5; // need margin from bottom only
            }
            // negative value means margin
            if (options.originalHeight < 0) options.height = pHeight + options.originalHeight - titleHeight;
            if (options.originalWidth < 0) options.width = pWidth + options.originalWidth * 2; // x 2 because there is left and right margin

            var head     = $('#w2ui-popup .w2ui-popup-title');
            var msgCount = $('#w2ui-popup .w2ui-message').length;
            // remove message
            if ($.trim(options.html) === '' && $.trim(options.body) === '' && $.trim(options.buttons) === '') {
                var $msg = $('#w2ui-popup #w2ui-message'+ (msgCount-1));
                var options = $msg.data('options') || {};
                $msg.css(w2utils.cssPrefix({
                    'transition': '0.15s',
                    'transform': 'translateY(-' + options.height + 'px)'
                }));
                if (msgCount == 1) {
                    w2popup.unlock(150);
                } else {
                    $('#w2ui-popup #w2ui-message'+ (msgCount-2)).css('z-index', 1500);
                }
                setTimeout(function () {
                    var $focus = $msg.data('prev_focus');
                    $msg.remove();
                    if ($focus && $focus.length > 0) {
                        $focus.focus();
                    } else {
                        obj.focus();
                    }
                    if (typeof options.onClose == 'function') options.onClose();
                }, 150);
            } else {
                if ($.trim(options.body) !== '' || $.trim(options.buttons) !== '') {
                    options.html = '<div class="w2ui-message-body">'+ options.body +'</div>'+
                        '<div class="w2ui-message-buttons">'+ options.buttons +'</div>';
                }
                // hide previous messages
                $('#w2ui-popup .w2ui-message').css('z-index', 1390);
                head.css('z-index', 1501);
                // add message
                $('#w2ui-popup .w2ui-box')
                    .before('<div id="w2ui-message' + msgCount + '" class="w2ui-message" style="display: none; z-index: 1500; ' +
                                (head.length === 0 ? 'top: 0px;' : 'top: ' + w2utils.getSize(head, 'height') + 'px;') +
                                (options.width  != null ? 'width: ' + options.width + 'px; left: ' + ((pWidth - options.width) / 2) + 'px;' : 'left: 10px; right: 10px;') +
                                (options.height != null ? 'height: ' + options.height + 'px;' : 'bottom: 6px;') +
                                w2utils.cssPrefix('transition', '.3s', true) + '"' +
                                (options.hideOnClick === true ? 'onclick="w2popup.message();"' : '') + '>' +
                            '</div>');
                $('#w2ui-popup #w2ui-message'+ msgCount).data('options', options).data('prev_focus', $(':focus'));
                var display = $('#w2ui-popup #w2ui-message'+ msgCount).css('display');
                $('#w2ui-popup #w2ui-message'+ msgCount).css(w2utils.cssPrefix({
                    'transform': (display == 'none' ? 'translateY(-' + options.height + 'px)' : 'translateY(0px)')
                }));
                if (display == 'none') {
                    $('#w2ui-popup #w2ui-message'+ msgCount).show().html(options.html);
                    // timer needs to animation
                    setTimeout(function () {
                        $('#w2ui-popup #w2ui-message'+ msgCount).css(w2utils.cssPrefix({
                            'transform': (display == 'none' ? 'translateY(0px)' : 'translateY(-' + options.height + 'px)')
                        }));
                    }, 1);
                    // timer for lock
                    if (msgCount === 0) w2popup.lock();
                    setTimeout(function() {
                        obj.focus();
                        // has to be on top of lock
                        $('#w2ui-popup #w2ui-message'+ msgCount).css(w2utils.cssPrefix({ 'transition': '0s' }));
                        if (typeof options.onOpen == 'function') options.onOpen();
                    }, 350);
                }
            }
        },

        focus: function () {
            var tmp = null;
            var pop = $('#w2ui-popup');
            var sel = 'input:visible, button:visible, select:visible, textarea:visible';
            // clear previous blur
            $(pop).find(sel).off('.keep-focus');
            // in message or popup
            var cnt = $('#w2ui-popup .w2ui-message').length - 1;
            var msg = $('#w2ui-popup #w2ui-message' + cnt);
            if (msg.length > 0) {
                var btn =$(msg[msg.length - 1]).find('button');
                if (btn.length > 0) btn[0].focus();
                tmp = msg;
            } else if (pop.length > 0) {
                var btn = pop.find('.w2ui-popup-buttons button');
                if (btn.length > 0) btn[0].focus();
                tmp = pop;
            }
            // keep focus/blur inside popup
            $(tmp).find(sel)
                .on('blur.keep-focus', function (event) {
                    setTimeout(function () {
                        var focus = $(':focus');
                        if ((focus.length > 0 && !$(tmp).find(sel).is(focus)) || focus.hasClass('w2ui-popup-hidden')) {
                            var el = $(tmp).find(sel);
                            if (el.length > 0) el[0].focus();
                        }
                    }, 1);
                });
        },

        lock: function (msg, showSpinner) {
            var args = Array.prototype.slice.call(arguments, 0);
            args.unshift($('#w2ui-popup'));
            w2utils.lock.apply(window, args);
        },

        unlock: function (speed) {
            w2utils.unlock($('#w2ui-popup'), speed);
        },

        // --- INTERNAL FUNCTIONS

        lockScreen: function (options) {
            if ($('#w2ui-lock').length > 0) return false;
            if (options == null) options = $('#w2ui-popup').data('options');
            if (options == null) options = {};
            options = $.extend({}, w2popup.defaults, options);
            // show element
            $('body').append('<div id="w2ui-lock" ' +
                '    onmousewheel="if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true; if (event.preventDefault) event.preventDefault(); else return false;"'+
                '    style="position: ' + (w2utils.engine == 'IE5' ? 'absolute' : 'fixed') + '; z-Index: 1199; left: 0px; top: 0px; ' +
                '           padding: 0px; margin: 0px; background-color: ' + options.color + '; width: 100%; height: 100%; opacity: 0;"></div>');
            // lock screen
            setTimeout(function () {
                $('#w2ui-lock')
                    .css('opacity', options.opacity)
                    .css(w2utils.cssPrefix('transition', options.speed + 's opacity'));
            }, 1);
            // add events
            if (options.modal == true) {
                $('#w2ui-lock').on('mousedown', function () {
                    $('#w2ui-lock')
                        .css('opacity', '0.6')
                        .css(w2utils.cssPrefix('transition', '.1s'));
                });
                $('#w2ui-lock').on('mouseup', function () {
                    setTimeout(function () {
                        $('#w2ui-lock')
                            .css('opacity', options.opacity)
                            .css(w2utils.cssPrefix('transition', '.1s'));
                    }, 100);
                });
            } else {
                $('#w2ui-lock').on('mousedown', function () { w2popup.close(); });
            }
            return true;
        },

        unlockScreen: function (options) {
            if ($('#w2ui-lock').length === 0) return false;
            if (options == null) options = $('#w2ui-popup').data('options');
            if (options == null) options = {};
            options = $.extend({}, w2popup.defaults, options);
            $('#w2ui-lock')
                .css('opacity', '0')
                .css(w2utils.cssPrefix('transition', options.speed + 's opacity'));
            setTimeout(function () {
                $('#w2ui-lock').remove();
            }, options.speed * 1000);
            return true;
        },

        resizeMessages: function () {
            var obj = this;
            var options = $('#w2ui-popup').data('options');
            // see if there are messages and resize them
            $('#w2ui-popup .w2ui-message').each(function () {
                var moptions = $(this).data('options');
                var $popup   = $('#w2ui-popup');
                if (parseInt(moptions.width) < 10)  moptions.width  = 10;
                if (parseInt(moptions.height) < 10) moptions.height = 10;
                var titleHeight = parseInt($popup.find('> .w2ui-popup-title').css('height'));
                var pWidth      = parseInt($popup.width());
                var pHeight     = parseInt($popup.height());
                // recalc width
                moptions.width = moptions.originalWidth;
                if (moptions.width > pWidth - 10) {
                    moptions.width = pWidth - 10;
                }
                // recalc height
                moptions.height = moptions.originalHeight;
                if (moptions.height > pHeight - titleHeight - 5) {
                    moptions.height = pHeight - titleHeight - 5;
                }
                if (moptions.originalHeight < 0) moptions.height = pHeight + moptions.originalHeight - titleHeight;
                if (moptions.originalWidth < 0) moptions.width = pWidth + moptions.originalWidth * 2; // x 2 because there is left and right margin
                $(this).css({
                    left    : ((pWidth - moptions.width) / 2) + 'px',
                    width   : moptions.width + 'px',
                    height  : moptions.height + 'px'
                });
            });
        },

        resize: function (width, height, callBack) {
            var obj = this;
            var options = $('#w2ui-popup').data('options');
            width  = parseInt(width);
            height = parseInt(height);
            // calculate new position
            var maxW, maxH;
            if (window.innerHeight == undefined) {
                maxW  = parseInt(document.documentElement.offsetWidth);
                maxH = parseInt(document.documentElement.offsetHeight);
                if (w2utils.engine === 'IE7') { maxW += 21; maxH += 4; }
            } else {
                maxW  = parseInt(window.innerWidth);
                maxH = parseInt(window.innerHeight);
            }
            if (maxW  - 10 < width) width  = maxW  - 10;
            if (maxH - 10 < height) height = maxH - 10;
            var top  = (maxH - height) / 2 * 0.6;
            var left = (maxW - width) / 2;
            // resize there
            $('#w2ui-popup')
                .css(w2utils.cssPrefix({
                    'transition': options.speed + 's width, ' + options.speed + 's height, ' + options.speed + 's left, ' + options.speed + 's top'
                }))
                .css({
                    'top'   : top,
                    'left'  : left,
                    'width' : width,
                    'height': height
                });
            var tmp_int = setInterval(function () { obj.resizeMessages(); }, 10); // then messages resize nicely
            setTimeout(function () {
                clearInterval(tmp_int);
                options.width  = width;
                options.height = height;
                obj.resizeMessages();
                if (typeof callBack == 'function') callBack();
            }, (options.speed * 1000) + 50); // give extra 50 ms
        },

        /***********************
        *  Internal
        **/

        // restores template
        restoreTemplate: function () {
            var options  = $('#w2ui-popup').data('options');
            if (options == null) return;
            var template = w2popup._template;
            var title    = options.title;
            var body     = options.body;
            var buttons  = options.buttons;
            if (w2popup._prev) {
                template = w2popup._prev.template;
                title    = w2popup._prev.title;
                body     = w2popup._prev.body;
                buttons  = w2popup._prev.buttons;
                delete w2popup._prev;
            } else {
                delete w2popup._template;
            }
            if (template != null) {
                var $tmp = $(template);
                if ($tmp.length === 0) return;
                if ($(body).attr('rel') == 'body') {
                    if (title) $tmp.append(title);
                    if (body) $tmp.append(body);
                    if (buttons) $tmp.append(buttons);
                } else {
                    $tmp.append(body);
                }
            }
        }
    };

    // merge in event handling
    $.extend(w2popup, w2utils.event);

})(jQuery);

// ============================================
// --- Common dialogs

var w2alert = function (msg, title, callBack) {
    var $ = jQuery;
    if (title == null) title = w2utils.lang('Notification');
    if ($('#w2ui-popup').length > 0 && w2popup.status != 'closing') {
        w2popup.message({
            width   : 400,
            height  : 170,
            body    : '<div class="w2ui-centered w2ui-alert-msg" style="font-size: 13px;">' + msg + '</div>',
            buttons : '<button onclick="w2popup.message();" class="w2ui-popup-btn w2ui-btn">' + w2utils.lang('Ok') + '</button>',
            onOpen: function () {
                $('#w2ui-popup .w2ui-message .w2ui-popup-btn').focus();
            },
            onClose: function () {
                if (typeof callBack == 'function') callBack();
            }
        });
    } else {
        w2popup.open({
            width     : 450,
            height    : 220,
            showMax   : false,
            showClose : false,
            title     : title,
            body      : '<div class="w2ui-centered w2ui-alert-msg" style="font-size: 13px;">' + msg + '</div>',
            buttons   : '<button onclick="w2popup.close();" class="w2ui-popup-btn w2ui-btn">' + w2utils.lang('Ok') + '</button>',
            onOpen: function (event) {
                // do not use onComplete as it is slower
                setTimeout(function () { $('#w2ui-popup .w2ui-popup-btn').focus(); }, 1);
            },
            onKeydown: function (event) {
                $('#w2ui-popup .w2ui-popup-btn').focus().addClass('clicked');
            },
            onClose: function () {
                if (typeof callBack == 'function') callBack();
            }
        });
    }
    return {
        ok: function (fun) {
            callBack = fun;
            return this;
        },
        done: function (fun) {
            callBack = fun;
            return this;
        }
    };
};

var w2confirm = function (msg, title, callBack) {
    var $ = jQuery;
    var options  = {};
    var defaults = {
        msg         : '',
        title       : w2utils.lang('Confirmation'),
        width       : ($('#w2ui-popup').length > 0 ? 400 : 450),
        height      : ($('#w2ui-popup').length > 0 ? 170 : 220),
        yes_text    : 'Yes',
        yes_class   : '',
        yes_style   : '',
        yes_callBack: null,
        no_text     : 'No',
        no_class    : '',
        no_style    : '',
        no_callBack : null,
        callBack    : null
    };
    if (arguments.length == 1 && typeof msg == 'object') {
        $.extend(options, defaults, msg);
    } else {
        if (typeof title == 'function') {
            $.extend(options, defaults, {
                msg     : msg,
                callBack: title
            })
        } else {
            $.extend(options, defaults, {
                msg     : msg,
                title   : title,
                callBack: callBack
            })
        }
    }
    // if there is a yes/no button object
    if (typeof options.btn_yes == 'object') {
        options.yes_text     = options.btn_yes.text || options.yes_text;
        options.yes_class    = options.btn_yes["class"] || options.yes_class;
        options.yes_style    = options.btn_yes.style || options.yes_style;
        options.yes_callBack = options.btn_yes.callBack || options.yes_callBack;
    }
    if (typeof options.btn_no == 'object') {
        options.no_text      = options.btn_no.text || options.no_text;
        options.no_class     = options.btn_no["class"] || options.no_class;
        options.no_style     = options.btn_no.style || options.no_style;
        options.no_callBack  = options.btn_no.callBack || options.no_callBack;
    }
    if ($('#w2ui-popup').length > 0 && w2popup.status != 'closing' && w2popup.get()) {
        if (options.width > w2popup.get().width) options.width = w2popup.get().width;
        if (options.height > (w2popup.get().height - 50)) options.height = w2popup.get().height - 50;
          w2popup.message({
            width   : options.width,
            height  : options.height,
            body    : '<div class="w2ui-centered w2ui-confirm-msg" style="font-size: 13px;">' + options.msg + '</div>',
            buttons : '<button id="Yes" class="w2ui-popup-btn w2ui-btn '+ options.yes_class +'" style="'+ options.yes_style +'">' + w2utils.lang(options.yes_text) + '</button>' +
                      '<button id="No" class="w2ui-popup-btn w2ui-btn '+ options.no_class +'" style="'+ options.no_style +'">' + w2utils.lang(options.no_text) + '</button>',
            onOpen: function () {
                $('#w2ui-popup .w2ui-message .w2ui-btn').on('click.w2confirm', function (event) {
                    w2popup._confirm_btn = event.target.id;
                    w2popup.message();
                });
            },
            onClose: function () {
                // needed this because there might be other messages
                $('#w2ui-popup .w2ui-message .w2ui-btn').off('click.w2confirm');
                // need to wait for message to slide up
                setTimeout(function () {
                    if (typeof options.callBack == 'function') options.callBack(w2popup._confirm_btn);
                    if (w2popup._confirm_btn == 'Yes' && typeof options.yes_callBack == 'function') options.yes_callBack();
                    if (w2popup._confirm_btn == 'No'  && typeof options.no_callBack == 'function') options.no_callBack();
                }, 300);
            }
            // onKeydown will not work here
        });

    } else {

        if (!w2utils.isInt(options.height)) options.height = options.height + 50;
        w2popup.open({
            width      : options.width,
            height     : options.height,
            title      : options.title,
            modal      : true,
            showClose  : false,
            body       : '<div class="w2ui-centered w2ui-confirm-msg" style="font-size: 13px;">' + options.msg + '</div>',
            buttons    : '<button id="Yes" class="w2ui-popup-btn w2ui-btn '+ options.yes_class +'" style="'+ options.yes_style +'">'+ w2utils.lang(options.yes_text) +'</button>'+
                         '<button id="No" class="w2ui-popup-btn w2ui-btn '+ options.no_class +'" style="'+ options.no_style +'">'+ w2utils.lang(options.no_text) +'</button>',
            onOpen: function (event) {
                // do not use onComplete as it is slower
                setTimeout(function () {
                    $('#w2ui-popup .w2ui-popup-btn').on('click', function (event) {
                        w2popup.close();
                        if (typeof options.callBack == 'function') options.callBack(event.target.id);
                        if (event.target.id == 'Yes' && typeof options.yes_callBack == 'function') options.yes_callBack();
                        if (event.target.id == 'No'  && typeof options.no_callBack == 'function') options.no_callBack();
                    });
                    $('#w2ui-popup .w2ui-popup-btn#Yes').focus();
                }, 1);
            },
            onKeydown: function (event) {
                // if there are no messages
                if ($('#w2ui-popup .w2ui-message').length === 0) {
                    switch (event.originalEvent.keyCode) {
                        case 13: // enter
                            $('#w2ui-popup .w2ui-popup-btn#Yes').focus().addClass('clicked'); // no need fo click as enter will do click
                            w2popup.close();
                            break;
                        case 27: // esc
                            $('#w2ui-popup .w2ui-popup-btn#No').focus().click();
                            w2popup.close();
                            break;
                    }
                }
            }
        });
    }

    return {
        yes: function (fun) {
            options.yes_callBack = fun;
            return this;
        },
        no: function (fun) {
            options.no_callBack = fun;
            return this;
        }
    };
};

var w2prompt = function (label, title, callBack) {
    var $ = jQuery;

    var options  = {};
    var defaults = {
        label       : '',
        value       : '',
        attrs       : '',
        title       : w2utils.lang('Notification'),
        ok_text     : w2utils.lang('Ok'),
        cancel_text : w2utils.lang('Cancel'),
        width       : ($('#w2ui-popup').length > 0 ? 400 : 450),
        height      : ($('#w2ui-popup').length > 0 ? 170 : 220),
        callBack    : null
    }

    if (arguments.length == 1 && typeof label == 'object') {
        $.extend(options, defaults, label);
    } else {
        if (typeof title == 'function') {
            $.extend(options, defaults, {
                label   : label,
                callBack: title
            })
        } else {
            $.extend(options, defaults, {
                label   : label,
                title   : title,
                callBack: callBack
            })
        }
    }

    if ($('#w2ui-popup').length > 0 && w2popup.status != 'closing' && w2popup.get()) {
        if (options.width > w2popup.get().width) options.width = w2popup.get().width;
        if (options.height > (w2popup.get().height - 50)) options.height = w2popup.get().height - 50;
          w2popup.message({
            width   : options.width,
            height  : options.height,
            body    : '<div class="w2ui-centered" style="font-size: 13px;">'+
                      '   <label style="margin-right: 10px;">' + options.label + ':</label>'+
                      '   <input id="w2prompt" '+ options.attrs +'>'+
                      '</div>',
            buttons : '<button id="Ok" class="w2ui-popup-btn w2ui-btn">' + options.ok_text + '</button><button id="Cancel" class="w2ui-popup-btn w2ui-btn">' + options.cancel_text + '</button>',
            onOpen: function () {
                $('#w2prompt').val(options.value);
                $('#w2ui-popup .w2ui-message .w2ui-btn#Ok').on('click.w2prompt', function (event) {
                    w2popup._prompt_value = $('#w2prompt').val();
                    w2popup.message();
                });
                $('#w2ui-popup .w2ui-message .w2ui-btn#Cancel').on('click.w2prompt', function (event) {
                    w2popup._prompt_value = null;
                    w2popup.message();
                });
                // set focus
                setTimeout(function () { $('#w2prompt').focus(); }, 100);
            },
            onClose: function () {
                // needed this because there might be other messages
                $('#w2ui-popup .w2ui-message .w2ui-btn').off('click.w2prompt');
                // need to wait for message to slide up
                setTimeout(function () {
                    if (typeof options.callBack == 'function' && w2popup._prompt_value != null) {
                        options.callBack(w2popup._prompt_value);
                    }
                }, 300);
            }
            // onKeydown will not work here
        });

    } else {

        if (!w2utils.isInt(options.height)) options.height = options.height + 50;
        w2popup.open({
            width      : options.width,
            height     : options.height,
            title      : options.title,
            modal      : true,
            showClose  : false,
            body       : '<div class="w2ui-centered" style="font-size: 13px;"><label style="margin-right: 10px;">' + options.label + ':</label><input id="w2prompt"></div>',
            buttons    : '<button id="Ok" class="w2ui-popup-btn w2ui-btn">' + options.ok_text + '</button><button id="Cancel" class="w2ui-popup-btn w2ui-btn">' + options.cancel_text + '</button>',
            onOpen: function (event) {
                // do not use onComplete as it is slower
                setTimeout(function () {
                    $('#w2prompt').val(options.value);
                    $('#w2prompt').w2field('text');
                    $('#w2ui-popup .w2ui-popup-btn#Ok').on('click', function (event) {
                        w2popup._prompt_value = $('#w2prompt').val();
                        w2popup.close();
                        if (typeof options.callBack == 'function') options.callBack(w2popup._prompt_value);
                    });
                    $('#w2ui-popup .w2ui-popup-btn#Cancel').on('click', function (event) {
                        w2popup._prompt_value = null;
                        w2popup.close();
                    });
                    $('#w2ui-popup .w2ui-popup-btn#Ok');
                    // set focus
                    setTimeout(function () { $('#w2prompt').focus(); }, 100);
                }, 1);
            },
            onKeydown: function (event) {
                // if there are no messages
                if ($('#w2ui-popup .w2ui-message').length === 0) {
                    switch (event.originalEvent.keyCode) {
                        case 13: // enter
                            $('#w2ui-popup .w2ui-popup-btn#Ok').focus().addClass('clicked'); // no need fo click as enter will do click
                            w2popup.close();
                            break;
                        case 27: // esc
                            w2popup.close();
                            break;
                    }
                }
            }
        });
    }
    return {
        change: function (fun) {
            $('#w2prompt').on('keyup', fun).keyup();
            return this;
        },
        ok: function (fun) {
            options.callBack = fun;
            return this;
        }
    };
};

/************************************************************************
*   Library: Web 2.0 UI for jQuery (using prototypical inheritance)
*   - Following objects defined
*        - w2tabs        - tabs widget
*        - $().w2tabs    - jQuery wrapper
*   - Dependencies: jQuery, w2utils
*
* == NICE TO HAVE ==
*   - align = left, right, center ??
*
************************************************************************/

(function ($) {
    var w2tabs = function (options) {
        this.box       = null;      // DOM Element that holds the element
        this.name      = null;      // unique name for w2ui
        this.active    = null;
        this.flow      = 'down';    // can be down or up
        this.tooltip   = 'top|left';     // can be top, bottom, left, right
        this.tabs      = [];
        this.routeData = {};        // data for dynamic routes
        this.right     = '';
        this.style     = '';

        $.extend(this, { handlers: [] });
        $.extend(true, this, w2obj.tabs, options);
    };

    // ====================================================
    // -- Registers as a jQuery plugin

    $.fn.w2tabs = function(method) {
        if ($.isPlainObject(method)) {
            // check name parameter
            if (!w2utils.checkName(method, 'w2tabs')) return;
            // extend tabs
            var tabs   = method.tabs || [];
            var object = new w2tabs(method);
            for (var i = 0; i < tabs.length; i++) {
                object.tabs[i] = $.extend({}, w2tabs.prototype.tab, tabs[i]);
            }
            if ($(this).length !== 0) {
                object.render($(this)[0]);
            }
            // register new object
            w2ui[object.name] = object;
            return object;
        } else {
            var obj = w2ui[$(this).attr('name')];
            if (!obj) return null;
            if (arguments.length > 0) {
                if (obj[method]) obj[method].apply(obj, Array.prototype.slice.call(arguments, 1));
                return this;
            } else {
                return obj;
            }
        }
    };

    // ====================================================
    // -- Implementation of core functionality

    w2tabs.prototype = {
        onClick   : null,
        onClose   : null,
        onRender  : null,
        onRefresh : null,
        onResize  : null,
        onDestroy : null,

        tab : {
            id        : null,        // command to be sent to all event handlers
            text      : null,
            route     : null,
            hidden    : false,
            disabled  : false,
            closable  : false,
            tooltip   : null,
            style     : '',
            onClick   : null,
            onRefresh : null,
            onClose   : null
        },

        add: function (tab) {
            return this.insert(null, tab);
        },

        insert: function (id, tab) {
            if (!$.isArray(tab)) tab = [tab];
            // assume it is array
            for (var i = 0; i < tab.length; i++) {
                // checks
                if (tab[i].id == null) {
                    console.log('ERROR: The parameter "id" is required but not supplied. (obj: '+ this.name +')');
                    return;
                }
                if (!w2utils.checkUniqueId(tab[i].id, this.tabs, 'tabs', this.name)) return;
                // add tab
                var newTab = $.extend({}, w2tabs.prototype.tab, tab[i]);
                if (id == null) {
                    this.tabs.push(newTab);
                } else {
                    var middle = this.get(id, true);
                    this.tabs = this.tabs.slice(0, middle).concat([newTab], this.tabs.slice(middle));
                }
                this.refresh(tab[i].id);
                this.resize();
            }
        },

        remove: function () {
            var removed = 0;
            for (var a = 0; a < arguments.length; a++) {
                var tab = this.get(arguments[a]);
                if (!tab) return false;
                removed++;
                // remove from array
                this.tabs.splice(this.get(tab.id, true), 1);
                // remove from screen
                $(this.box).find('#tabs_'+ this.name +'_tab_'+ w2utils.escapeId(tab.id)).remove();
            }
            this.resize();
            return removed;
        },

        select: function (id) {
            if (this.active == id || this.get(id) == null) return false;
            this.active = id;
            this.refresh();
            return true;
        },

        set: function (id, tab) {
            var index = this.get(id, true);
            if (index == null) return false;
            $.extend(this.tabs[index], tab);
            this.refresh(id);
            return true;
        },

        get: function (id, returnIndex) {
            if (arguments.length === 0) {
                var all = [];
                for (var i1 = 0; i1 < this.tabs.length; i1++) {
                    if (this.tabs[i1].id != null) {
                        all.push(this.tabs[i1].id);
                    }
                }
                return all;
            } else {
                for (var i2 = 0; i2 < this.tabs.length; i2++) {
                    if (this.tabs[i2].id == id) { // need to be == since id can be numeric
                        return (returnIndex === true ? i2 : this.tabs[i2]);
                    }
                }
            }
            return null;
        },

        show: function () {
            var obj   = this;
            var shown = 0;
            var tmp   = [];
            for (var a = 0; a < arguments.length; a++) {
                var tab = this.get(arguments[a]);
                if (!tab || tab.hidden === false) continue;
                shown++;
                tab.hidden = false;
                tmp.push(tab.id);
            }
            setTimeout(function () { for (var t=0; t<tmp.length; t++) obj.refresh(tmp[t]); obj.resize(); }, 15); // needs timeout
            return shown;
        },

        hide: function () {
            var obj   = this;
            var hidden= 0;
            var tmp   = [];
            for (var a = 0; a < arguments.length; a++) {
                var tab = this.get(arguments[a]);
                if (!tab || tab.hidden === true) continue;
                hidden++;
                tab.hidden = true;
                tmp.push(tab.id);
            }
            setTimeout(function () { for (var t=0; t<tmp.length; t++) obj.refresh(tmp[t]); obj.resize(); }, 15); // needs timeout
            return hidden;
        },

        enable: function () {
            var obj   = this;
            var enabled = 0;
            var tmp   = [];
            for (var a = 0; a < arguments.length; a++) {
                var tab = this.get(arguments[a]);
                if (!tab || tab.disabled === false) continue;
                enabled++;
                tab.disabled = false;
                tmp.push(tab.id);
            }
            setTimeout(function () { for (var t=0; t<tmp.length; t++) obj.refresh(tmp[t]); }, 15); // needs timeout
            return enabled;
        },

        disable: function () {
            var obj   = this;
            var disabled = 0;
            var tmp   = [];
            for (var a = 0; a < arguments.length; a++) {
                var tab = this.get(arguments[a]);
                if (!tab || tab.disabled === true) continue;
                disabled++;
                tab.disabled = true;
                tmp.push(tab.id);
            }
            setTimeout(function () { for (var t=0; t<tmp.length; t++) obj.refresh(tmp[t]); }, 15); // needs timeout
            return disabled;
        },

        tooltipShow: function (id, event, forceRefresh) {
            if (this.tooltip == null) return;
            var $el  = $(this.box).find('#tabs_'+ this.name + '_tab_'+ w2utils.escapeId(id));
            var item = this.get(id);
            var pos  = this.tooltip;
            var txt  = item.tooltip;
            if (typeof txt == 'function') txt = txt.call(this, item);
            $el.prop('_mouse_over', true);
            setTimeout(function () {
                if ($el.prop('_mouse_over') === true && $el.prop('_mouse_tooltip') !== true) {
                    $el.prop('_mouse_tooltip', true);
                    // show tooltip
                    $el.w2tag(w2utils.lang(txt), { position: pos });
                }
                if (forceRefresh == true) {
                    $el.w2tag(w2utils.lang(txt), { position: pos });
                }
            }, 1);
        },

        tooltipHide: function (id) {
            if (this.tooltip == null) return;
            var $el  = $(this.box).find('#tabs_'+ this.name + '_tab_'+ w2utils.escapeId(id));
            var item = this.get(id);
            $el.removeProp('_mouse_over');
            setTimeout(function () {
                if ($el.prop('_mouse_over') !== true && $el.prop('_mouse_tooltip') === true) {
                    $el.removeProp('_mouse_tooltip');
                    // hide tooltip
                    $el.w2tag();
                }
            }, 1);
        },

        refresh: function (id) {
            var time = (new Date()).getTime();
            if (this.flow == 'up') $(this.box).addClass('w2ui-tabs-up'); else $(this.box).removeClass('w2ui-tabs-up');
            // event before
            var edata = this.trigger({ phase: 'before', type: 'refresh', target: (id != null ? id : this.name), object: this.get(id) });
            if (edata.isCancelled === true) return;
            if (id == null) {
                // refresh all
                for (var i = 0; i < this.tabs.length; i++) this.refresh(this.tabs[i].id);
            } else {
                // create or refresh only one item
                var tab = this.get(id);
                if (tab == null) return false;
                if (tab.text == null && tab.caption != null) tab.text = tab.caption;
                if (tab.tooltip == null && tab.hint != null) tab.tooltip = tab.hint; // for backward compatibility
                var text = tab.text;
                if (typeof text == 'function') text = text.call(this, tab);
                if (text == null) text = '';

                var jq_el    = $(this.box).find('#tabs_'+ this.name +'_tab_'+ w2utils.escapeId(tab.id));
                var closable = '';
                if (tab.closable && !tab.disabled) {
                    closable = '<div class="w2ui-tab-close" '+
                               '    onmouseover = "w2ui[\''+ this.name +'\'].tooltipShow(\''+ tab.id +'\', event);"'+
                               '    onmouseout  = "w2ui[\''+ this.name +'\'].tooltipHide(\''+ tab.id +'\', event);"'+
                               '    onclick="w2ui[\''+ this.name +'\'].animateClose(\''+ tab.id +'\', event);">'+
                               '</div>';
                }
                var tabHTML = closable +
                    '    <div class="w2ui-tab'+ (this.active === tab.id ? ' active' : '') + (tab.closable ? ' closable' : '')
                                + (tab['class'] ? ' ' + tab['class'] : '') +'" style="'+ tab.style +'" '+
                    '        onmouseover = "' + (!tab.disabled ? "w2ui['"+ this.name +"'].tooltipShow('"+ tab.id +"', event);" : "") + '"'+
                    '        onmouseout  = "' + (!tab.disabled ? "w2ui['"+ this.name +"'].tooltipHide('"+ tab.id +"', event);" : "") + '"'+
                    '        onclick="w2ui[\''+ this.name +'\'].click(\''+ tab.id +'\', event);">' + w2utils.lang(text) + '</div>';
                if (jq_el.length === 0) {
                    // does not exist - create it
                    var addStyle = '';
                    if (tab.hidden) { addStyle += 'display: none;'; }
                    if (tab.disabled) { addStyle += 'opacity: 0.2;'; }
                    var html = '<td id="tabs_'+ this.name + '_tab_'+ tab.id +'" style="'+ addStyle +'" valign="middle">'+ tabHTML + '</td>';
                    if (this.get(id, true) !== this.tabs.length-1 && $(this.box).find('#tabs_'+ this.name +'_tab_'+ w2utils.escapeId(this.tabs[parseInt(this.get(id, true))+1].id)).length > 0) {
                        $(this.box).find('#tabs_'+ this.name +'_tab_'+ w2utils.escapeId(this.tabs[parseInt(this.get(id, true))+1].id)).before(html);
                    } else {
                        $(this.box).find('#tabs_'+ this.name +'_right').before(html);
                    }
                } else {
                    // refresh
                    jq_el.html(tabHTML);
                    if (tab.hidden) { jq_el.css('display', 'none'); }
                    else { jq_el.css('display', ''); }
                    if (tab.disabled) { jq_el.css({ 'opacity': '0.2' }); }
                    else { jq_el.css({ 'opacity': '1' }); }
                }
            }
            // right html
            $('#tabs_'+ this.name +'_right').html(this.right);
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            return (new Date()).getTime() - time;
        },

        render: function (box) {
            var time = (new Date()).getTime();
            // event before
            var edata = this.trigger({ phase: 'before', type: 'render', target: this.name, box: box });
            if (edata.isCancelled === true) return;
            // default action
            // if (window.getSelection) window.getSelection().removeAllRanges(); // clear selection
            if (box != null) {
                if ($(this.box).find('> table #tabs_'+ this.name + '_right').length > 0) {
                    $(this.box)
                        .removeAttr('name')
                        .removeClass('w2ui-reset w2ui-tabs')
                        .html('');
                }
                this.box = box;
            }
            if (!this.box) return false;
            // render all buttons
            var html =  '<div class="w2ui-scroll-wrapper" onmousedown="var el=w2ui[\''+ this.name +'\']; if (el) el.resize();">'+
                '<table cellspacing="0" cellpadding="1" width="100%"><tbody>'+
                '    <tr><td width="100%" id="tabs_'+ this.name +'_right" align="right">'+ this.right +'</td></tr>'+
                '</tbody></table>'+
                '</div>'+
                '<div class="w2ui-scroll-left" onclick="var el=w2ui[\''+ this.name +'\']; if (el) el.scroll(\'left\');"></div>'+
                '<div class="w2ui-scroll-right" onclick="var el=w2ui[\''+ this.name +'\']; if (el) el.scroll(\'right\');"></div>';
            $(this.box)
                .attr('name', this.name)
                .addClass('w2ui-reset w2ui-tabs')
                .html(html);
            if ($(this.box).length > 0) $(this.box)[0].style.cssText += this.style;
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            this.refresh();
            this.resize();
            return (new Date()).getTime() - time;
        },

        scroll: function (direction) {
            var box = $(this.box);
            var obj = this;
            var scrollBox  = box.find('.w2ui-scroll-wrapper');
            var scrollLeft = scrollBox.scrollLeft();
            var width1, width2, scroll;

            switch (direction) {
                case 'left':
                    width1 = scrollBox.outerWidth();
                    width2 = scrollBox.find(':first').outerWidth();
                    scroll = scrollLeft - width1 + 50; // 35 is width of both button
                    if (scroll <= 0) scroll = 0;
                    scrollBox.animate({ scrollLeft: scroll }, 300);
                    break;

                case 'right':
                    width1 = scrollBox.outerWidth();
                    width2 = scrollBox.find(':first').outerWidth();
                    scroll = scrollLeft + width1 - 50; // 35 is width of both button
                    if (scroll >= width2 - width1) scroll = width2 - width1;
                    scrollBox.animate({ scrollLeft: scroll }, 300);
                    break;
            }
            setTimeout(function () { obj.resize(); }, 350);
        },


        resize: function () {
            var time = (new Date()).getTime();
            // event before
            var edata = this.trigger({ phase: 'before', type: 'resize', target: this.name });
            if (edata.isCancelled === true) return;

            // show hide overflow buttons
            var box = $(this.box);
            box.find('.w2ui-scroll-left, .w2ui-scroll-right').hide();
            var scrollBox = box.find('.w2ui-scroll-wrapper');
            if (scrollBox.find(':first').outerWidth() > scrollBox.outerWidth()) {
                // we have overflowed content
                if (scrollBox.scrollLeft() > 0) {
                    box.find('.w2ui-scroll-left').show();
                }
                if (scrollBox.scrollLeft() < scrollBox.find(':first').outerWidth() - scrollBox.outerWidth()) {
                    box.find('.w2ui-scroll-right').show();
                }
            }

            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            return (new Date()).getTime() - time;
        },

        destroy: function () {
            // event before
            var edata = this.trigger({ phase: 'before', type: 'destroy', target: this.name });
            if (edata.isCancelled === true) return;
            // clean up
            if ($(this.box).find('> table #tabs_'+ this.name + '_right').length > 0) {
                $(this.box)
                    .removeAttr('name')
                    .removeClass('w2ui-reset w2ui-tabs')
                    .html('');
            }
            delete w2ui[this.name];
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        // ===================================================
        // -- Internal Event Handlers

        click: function (id, event) {
            var tab = this.get(id);
            if (tab == null || tab.disabled) return false;
            // event before
            var edata = this.trigger({ phase: 'before', type: 'click', target: id, tab: tab, object: tab, originalEvent: event });
            if (edata.isCancelled === true) return;
            // default action
            $(this.box).find('#tabs_'+ this.name +'_tab_'+ w2utils.escapeId(this.active) +' .w2ui-tab').removeClass('active');
            this.active = tab.id;
            // route processing
            if (typeof tab.route == 'string') {
                var route = tab.route !== '' ? String('/'+ tab.route).replace(/\/{2,}/g, '/') : '';
                var info  = w2utils.parseRoute(route);
                if (info.keys.length > 0) {
                    for (var k = 0; k < info.keys.length; k++) {
                        if (this.routeData[info.keys[k].name] == null) continue;
                        route = route.replace((new RegExp(':'+ info.keys[k].name, 'g')), this.routeData[info.keys[k].name]);
                    }
                }
                setTimeout(function () { window.location.hash = route; }, 1);
            }
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            this.refresh(id);
        },

        animateClose: function(id, event) {
            var tab = this.get(id);
            if (tab == null || tab.disabled) return false;
            // event before
            var edata = this.trigger({ phase: 'before', type: 'close', target: id, object: this.get(id), originalEvent: event });
            if (edata.isCancelled === true) return;
            // default action
            var obj = this;
            $(this.box).find('#tabs_'+ this.name +'_tab_'+ w2utils.escapeId(tab.id)).css(w2utils.cssPrefix('transition', '.2s')).css('opacity', '0');
            setTimeout(function () {
                var width = $(obj.box).find('#tabs_'+ obj.name +'_tab_'+ w2utils.escapeId(tab.id)).width();
                $(obj.box).find('#tabs_'+ obj.name +'_tab_'+ w2utils.escapeId(tab.id))
                    .html('<div style="width: '+ width +'px; '+ w2utils.cssPrefix('transition', '.2s', true) +'"></div>');
                setTimeout(function () {
                    $(obj.box).find('#tabs_'+ obj.name +'_tab_'+ w2utils.escapeId(tab.id)).find(':first-child').css({ 'width': '0px' });
                }, 50);
            }, 200);
            setTimeout(function () {
                obj.remove(id);
            }, 450);
            // event before
            this.trigger($.extend(edata, { phase: 'after' }));
            this.refresh();
        },

        animateInsert: function(id, tab) {
            if (this.get(id) == null) return;
            if (!$.isPlainObject(tab)) return;
            // check for unique
            if (!w2utils.checkUniqueId(tab.id, this.tabs, 'tabs', this.name)) return;
            // insert simple div
            var jq_el   = $(this.box).find('#tabs_'+ this.name +'_tab_'+ w2utils.escapeId(tab.id));
            if (jq_el.length !== 0) return; // already exists
            // measure width
            if (tab.text == null && tab.caption != null) tab.text = tab.caption;
            var tmp = '<div id="_tmp_tabs" class="w2ui-reset w2ui-tabs" style="position: absolute; top: -1000px;">'+
                '<table cellspacing="0" cellpadding="1" width="100%"><tbody><tr>'+
                '<td id="_tmp_simple_tab" style="" valign="middle">'+
                    (tab.closable ? '<div class="w2ui-tab-close"></div>' : '') +
                '    <div class="w2ui-tab '+ (this.active === tab.id ? 'active' : '') +'">'+ tab.text +'</div>'+
                '</td></tr></tbody></table>'+
                '</div>';
            $('body').append(tmp);
            // create dummy element
            var tabHTML = '<div style="width: 1px; '+ w2utils.cssPrefix('transition', '.2s', true) +'">&#160;</div>';
            var addStyle = '';
            if (tab.hidden) { addStyle += 'display: none;'; }
            if (tab.disabled) { addStyle += 'opacity: 0.2;'; }
            var html = '<td id="tabs_'+ this.name +'_tab_'+ tab.id +'" style="'+ addStyle +'" valign="middle">'+ tabHTML +'</td>';
            if (this.get(id, true) !== this.tabs.length && $(this.box).find('#tabs_'+ this.name +'_tab_'+ w2utils.escapeId(this.tabs[parseInt(this.get(id, true))].id)).length > 0) {
                $(this.box).find('#tabs_'+ this.name +'_tab_'+ w2utils.escapeId(this.tabs[parseInt(this.get(id, true))].id)).before(html);
            } else {
                $(this.box).find('#tabs_'+ this.name +'_right').before(html);
            }
            // -- move
            var obj = this;
            setTimeout(function () {
                var width = $('#_tmp_simple_tab').width();
                $('#_tmp_tabs').remove();
                $('#tabs_'+ obj.name +'_tab_'+ w2utils.escapeId(tab.id) +' > div').css('width', width+'px');
            }, 1);
            setTimeout(function () {
                // insert for real
                obj.insert(id, tab);
            }, 200);
        }
    };

    $.extend(w2tabs.prototype, w2utils.event);
    w2obj.tabs = w2tabs;
})(jQuery);

/************************************************************************
*   Library: Web 2.0 UI for jQuery (using prototypical inheritance)
*   - Following objects defined
*        - w2toolbar        - toolbar widget
*        - $().w2toolbar    - jQuery wrapper
*   - Dependencies: jQuery, w2utils, w2field
*
* == NICE TO HAVE ==
*   - vertical toolbar
*
************************************************************************/

(function ($) {
    var w2toolbar = function (options) {
        this.box       = null;      // DOM Element that holds the element
        this.name      = null;      // unique name for w2ui
        this.routeData = {};        // data for dynamic routes
        this.items     = [];
        this.right     = '';        // HTML text on the right of toolbar
        this.tooltip   = 'top|left';// can be top, bottom, left, right

        $.extend(true, this, w2obj.toolbar, options);
    };

    // ====================================================
    // -- Registers as a jQuery plugin

    $.fn.w2toolbar = function(method) {
        if ($.isPlainObject(method)) {
            // check name parameter
            if (!w2utils.checkName(method, 'w2toolbar')) return;
            // extend items
            var items = method.items || [];
            var object = new w2toolbar(method);
            $.extend(object, { items: [], handlers: [] });
            for (var i = 0; i < items.length; i++) {
                object.items[i] = $.extend({}, w2toolbar.prototype.item, items[i]);
                // menus
                if (object.items[i].type == 'menu-check') {
                    var item = object.items[i];
                    if (!Array.isArray(item.selected)) item.selected = [];
                    if (Array.isArray(item.items)) {
                        for (var j = 0; j < item.items.length; j++) {
                            var it = item.items[j];
                            if (it.checked && item.selected.indexOf(it.id) == -1) item.selected.push(it.id);
                            if (!it.checked && item.selected.indexOf(it.id) != -1) it.checked = true;
                            if (it.checked == null) it.checked = false;
                        }
                    }
                }
                else if (object.items[i].type == 'menu-radio') {
                    var item = object.items[i];
                    if (Array.isArray(item.items)) {
                        for (var j = 0; j < item.items.length; j++) {
                            var it = item.items[j];
                            if (it.checked && item.selected == null) item.selected = it.id; else it.checked = false;
                            if (!it.checked && item.selected == it.id) it.checked = true;
                            if (it.checked == null) it.checked = false;
                        }
                    }
                }
            }
            if ($(this).length !== 0) {
                object.render($(this)[0]);
            }
            // register new object
            w2ui[object.name] = object;
            return object;

        } else {
            var obj = w2ui[$(this).attr('name')];
            if (!obj) return null;
            if (arguments.length > 0) {
                if (obj[method]) obj[method].apply(obj, Array.prototype.slice.call(arguments, 1));
                return this;
            } else {
                return obj;
            }
        }
    };

    // ====================================================
    // -- Implementation of core functionality

    w2toolbar.prototype = {
        onClick   : null,
        onRender  : null,
        onRefresh : null,
        onResize  : null,
        onDestroy : null,

        item: {
            id          : null,        // command to be sent to all event handlers
            type        : 'button',    // button, check, radio, drop, menu, menu-radio, menu-check, break, html, spacer
            text        : null,
            html        : '',
            tooltip     : null,        // w2toolbar.tooltip should be
            count       : null,
            hidden      : false,
            disabled    : false,
            checked     : false,       // used for radio buttons
            img         : null,
            icon        : null,
            route       : null,        // if not null, it is route to go
            arrow       : true,        // arrow down for drop/menu types
            style       : null,        // extre css style for caption
            color       : null,        // color value - used in color pickers
            transparent : null,        // transparent t/f - used in color pickers
            group       : null,        // used for radio buttons
            items       : null,        // for type menu* it is an array of items in the menu
            selected    : null,        // used for menu-check, menu-radio
            overlay     : {},
            onClick     : null,
            onRefresh   : null
        },

        add: function (items) {
            this.insert(null, items);
        },

        insert: function (id, items) {
            if (!$.isArray(items)) items = [items];
            for (var o = 0; o < items.length; o++) {
                // checks
                if (items[o].type == null) {
                    console.log('ERROR: The parameter "type" is required but not supplied in w2toolbar.add() method.');
                    return;
                }
                if ($.inArray(String(items[o].type), ['button', 'check', 'radio', 'drop', 'menu', 'menu-radio', 'menu-check', 'color', 'text-color', 'break', 'html', 'spacer']) == -1) {
                    console.log('ERROR: The parameter "type" should be one of the following [button, check, radio, drop, menu, break, html, spacer] '+
                            'in w2toolbar.add() method.');
                    return;
                }
                if (items[o].id == null && items[o].type != 'break' && items[o].type != 'spacer') {
                    console.log('ERROR: The parameter "id" is required but not supplied in w2toolbar.add() method.');
                    return;
                }
                if (!w2utils.checkUniqueId(items[o].id, this.items, 'toolbar items', this.name)) return;
                // add item
                var it = $.extend({}, w2toolbar.prototype.item, items[o]);
                if (id == null) {
                    this.items.push(it);
                } else {
                    var middle = this.get(id, true);
                    this.items = this.items.slice(0, middle).concat([it], this.items.slice(middle));
                }
                this.refresh(it.id);
                this.resize();
            }
        },

        remove: function () {
            var removed = 0;
            for (var a = 0; a < arguments.length; a++) {
                var it = this.get(arguments[a]);
                if (!it || String(arguments[a]).indexOf(':') != -1) continue;
                removed++;
                // remove from screen
                $(this.box).find('#tb_'+ this.name +'_item_'+ w2utils.escapeId(it.id)).remove();
                // remove from array
                var ind = this.get(it.id, true);
                if (ind != null) this.items.splice(ind, 1);
            }
            this.resize();
            return removed;
        },

        set: function (id, newOptions) {
            var item = this.get(id);
            if (item == null) return false;
            $.extend(item, newOptions);
            this.refresh(String(id).split(':')[0]);
            return true;
        },

        get: function (id, returnIndex) {
            if (arguments.length === 0) {
                var all = [];
                for (var i1 = 0; i1 < this.items.length; i1++) if (this.items[i1].id != null) all.push(this.items[i1].id);
                return all;
            }
            var tmp = String(id).split(':');
            for (var i2 = 0; i2 < this.items.length; i2++) {
                var it = this.items[i2];
                // find a menu item
                if (['menu', 'menu-radio', 'menu-check'].indexOf(it.type) != -1 && tmp.length == 2 && it.id == tmp[0]) {
                    for (var i = 0; i < it.items.length; i++) {
                        var item = it.items[i];
                        if (item.id == tmp[1] || (item.id == null && item.text == tmp[1])) {
                            if (returnIndex == true) return i; else return item;
                        }
                    }
                } else if (it.id == tmp[0]) {
                    if (returnIndex == true) return i2; else return it;
                }
            }
            return null;
        },

        show: function () {
            var obj   = this;
            var items = 0;
            var tmp   = [];
            for (var a = 0; a < arguments.length; a++) {
                var it = this.get(arguments[a]);
                if (!it) continue;
                items++;
                it.hidden = false;
                tmp.push(String(arguments[a]).split(':')[0]);
            }
            setTimeout(function () { for (var t=0; t<tmp.length; t++) obj.refresh(tmp[t]); obj.resize(); }, 15); // needs timeout
            return items;
        },

        hide: function () {
            var obj   = this;
            var items = 0;
            var tmp   = [];
            for (var a = 0; a < arguments.length; a++) {
                var it = this.get(arguments[a]);
                if (!it) continue;
                items++;
                it.hidden = true;
                tmp.push(String(arguments[a]).split(':')[0]);
            }
            setTimeout(function () { for (var t=0; t<tmp.length; t++) { obj.refresh(tmp[t]); obj.tooltipHide(tmp[t]); } obj.resize(); }, 15); // needs timeout
            return items;
        },

        enable: function () {
            var obj   = this;
            var items = 0;
            var tmp   = [];
            for (var a = 0; a < arguments.length; a++) {
                var it = this.get(arguments[a]);
                if (!it) continue;
                items++;
                it.disabled = false;
                tmp.push(String(arguments[a]).split(':')[0]);
            }
            setTimeout(function () { for (var t=0; t<tmp.length; t++) obj.refresh(tmp[t]); }, 15); // needs timeout
            return items;
        },

        disable: function () {
            var obj   = this;
            var items = 0;
            var tmp   = [];
            for (var a = 0; a < arguments.length; a++) {
                var it = this.get(arguments[a]);
                if (!it) continue;
                items++;
                it.disabled = true;
                tmp.push(String(arguments[a]).split(':')[0]);
            }
            setTimeout(function () { for (var t=0; t<tmp.length; t++) { obj.refresh(tmp[t]); obj.tooltipHide(tmp[t]); } }, 15); // needs timeout
            return items;
        },

        check: function () {
            var obj   = this;
            var items = 0;
            var tmp   = [];
            for (var a = 0; a < arguments.length; a++) {
                var it = this.get(arguments[a]);
                if (!it || String(arguments[a]).indexOf(':') != -1) continue;
                items++;
                it.checked = true;
                tmp.push(String(arguments[a]).split(':')[0]);
            }
            setTimeout(function () { for (var t=0; t<tmp.length; t++) obj.refresh(tmp[t]); }, 15); // needs timeout
            return items;
        },

        uncheck: function () {
            var obj   = this;
            var items = 0;
            var tmp   = [];
            for (var a = 0; a < arguments.length; a++) {
                var it = this.get(arguments[a]);
                if (!it || String(arguments[a]).indexOf(':') != -1) continue;
                // remove overlay
                if (['menu', 'menu-radio', 'menu-check', 'drop', 'color', 'text-color'].indexOf(it.type) != -1 && it.checked) {
                    // hide overlay
                    setTimeout(function () {
                        var el = $('#tb_'+ obj.name +'_item_'+ w2utils.escapeId(it.id));
                        el.w2overlay({ name: obj.name });
                    }, 1);
                }
                items++;
                it.checked = false;
                tmp.push(String(arguments[a]).split(':')[0]);
            }
            setTimeout(function () { for (var t=0; t<tmp.length; t++) obj.refresh(tmp[t]); }, 15); // needs timeout
            return items;
        },

        click: function (id, event) {
            var obj = this;
            // click on menu items
            var tmp = String(id).split(':');
            var it  = this.get(tmp[0]);
            if (tmp.length > 1) {
                var subItem = this.get(id);
                if (subItem && !subItem.disabled) {
                    obj.menuClick({ name: obj.name, item: it, subItem: subItem, originalEvent: event });
                }
                return;
            }
            if (it && !it.disabled) {
                // event before
                var edata = this.trigger({ phase: 'before', type: 'click', target: (id != null ? id : this.name),
                    item: it, object: it, originalEvent: event });
                if (edata.isCancelled === true) return;

                var btn = '#tb_'+ this.name +'_item_'+ w2utils.escapeId(it.id) +' table.w2ui-button';
                $(btn).removeClass('down'); // need to requery at the moment -- as well as elsewhere in this function

                if (it.type == 'radio') {
                    for (var i = 0; i < this.items.length; i++) {
                        var itt = this.items[i];
                        if (itt == null || itt.id == it.id || itt.type !== 'radio') continue;
                        if (itt.group == it.group && itt.checked) {
                            itt.checked = false;
                            this.refresh(itt.id);
                        }
                    }
                    it.checked = true;
                    $(btn).addClass('checked');
                }

                if (['menu', 'menu-radio', 'menu-check', 'drop', 'color', 'text-color'].indexOf(it.type) != -1) {
                    obj.tooltipHide(id);
                    if (it.checked) {
                        // if it was already checked, second click will hide it
                        setTimeout(function () {
                            // hide overlay
                            var el = $('#tb_'+ obj.name +'_item_'+ w2utils.escapeId(it.id));
                            el.w2overlay({ name: obj.name });
                            // uncheck
                            it.checked = false;
                            obj.refresh(it.id);
                        }, 1);

                    } else {

                        // show overlay
                        setTimeout(function () {
                            var el = $('#tb_'+ obj.name +'_item_'+ w2utils.escapeId(it.id));
                            if (!$.isPlainObject(it.overlay)) it.overlay = {};
                            var left = (el.width() - 50) / 2;
                            if (left > 19) left = 19;
                            if (it.type == 'drop') {
                                el.w2overlay(it.html, $.extend({ name: obj.name, left: left, top: 3 }, it.overlay, {
                                    onHide: function (event) {
                                        hideDrop();
                                    }
                                }));
                            }
                            if (['menu', 'menu-radio', 'menu-check'].indexOf(it.type) != -1) {
                                var menuType = 'normal';
                                if (it.type == 'menu-radio') {
                                    menuType = 'radio';
                                    it.items.forEach(function (item) {
                                        if (it.selected == item.id) item.checked = true; else item.checked = false;
                                    });
                                }
                                if (it.type == 'menu-check') {
                                    menuType = 'check';
                                    it.items.forEach(function (item) {
                                        if ($.isArray(it.selected) && it.selected.indexOf(item.id) != -1) item.checked = true; else item.checked = false;
                                    });
                                }
                                el.w2menu($.extend({ name: obj.name, items: it.items, left: left, top: 3 }, it.overlay, {
                                    type: menuType,
                                    select: function (event) {
                                        obj.menuClick({ name: obj.name, item: it, subItem: event.item, originalEvent: event.originalEvent, keepOpen: event.keepOpen });
                                    },
                                    onHide: function (event) {
                                        hideDrop();
                                    }
                                }));
                            }
                            if (['color', 'text-color'].indexOf(it.type) != -1) {
                                if (it.transparent == null) it.transparent = true;
                                $(el).w2color({ color: it.color, transparent: it.transparent }, function (color, index) {
                                    if (color != null) {
                                        obj.colorClick({ name: obj.name, item: it, color: color, originalEvent: event.originalEvent });
                                    }
                                    hideDrop();
                                });
                            }
                            function hideDrop(event) {
                                it.checked = false;
                                $(btn).removeClass('checked');
                            }
                        }, 1);
                    }
                }

                if (['check', 'menu', 'menu-radio', 'menu-check', 'drop', 'color', 'text-color'].indexOf(it.type) != -1) {
                    it.checked = !it.checked;
                    if (it.checked) {
                        $(btn).addClass('checked');
                    } else {
                        $(btn).removeClass('checked');
                    }
                }
                // route processing
                if (it.route) {
                    var route = String('/'+ it.route).replace(/\/{2,}/g, '/');
                    var info  = w2utils.parseRoute(route);
                    if (info.keys.length > 0) {
                        for (var k = 0; k < info.keys.length; k++) {
                            route = route.replace((new RegExp(':'+ info.keys[k].name, 'g')), this.routeData[info.keys[k].name]);
                        }
                    }
                    setTimeout(function () { window.location.hash = route; }, 1);
                }
                if (event && ['button', 'check', 'radio'].indexOf(it.type) != -1) {
                    // need to refresh toolbar as it might be dynamic
                    this.tooltipShow(id, event, true);
                }
                // event after
                this.trigger($.extend(edata, { phase: 'after' }));
            }
        },

        scroll: function (direction) {
            var box = $(this.box);
            var obj = this;
            var scrollBox  = box.find('.w2ui-scroll-wrapper');
            var scrollLeft = scrollBox.scrollLeft();
            var width1, width2, scroll;

            switch (direction) {
                case 'left':
                    width1 = scrollBox.outerWidth();
                    width2 = scrollBox.find(':first').outerWidth();
                    scroll = scrollLeft - width1 + 50; // 35 is width of both button
                    if (scroll <= 0) scroll = 0;
                    scrollBox.animate({ scrollLeft: scroll }, 300);
                    break;

                case 'right':
                    width1 = scrollBox.outerWidth();
                    width2 = scrollBox.find(':first').outerWidth();
                    scroll = scrollLeft + width1 - 50; // 35 is width of both button
                    if (scroll >= width2 - width1) scroll = width2 - width1;
                    scrollBox.animate({ scrollLeft: scroll }, 300);
                    break;
            }
            setTimeout(function () { obj.resize(); }, 350);
        },

        render: function (box) {
            var time = (new Date()).getTime();
            // event before
            var edata = this.trigger({ phase: 'before', type: 'render', target: this.name, box: box });
            if (edata.isCancelled === true) return;

            if (box != null) {
                if ($(this.box).find('> table #tb_'+ this.name + '_right').length > 0) {
                    $(this.box)
                        .removeAttr('name')
                        .removeClass('w2ui-reset w2ui-toolbar')
                        .html('');
                }
                this.box = box;
            }
            if (!this.box) return;
            // render all buttons
            var html = '<div class="w2ui-scroll-wrapper" onmousedown="var el=w2ui[\''+ this.name +'\']; if (el) el.resize();">'+
                       '<table cellspacing="0" cellpadding="0" width="100%"><tbody>'+
                       '<tr>';
            for (var i = 0; i < this.items.length; i++) {
                var it = this.items[i];
                if (it == null)  continue;
                if (it.id == null) it.id = "item_" + i;
                if (it.type == 'spacer') {
                    html += '<td width="100%" id="tb_'+ this.name +'_item_'+ it.id +'" align="right"></td>';
                } else {
                    html += '<td id="tb_'+ this.name + '_item_'+ it.id +'" style="'+ (it.hidden ? 'display: none' : '') +'" '+
                            '    class="'+ (it.disabled ? 'disabled' : '') +'" valign="middle">'+
                            '</td>';
                }
            }
            html += '<td width="100%" id="tb_'+ this.name +'_right" align="right">'+ this.right +'</td>';
            html += '</tr>'+
                    '</tbody></table></div>'+
                    '<div class="w2ui-scroll-left" onclick="var el=w2ui[\''+ this.name +'\']; if (el) el.scroll(\'left\');"></div>'+
                    '<div class="w2ui-scroll-right" onclick="var el=w2ui[\''+ this.name +'\']; if (el) el.scroll(\'right\');"></div>';
            $(this.box)
                .attr('name', this.name)
                .addClass('w2ui-reset w2ui-toolbar')
                .html(html);
            if ($(this.box).length > 0) $(this.box)[0].style.cssText += this.style;
            // refresh all
            this.refresh();
            this.resize();
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            return (new Date()).getTime() - time;
        },

        refresh: function (id) {
            var time = (new Date()).getTime();
            // event before
            var edata = this.trigger({ phase: 'before', type: 'refresh', target: (id != null ? id : this.name), item: this.get(id) });
            if (edata.isCancelled === true) return;
            // refresh all
            if (id == null) {
                for (var i = 0; i < this.items.length; i++) {
                    var it1 = this.items[i];
                    if (it1.id == null) it1.id = "item_" + i;
                    this.refresh(it1.id);
                }
                return;
            }
            // create or refresh only one item
            var it = this.get(id);
            if (it == null) return false;
            if (typeof it.onRefresh == 'function') {
                var edata2 = this.trigger({ phase: 'before', type: 'refresh', target: id, item: it, object: it });
                if (edata2.isCancelled === true) return;
            }
            var el = $(this.box).find('#tb_'+ this.name +'_item_'+ w2utils.escapeId(it.id));
            var html  = this.getItemHTML(it);
            if (el.length === 0) {
                // does not exist - create it
                if (it.type == 'spacer') {
                    html = '<td width="100%" id="tb_'+ this.name +'_item_'+ it.id +'" align="right"></td>';
                } else {
                    html = '<td id="tb_'+ this.name + '_item_'+ it.id +'" style="'+ (it.hidden ? 'display: none' : '') +'" '+
                        '    class="'+ (it.disabled ? 'disabled' : '') +'" valign="middle">'+ html +
                        '</td>';
                }
                if (this.get(id, true) == this.items.length-1) {
                    $(this.box).find('#tb_'+ this.name +'_right').before(html);
                } else {
                    $(this.box).find('#tb_'+ this.name +'_item_'+ w2utils.escapeId(this.items[parseInt(this.get(id, true))+1].id)).before(html);
                }
            } else {
                if (['menu', 'menu-radio', 'menu-check', 'drop', 'color', 'text-color'].indexOf(it.type) != -1 && it.checked == false) {
                    if ($('#w2ui-overlay-'+ this.name).length > 0) $('#w2ui-overlay-'+ this.name)[0].hide();
                }
                // refresh
                el.html(html);
                if (it.hidden) { el.css('display', 'none'); } else { el.css('display', ''); }
                if (it.disabled) { el.addClass('disabled'); } else { el.removeClass('disabled'); }
            }
            // event after
            if (typeof it.onRefresh == 'function') {
                this.trigger($.extend(edata2, { phase: 'after' }));
            }
            this.trigger($.extend(edata, { phase: 'after' }));
            return (new Date()).getTime() - time;
        },

        resize: function () {
            var time = (new Date()).getTime();
            // event before
            var edata = this.trigger({ phase: 'before', type: 'resize', target: this.name });
            if (edata.isCancelled === true) return;

            // show hide overflow buttons
            var box = $(this.box);
            box.find('.w2ui-scroll-left, .w2ui-scroll-right').hide();
            var scrollBox = box.find('.w2ui-scroll-wrapper');
            if (scrollBox.find(':first').outerWidth() > scrollBox.outerWidth()) {
                // we have overflowed content
                if (scrollBox.scrollLeft() > 0) {
                    box.find('.w2ui-scroll-left').show();
                }
                if (scrollBox.scrollLeft() < scrollBox.find(':first').outerWidth() - scrollBox.outerWidth()) {
                    box.find('.w2ui-scroll-right').show();
                }
            }

            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            return (new Date()).getTime() - time;
        },

        destroy: function () {
            // event before
            var edata = this.trigger({ phase: 'before', type: 'destroy', target: this.name });
            if (edata.isCancelled === true) return;
            // clean up
            if ($(this.box).find('> table #tb_'+ this.name + '_right').length > 0) {
                $(this.box)
                    .removeAttr('name')
                    .removeClass('w2ui-reset w2ui-toolbar')
                    .html('');
            }
            $(this.box).html('');
            delete w2ui[this.name];
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        // ========================================
        // --- Internal Functions

        getItemHTML: function (item) {
            var html = '';
            if (item.caption != null && item.text == null) item.text = item.caption; // for backward compatibility
            if (item.text == null) item.text = '';
            if (item.tooltip == null && item.hint != null) item.tooltip = item.hint; // for backward compatibility
            if (item.tooltip == null) item.tooltip = '';
            var img  = '<td>&#160;</td>';
            var text = item.text;
            if (typeof text == 'function') text = text.call(this, item);
            if (item.img)  img = '<td><div class="w2ui-tb-image w2ui-icon '+ item.img +'"></div></td>';
            if (item.icon) img = '<td><div class="w2ui-tb-image"><span class="'+ item.icon +'"></span></div></td>';

            if (html === '') switch (item.type) {
                case 'color':
                case 'text-color':
                    if (typeof item.color == 'string' && item.color.substr(0,1) == '#') item.color = item.color.substr(1);
                    if (item.type == 'color') {
                        text = '<div style="height: 12px; width: 12px; margin-top: 1px; border: 1px solid #8A8A8A; border-radius: 1px; box-shadow: 0px 0px 1px #fff; '+
                               '        background-color: #'+ (item.color != null ? item.color : 'fff') +'; float: left;"></div>'+
                               (item.text ? '<div style="margin-left: 17px;">' + w2utils.lang(item.text) + '</div>' : '');
                    }
                    if (item.type == 'text-color') {
                        text = '<div style="color: #'+ (item.color != null ? item.color : '444') +';">'+
                                    (item.text ? w2utils.lang(item.text) : '<b>Aa</b>') +
                               '</div>';
                    }
                case 'menu':
                case 'menu-check':
                case 'menu-radio':
                case 'button':
                case 'check':
                case 'radio':
                case 'drop':
                    html += '<table cellpadding="0" cellspacing="0" '+
                            '       class="w2ui-button '+ (item.checked ? 'checked' : '') +'" '+
                            '       onclick     = "var el=w2ui[\''+ this.name + '\']; if (el) el.click(\''+ item.id +'\', event);" '+
                            '       onmouseover = "' + (!item.disabled ? "jQuery(this).addClass('over'); w2ui['"+ this.name +"'].tooltipShow('"+ item.id +"', event);" : "") + '"'+
                            '       onmouseout  = "' + (!item.disabled ? "jQuery(this).removeClass('over').removeClass('down'); w2ui['"+ this.name +"'].tooltipHide('"+ item.id +"', event);" : "") + '"'+
                            '       onmousedown = "' + (!item.disabled ? "jQuery(this).addClass('down');" : "") + '"'+
                            '       onmouseup   = "' + (!item.disabled ? "jQuery(this).removeClass('down');" : "") + '"'+
                            '><tbody>'+
                            '<tr><td>'+
                            '  <table cellpadding="1" cellspacing="0"><tbody>'+
                            '  <tr>' +
                                    img +
                                    (text !== ''
                                        ? '<td class="w2ui-tb-caption" nowrap="nowrap" style="'+ (item.style ? item.style : '') +'">'+ w2utils.lang(text) +'</td>'
                                        : ''
                                    ) +
                                    (item.count != null
                                        ? '<td class="w2ui-tb-count" nowrap="nowrap"><span>'+ item.count +'</span></td>'
                                        : ''
                                    ) +
                                    (((['menu', 'menu-radio', 'menu-check', 'drop', 'color', 'text-color'].indexOf(item.type) != -1) && item.arrow !== false) ?
                                        '<td class="w2ui-tb-down" nowrap="nowrap"><div></div></td>' : '') +
                            '  </tr></tbody></table>'+
                            '</td></tr></tbody></table>';
                    break;

                case 'break':
                    html += '<table cellpadding="0" cellspacing="0"><tbody><tr>'+
                            '    <td><div class="w2ui-break">&#160;</div></td>'+
                            '</tr></tbody></table>';
                    break;

                case 'html':
                    html += '<table cellpadding="0" cellspacing="0"><tbody><tr>'+
                            '    <td nowrap="nowrap">' + (typeof item.html == 'function' ? item.html.call(this, item) : item.html) + '</td>'+
                            '</tr></tbody></table>';
                    break;
            }
            return '<div>' + html + '</div>';
        },

        tooltipShow: function (id, event, forceRefresh) {
            if (this.tooltip == null) return;
            var $el  = $(this.box).find('#tb_'+ this.name + '_item_'+ w2utils.escapeId(id));
            var item = this.get(id);
            var pos  = this.tooltip;
            var txt  = item.tooltip;
            if (typeof txt == 'function') txt = txt.call(this, item);
            $el.prop('_mouse_over', true);
            setTimeout(function () {
                if ($el.prop('_mouse_over') === true && $el.prop('_mouse_tooltip') !== true) {
                    $el.prop('_mouse_tooltip', true);
                    // show tooltip
                    if (['menu', 'menu-radio', 'menu-check', 'drop', 'color', 'text-color'].indexOf(item.type) != -1 && item.checked == true) return; // not for opened drop downs
                    $el.w2tag(w2utils.lang(txt), { position: pos });
                }
                if (forceRefresh == true) {
                    $el.w2tag(w2utils.lang(txt), { position: pos });
                }
            }, 1);
        },

        tooltipHide: function (id, event) {
            if (this.tooltip == null) return;
            var $el  = $(this.box).find('#tb_'+ this.name + '_item_'+ w2utils.escapeId(id));
            var item = this.get(id);
            $el.removeProp('_mouse_over');
            setTimeout(function () {
                if ($el.prop('_mouse_over') !== true && $el.prop('_mouse_tooltip') === true) {
                    $el.removeProp('_mouse_tooltip');
                    // hide tooltip
                    $el.w2tag();
                }
            }, 1);
        },

        menuClick: function (event) {
            var obj = this;
            if (event.item && !event.item.disabled) {
                // event before
                var edata = this.trigger({ phase: 'before', type: 'click', target: event.item.id + ':' + event.subItem.id, item: event.item,
                    subItem: event.subItem, originalEvent: event.originalEvent });
                if (edata.isCancelled === true) return;

                // route processing
                var it   = event.subItem;
                var item = this.get(event.item.id);
                if (item.type == 'menu-radio') {
                    item.selected = it.id;
                    event.item.items.forEach(function (item) { item.checked = false; });
                    it.checked = true;
                }
                if (item.type == 'menu-check') {
                    if (!$.isArray(item.selected)) item.selected = [];
                    var ind = item.selected.indexOf(it.id);
                    if (ind == -1) {
                        item.selected.push(it.id);
                        it.checked = true;
                    } else {
                        item.selected.splice(ind, 1);
                        it.checked = false;
                    }
                }
                if (typeof it.route == 'string') {
                    var route = it.route !== '' ? String('/'+ it.route).replace(/\/{2,}/g, '/') : '';
                    var info  = w2utils.parseRoute(route);
                    if (info.keys.length > 0) {
                        for (var k = 0; k < info.keys.length; k++) {
                            if (obj.routeData[info.keys[k].name] == null) continue;
                            route = route.replace((new RegExp(':'+ info.keys[k].name, 'g')), this.routeData[info.keys[k].name]);
                        }
                    }
                    setTimeout(function () { window.location.hash = route; }, 1);
                }
                this.refresh(event.item.id);
                // event after
                this.trigger($.extend(edata, { phase: 'after' }));
            }
        },

        colorClick: function (event) {
            var obj = this;
            if (event.item && !event.item.disabled) {
                // event before
                var edata = this.trigger({ phase: 'before', type: 'click', target: event.item.id, item: event.item,
                    color: event.color, originalEvent: event.originalEvent });
                if (edata.isCancelled === true) return;

                // default behavior
                event.item.color = event.color;
                obj.refresh(event.item.id);

                // event after
                this.trigger($.extend(edata, { phase: 'after' }));
            }
        }
    };

    $.extend(w2toolbar.prototype, w2utils.event);
    w2obj.toolbar = w2toolbar;
})(jQuery);

/************************************************************************
*   Library: Web 2.0 UI for jQuery (using prototypical inheritance)
*   - Following objects defined
*        - w2sidebar        - sidebar widget
*        - $().w2sidebar    - jQuery wrapper
*   - Dependencies: jQuery, w2utils
*
* == NICE TO HAVE ==
*   - add find() method to find nodes by a specific criteria (I want all nodes for exampe)
*   - dbl click should be like it is in grid (with timer not HTML dbl click event)
*   - reorder with dgrag and drop
*   - node.style is misleading - should be there to apply color for example
*   - add multiselect
*
************************************************************************/

(function ($) {
    var w2sidebar = function (options) {
        this.name          = null;
        this.box           = null;
        this.sidebar       = null;
        this.parent        = null;
        this.nodes         = [];        // Sidebar child nodes
        this.menu          = [];
        this.routeData     = {};        // data for dynamic routes
        this.selected      = null;      // current selected node (readonly)
        this.img           = null;
        this.icon          = null;
        this.style         = '';
        this.topHTML       = '';
        this.bottomHTML    = '';
        this.flatButton    = false;
        this.keyboard      = true;
        this.flat          = false;
        this.hasFocus      = false;

        $.extend(true, this, w2obj.sidebar, options);
    };

    // ====================================================
    // -- Registers as a jQuery plugin

    $.fn.w2sidebar = function(method) {
        if ($.isPlainObject(method)) {
            // check name parameter
            if (!w2utils.checkName(method, 'w2sidebar')) return;
            // extend items
            var nodes  = method.nodes;
            var object = new w2sidebar(method);
            $.extend(object, { handlers: [], nodes: [] });
            if (nodes != null) {
                object.add(object, nodes);
            }
            if ($(this).length !== 0) {
                object.render($(this)[0]);
            }
            object.sidebar = object;
            // register new object
            w2ui[object.name] = object;
            return object;

        } else {
            var obj = w2ui[$(this).attr('name')];
            if (!obj) return null;
            if (arguments.length > 0) {
                if (obj[method]) obj[method].apply(obj, Array.prototype.slice.call(arguments, 1));
                return this;
            } else {
                return obj;
            }
        }
    };

    // ====================================================
    // -- Implementation of core functionality

    w2sidebar.prototype = {

        onClick       : null,      // Fire when user click on Node Text
        onDblClick    : null,      // Fire when user dbl clicks
        onContextMenu : null,
        onMenuClick   : null,      // when context menu item selected
        onExpand      : null,      // Fire when node Expands
        onCollapse    : null,      // Fire when node Colapses
        onKeydown     : null,
        onRender      : null,
        onRefresh     : null,
        onResize      : null,
        onDestroy     : null,
        onFocus       : null,
        onBlur        : null,
        onFlat        : null,

        node: {
            id              : null,
            text            : '',
            count           : null,
            img             : null,
            icon            : null,
            nodes           : [],
            style           : '',            // additional style for subitems
            route           : null,
            selected        : false,
            expanded        : false,
            hidden          : false,
            disabled        : false,
            group           : false,        // if true, it will build as a group
            groupShowHide   : true,
            collapsible     : true,
            plus            : false,        // if true, plus will be shown even if there is no sub nodes
            // events
            onClick         : null,
            onDblClick      : null,
            onContextMenu   : null,
            onExpand        : null,
            onCollapse      : null,
            // internal
            parent          : null,         // node object
            sidebar         : null
        },

        add: function (parent, nodes) {
            if (arguments.length == 1) {
                // need to be in reverse order
                nodes  = arguments[0];
                parent = this;
            }
            if (typeof parent == 'string') parent = this.get(parent);
            return this.insert(parent, null, nodes);
        },

        insert: function (parent, before, nodes) {
            var txt, ind, tmp, node, nd;
            if (arguments.length == 2) {
                // need to be in reverse order
                nodes  = arguments[1];
                before = arguments[0];
                if (before != null) {
                    ind = this.get(before);
                    if (ind == null) {
                        if (!$.isArray(nodes)) nodes = [nodes];
                        txt = (nodes[0].caption != null ? nodes[0].caption : nodes[0].text);
                        console.log('ERROR: Cannot insert node "'+ txt +'" because cannot find node "'+ before +'" to insert before.');
                        return null;
                    }
                    parent = this.get(before).parent;
                } else {
                    parent = this;
                }
            }
            if (typeof parent == 'string') parent = this.get(parent);
            if (!$.isArray(nodes)) nodes = [nodes];
            for (var o = 0; o < nodes.length; o++) {
                node = nodes[o];
                if (typeof node.id == null) {
                    txt = (node.caption != null ? node.caption : node.text);
                    console.log('ERROR: Cannot insert node "'+ txt +'" because it has no id.');
                    continue;
                }
                if (this.get(this, node.id) != null) {
                    txt = (node.caption != null ? node.caption : node.text);
                    console.log('ERROR: Cannot insert node with id='+ node.id +' (text: '+ txt + ') because another node with the same id already exists.');
                    continue;
                }
                tmp = $.extend({}, w2sidebar.prototype.node, node);
                tmp.sidebar = this;
                tmp.parent  = parent;
                nd = tmp.nodes || [];
                tmp.nodes = []; // very important to re-init empty nodes array
                if (before == null) { // append to the end
                    parent.nodes.push(tmp);
                } else {
                    ind = this.get(parent, before, true);
                    if (ind == null) {
                        txt = (node.caption != null ? node.caption : node.text);
                        console.log('ERROR: Cannot insert node "'+ txt +'" because cannot find node "'+ before +'" to insert before.');
                        return null;
                }
                    parent.nodes.splice(ind, 0, tmp);
                }
                if (nd.length > 0) {
                    this.insert(tmp, null, nd);
                }
            }
            this.refresh(parent.id);
            return tmp;
        },

        remove: function () { // multiple arguments
            var deleted = 0;
            var tmp;
            for (var a = 0; a < arguments.length; a++) {
                tmp = this.get(arguments[a]);
                if (tmp == null) continue;
                if (this.selected != null && this.selected === tmp.id) {
                    this.selected = null;
                }
                var ind  = this.get(tmp.parent, arguments[a], true);
                if (ind == null) continue;
                if (tmp.parent.nodes[ind].selected) tmp.sidebar.unselect(tmp.id);
                tmp.parent.nodes.splice(ind, 1);
                deleted++;
            }
            if (deleted > 0 && arguments.length == 1) this.refresh(tmp.parent.id); else this.refresh();
            return deleted;
        },

        set: function (parent, id, node) {
            if (arguments.length == 2) {
                // need to be in reverse order
                node    = id;
                id        = parent;
                parent    = this;
            }
            // searches all nested nodes
            if (typeof parent == 'string') parent = this.get(parent);
            if (parent.nodes == null) return null;
            for (var i = 0; i < parent.nodes.length; i++) {
                if (parent.nodes[i].id === id) {
                    // make sure nodes inserted correctly
                    var nodes = node.nodes;
                    $.extend(parent.nodes[i], node, { nodes: [] });
                    if (nodes != null) {
                        this.add(parent.nodes[i], nodes);
                    }
                    this.refresh(id);
                    return true;
                } else {
                    var rv = this.set(parent.nodes[i], id, node);
                    if (rv) return true;
                }
            }
            return false;
        },

        get: function (parent, id, returnIndex) { // can be just called get(id) or get(id, true)
            if (arguments.length === 0) {
                var all = [];
                var tmp = this.find({});
                for (var t = 0; t < tmp.length; t++) {
                    if (tmp[t].id != null) all.push(tmp[t].id);
                }
                return all;
            } else {
                if (arguments.length == 1 || (arguments.length == 2 && id === true) ) {
                    // need to be in reverse order
                    returnIndex    = id;
                    id            = parent;
                    parent        = this;
                }
                // searches all nested nodes
                if (typeof parent == 'string') parent = this.get(parent);
                if (parent.nodes == null) return null;
                for (var i = 0; i < parent.nodes.length; i++) {
                    if (parent.nodes[i].id == id) {
                        if (returnIndex === true) return i; else return parent.nodes[i];
                    } else {
                        var rv = this.get(parent.nodes[i], id, returnIndex);
                        if (rv || rv === 0) return rv;
                    }
                }
                return null;
            }
        },

        find: function (parent, params, results) { // can be just called find({ selected: true })
            if (arguments.length == 1) {
                // need to be in reverse order
                params = parent;
                parent = this;
            }
            if (!results) results = [];
            // searches all nested nodes
            if (typeof parent == 'string') parent = this.get(parent);
            if (parent.nodes == null) return results;
            for (var i = 0; i < parent.nodes.length; i++) {
                var match = true;
                for (var prop in params) { // params is an object
                    if (parent.nodes[i][prop] != params[prop]) match = false;
                }
                if (match) results.push(parent.nodes[i]);
                if (parent.nodes[i].nodes.length > 0) results = this.find(parent.nodes[i], params, results);
            }
            return results;
        },

        hide: function () { // multiple arguments
            var hidden = 0;
            for (var a = 0; a < arguments.length; a++) {
                var tmp = this.get(arguments[a]);
                if (tmp == null) continue;
                tmp.hidden = true;
                hidden++;
            }
            if (arguments.length == 1) this.refresh(arguments[0]); else this.refresh();
            return hidden;
        },

        show: function () { // multiple arguments
            var shown = 0;
            for (var a = 0; a < arguments.length; a++) {
                var tmp = this.get(arguments[a]);
                if (tmp == null) continue;
                tmp.hidden = false;
                shown++;
            }
            if (arguments.length == 1) this.refresh(arguments[0]); else this.refresh();
            return shown;
        },

        disable: function () { // multiple arguments
            var disabled = 0;
            for (var a = 0; a < arguments.length; a++) {
                var tmp = this.get(arguments[a]);
                if (tmp == null) continue;
                tmp.disabled = true;
                if (tmp.selected) this.unselect(tmp.id);
                disabled++;
            }
            if (arguments.length == 1) this.refresh(arguments[0]); else this.refresh();
            return disabled;
        },

        enable: function () { // multiple arguments
            var enabled = 0;
            for (var a = 0; a < arguments.length; a++) {
                var tmp = this.get(arguments[a]);
                if (tmp == null) continue;
                tmp.disabled = false;
                enabled++;
            }
            if (arguments.length == 1) this.refresh(arguments[0]); else this.refresh();
            return enabled;
        },

        select: function (id) {
            var new_node = this.get(id);
            if (!new_node) return false;
            if (this.selected == id && new_node.selected) return false;
            this.unselect(this.selected);
            $(this.box).find('#node_'+ w2utils.escapeId(id))
                .addClass('w2ui-selected')
                .find('.w2ui-icon').addClass('w2ui-icon-selected');
            new_node.selected = true;
            this.selected = id;
            return true;
        },

        unselect: function (id) {
            // if no arguments provided, unselect selected node
            if (arguments.length === 0) {
                id = this.selected;
            }
            var current = this.get(id);
            if (!current) return false;
            current.selected = false;
            $(this.box).find('#node_'+ w2utils.escapeId(id))
                .removeClass('w2ui-selected')
                .find('.w2ui-icon').removeClass('w2ui-icon-selected');
            if (this.selected == id) this.selected = null;
            return true;
        },

        toggle: function(id) {
            var nd = this.get(id);
            if (nd == null) return false;
            if (nd.plus) {
                this.set(id, { plus: false });
                this.expand(id);
                this.refresh(id);
                return;
            }
            if (nd.nodes.length === 0) return false;
            if (!nd.collapsible) return false;
            if (this.get(id).expanded) return this.collapse(id); else return this.expand(id);
        },

        collapse: function (id) {
            var obj = this;
            var nd  = this.get(id);
            // event before
            var edata = this.trigger({ phase: 'before', type: 'collapse', target: id, object: nd });
            if (edata.isCancelled === true) return;
            // default action
            $(this.box).find('#node_'+ w2utils.escapeId(id) +'_sub').slideUp(200);
            $(this.box).find('#node_'+ w2utils.escapeId(id) +' .w2ui-node-dots:first-child').html('<div class="w2ui-expand">+</div>');
            nd.expanded = false;
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            setTimeout(function () { obj.refresh(id); }, 200);
            return true;
        },

        collapseAll: function (parent) {
            if (parent == null) parent = this;
            if (typeof parent == 'string') parent = this.get(parent);
            if (parent.nodes == null) return false;
            for (var i = 0; i < parent.nodes.length; i++) {
                if (parent.nodes[i].expanded === true) parent.nodes[i].expanded = false;
                if (parent.nodes[i].nodes && parent.nodes[i].nodes.length > 0) this.collapseAll(parent.nodes[i]);
            }
            this.refresh(parent.id);
            return true;
        },

        expand: function (id) {
            var obj = this;
            var nd  = this.get(id);
            // event before
            var edata = this.trigger({ phase: 'before', type: 'expand', target: id, object: nd });
            if (edata.isCancelled === true) return;
            // default action
            $(this.box).find('#node_'+ w2utils.escapeId(id) +'_sub').slideDown(200);
            $(this.box).find('#node_'+ w2utils.escapeId(id) +' .w2ui-node-dots:first-child').html('<div class="w2ui-expand">-</div>');
            nd.expanded = true;
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            setTimeout(function () { obj.refresh(id); }, 200);
            return true;
        },

        expandAll: function (parent) {
            if (parent == null) parent = this;
            if (typeof parent == 'string') parent = this.get(parent);
            if (parent.nodes == null) return false;
            for (var i = 0; i < parent.nodes.length; i++) {
                if (parent.nodes[i].expanded === false) parent.nodes[i].expanded = true;
                if (parent.nodes[i].nodes && parent.nodes[i].nodes.length > 0) this.expandAll(parent.nodes[i]);
            }
            this.refresh(parent.id);
        },

        expandParents: function (id) {
            var node = this.get(id);
            if (node == null) return false;
            if (node.parent) {
                if (!node.parent.expanded) {
                    node.parent.expanded = true;
                    this.refresh(node.parent.id);
                }
                this.expandParents(node.parent.id);
            }
            return true;
        },

        click: function (id, event) {
            var obj = this;
            var nd  = this.get(id);
            if (nd == null) return;
            if (nd.disabled || nd.group) return; // should click event if already selected
            // unselect all previsously
            $(obj.box).find('.w2ui-node.w2ui-selected').each(function (index, el) {
                var oldID     = $(el).attr('id').replace('node_', '');
                var oldNode = obj.get(oldID);
                if (oldNode != null) oldNode.selected = false;
                $(el).removeClass('w2ui-selected').find('.w2ui-icon').removeClass('w2ui-icon-selected');
            });
            // select new one
            var newNode = $(obj.box).find('#node_'+ w2utils.escapeId(id));
            var oldNode = $(obj.box).find('#node_'+ w2utils.escapeId(obj.selected));
            newNode.addClass('w2ui-selected').find('.w2ui-icon').addClass('w2ui-icon-selected');
            // need timeout to allow rendering
            setTimeout(function () {
                // event before
                var edata = obj.trigger({ phase: 'before', type: 'click', target: id, originalEvent: event, node: nd, object: nd });
                if (edata.isCancelled === true) {
                    // restore selection
                    newNode.removeClass('w2ui-selected').find('.w2ui-icon').removeClass('w2ui-icon-selected');
                    oldNode.addClass('w2ui-selected').find('.w2ui-icon').addClass('w2ui-icon-selected');
                    return;
                }
                // default action
                if (oldNode != null) oldNode.selected = false;
                obj.get(id).selected = true;
                obj.selected = id;
                // route processing
                if (typeof nd.route == 'string') {
                    var route = nd.route !== '' ? String('/'+ nd.route).replace(/\/{2,}/g, '/') : '';
                    var info  = w2utils.parseRoute(route);
                    if (info.keys.length > 0) {
                        for (var k = 0; k < info.keys.length; k++) {
                            if (obj.routeData[info.keys[k].name] == null) continue;
                            route = route.replace((new RegExp(':'+ info.keys[k].name, 'g')), obj.routeData[info.keys[k].name]);
                        }
                    }
                    setTimeout(function () { window.location.hash = route; }, 1);
                }
                // event after
                obj.trigger($.extend(edata, { phase: 'after' }));
            }, 1);
        },

        focus: function (event) {
            var obj = this;
            // event before
            var edata = this.trigger({ phase: 'before', type: 'focus', target: this.name, originalEvent: event });
            if (edata.isCancelled === true) return false;
            // default behaviour
            this.hasFocus = true;
            $(this.box).find('.w2ui-selected').removeClass('w2ui-inactive');
            setTimeout(function () {
                var $input = $(obj.box).find('#sidebar_'+ obj.name + '_focus');
                if (!$input.is(':focus')) $input.focus();
            }, 10);
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        blur: function (event) {
            // event before
            var edata = this.trigger({ phase: 'before', type: 'blur', target: this.name, originalEvent: event });
            if (edata.isCancelled === true) return false;
            // default behaviour
            this.hasFocus = false;
            $(this.box).find('.w2ui-selected').addClass('w2ui-inactive');
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        keydown: function (event) {
            var obj = this;
            var nd  = obj.get(obj.selected);
            if (obj.keyboard !== true) return;
            if (!nd) nd = obj.nodes[0];
            // trigger event
            var edata = obj.trigger({ phase: 'before', type: 'keydown', target: obj.name, originalEvent: event });
            if (edata.isCancelled === true) return;
            // default behaviour
            if (event.keyCode == 13 || event.keyCode == 32) { // enter or space
                if (nd.nodes.length > 0) obj.toggle(obj.selected);
            }
            if (event.keyCode == 37) { // left
                if (nd.nodes.length > 0 && nd.expanded) {
                    obj.collapse(obj.selected);
                } else {
                    selectNode(nd.parent);
                    if (!nd.parent.group) obj.collapse(nd.parent.id);
                }
            }
            if (event.keyCode == 39) { // right
                if ((nd.nodes.length > 0 || nd.plus) && !nd.expanded) obj.expand(obj.selected);
            }
            if (event.keyCode == 38) { // up
                selectNode(neighbor(nd, prev));
            }
            if (event.keyCode == 40) { // down
                selectNode(neighbor(nd, next));
            }
            // cancel event if needed
            if ($.inArray(event.keyCode, [13, 32, 37, 38, 39, 40]) != -1) {
                if (event.preventDefault) event.preventDefault();
                if (event.stopPropagation) event.stopPropagation();
            }
            // event after
            obj.trigger($.extend(edata, { phase: 'after' }));

            function selectNode (node, event) {
                if (node != null && !node.hidden && !node.disabled && !node.group) {
                    obj.click(node.id, event);
                    setTimeout(function () { obj.scrollIntoView(); }, 50);
                }
            }

            function neighbor (node, neighborFunc) {
                node = neighborFunc(node);
                while (node != null && (node.hidden || node.disabled)) {
                    if (node.group) break; else node = neighborFunc(node);
                }
                return node;
            }

            function next (node, noSubs) {
                if (node == null) return null;
                var parent   = node.parent;
                var ind      = obj.get(node.id, true);
                var nextNode = null;
                // jump inside
                if (node.expanded && node.nodes.length > 0 && noSubs !== true) {
                    var t = node.nodes[0];
                    if (t.hidden || t.disabled || t.group) nextNode = next(t); else nextNode = t;
                } else {
                    if (parent && ind + 1 < parent.nodes.length) {
                        nextNode = parent.nodes[ind + 1];
                    } else {
                        nextNode = next(parent, true); // jump to the parent
                    }
                }
                if (nextNode != null && (nextNode.hidden || nextNode.disabled || nextNode.group)) nextNode = next(nextNode);
                return nextNode;
            }

            function prev (node) {
                if (node == null) return null;
                var parent   = node.parent;
                var ind      = obj.get(node.id, true);
                var prevNode = (ind > 0) ? lastChild(parent.nodes[ind - 1]) : parent;
                if (prevNode != null && (prevNode.hidden || prevNode.disabled || prevNode.group)) prevNode = prev(prevNode);
                return prevNode;
            }

            function lastChild (node) {
                if (node.expanded && node.nodes.length > 0) {
                    var t = node.nodes[node.nodes.length - 1];
                    if (t.hidden || t.disabled || t.group) return prev(t); else return lastChild(t);
                }
                return node;
            }
        },

        scrollIntoView: function (id) {
            if (id == null) id = this.selected;
            var nd = this.get(id);
            if (nd == null) return;
            var body   = $(this.box).find('.w2ui-sidebar-div');
            var item   = $(this.box).find('#node_'+ w2utils.escapeId(id));
            var offset = item.offset().top - body.offset().top;
            if (offset + item.height() > body.height() || offset <= 0) {
                body.animate({ 'scrollTop': body.scrollTop() + offset - body.height() / 2 + item.height() }, 250, 'linear');
            }
        },

        dblClick: function (id, event) {
            var nd = this.get(id);
            // event before
            var edata = this.trigger({ phase: 'before', type: 'dblClick', target: id, originalEvent: event, object: nd });
            if (edata.isCancelled === true) return;
            // default action
            this.toggle(id);
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        contextMenu: function (id, event) {
            var obj = this;
            var nd  = obj.get(id);
            if (id != obj.selected) obj.click(id);
            // event before
            var edata = obj.trigger({ phase: 'before', type: 'contextMenu', target: id, originalEvent: event, object: nd, allowOnDisabled: false });
            if (edata.isCancelled === true) return;
            // default action
            if (nd.disabled && !edata.allowOnDisabled) return;
            if (obj.menu.length > 0) {
                $(obj.box).find('#node_'+ w2utils.escapeId(id))
                    .w2menu({
                        items: obj.menu,
                        contextMenu: true,
                        originalEvent: event,
                        onSelect: function (event) {
                            obj.menuClick(id, parseInt(event.index), event.originalEvent);
                        }
                    }
                );
            }
            // cancel event
            if (event.preventDefault) event.preventDefault();
            // event after
            obj.trigger($.extend(edata, { phase: 'after' }));
        },

        menuClick: function (itemId, index, event) {
            var obj = this;
            // event before
            var edata = obj.trigger({ phase: 'before', type: 'menuClick', target: itemId, originalEvent: event, menuIndex: index, menuItem: obj.menu[index] });
            if (edata.isCancelled === true) return;
            // default action
            // -- empty
            // event after
            obj.trigger($.extend(edata, { phase: 'after' }));
        },

        goFlat: function () {
            // event before
            var edata = this.trigger({ phase: 'before', type: 'flat', goFlat: !this.flat });
            if (edata.isCancelled === true) return;
            // default action
            this.flat = !this.flat;
            this.refresh();
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        render: function (box) {
            var time = (new Date()).getTime();
            var obj  = this;
            // event before
            var edata = this.trigger({ phase: 'before', type: 'render', target: this.name, box: box });
            if (edata.isCancelled === true) return;
            // default action
            if (box != null) {
                if ($(this.box).find('> div > div.w2ui-sidebar-div').length > 0) {
                    $(this.box)
                        .removeAttr('name')
                        .removeClass('w2ui-reset w2ui-sidebar')
                        .html('');
                }
                this.box = box;
            }
            if (!this.box) return;
            $(this.box)
                .attr('name', this.name)
                .addClass('w2ui-reset w2ui-sidebar')
                .html('<div>'+
                        '<input id="sidebar_'+ this.name +'_focus" style="position: absolute; top: 0; right: 0; width: 1px; z-index: -1; opacity: 0"/>'+
                        '<div class="w2ui-sidebar-top"></div>' +
                        '<div class="w2ui-sidebar-div"></div>'+
                        '<div class="w2ui-sidebar-bottom"></div>'+
                    '</div>'
                );
            $(this.box).find('> div').css({
                width  : $(this.box).width() + 'px',
                height : $(this.box).height() + 'px'
            });
            if ($(this.box).length > 0) $(this.box)[0].style.cssText += this.style;
            // adjust top and bottom
            var flatHTML = '';
            if (this.flatButton == true) {
                flatHTML = '<div class="w2ui-flat-'+ (this.flat ? 'right' : 'left') +'" onclick="w2ui[\''+ this.name +'\'].goFlat()"></div>';
            }
            if (this.topHTML !== '' || flatHTML !== '') {
                $(this.box).find('.w2ui-sidebar-top').html(this.topHTML + flatHTML);
                $(this.box).find('.w2ui-sidebar-div')
                    .css('top', $(this.box).find('.w2ui-sidebar-top').height() + 'px');
            }
            if (this.bottomHTML !== '') {
                $(this.box).find('.w2ui-sidebar-bottom').html(this.bottomHTML);
                $(this.box).find('.w2ui-sidebar-div')
                    .css('bottom', $(this.box).find('.w2ui-sidebar-bottom').height() + 'px');
            }
            // focus
            var kbd_timer;
            $(this.box).find('#sidebar_'+ this.name + '_focus')
                .on('focus', function (event) {
                    clearTimeout(kbd_timer);
                    if (!obj.hasFocus) obj.focus(event);
                })
                .on('blur', function (event) {
                    kbd_timer = setTimeout(function () {
                        if (obj.hasFocus) { obj.blur(event); }
                    }, 100);
                })
                .on('keydown', function (event) {
                    if (event.keyCode != 9) { // not tab
                        w2ui[obj.name].keydown.call(w2ui[obj.name], event);
                    }
                });
            $(this.box).off('mousedown').on('mousedown', function (event) {
                // set focus to grid
                setTimeout(function () {
                    // if input then do not focus
                    if (['INPUT', 'TEXTAREA', 'SELECT'].indexOf(event.target.tagName.toUpperCase()) == -1) {
                        var $input = $(obj.box).find('#sidebar_'+ obj.name + '_focus');
                        if (!$input.is(':focus')) {
                            if ($(event.target).hasClass('w2ui-node')) {
                                var top = $(event.target).position().top + $(obj.box).find('.w2ui-sidebar-top').height() + event.offsetY;
                                $input.css({ top: top + 'px', left: '0px' });
                            }
                            $input.focus();
                        }
                    }
                }, 1);
            });
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            // ---
            this.refresh();
            return (new Date()).getTime() - time;
        },

        refresh: function (id) {
            var time = (new Date()).getTime();
            // event before
            var edata = this.trigger({ phase: 'before', type: 'refresh', target: (id != null ? id : this.name),
                fullRefresh: (id != null ? false : true) });
            if (edata.isCancelled === true) return;
            // adjust top and bottom
            var flatHTML = '';
            if (this.flatButton == true) {
                flatHTML = '<div class="w2ui-flat-'+ (this.flat ? 'right' : 'left') +'" onclick="w2ui[\''+ this.name +'\'].goFlat()"></div>';
            }
            if (this.topHTML !== '' || flatHTML !== '') {
                $(this.box).find('.w2ui-sidebar-top').html(this.topHTML + flatHTML);
                $(this.box).find('.w2ui-sidebar-div')
                    .css('top', $(this.box).find('.w2ui-sidebar-top').height() + 'px');
            }
            if (this.bottomHTML !== '') {
                $(this.box).find('.w2ui-sidebar-bottom').html(this.bottomHTML);
                $(this.box).find('.w2ui-sidebar-div')
                    .css('bottom', $(this.box).find('.w2ui-sidebar-bottom').height() + 'px');
            }
            // default action
            $(this.box).find('> div').removeClass('w2ui-sidebar-flat').addClass(this.flat ? 'w2ui-sidebar-flat' : '').css({
                width : $(this.box).width() + 'px',
                height: $(this.box).height() + 'px'
            });
            var obj = this;
            var node, nd;
            var nm;
            if (id == null) {
                node = this;
                nm   = '.w2ui-sidebar-div';
            } else {
                node = this.get(id);
                if (node == null) return;
                nm   = '#node_'+ w2utils.escapeId(node.id) + '_sub';
            }
            var nodeHTML;
            if (node !== this) {
                var tmp  = '#node_'+ w2utils.escapeId(node.id);
                nodeHTML = getNodeHTML(node);
                $(this.box).find(tmp).before('<div id="sidebar_'+ this.name + '_tmp"></div>');
                $(this.box).find(tmp).remove();
                $(this.box).find(nm).remove();
                $('#sidebar_'+ this.name + '_tmp').before(nodeHTML);
                $('#sidebar_'+ this.name + '_tmp').remove();
            }
            // refresh sub nodes
            $(this.box).find(nm).html('');
            for (var i = 0; i < node.nodes.length; i++) {
                nd = node.nodes[i];
                nodeHTML = getNodeHTML(nd);
                $(this.box).find(nm).append(nodeHTML);
                if (nd.nodes.length !== 0) {
                    this.refresh(nd.id);
                } else {
                    // trigger event
                    var edata2 = this.trigger({ phase: 'before', type: 'refresh', target: nd.id });
                    if (edata2.isCancelled === true) return;
                    // event after
                    this.trigger($.extend(edata2, { phase: 'after' }));
                }
            }
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            return (new Date()).getTime() - time;

            function getNodeHTML(nd) {
                var html = '';
                var img  = nd.img;
                if (img == null) img = this.img;
                var icon = nd.icon;
                if (icon == null) icon = this.icon;
                // -- find out level
                var tmp   = nd.parent;
                var level = 0;
                while (tmp && tmp.parent != null) {
                    if (tmp.group) level--;
                    tmp = tmp.parent;
                    level++;
                }
                if (nd.caption != null) nd.text = nd.caption;
                if (nd.group) {
                    html =
                        '<div class="w2ui-node-group w2ui-level-'+ level +'" id="node_'+ nd.id +'"'+
                        '   onclick="w2ui[\''+ obj.name +'\'].toggle(\''+ nd.id +'\')"'+
                        '   oncontextmenu="w2ui[\''+ obj.name +'\'].contextMenu(\''+ nd.id +'\', event);"'+
                        '   onmouseout="jQuery(this).find(\'span:nth-child(1)\').css(\'color\', \'transparent\')" '+
                        '   onmouseover="jQuery(this).find(\'span:nth-child(1)\').css(\'color\', \'inherit\')">'+
                        ((nd.groupShowHide && nd.collapsible) ? '<span>'+ (!nd.hidden && nd.expanded ? w2utils.lang('Hide') : w2utils.lang('Show')) +'</span>' : '<span></span>') +
                        (typeof nd.text == 'function' ? nd.text.call(obj, nd) : '<span>'+ nd.text +'</span>') +
                        '</div>'+
                        '<div class="w2ui-node-sub" id="node_'+ nd.id +'_sub" style="'+ nd.style +';'+ (!nd.hidden && nd.expanded ? '' : 'display: none;') +'"></div>';
                    if (obj.flat) {
                        html = '<div class="w2ui-node-group" id="node_'+ nd.id +'"><span>&#160;</span></div>'+
                               '<div id="node_'+ nd.id +'_sub" style="'+ nd.style +';'+ (!nd.hidden && nd.expanded ? '' : 'display: none;') +'"></div>';
                    }
                } else {
                    if (nd.selected && !nd.disabled) obj.selected = nd.id;
                    tmp = '';
                    if (img) tmp  = '<div class="w2ui-node-image w2ui-icon '+ img +    (nd.selected && !nd.disabled ? " w2ui-icon-selected" : "") +'"></div>';
                    if (icon) tmp = '<div class="w2ui-node-image"><span class="'+ icon +'"></span></div>';
                    var text = nd.text;
                    if (typeof nd.text == 'function') text = nd.text.call(obj, nd);
                    html =  '<div class="w2ui-node w2ui-level-'+ level +' '+ (nd.selected ? 'w2ui-selected' : '') +' '+ (nd.disabled ? 'w2ui-disabled' : '') +'" id="node_'+ nd.id +'" style="'+ (nd.hidden ? 'display: none;' : '') +'"'+
                            '    ondblclick="w2ui[\''+ obj.name +'\'].dblClick(\''+ nd.id +'\', event);"'+
                            '    oncontextmenu="w2ui[\''+ obj.name +'\'].contextMenu(\''+ nd.id +'\', event);"'+
                            '    onClick="w2ui[\''+ obj.name +'\'].click(\''+ nd.id +'\', event); ">'+
                            '<table cellpadding="0" cellspacing="0" style="margin-left:'+ (level*18) +'px; padding-right:'+ (level*18) +'px"><tbody><tr>'+
                            '<td class="w2ui-node-dots" nowrap="nowrap" onclick="w2ui[\''+ obj.name +'\'].toggle(\''+ nd.id +'\'); '+
                            '        if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true;">'+
                            '    <div class="w2ui-expand">'    + (nd.nodes.length > 0 ? (nd.expanded ? '-' : '+') : (nd.plus ? '+' : '')) + '</div>' +
                            '</td>'+
                            '<td class="w2ui-node-data" nowrap="nowrap">'+
                                    tmp +
                                    (nd.count || nd.count === 0 ? '<div class="w2ui-node-count">'+ nd.count +'</div>' : '') +
                                    '<div class="w2ui-node-caption">'+ text +'</div>'+
                            '</td>'+
                            '</tr></tbody></table>'+
                            '</div>'+
                            '<div class="w2ui-node-sub" id="node_'+ nd.id +'_sub" style="'+ nd.style +';'+ (!nd.hidden && nd.expanded ? '' : 'display: none;') +'"></div>';
                    if (obj.flat) {
                        html =  '<div class="w2ui-node w2ui-level-'+ level +' '+ (nd.selected ? 'w2ui-selected' : '') +' '+ (nd.disabled ? 'w2ui-disabled' : '') +'" id="node_'+ nd.id +'" style="'+ (nd.hidden ? 'display: none;' : '') +'"'+
                                '    onmouseover="jQuery(this).find(\'.w2ui-node-data\').w2tag(w2utils.base64decode(\''+
                                                w2utils.base64encode(text + (nd.count || nd.count === 0 ? ' - <span class="w2ui-node-count">'+ nd.count +'</span>' : '')) + '\'), '+
                                '               { id: \'' + nd.id + '\', left: -5 })"'+
                                '    onmouseout="jQuery(this).find(\'.w2ui-node-data\').w2tag(null, { id: \'' + nd.id + '\' })"'+
                                '    ondblclick="w2ui[\''+ obj.name +'\'].dblClick(\''+ nd.id +'\', event);"'+
                                '    oncontextmenu="w2ui[\''+ obj.name +'\'].contextMenu(\''+ nd.id +'\', event);"'+
                                '    onClick="w2ui[\''+ obj.name +'\'].click(\''+ nd.id +'\', event); ">'+
                                '<div class="w2ui-node-data w2ui-node-flat">'+ tmp +'</div>'+
                                '</div>'+
                                '<div class="w2ui-node-sub" id="node_'+ nd.id +'_sub" style="'+ nd.style +';'+ (!nd.hidden && nd.expanded ? '' : 'display: none;') +'"></div>';
                    }
                }
                return html;
            }
        },

        resize: function () {
            var time = (new Date()).getTime();
            // event before
            var edata = this.trigger({ phase: 'before', type: 'resize', target: this.name });
            if (edata.isCancelled === true) return;
            // default action
            $(this.box).css('overflow', 'hidden');    // container should have no overflow
            $(this.box).find('> div').css({
                width  : $(this.box).width() + 'px',
                height : $(this.box).height() + 'px'
            });
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            return (new Date()).getTime() - time;
        },

        destroy: function () {
            // event before
            var edata = this.trigger({ phase: 'before', type: 'destroy', target: this.name });
            if (edata.isCancelled === true) return;
            // clean up
            if ($(this.box).find('> div > div.w2ui-sidebar-div').length > 0) {
                $(this.box)
                    .removeAttr('name')
                    .removeClass('w2ui-reset w2ui-sidebar')
                    .html('');
            }
            delete w2ui[this.name];
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        lock: function (msg, showSpinner) {
            var args = Array.prototype.slice.call(arguments, 0);
            args.unshift(this.box);
            w2utils.lock.apply(window, args);
        },

        unlock: function (speed) {
            w2utils.unlock(this.box, speed);
        }
    };

    $.extend(w2sidebar.prototype, w2utils.event);
    w2obj.sidebar = w2sidebar;
})(jQuery);

/************************************************************************
*   Library: Web 2.0 UI for jQuery (using prototypical inheritance)
*   - Following objects defined
*        - w2field        - various field controls
*        - $().w2field    - jQuery wrapper
*   - Dependencies: jQuery, w2utils
*
* == NICE TO HAVE ==
*   - upload (regular files)
*   - BUG with prefix/postfix and arrows (test in different contexts)
*   - multiple date selection
*   - month selection, year selections
*   - arrows no longer work (for int)
*   - form to support custom types
*   - rewrite suffix and prefix positioning with translateY()
*   - prefix and suffix are slow (100ms or so)
*   - MultiSelect - Allow Copy/Paste for single and multi values
*   - add routeData to list/enum
*   - for type: list -> read value from attr('value')
*   - ENUM, LIST: should have same as grid (limit, offset, search, sort)
*   - ENUM, LIST: should support wild chars
*   - add selection of predefined times (used for appointments)
*
************************************************************************/

(function ($) {

    var w2field = function (options) {
        // public properties
        this.el          = null;
        this.helpers     = {}; // object or helper elements
        this.type        = options.type || 'text';
        this.options     = $.extend(true, {}, options);
        this.onSearch    = options.onSearch    || null;
        this.onRequest   = options.onRequest   || null;
        this.onLoad      = options.onLoad      || null;
        this.onError     = options.onError     || null;
        this.onClick     = options.onClick     || null;
        this.onAdd       = options.onAdd       || null;
        this.onNew       = options.onNew       || null;
        this.onRemove    = options.onRemove    || null;
        this.onMouseOver = options.onMouseOver || null;
        this.onMouseOut  = options.onMouseOut  || null;
        this.onIconClick = options.onIconClick || null;
        this.onScroll    = options.onScroll || null;
        this.tmp         = {}; // temp object
        // clean up some options
        delete this.options.type;
        delete this.options.onSearch;
        delete this.options.onRequest;
        delete this.options.onLoad;
        delete this.options.onError;
        delete this.options.onClick;
        delete this.options.onMouseOver;
        delete this.options.onMouseOut;
        delete this.options.onIconClick;
        delete this.options.onScroll;
        // extend with defaults
        $.extend(true, this, w2obj.field);
    };

    // ====================================================
    // -- Registers as a jQuery plugin

    $.fn.w2field = function (method, options) {
        // call direct
        if (this.length === 0) {
            var pr = w2field.prototype;
            if (pr[method]) {
                return pr[method].apply(pr, Array.prototype.slice.call(arguments, 1));
            }
        } else {
            // if without arguments - return the object
            if (arguments.length === 0) {
                var obj = $(this).data('w2field');
                return obj;
            }
            if (typeof method == 'string' && typeof options == 'object') {
                method = $.extend(true, {}, options, { type: method });
            }
            if (typeof method == 'string' && options == null) {
                method = { type: method };
            }
            method.type = String(method.type).toLowerCase();
            return this.each(function (index, el) {
                var obj = $(el).data('w2field');
                // if object is not defined, define it
                if (obj == null) {
                    var obj = new w2field(method);
                    $.extend(obj, { handlers: [] });
                    if (el) obj.el = $(el)[0];
                    obj.init();
                    $(el).data('w2field', obj);
                    return obj;
                } else { // fully re-init
                    obj.clear();
                    if (method.type == 'clear') return;
                    var obj = new w2field(method);
                    $.extend(obj, { handlers: [] });
                    if (el) obj.el = $(el)[0];
                    obj.init();
                    $(el).data('w2field', obj);
                    return obj;
                }
                return null;
            });
        }
    };

    // ====================================================
    // -- Implementation of core functionality

    /*     To add custom types
        $().w2field('addType', 'myType', function (options) {
            $(this.el).on('keypress', function (event) {
                if (event.metaKey || event.ctrlKey || event.altKey
                    || (event.charCode != event.keyCode && event.keyCode > 0)) return;
                var ch = String.fromCharCode(event.charCode);
                if (ch != 'a' && ch != 'b' && ch != 'c') {
                    if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true;
                    return false;
                }
            });
            $(this.el).on('blur', function (event)  { // keyCode & charCode differ in FireFox
                var ch = this.value;
                if (ch != 'a' && ch != 'b' && ch != 'c') {
                    $(this).w2tag(w2utils.lang("Not a single character from the set of 'abc'"));
                }
            });
        });
    */

    w2field.prototype = {

        custom: {},  // map of custom types

        addType: function (type, handler) {
            type = String(type).toLowerCase();
            this.custom[type] = handler;
            return true;
        },

        removeType: function (type) {
            type = String(type).toLowerCase();
            if (!this.custom[type]) return false;
            delete this.custom[type];
            return true;
        },

        init: function () {
            var obj     = this;
            var options = this.options;
            var defaults;

            // Custom Types
            if (typeof this.custom[this.type] == 'function') {
                this.custom[this.type].call(this, options);
                return;
            }
            // only for INPUT or TEXTAREA
            if (['INPUT', 'TEXTAREA'].indexOf(this.el.tagName.toUpperCase()) == -1) {
                console.log('ERROR: w2field could only be applied to INPUT or TEXTAREA.', this.el);
                return;
            }

            switch (this.type) {
                case 'text':
                case 'int':
                case 'float':
                case 'money':
                case 'currency':
                case 'percent':
                case 'alphanumeric':
                case 'bin':
                case 'hex':
                    defaults = {
                        min                : null,
                        max                : null,
                        step               : 1,
                        autoFormat         : true,
                        currencyPrefix     : w2utils.settings.currencyPrefix,
                        currencySuffix     : w2utils.settings.currencySuffix,
                        currencyPrecision  : w2utils.settings.currencyPrecision,
                        decimalSymbol      : w2utils.settings.decimalSymbol,
                        groupSymbol        : w2utils.settings.groupSymbol,
                        arrows             : false,
                        keyboard           : true,
                        precision          : null,
                        silent             : true,
                        prefix             : '',
                        suffix             : ''
                    };
                    this.options = $.extend(true, {}, defaults, options);
                    options = this.options; // since object is re-created, need to re-assign
                    options.numberRE  = new RegExp('['+ options.groupSymbol + ']', 'g');
                    options.moneyRE   = new RegExp('['+ options.currencyPrefix + options.currencySuffix + options.groupSymbol +']', 'g');
                    options.percentRE = new RegExp('['+ options.groupSymbol + '%]', 'g');
                    // no keyboard support needed
                    if (['text', 'alphanumeric', 'hex', 'bin'].indexOf(this.type) != -1) {
                        options.arrows   = false;
                        options.keyboard = false;
                    }
                    this.addPrefix(); // only will add if needed
                    this.addSuffix();
                    break;

                case 'color':
                    defaults = {
                        prefix      : '#',
                        suffix      : '<div style="width: '+ (parseInt($(this.el).css('font-size')) || 12) +'px">&#160;</div>',
                        arrows      : false,
                        keyboard    : false,
                        transparent : true
                    };
                    $.extend(options, defaults);
                    this.addPrefix();    // only will add if needed
                    this.addSuffix();    // only will add if needed
                    // additional checks
                    $(this.el).attr('maxlength', 6);
                    if ($(this.el).val() !== '') setTimeout(function () { obj.change(); }, 1);
                    break;

                case 'date':
                    defaults = {
                        format       : w2utils.settings.dateFormat, // date format
                        keyboard     : true,
                        silent       : true,
                        start        : '',       // string or jquery object
                        end          : '',       // string or jquery object
                        blocked      : {},       // { '4/11/2011': 'yes' }
                        colored      : {},        // { '4/11/2011': 'red:white' }
                        blockWeekDays : null       // array of numbers of weekday to block
                    };
                    this.options = $.extend(true, {}, defaults, options);
                    options = this.options; // since object is re-created, need to re-assign
                    if ($(this.el).attr('placeholder') == null) $(this.el).attr('placeholder', options.format);
                    break;

                case 'time':
                    defaults = {
                        format    : w2utils.settings.timeFormat,
                        keyboard  : true,
                        silent    : true,
                        start     : '',
                        end       : '',
                        noMinutes : false
                    };
                    this.options = $.extend(true, {}, defaults, options);
                    options = this.options; // since object is re-created, need to re-assign
                    if ($(this.el).attr('placeholder') == null) $(this.el).attr('placeholder', options.format);
                    break;

                case 'datetime':
                    defaults = {
                        format      : w2utils.settings.dateFormat + ' | ' + w2utils.settings.timeFormat,
                        keyboard    : true,
                        silent      : true,
                        start       : '',       // string or jquery object or Date object
                        end         : '',       // string or jquery object or Date object
                        blocked     : [],       // [ '4/11/2011', '4/12/2011' ] or [ new Date(2011, 4, 11), new Date(2011, 4, 12) ]
                        colored     : {},       // { '12/17/2014': 'blue:green', '12/18/2014': 'gray:white'  }; // key has to be formatted with w2utils.settings.dateFormat
                        placeholder : null,     // optional. will fall back to this.format if not specified. Only used if this.el has no placeholder attribute.
                        btn_now     : true,     // show/hide the use-current-date-and-time button
                        noMinutes   : false
                    };
                    this.options = $.extend(true, {}, defaults, options);
                    options = this.options; // since object is re-created, need to re-assign
                    if ($(this.el).attr('placeholder') == null) $(this.el).attr('placeholder', options.placeholder || options.format);
                    break;

                case 'list':
                case 'combo':
                    defaults = {
                        items           : [],
                        selected        : {},
                        url             : null,          // url to pull data from
                        recId           : null,          // map retrieved data from url to id, can be string or function
                        recText         : null,          // map retrieved data from url to text, can be string or function
                        method          : null,          // default comes from w2utils.settings.dataType
                        interval        : 350,           // number of ms to wait before sending server call on search
                        postData        : {},
                        minLength       : 1,            // min number of chars when trigger search
                        cacheMax        : 250,
                        maxDropHeight   : 350,          // max height for drop down menu
                        maxDropWidth    : null,         // if null then auto set
                        match           : 'begins',     // ['contains', 'is', 'begins', 'ends']
                        silent          : true,
                        icon            : null,
                        iconStyle       : '',
                        onSearch        : null,         // when search needs to be performed
                        onRequest       : null,         // when request is submitted
                        onLoad          : null,         // when data is received
                        onError         : null,         // when data fails to load due to server error or other failure modes
                        onIconClick     : null,
                        renderDrop      : null,         // render function for drop down item
                        compare         : null,         // compare function for filtering
                        filter          : true,         // weather to filter at all
                        prefix          : '',
                        suffix          : '',
                        openOnFocus     : false,        // if to show overlay onclick or when typing
                        markSearch      : false
                    };
                    options.items = this.normMenu(options.items); // need to be first
                    if (this.type == 'list') {
                        // defaults.search = (options.items && options.items.length >= 10 ? true : false);
                        defaults.openOnFocus = true;
                        $(this.el).addClass('w2ui-select');
                        // if simple value - look it up
                        if (!$.isPlainObject(options.selected) && options.items) {
                            for (var i = 0; i< options.items.length; i++) {
                                var item = options.items[i];
                                if (item && item.id == options.selected) {
                                    options.selected = $.extend(true, {}, item);
                                    break;
                                }
                            }
                        }
                        this.watchSize();
                    }
                    options = $.extend({}, defaults, options, {
                        align   : 'both',      // same width as control
                        altRows : true         // alternate row color
                    });
                    this.options = options;
                    if (!$.isPlainObject(options.selected)) options.selected = {};
                    $(this.el).data('selected', options.selected);
                    if (options.url) {
                        options.items = [];
                        this.request(0);
                    }
                    if (this.type == 'list') this.addFocus();
                    this.addPrefix();
                    this.addSuffix();
                    setTimeout(function () { obj.refresh(); }, 10); // need this for icon refresh
                    $(this.el).attr('autocomplete', 'off');
                    if (options.selected.text != null) $(this.el).val(options.selected.text);
                    break;

                case 'enum':
                    defaults = {
                        items           : [],
                        selected        : [],
                        max             : 0,             // max number of selected items, 0 - unlim
                        url             : null,          // not implemented
                        recId           : null,          // map retrieved data from url to id, can be string or function
                        recText         : null,          // map retrieved data from url to text, can be string or function
                        interval        : 350,           // number of ms to wait before sending server call on search
                        method          : null,          // default comes from w2utils.settings.dataType
                        postData        : {},
                        minLength       : 1,            // min number of chars when trigger search
                        cacheMax        : 250,
                        maxWidth        : 250,           // max width for a single item
                        maxHeight       : 350,           // max height for input control to grow
                        maxDropHeight   : 350,           // max height for drop down menu
                        maxDropWidth    : null,          // if null then auto set
                        match           : 'contains',    // ['contains', 'is', 'begins', 'ends']
                        silent          : true,
                        openOnFocus     : false,         // if to show overlay onclick or when typing
                        markSearch      : true,
                        renderDrop      : null,          // render function for drop down item
                        renderItem      : null,          // render selected item
                        compare         : null,          // compare function for filtering
                        filter          : true,          // alias for compare
                        style           : '',            // style for container div
                        onSearch        : null,          // when search needs to be performed
                        onRequest       : null,          // when request is submitted
                        onLoad          : null,          // when data is received
                        onError         : null,          // when data fails to load due to server error or other failure modes
                        onClick         : null,          // when an item is clicked
                        onAdd           : null,          // when an item is added
                        onNew           : null,          // when new item should be added
                        onRemove        : null,          // when an item is removed
                        onMouseOver     : null,          // when an item is mouse over
                        onMouseOut      : null,          // when an item is mouse out
                        onScroll        : null           // when div with selected items is scrolled
                    };
                    options = $.extend({}, defaults, options, {
                        align    : 'both',    // same width as control
                        suffix   : '',
                        altRows  : true       // alternate row color
                    });
                    options.items    = this.normMenu(options.items);
                    options.selected = this.normMenu(options.selected);
                    this.options = options;
                    if (!$.isArray(options.selected)) options.selected = [];
                    $(this.el).data('selected', options.selected);
                    if (options.url) {
                        options.items = [];
                        this.request(0);
                    }
                    this.addSuffix();
                    this.addMulti();
                    this.watchSize();
                    break;

                case 'file':
                    defaults = {
                        selected      : [],
                        max           : 0,
                        maxSize       : 0,        // max size of all files, 0 - unlim
                        maxFileSize   : 0,        // max size of a single file, 0 -unlim
                        maxWidth      : 250,      // max width for a single item
                        maxHeight     : 350,      // max height for input control to grow
                        maxDropHeight : 350,      // max height for drop down menu
                        maxDropWidth  : null,     // if null then auto set
                        readContent   : true,     // if true, it will readAsDataURL content of the file
                        silent        : true,
                        renderItem    : null,     // render selected item
                        style         : '',       // style for container div
                        onClick       : null,     // when an item is clicked
                        onAdd         : null,     // when an item is added
                        onRemove      : null,     // when an item is removed
                        onMouseOver   : null,     // when an item is mouse over
                        onMouseOut    : null      // when an item is mouse out
                    };
                    options = $.extend({}, defaults, options, {
                        align         : 'both',   // same width as control
                        altRows        : true     // alternate row color
                    });
                    this.options = options;
                    if (!$.isArray(options.selected)) options.selected = [];
                    $(this.el).data('selected', options.selected);
                    if ($(this.el).attr('placeholder') == null) {
                        $(this.el).attr('placeholder', w2utils.lang('Attach files by dragging and dropping or Click to Select'));
                    }
                    this.addMulti();
                    this.watchSize();
                    break;
            }
            // attach events
            this.tmp = {
                onChange    : function (event) { obj.change.call(obj, event); },
                onClick     : function (event) { obj.click.call(obj, event); },
                onFocus     : function (event) { obj.focus.call(obj, event); },
                onBlur      : function (event) { obj.blur.call(obj, event); },
                onKeydown   : function (event) { obj.keyDown.call(obj, event); },
                onKeyup     : function (event) { obj.keyUp.call(obj, event); },
                onKeypress  : function (event) { obj.keyPress.call(obj, event); }
            };
            $(this.el)
                .addClass('w2field w2ui-input')
                .data('w2field', this)
                .on('change.w2field',   this.tmp.onChange)
                .on('click.w2field',    this.tmp.onClick)         // ignore click because it messes overlays
                .on('focus.w2field',    this.tmp.onFocus)
                .on('blur.w2field',     this.tmp.onBlur)
                .on('keydown.w2field',  this.tmp.onKeydown)
                .on('keyup.w2field',    this.tmp.onKeyup)
                .on('keypress.w2field', this.tmp.onKeypress)
                .css(w2utils.cssPrefix('box-sizing', 'border-box'));
            // format initial value
            this.change($.Event('change'));
        },

        watchSize: function () {
            var obj = this;
            var tmp = $(obj.el).data('tmp') || {};
            tmp.sizeTimer = setInterval(function () {
                if ($(obj.el).parents('body').length > 0) {
                    obj.resize();
                } else {
                    clearInterval(tmp.sizeTimer);
                }
            }, 200);
            $(obj.el).data('tmp', tmp);
        },

        get: function () {
            var ret;
            if (['list', 'enum', 'file'].indexOf(this.type) != -1) {
                ret = $(this.el).data('selected');
            } else {
                ret = $(this.el).val();
            }
            return ret;
        },

        set: function (val, append) {
            if (['list', 'enum', 'file'].indexOf(this.type) != -1) {
                if (this.type != 'list' && append) {
                    if ($(this.el).data('selected') == null) $(this.el).data('selected', []);
                    $(this.el).data('selected').push(val);
                    $(this.el).change();
                } else {
                    var it = (this.type == 'enum' ? [val] : val);
                    $(this.el).data('selected', it).change();
                }
                this.refresh();
            } else {
                $(this.el).val(val);
            }
        },

        setIndex: function (ind, append) {
            if (['list', 'enum'].indexOf(this.type) != -1) {
                var items = this.options.items;
                if (items && items[ind]) {
                    if (this.type != 'list' && append) {
                        if ($(this.el).data('selected') == null) $(this.el).data('selected', []);
                        $(this.el).data('selected').push(items[ind]);
                        $(this.el).change();
                    } else {
                        var it = (this.type == 'enum' ? [items[ind]] : items[ind]);
                        $(this.el).data('selected', it).change();
                    }
                    this.refresh();
                    return true;
                }
            }
            return false;
        },

        clear: function () {
            var obj        = this;
            var options    = this.options;
            // if money then clear value
            if (['money', 'currency'].indexOf(this.type) != -1) {
                $(this.el).val($(this.el).val().replace(options.moneyRE, ''));
            }
            if (this.type == 'percent') {
                $(this.el).val($(this.el).val().replace(/%/g, ''));
            }
            if (this.type == 'color') {
                $(this.el).removeAttr('maxlength');
            }
            if (this.type == 'list') {
                $(this.el).removeClass('w2ui-select');
            }
            this.type = 'clear';
            var tmp = $(this.el).data('tmp');
            if (!this.tmp) return;
            // restore paddings
            if (tmp != null) {
                $(this.el).height('auto');
                if (tmp && tmp['old-padding-left'])  $(this.el).css('padding-left',  tmp['old-padding-left']);
                if (tmp && tmp['old-padding-right']) $(this.el).css('padding-right', tmp['old-padding-right']);
                if (tmp && tmp['old-background-color']) $(this.el).css('background-color', tmp['old-background-color']);
                if (tmp && tmp['old-border-color']) $(this.el).css('border-color', tmp['old-border-color']);
                // remove resize watcher
                clearInterval(tmp.sizeTimer);
            }
            // remove events and (data)
            $(this.el)
                .val(this.clean($(this.el).val()))
                .removeClass('w2field')
                .removeData()       // removes all attached data
                .off('.w2field');   // remove only events added by w2field
            // remove helpers
            for (var h in this.helpers) $(this.helpers[h]).remove();
            this.helpers = {};
        },

        refresh: function () {
            var obj       = this;
            var options   = this.options;
            var selected  = $(this.el).data('selected');
            var time      = (new Date()).getTime();
            // enum
            if (['list'].indexOf(this.type) != -1) {
                $(obj.el).parent().css('white-space', 'nowrap'); // needs this for arrow always to appear on the right side
                // hide focus and show text
                if (obj.helpers.prefix) obj.helpers.prefix.hide();
                setTimeout(function () {
                    if (!obj.helpers.focus) return;
                    // if empty show no icon
                    if (!$.isEmptyObject(selected) && options.icon) {
                        options.prefix = '<span class="w2ui-icon '+ options.icon +'"style="cursor: pointer; font-size: 14px;' +
                                         ' display: inline-block; margin-top: -1px; color: #7F98AD;'+ options.iconStyle +'">'+
                            '</span>';
                        obj.addPrefix();
                    } else {
                        options.prefix = '';
                        obj.addPrefix();
                    }
                    // focus helper
                    var focus = obj.helpers.focus.find('input');
                    if ($(focus).val() === '') {
                        $(focus).css('text-indent', '-9999em').prev().css('opacity', 0);
                        $(obj.el).val(selected && selected.text != null ? w2utils.lang(selected.text) : '');
                    } else {
                        $(focus).css('text-indent', 0).prev().css('opacity', 1);
                        $(obj.el).val('');
                        setTimeout(function () {
                            if (obj.helpers.prefix) obj.helpers.prefix.hide();
                            var tmp = 'position: absolute; opacity: 0; margin: 4px 0px 0px 2px; background-position: left !important;';
                            if (options.icon) {
                                $(focus).css('margin-left', '17px');
                                $(obj.helpers.focus).find('.icon-search').attr('style', tmp + 'width: 11px !important; opacity: 1; display: block');
                            } else {
                                $(focus).css('margin-left', '0px');
                                $(obj.helpers.focus).find('.icon-search').attr('style', tmp + 'width: 0px !important; opacity: 0; display: none');
                            }
                        }, 1);
                    }
                    // if readonly or disabled
                    if ($(obj.el).prop('readonly') || $(obj.el).prop('disabled')) {
                        setTimeout(function () {
                            $(obj.helpers.prefix).css('opacity', '0.6');
                            $(obj.helpers.suffix).css('opacity', '0.6');
                        }, 1);
                    } else {
                        setTimeout(function () {
                            $(obj.helpers.prefix).css('opacity', '1');
                            $(obj.helpers.suffix).css('opacity', '1');
                        }, 1);
                    }
                }, 1);
            }
            if (['enum', 'file'].indexOf(this.type) != -1) {
                var html = '';
                if (selected) {
                   for (var s = 0; s < selected.length; s++) {
                       var it  = selected[s];
                       var ren = '';
                       if (typeof options.renderItem == 'function') {
                           ren = options.renderItem(it, s, '<div class="w2ui-list-remove" title="'+ w2utils.lang('Remove') +'" index="'+ s +'">&#160;&#160;</div>');
                       } else {
                           ren = '<div class="w2ui-list-remove" title="'+ w2utils.lang('Remove') +'" index="'+ s +'">&#160;&#160;</div>'+
                                 (obj.type == 'enum' ? it.text : it.name + '<span class="file-size"> - '+ w2utils.formatSize(it.size) +'</span>');
                       }
                       html += '<li index="'+ s +'" style="max-width: '+ parseInt(options.maxWidth) + 'px; '+ (it.style ? it.style : '') +'">'+
                               ren +'</li>';
                   }
                }
                var div = obj.helpers.multi;
                var ul  = div.find('ul');
                div.attr('style', div.attr('style') + ';' + options.style);
                $(obj.el).css('z-index', '-1');
                if ($(obj.el).prop('readonly') || $(obj.el).prop('disabled')) {
                    setTimeout(function () {
                        div[0].scrollTop = 0; // scroll to the top
                        div.addClass('w2ui-readonly')
                            .find('li').css('opacity', '0.9')
                            .parent().find('li.nomouse').hide()
                            .find('input').prop('readonly', true)
                            .parents('ul')
                            .find('.w2ui-list-remove').hide();
                    }, 1);
                } else {
                    setTimeout(function () {
                        div.removeClass('w2ui-readonly')
                            .find('li').css('opacity', '1')
                            .parent().find('li.nomouse').show()
                            .find('input').prop('readonly', false)
                            .parents('ul')
                            .find('.w2ui-list-remove').show();
                    }, 1);
                }

                // clean
                div.find('.w2ui-enum-placeholder').remove();
                ul.find('li').not('li.nomouse').remove();
                // add new list
                if (html !== '') {
                    ul.prepend(html);
                } else if ($(obj.el).attr('placeholder') != null && div.find('input').val() === '') {
                    var style =
                        'padding-top: ' + $(this.el).css('padding-top') + ';'+
                        'padding-left: ' + $(this.el).css('padding-left') + '; ' +
                        'box-sizing: ' + $(this.el).css('box-sizing') + '; ' +
                        'line-height: ' + $(this.el).css('line-height') + '; ' +
                        'font-size: ' + $(this.el).css('font-size') + '; ' +
                        'font-family: ' + $(this.el).css('font-family') + '; ';
                    div.prepend('<div class="w2ui-enum-placeholder" style="'+ style +'">'+ $(obj.el).attr('placeholder') +'</div>');
                }
                // ITEMS events
                div.off('scroll.w2field').on('scroll.w2field', function (event) {
                        var edata = obj.trigger({ phase: 'before', type: 'scroll', target: obj.el, originalEvent: event });
                        if (edata.isCancelled === true) return;
                        // event after
                        obj.trigger($.extend(edata, { phase: 'after' }));
                    })
                    .find('li')
                    .data('mouse', 'out')
                    .on('click', function (event) {
                        var target = (event.target.tagName.toUpperCase() == 'LI' ? event.target : $(event.target).parents('LI'));
                        var item   = selected[$(target).attr('index')];
                        if ($(target).hasClass('nomouse')) return;
                        event.stopPropagation();
                        // default behavior
                        if ($(event.target).hasClass('w2ui-list-remove')) {
                            if ($(obj.el).prop('readonly') || $(obj.el).prop('disabled')) return;
                            // trigger event
                            var edata = obj.trigger({ phase: 'before', type: 'remove', target: obj.el, originalEvent: event.originalEvent, item: item });
                            if (edata.isCancelled === true) return;
                            // default behavior
                            $().w2overlay();
                            selected.splice($(event.target).attr('index'), 1);
                            $(obj.el).trigger('change');
                            $(event.target).parent().fadeOut('fast');
                            setTimeout(function () {
                                obj.refresh();
                                // event after
                                obj.trigger($.extend(edata, { phase: 'after' }));
                            }, 300);
                        } else {
                            // trigger event
                            var edata = obj.trigger({ phase: 'before', type: 'click', target: obj.el, originalEvent: event.originalEvent, item: item });
                            if (edata.isCancelled === true) return;
                            // if file - show image preview
                            if (obj.type == 'file') {
                                var preview = '';
                                if ((/image/i).test(item.type)) { // image
                                    preview = '<div style="padding: 3px;">'+
                                        '    <img src="'+ (item.content ? 'data:'+ item.type +';base64,'+ item.content : '') +'" style="max-width: 300px;" '+
                                        '        onload="var w = jQuery(this).width(); var h = jQuery(this).height(); '+
                                        '            if (w < 300 & h < 300) return; '+
                                        '            if (w >= h && w > 300) jQuery(this).width(300);'+
                                        '            if (w < h && h > 300) jQuery(this).height(300);"'+
                                        '        onerror="this.style.display = \'none\'"'+
                                        '    >'+
                                        '</div>';
                                }
                                var td1 = 'style="padding: 3px; text-align: right; color: #777;"';
                                var td2 = 'style="padding: 3px"';
                                preview += '<div style="padding: 8px;">'+
                                    '    <table cellpadding="2"><tbody>'+
                                    '    <tr><td '+ td1 +'>'+ w2utils.lang('Name') +':</td><td '+ td2 +'>'+ item.name +'</td></tr>'+
                                    '    <tr><td '+ td1 +'>'+ w2utils.lang('Size') +':</td><td '+ td2 +'>'+ w2utils.formatSize(item.size) +'</td></tr>'+
                                    '    <tr><td '+ td1 +'>'+ w2utils.lang('Type') +':</td><td '+ td2 +'>' +
                                    '        <span style="width: 200px; display: block-inline; overflow: hidden; text-overflow: ellipsis; white-space: nowrap="nowrap";">'+ item.type +'</span>'+
                                    '    </td></tr>'+
                                    '    <tr><td '+ td1 +'>'+ w2utils.lang('Modified') +':</td><td '+ td2 +'>'+ w2utils.date(item.modified) +'</td></tr>'+
                                    '    </tbody></table>'+
                                    '</div>';
                                $('#w2ui-overlay').remove();
                                $(target).w2overlay(preview);
                            }                            // event after
                            obj.trigger($.extend(edata, { phase: 'after' }));
                        }
                    })
                    .on('mouseover', function (event) {
                        var target = (event.target.tagName.toUpperCase() == 'LI' ? event.target : $(event.target).parents('LI'));
                        if ($(target).hasClass('nomouse')) return;
                        if ($(target).data('mouse') == 'out') {
                            var item = selected[$(event.target).attr('index')];
                            // trigger event
                            var edata = obj.trigger({ phase: 'before', type: 'mouseOver', target: obj.el, originalEvent: event.originalEvent, item: item });
                            if (edata.isCancelled === true) return;
                            // event after
                            obj.trigger($.extend(edata, { phase: 'after' }));
                        }
                        $(target).data('mouse', 'over');
                    })
                    .on('mouseout', function (event) {
                        var target = (event.target.tagName.toUpperCase() == 'LI' ? event.target : $(event.target).parents('LI'));
                        if ($(target).hasClass('nomouse')) return;
                        $(target).data('mouse', 'leaving');
                        setTimeout(function () {
                            if ($(target).data('mouse') == 'leaving') {
                                $(target).data('mouse', 'out');
                                var item = selected[$(event.target).attr('index')];
                                // trigger event
                                var edata = obj.trigger({ phase: 'before', type: 'mouseOut', target: obj.el, originalEvent: event.originalEvent, item: item });
                                if (edata.isCancelled === true) return;
                                // event after
                                obj.trigger($.extend(edata, { phase: 'after' }));
                            }
                        }, 0);
                    });
                // adjust height
                $(this.el).height('auto');
                var cntHeight = $(div).find('> div.w2ui-multi-items').height() + w2utils.getSize(div, '+height') * 2;
                if (cntHeight < 26) cntHeight = 26;
                if (cntHeight > options.maxHeight) cntHeight = options.maxHeight;
                if (div.length > 0) div[0].scrollTop = 1000;
                var inpHeight = w2utils.getSize($(this.el), 'height') - 2;
                if (inpHeight > cntHeight) cntHeight = inpHeight;
                $(div).css({ 'height': cntHeight + 'px', overflow: (cntHeight == options.maxHeight ? 'auto' : 'hidden') });
                if (cntHeight < options.maxHeight) $(div).prop('scrollTop', 0);
                $(this.el).css({ 'height' : (cntHeight + 2) + 'px' });
                // update size
                if (obj.type == 'enum') {
                    var tmp = obj.helpers.multi.find('input');
                    tmp.width(((tmp.val().length + 2) * 8) + 'px');
                }
            }
            return (new Date()).getTime() - time;
        },

        reset: function () {
            var type = this.type;
            this.clear();
            this.type = type;
            this.init();
        },

        // resizing width of list, enum, file controls
        resize: function () {
            var obj = this;
            var new_width  = $(obj.el).width();
            var new_height = $(obj.el).height();
            if (obj.tmp.current_width == new_width && new_height > 0) return;

            var focus  = this.helpers.focus;
            var multi  = this.helpers.multi;
            var suffix = this.helpers.suffix;
            var prefix = this.helpers.prefix;

            // resize helpers
            if (focus) {
                focus.width($(obj.el).width());
            }
            if (multi) {
                var width = (w2utils.getSize(obj.el, 'width')
                    - parseInt($(obj.el).css('margin-left'), 10)
                    - parseInt($(obj.el).css('margin-right'), 10));
                $(multi).width(width);
            }
            if (suffix) {
                obj.options.suffix = '<div class="arrow-down" style="margin-top: '+ ((parseInt($(obj.el).height()) - 6) / 2) +'px;"></div>';
                obj.addSuffix();
            }
            if (prefix) {
                obj.addPrefix();
            }
            // remember width
            obj.tmp.current_width = new_width;
        },

        clean: function (val) {
            //issue #499
            if(typeof val == 'number'){
                 return val;
            }
            var options = this.options;
            val = String(val).trim();
            // clean
            if (['int', 'float', 'money', 'currency', 'percent'].indexOf(this.type) != -1) {
                if (typeof val == 'string') {
                    if (options.autoFormat && ['money', 'currency'].indexOf(this.type) != -1) val = String(val).replace(options.moneyRE, '');
                    if (options.autoFormat && this.type == 'percent') val = String(val).replace(options.percentRE, '');
                    if (options.autoFormat && ['int', 'float'].indexOf(this.type) != -1) val = String(val).replace(options.numberRE, '');
                    val = val.replace(/\s+/g, '').replace(w2utils.settings.groupSymbol, '').replace(w2utils.settings.decimalSymbol, '.');
                }
                if (parseFloat(val) == val) {
                    if (options.min != null && val < options.min) { val = options.min; $(this.el).val(options.min); }
                    if (options.max != null && val > options.max) { val = options.max; $(this.el).val(options.max); }
                }
                if (val !== '' && w2utils.isFloat(val)) val = Number(val); else val = '';
            }
            return val;
        },

        format: function (val) {
            var options = this.options;
            // autoformat numbers or money
            if (options.autoFormat && val !== '') {
                switch (this.type) {
                    case 'money':
                    case 'currency':
                        val = w2utils.formatNumber(val, options.currencyPrecision, options.groupSymbol);
                        if (val !== '') val = options.currencyPrefix + val + options.currencySuffix;
                        break;
                    case 'percent':
                        val = w2utils.formatNumber(val, options.precision, options.groupSymbol);
                        if (val !== '') val += '%';
                        break;
                    case 'float':
                        val = w2utils.formatNumber(val, options.precision, options.groupSymbol);
                        break;
                    case 'int':
                        val = w2utils.formatNumber(val, 0, options.groupSymbol);
                        break;
                }
            }
            return val;
        },

        change: function (event) {
            var obj     = this;
            var options = obj.options;
            // numeric
            if (['int', 'float', 'money', 'currency', 'percent'].indexOf(this.type) != -1) {
                // check max/min
                var val     =  $(this.el).val();
                var new_val = this.format(this.clean($(this.el).val()));
                // if was modified
                if (val !== '' && val != new_val) {
                    $(this.el).val(new_val).change();
                    // cancel event
                    event.stopPropagation();
                    event.preventDefault();
                    return false;
                }
            }
            // color
            if (this.type == 'color') {
                var color = '#' + $(this.el).val();
                if ($(this.el).val().length != 6 && $(this.el).val().length != 3) color = '';
                $(this.el).next().find('div').css('background-color', color);
                if ($(obj.el).is(':focus')) this.updateOverlay();
            }
            // list, enum
            if (['list', 'enum', 'file'].indexOf(this.type) != -1) {
                obj.refresh();
                // need time out to show icon indent properly
                setTimeout(function () { obj.refresh(); }, 5);
            }
            // date, time
            if (['date', 'time', 'datetime'].indexOf(this.type) != -1) {
                // convert linux timestamps
                var tmp = parseInt(obj.el.value);
                if (w2utils.isInt(obj.el.value) && tmp > 3000) {
                    if (this.type == 'time') $(obj.el).val(w2utils.formatTime(new Date(tmp), options.format)).change();
                    if (this.type == 'date') $(obj.el).val(w2utils.formatDate(new Date(tmp), options.format)).change();
                    if (this.type == 'datetime') $(obj.el).val(w2utils.formatDateTime(new Date(tmp), options.format)).change();
                }
            }
        },

        click: function (event) {
            event.stopPropagation();
            // lists
            if (['list', 'combo', 'enum'].indexOf(this.type) != -1) {
                if (!$(this.el).is(':focus')) this.focus(event);
            }
            // other fields with drops
            if (['date', 'time', 'color', 'datetime'].indexOf(this.type) != -1) {
                this.updateOverlay();
            }
        },

        focus: function (event) {
            var obj     = this;
            var options = this.options;
            // color, date, time
            if (['color', 'date', 'time', 'datetime'].indexOf(obj.type) !== -1) {
                if ($(obj.el).prop('readonly') || $(obj.el).prop('disabled')) return;
                if ($("#w2ui-overlay").length > 0) $('#w2ui-overlay')[0].hide();
                setTimeout(function () { obj.updateOverlay(); }, 150);
            }
            // menu
            if (['list', 'combo', 'enum'].indexOf(obj.type) != -1) {
                if ($(obj.el).prop('readonly') || $(obj.el).prop('disabled')) return;
                if ($("#w2ui-overlay").length > 0) $('#w2ui-overlay')[0].hide();
                obj.resize();
                setTimeout(function () {
                    if (obj.type == 'list' && $(obj.el).is(':focus')) {
                        $(obj.helpers.focus).find('input').focus();
                        return;
                    }
                    obj.search();
                    setTimeout(function () { obj.updateOverlay(); }, 1);
                }, 1);
            }
            // file
            if (obj.type == 'file') {
                $(obj.helpers.multi).css({ 'outline': 'auto 5px #7DB4F3', 'outline-offset': '-2px' });
            }
        },

        blur: function (event) {
            var obj     = this;
            var options = obj.options;
            var val     = $(obj.el).val().trim();
            // hide overlay
            if (['color', 'date', 'time', 'list', 'combo', 'enum', 'datetime'].indexOf(obj.type) != -1) {
                if ($("#w2ui-overlay").length > 0) $('#w2ui-overlay')[0].hide();
            }
            if (['int', 'float', 'money', 'currency', 'percent'].indexOf(obj.type) != -1) {
                if (val !== '' && !obj.checkType(val)) {
                    $(obj.el).val('').change();
                    if (options.silent === false) {
                        $(obj.el).w2tag('Not a valid number');
                        setTimeout(function () { $(obj.el).w2tag(''); }, 3000);
                    }
                }
            }
            // date or time
            if (['date', 'time', 'datetime'].indexOf(obj.type) != -1) {
                // check if in range
                if (val !== '' && !obj.inRange(obj.el.value)) {
                    $(obj.el).val('').removeData('selected').change();
                    if (options.silent === false) {
                        $(obj.el).w2tag('Not in range');
                        setTimeout(function () { $(obj.el).w2tag(''); }, 3000);
                    }
                } else {
                    if (obj.type == 'date' && val !== '' && !w2utils.isDate(obj.el.value, options.format)) {
                        $(obj.el).val('').removeData('selected').change();
                        if (options.silent === false) {
                            $(obj.el).w2tag('Not a valid date');
                            setTimeout(function () { $(obj.el).w2tag(''); }, 3000);
                        }
                    }
                    else if (obj.type == 'time' && val !== '' && !w2utils.isTime(obj.el.value)) {
                        $(obj.el).val('').removeData('selected').change();
                        if (options.silent === false) {
                            $(obj.el).w2tag('Not a valid time');
                            setTimeout(function () { $(obj.el).w2tag(''); }, 3000);
                        }
                    }
                    else if (obj.type == 'datetime' && val !== '' && !w2utils.isDateTime(obj.el.value, options.format)) {
                        $(obj.el).val('').removeData('selected').change();
                        if (options.silent === false) {
                            $(obj.el).w2tag('Not a valid date');
                            setTimeout(function () { $(obj.el).w2tag(''); }, 3000);
                        }
                    }
                }
            }
            // clear search input
            if (obj.type == 'enum') {
                $(obj.helpers.multi).find('input').val('').width(20);
            }
            // file
            if (obj.type == 'file') {
                $(obj.helpers.multi).css({ 'outline': 'none' });
            }
        },

        keyPress: function (event) {
            var obj     = this;
            var options = obj.options;
            // ignore wrong pressed key
            if (['int', 'float', 'money', 'currency', 'percent', 'hex', 'bin', 'color', 'alphanumeric'].indexOf(obj.type) != -1) {
                // keyCode & charCode differ in FireFox
                if (event.metaKey || event.ctrlKey || event.altKey || (event.charCode != event.keyCode && event.keyCode > 0)) return;
                var ch = String.fromCharCode(event.charCode);
                if (!obj.checkType(ch, true) && event.keyCode != 13) {
                    event.preventDefault();
                    if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true;
                    return false;
                }
            }
            // update date popup
            if (['date', 'time', 'datetime'].indexOf(obj.type) != -1) {
                if (event.keyCode !== 9) setTimeout(function () { obj.updateOverlay(); }, 1);
            }
        },

        keyDown: function (event, extra) {
            var obj     = this;
            var options = obj.options;
            var key     = event.keyCode || (extra && extra.keyCode);
            // numeric
            if (['int', 'float', 'money', 'currency', 'percent'].indexOf(obj.type) != -1) {
                if (!options.keyboard || $(obj.el).prop('readonly') || $(obj.el).prop('disabled')) return;
                var cancel = false;
                var val = parseFloat($(obj.el).val().replace(options.moneyRE, '')) || 0;
                var inc = options.step;
                if (event.ctrlKey || event.metaKey) inc = 10;
                switch (key) {
                    case 38: // up
                        if (event.shiftKey) break; // no action if shift key is pressed
                        $(obj.el).val((val + inc <= options.max || options.max == null ? Number((val + inc).toFixed(12)) : options.max)).change();
                        cancel = true;
                        break;
                    case 40: // down
                        if (event.shiftKey) break; // no action if shift key is pressed
                        $(obj.el).val((val - inc >= options.min || options.min == null ? Number((val - inc).toFixed(12)) : options.min)).change();
                        cancel = true;
                        break;
                }
                if (cancel) {
                    event.preventDefault();
                    setTimeout(function () {
                        // set cursor to the end
                        obj.el.setSelectionRange(obj.el.value.length, obj.el.value.length);
                    }, 0);
                }
            }
            // date
            if (obj.type == 'date') {
                if (!options.keyboard || $(obj.el).prop('readonly') || $(obj.el).prop('disabled')) return;
                var cancel  = false;
                var daymil  = 24*60*60*1000;
                var inc     = 1;
                if (event.ctrlKey || event.metaKey) inc = 10;
                var dt = w2utils.isDate($(obj.el).val(), options.format, true);
                if (!dt) { dt = new Date(); daymil = 0; }
                switch (key) {
                    case 38: // up
                        if (event.shiftKey) break; // no action if shift key is pressed
                        var newDT = w2utils.formatDate(dt.getTime() + daymil, options.format);
                        if (inc == 10) newDT = w2utils.formatDate(new Date(dt.getFullYear(), dt.getMonth()+1, dt.getDate()), options.format);
                        $(obj.el).val(newDT).change();
                        cancel = true;
                        break;
                    case 40: // down
                        if (event.shiftKey) break; // no action if shift key is pressed
                        var newDT = w2utils.formatDate(dt.getTime() - daymil, options.format);
                        if (inc == 10) newDT = w2utils.formatDate(new Date(dt.getFullYear(), dt.getMonth()-1, dt.getDate()), options.format);
                        $(obj.el).val(newDT).change();
                        cancel = true;
                        break;
                }
                if (cancel) {
                    event.preventDefault();
                    setTimeout(function () {
                        // set cursor to the end
                        obj.el.setSelectionRange(obj.el.value.length, obj.el.value.length);
                        obj.updateOverlay();
                    }, 0);
                }
            }
            // time
            if (obj.type == 'time') {
                if (!options.keyboard || $(obj.el).prop('readonly') || $(obj.el).prop('disabled')) return;
                var cancel  = false;
                var inc     = (event.ctrlKey || event.metaKey ? 60 : 1);
                var val     = $(obj.el).val();
                var time    = obj.toMin(val) || obj.toMin((new Date()).getHours() + ':' + ((new Date()).getMinutes() - 1));
                switch (key) {
                    case 38: // up
                        if (event.shiftKey) break; // no action if shift key is pressed
                        time += inc;
                        cancel = true;
                        break;
                    case 40: // down
                        if (event.shiftKey) break; // no action if shift key is pressed
                        time -= inc;
                        cancel = true;
                        break;
                }
                if (cancel) {
                    $(obj.el).val(obj.fromMin(time)).change();
                    event.preventDefault();
                    setTimeout(function () {
                        // set cursor to the end
                        obj.el.setSelectionRange(obj.el.value.length, obj.el.value.length);
                    }, 0);
                }
            }
            // datetime
            if (obj.type == 'datetime') {
                if (!options.keyboard || $(obj.el).prop('readonly') || $(obj.el).prop('disabled')) return;
                var cancel  = false;
                var daymil  = 24*60*60*1000;
                var inc     = 1;
                if (event.ctrlKey || event.metaKey) inc = 10;
                var str = $(obj.el).val();
                var dt  = w2utils.isDateTime(str, this.options.format, true);
                if (!dt) { dt = new Date(); daymil = 0; }
                switch (key) {
                    case 38: // up
                        if (event.shiftKey) break; // no action if shift key is pressed
                        var newDT = w2utils.formatDateTime(dt.getTime() + daymil, options.format);
                        if (inc == 10) newDT = w2utils.formatDateTime(new Date(dt.getFullYear(), dt.getMonth()+1, dt.getDate()), options.format);
                        $(obj.el).val(newDT).change();
                        cancel = true;
                        break;
                    case 40: // down
                        if (event.shiftKey) break; // no action if shift key is pressed
                        var newDT = w2utils.formatDateTime(dt.getTime() - daymil, options.format);
                        if (inc == 10) newDT = w2utils.formatDateTime(new Date(dt.getFullYear(), dt.getMonth()-1, dt.getDate()), options.format);
                        $(obj.el).val(newDT).change();
                        cancel = true;
                        break;
                }
                if (cancel) {
                    event.preventDefault();
                    setTimeout(function () {
                        // set cursor to the end
                        obj.el.setSelectionRange(obj.el.value.length, obj.el.value.length);
                        obj.updateOverlay();
                    }, 0);
                }
            }
            // color
            if (obj.type == 'color') {
                if ($(obj.el).prop('readonly') || $(obj.el).prop('disabled')) return;
                // paste
                if (event.keyCode == 86 && (event.ctrlKey || event.metaKey)) {
                    $(obj.el).prop('maxlength', 7);
                    setTimeout(function () {
                        var val = $(obj).val();
                        if (val.substr(0, 1) == '#') val = val.substr(1);
                        if (!w2utils.isHex(val)) val = '';
                        $(obj).val(val).prop('maxlength', 6).change();
                    }, 20);
                }
                if ((event.ctrlKey || event.metaKey) && !event.shiftKey) {
                    var dir      = null;
                    var newColor = null;
                    switch (key) {
                        case 38: // up
                            dir = 'up';
                            break;
                        case 40: // down
                            dir = 'down';
                            break;
                        case 39: // right
                            dir = 'right';
                            break;
                        case 37: // left
                            dir = 'left';
                            break;
                    }
                    if (obj.el.nav && dir != null) {
                        newColor = obj.el.nav(dir);
                        $(obj.el).val(newColor).change();
                        event.preventDefault();
                    }
                }
            }
            // list/select/combo
            if (['list', 'combo', 'enum'].indexOf(obj.type) != -1) {
                if ($(obj.el).prop('readonly') || $(obj.el).prop('disabled')) return;
                var selected  = $(obj.el).data('selected');
                var focus     = $(obj.el);
                var indexOnly = false;
                if (['list', 'enum'].indexOf(obj.type) != -1) {
                    if (obj.type == 'list') {
                        focus = $(obj.helpers.focus).find('input');
                    }
                    if (obj.type == 'enum') {
                        focus = $(obj.helpers.multi).find('input');
                    }
                    // not arrows - refresh
                    if ([37, 38, 39, 40].indexOf(key) == -1) {
                        setTimeout(function () { obj.refresh(); }, 1);
                    }
                    // paste
                    if (event.keyCode == 86 && (event.ctrlKey || event.metaKey)) {
                        setTimeout(function () {
                            obj.refresh();
                            obj.search();
                            obj.request();
                        }, 50);
                    }
                }
                // apply arrows
                switch (key) {
                    case 27: // escape
                        if (obj.type == 'list') {
                            if (focus.val() !== '') focus.val('');
                            event.stopPropagation(); // escape in field should not close popup
                        }
                        break;
                    case 37: // left
                    case 39: // right
                        // indexOnly = true;
                        break;
                    case 13: // enter
                        if ($('#w2ui-overlay').length === 0) break; // no action if overlay not open
                        var item  = options.items[options.index];
                        if (obj.type == 'enum') {
                            if (item != null) {
                                // trigger event
                                var edata = obj.trigger({ phase: 'before', type: 'add', target: obj.el, originalEvent: event.originalEvent, item: item });
                                if (edata.isCancelled === true) return;
                                item = edata.item; // need to reassign because it could be recreated by user
                                // default behavior
                                if (selected.length >= options.max && options.max > 0) selected.pop();
                                delete item.hidden;
                                delete obj.tmp.force_open;
                                selected.push(item);
                                $(obj.el).change();
                                focus.val('').width(20);
                                obj.refresh();
                                // event after
                                obj.trigger($.extend(edata, { phase: 'after' }));
                            } else {
                                // trigger event
                                item = { id: focus.val(), text: focus.val() };
                                var edata = obj.trigger({ phase: 'before', type: 'new', target: obj.el, originalEvent: event.originalEvent, item: item });
                                if (edata.isCancelled === true) return;
                                item = edata.item; // need to reassign because it could be recreated by user
                                // default behavior
                                if (typeof obj.onNew == 'function') {
                                    if (selected.length >= options.max && options.max > 0) selected.pop();
                                    delete obj.tmp.force_open;
                                    selected.push(item);
                                    $(obj.el).change();
                                    focus.val('').width(20);
                                    obj.refresh();
                                }
                                // event after
                                obj.trigger($.extend(edata, { phase: 'after' }));
                            }
                        } else {
                            if (item) $(obj.el).data('selected', item).val(item.text).change();
                            if ($(obj.el).val() === '' && $(obj.el).data('selected')) $(obj.el).removeData('selected').val('').change();
                            if (obj.type == 'list') {
                                focus.val('');
                                obj.refresh();
                            }
                            // hide overlay
                            obj.tmp.force_hide = true;
                        }
                        break;
                    case 8:  // backspace
                    case 46: // delete
                        if (obj.type == 'enum' && key == 8) {
                            if (focus.val() === '' && selected.length > 0) {
                                var item = selected[selected.length - 1];
                                // trigger event
                                var edata = obj.trigger({ phase: 'before', type: 'remove', target: obj.el, originalEvent: event.originalEvent, item: item });
                                if (edata.isCancelled === true) return;
                                // default behavior
                                selected.pop();
                                $(obj.el).trigger('change');
                                obj.refresh();
                                // event after
                                obj.trigger($.extend(edata, { phase: 'after' }));
                            }
                        }
                        if (obj.type == 'list' && focus.val() === '') {
                            $(obj.el).data('selected', {}).change();
                            obj.refresh();
                        }
                        break;
                    case 38: // up
                        options.index = w2utils.isInt(options.index) ? parseInt(options.index) : 0;
                        options.index--;
                        while (options.index > 0 && options.items[options.index].hidden) options.index--;
                        if (options.index === 0 && options.items[options.index].hidden) {
                            while (options.items[options.index] && options.items[options.index].hidden) options.index++;
                        }
                        indexOnly = true;
                        break;
                    case 40: // down
                        options.index = w2utils.isInt(options.index) ? parseInt(options.index) : -1;
                        options.index++;
                        while (options.index < options.items.length-1 && options.items[options.index].hidden) options.index++;
                        if (options.index == options.items.length-1 && options.items[options.index].hidden) {
                            while (options.items[options.index] && options.items[options.index].hidden) options.index--;
                        }
                        // show overlay if not shown
                        if (focus.val() === '' && $('#w2ui-overlay').length === 0) {
                            obj.tmp.force_open = true;
                        } else {
                            indexOnly = true;
                        }
                        break;
                }
                if (indexOnly) {
                    if (options.index < 0) options.index = 0;
                    if (options.index >= options.items.length) options.index = options.items.length -1;
                    obj.updateOverlay(indexOnly);
                    // cancel event
                    event.preventDefault();
                    setTimeout(function () {
                        // set cursor to the end
                        if (obj.type == 'enum') {
                            var tmp = focus.get(0);
                            tmp.setSelectionRange(tmp.value.length, tmp.value.length);
                        } else if (obj.type == 'list') {
                            var tmp = focus.get(0);
                            tmp.setSelectionRange(tmp.value.length, tmp.value.length);
                        } else {
                            obj.el.setSelectionRange(obj.el.value.length, obj.el.value.length);
                        }
                    }, 0);
                    return;
                }
                // expand input
                if (obj.type == 'enum') {
                    focus.width(((focus.val().length + 2) * 8) + 'px');
                }
            }
        },

        keyUp: function (event) {
            var obj = this;
            if (this.type == 'color') {
                if (event.keyCode == 86 && (event.ctrlKey || event.metaKey)) {
                    $(this).prop('maxlength', 6);
                }
            }
            if (['list', 'combo', 'enum'].indexOf(this.type) != -1) {
                if ($(obj.el).prop('readonly') || $(obj.el).prop('disabled')) return;
                // need to be here for ipad compa
                if ([16, 17, 18, 20, 37, 39, 91].indexOf(event.keyCode) == -1) { // no refreah on crtl, shift, left/right arrows, etc
                    var input = $(this.helpers.focus).find('input');
                    if (input.length === 0) input = $(this.el); // for combo list
                    // trigger event
                    var edata = this.trigger({ phase: 'before', type: 'search', originalEvent: event, target: input, search: input.val() });
                    if (edata.isCancelled === true) return;
                    // regular
                    if (!this.tmp.force_hide) this.request();
                    if (input.val().length == 1) this.refresh();
                    if ($('#w2ui-overlay').length === 0 || [38, 40].indexOf(event.keyCode) == -1) { // no search on arrows
                        this.search();
                    }
                    // event after
                    this.trigger($.extend(edata, { phase: 'after' }));
                }
            }
        },

        clearCache: function () {
            var options          = this.options;
            options.items        = [];
            this.tmp.xhr_loading = false;
            this.tmp.xhr_search  = '';
            this.tmp.xhr_total   = -1;
        },

        request: function (interval) {
            var obj      = this;
            var options  = this.options;
            var search   = $(obj.el).val() || '';
            // if no url - do nothing
            if (!options.url) return;
            // --
            if (obj.type == 'enum') {
                var tmp = $(obj.helpers.multi).find('input');
                if (tmp.length === 0) search = ''; else search = tmp.val();
            }
            if (obj.type == 'list') {
                var tmp = $(obj.helpers.focus).find('input');
                if (tmp.length === 0) search = ''; else search = tmp.val();
            }
            if (options.minLength !== 0 && search.length < options.minLength) {
                options.items = []; // need to empty the list
                this.updateOverlay();
                return;
            }
            if (interval == null) interval = options.interval;
            if (obj.tmp.xhr_search == null) obj.tmp.xhr_search = '';
            if (obj.tmp.xhr_total == null) obj.tmp.xhr_total = -1;
            // check if need to search
            if (options.url && $(obj.el).prop('readonly') !== true && $(obj.el).prop('disabled') !== true && (
                    (options.items.length === 0 && obj.tmp.xhr_total !== 0) ||
                    (obj.tmp.xhr_total == options.cacheMax && search.length > obj.tmp.xhr_search.length) ||
                    (search.length >= obj.tmp.xhr_search.length && search.substr(0, obj.tmp.xhr_search.length) != obj.tmp.xhr_search) ||
                    (search.length < obj.tmp.xhr_search.length)
                )) {
                // empty list
                if (obj.tmp.xhr) obj.tmp.xhr.abort();
                obj.tmp.xhr_loading = true;
                obj.search();
                // timeout
                clearTimeout(obj.tmp.timeout);
                obj.tmp.timeout = setTimeout(function () {
                    // trigger event
                    var url      = options.url;
                    var postData = {
                        search : search,
                        max    : options.cacheMax
                    };
                    $.extend(postData, options.postData);
                    var edata = obj.trigger({ phase: 'before', type: 'request', search: search, target: obj.el, url: url, postData: postData });
                    if (edata.isCancelled === true) return;
                    url      = edata.url;
                    postData = edata.postData;
                    var ajaxOptions = {
                        type     : 'GET',
                        url      : url,
                        data     : postData,
                        dataType : 'JSON' // expected from server
                    };
                    if (options.method) ajaxOptions.type = options.method;
                    if (w2utils.settings.dataType == 'JSON') {
                        ajaxOptions.type        = 'POST';
                        ajaxOptions.data        = JSON.stringify(ajaxOptions.data);
                        ajaxOptions.contentType = 'application/json';
                    }
                    if (w2utils.settings.dataType == 'HTTPJSON') {
                        ajaxOptions.data = { request: JSON.stringify(ajaxOptions.data) };
                    }
                    if (options.method != null) ajaxOptions.type = options.method;
                    obj.tmp.xhr = $.ajax(ajaxOptions)
                        .done(function (data, status, xhr) {
                            // trigger event
                            var edata2 = obj.trigger({ phase: 'before', type: 'load', target: obj.el, search: postData.search, data: data, xhr: xhr });
                            if (edata2.isCancelled === true) return;
                            // default behavior
                            data = edata2.data;
                            if (typeof data == 'string') data = JSON.parse(data);
                            if (data.records == null && data.items != null) {
                                // needed for backward compatibility
                                data.records = data.items;
                                delete data.items;
                            }
                            if (data.status != 'success' || !Array.isArray(data.records)) {
                                console.log('ERROR: server did not return proper structure. It should return', { status: 'success', records: [{ id: 1, text: 'item' }] });
                                return;
                            }
                            // remove all extra items if more then needed for cache
                            if (data.records.length > options.cacheMax) data.records.splice(options.cacheMax, 100000);
                            // map id and text
                            if (options.recId == null && options.recid != null) options.recId = options.recid; // since lower-case recid is used in grid
                            if (options.recId || options.recText) {
                                data.records.forEach(function (item) {
                                    if (typeof options.recId == 'string') item.id   = item[options.recId];
                                    if (typeof options.recId == 'function') item.id = options.recId(item);
                                    if (typeof options.recText == 'string') item.text   = item[options.recText];
                                    if (typeof options.recText == 'function') item.text = options.recText(item);
                                });
                            }
                            // remember stats
                            obj.tmp.xhr_loading = false;
                            obj.tmp.xhr_search  = search;
                            obj.tmp.xhr_total   = data.records.length;
                            options.items       = obj.normMenu(data.records);
                            if (search === '' && data.records.length === 0) obj.tmp.emptySet = true; else obj.tmp.emptySet = false;
                            obj.search();
                            // event after
                            obj.trigger($.extend(edata2, { phase: 'after' }));
                        })
                        .fail(function (xhr, status, error) {
                            // trigger event
                            var errorObj = { status: status, error: error, rawResponseText: xhr.responseText };
                            var edata2 = obj.trigger({ phase: 'before', type: 'error', target: obj.el, search: search, error: errorObj, xhr: xhr });
                            if (edata2.isCancelled === true) return;
                            // default behavior
                            if (status != 'abort') {
                                var data;
                                try { data = $.parseJSON(xhr.responseText); } catch (e) {}
                                console.log('ERROR: Server communication failed.',
                                    '\n   EXPECTED:', { status: 'success', records: [{ id: 1, text: 'item' }] },
                                    '\n         OR:', { status: 'error', message: 'error message' },
                                    '\n   RECEIVED:', typeof data == 'object' ? data : xhr.responseText);
                            }
                            // reset stats
                            obj.clearCache();
                            obj.search();
                            // event after
                            obj.trigger($.extend(edata2, { phase: 'after' }));
                        });
                    // event after
                    obj.trigger($.extend(edata, { phase: 'after' }));
                }, interval);
            }
        },

        search: function () {
            var obj      = this;
            var options  = this.options;
            var search   = $(obj.el).val();
            var target   = obj.el;
            var ids      = [];
            var selected = $(obj.el).data('selected');
            if (obj.type == 'enum') {
                target = $(obj.helpers.multi).find('input');
                search = target.val();
                for (var s in selected) { if (selected[s]) ids.push(selected[s].id); }
            }
            else if (obj.type == 'list') {
                target = $(obj.helpers.focus).find('input');
                search = target.val();
                for (var s in selected) { if (selected[s]) ids.push(selected[s].id); }
            }
            if (obj.tmp.xhr_loading !== true) {
                var shown = 0;
                for (var i = 0; i < options.items.length; i++) {
                    var item = options.items[i];
                    if (options.compare != null) {
                        if (typeof options.compare == 'function') {
                            item.hidden = (options.compare.call(this, item, search) === false ? true : false);
                        }
                    } else {
                        var prefix = '';
                        var suffix = '';
                        if (['is', 'begins'].indexOf(options.match) != -1) prefix = '^';
                        if (['is', 'ends'].indexOf(options.match) != -1) suffix = '$';
                        try {
                            var re = new RegExp(prefix + search + suffix, 'i');
                            if (re.test(item.text) || item.text == '...') item.hidden = false; else item.hidden = true;
                        } catch (e) {}
                    }
                    if (options.filter === false) item.hidden = false;
                    // do not show selected items
                    if (obj.type == 'enum' && $.inArray(item.id, ids) != -1) item.hidden = true;
                    if (item.hidden !== true) { shown++; delete item.hidden; }
                }
                // preselect first item
                options.index = -1;
                while (options.items[options.index] && options.items[options.index].hidden) options.index++;
                if (shown <= 0) options.index = -1;
                options.spinner = false;
                obj.updateOverlay();
                setTimeout(function () {
                    var html = $('#w2ui-overlay').html() || '';
                    if (options.markSearch && html.indexOf('$.fn.w2menuHandler') != -1) { // do not highlight when no items
                        $('#w2ui-overlay').w2marker(search);
                    }
                }, 1);
            } else {
                options.items.splice(0, options.cacheMax);
                options.spinner = true;
                obj.updateOverlay();
            }
        },

        updateOverlay: function (indexOnly) {
            var obj     = this;
            var options = this.options;
            // color
            if (this.type == 'color') {
                if ($(obj.el).prop('readonly') || $(obj.el).prop('disabled')) return;
                $(this.el).w2color({ color: $(this.el).val(), transparent: options.transparent }, function (color) {
                    if (color == null) return;
                    $(obj.el).val(color).change();
                });
            }
            // date
            if (this.type == 'date') {
                if ($(obj.el).prop('readonly') || $(obj.el).prop('disabled')) return;
                if ($('#w2ui-overlay').length === 0) {
                    $(obj.el).w2overlay('<div class="w2ui-reset w2ui-calendar" onclick="event.stopPropagation();"></div>', {
                        css: { "background-color": "#f5f5f5" }
                    });
                }
                var month, year;
                var dt = w2utils.isDate($(obj.el).val(), obj.options.format, true);
                if (dt) { month = dt.getMonth() + 1; year = dt.getFullYear(); }
                (function refreshCalendar(month, year) {
                    $('#w2ui-overlay > div > div').html(obj.getMonthHTML(month, year, $(obj.el).val()));
                    $('#w2ui-overlay .w2ui-calendar-title')
                        .on('mousedown', function () {
                            if ($(this).next().hasClass('w2ui-calendar-jump')) {
                                $(this).next().remove();
                            } else {
                                var selYear, selMonth;
                                $(this).after('<div class="w2ui-calendar-jump" style=""></div>');
                                $(this).next().hide().html(obj.getYearHTML()).fadeIn(200);
                                setTimeout(function () {
                                    $('#w2ui-overlay .w2ui-calendar-jump')
                                        .find('.w2ui-jump-month, .w2ui-jump-year')
                                        .on('click', function () {
                                            if ($(this).hasClass('w2ui-jump-month')) {
                                                $(this).parent().find('.w2ui-jump-month').removeClass('selected');
                                                $(this).addClass('selected');
                                                selMonth = $(this).attr('name');
                                            }
                                            if ($(this).hasClass('w2ui-jump-year')) {
                                                $(this).parent().find('.w2ui-jump-year').removeClass('selected');
                                                $(this).addClass('selected');
                                                selYear = $(this).attr('name');
                                            }
                                            if (selYear != null && selMonth != null) {
                                                $('#w2ui-overlay .w2ui-calendar-jump').fadeOut(100);
                                                setTimeout(function () { refreshCalendar(parseInt(selMonth)+1, selYear); }, 100);
                                            }
                                        });
                                    $('#w2ui-overlay .w2ui-calendar-jump >:last-child').prop('scrollTop', 2000);
                                }, 1);
                            }
                        });
                    $('#w2ui-overlay .w2ui-date')
                        .on('mousedown', function () {
                            var day = $(this).attr('date');
                            $(obj.el).val(day).change();
                            $(this).css({ 'background-color': '#B6D5FB', 'border-color': '#aaa' });
                        })
                        .on('mouseup', function () {
                            setTimeout(function () {
                                if ($("#w2ui-overlay").length > 0) $('#w2ui-overlay').removeData('keepOpen')[0].hide();
                            }, 10);
                        });
                    $('#w2ui-overlay .previous').on('mousedown', function () {
                        var tmp = obj.options.current.split('/');
                        tmp[0]  = parseInt(tmp[0]) - 1;
                        refreshCalendar(tmp[0], tmp[1]);
                    });
                    $('#w2ui-overlay .next').on('mousedown', function () {
                        var tmp = obj.options.current.split('/');
                        tmp[0]  = parseInt(tmp[0]) + 1;
                        refreshCalendar(tmp[0], tmp[1]);
                    });
                }) (month, year);
            }
            // time
            if (this.type == 'time') {
                if ($(obj.el).prop('readonly') || $(obj.el).prop('disabled')) return;
                if ($('#w2ui-overlay').length === 0) {
                    $(obj.el).w2overlay('<div class="w2ui-reset w2ui-calendar-time" onclick="event.stopPropagation();"></div>', {
                        css: { "background-color": "#fff" }
                    });
                }
                var h24 = (this.options.format == 'h24');
                $('#w2ui-overlay > div').html(obj.getHourHTML());
                $('#w2ui-overlay .w2ui-time')
                    .on('mousedown', function (event) {
                        $(this).css({ 'background-color': '#B6D5FB', 'border-color': '#aaa' });
                        var hour = $(this).attr('hour');
                        $(obj.el).val((hour > 12 && !h24 ? hour - 12 : hour) + ':00' + (!h24 ? (hour < 12 ? ' am' : ' pm') : '')).change();
                    });
                    if (this.options.noMinutes == null || this.options.noMinutes === false) {
                        $('#w2ui-overlay .w2ui-time')
                            .on('mouseup', function () {
                                var hour = $(this).attr('hour');
                                if ($("#w2ui-overlay").length > 0) $('#w2ui-overlay')[0].hide();
                                $(obj.el).w2overlay('<div class="w2ui-reset w2ui-calendar-time"></div>', { css: { "background-color": "#fff" } });
                                $('#w2ui-overlay > div').html(obj.getMinHTML(hour));
                                $('#w2ui-overlay .w2ui-time')
                                    .on('mousedown', function () {
                                        $(this).css({ 'background-color': '#B6D5FB', 'border-color': '#aaa' });
                                        var min = $(this).attr('min');
                                        $(obj.el).val((hour > 12 && !h24 ? hour - 12 : hour) + ':' + (min < 10 ? 0 : '') + min + (!h24 ? (hour < 12 ? ' am' : ' pm') : '')).change();
                                    })
                                    .on('mouseup', function () {
                                        setTimeout(function () { if ($("#w2ui-overlay").length > 0) $('#w2ui-overlay').removeData('keepOpen')[0].hide(); }, 10);
                                    });
                            });
                    } else {
                        $('#w2ui-overlay .w2ui-time')
                            .on('mouseup', function () {
                                    setTimeout(function () { if ($("#w2ui-overlay").length > 0) $('#w2ui-overlay').removeData('keepOpen')[0].hide(); }, 10);
                            });
                    }
            }
            // datetime
            if (this.type == 'datetime') {
                if ($(obj.el).prop('readonly') || $(obj.el).prop('disabled')) return;
                // hide overlay if we are in the time selection
                if ($("#w2ui-overlay .w2ui-time").length > 0) $('#w2ui-overlay')[0].hide();
                if ($('#w2ui-overlay').length === 0) {
                    $(obj.el).w2overlay('<div class="w2ui-reset w2ui-calendar" onclick="event.stopPropagation();"></div>', {
                        css: { "background-color": "#f5f5f5" }
                    });
                }
                var month, year;
                var dt = w2utils.isDateTime($(obj.el).val(), obj.options.format, true);
                if (dt) { month = dt.getMonth() + 1; year = dt.getFullYear(); }
                var selDate = null;
                (function refreshCalendar(month, year) {
                    $('#w2ui-overlay > div > div').html(
                        obj.getMonthHTML(month, year, $(obj.el).val())
                        + (options.btn_now ? '<div class="w2ui-calendar-now now">'+ w2utils.lang('Current Date & Time') + '</div>' : '')
                    );
                    $('#w2ui-overlay .w2ui-calendar-title')
                        .on('mousedown', function () {
                            if ($(this).next().hasClass('w2ui-calendar-jump')) {
                                $(this).next().remove();
                            } else {
                                var selYear, selMonth;
                                $(this).after('<div class="w2ui-calendar-jump" style=""></div>');
                                $(this).next().hide().html(obj.getYearHTML()).fadeIn(200);
                                setTimeout(function () {
                                    $('#w2ui-overlay .w2ui-calendar-jump')
                                        .find('.w2ui-jump-month, .w2ui-jump-year')
                                        .on('click', function () {
                                            if ($(this).hasClass('w2ui-jump-month')) {
                                                $(this).parent().find('.w2ui-jump-month').removeClass('selected');
                                                $(this).addClass('selected');
                                                selMonth = $(this).attr('name');
                                            }
                                            if ($(this).hasClass('w2ui-jump-year')) {
                                                $(this).parent().find('.w2ui-jump-year').removeClass('selected');
                                                $(this).addClass('selected');
                                                selYear = $(this).attr('name');
                                            }
                                            if (selYear != null && selMonth != null) {
                                                $('#w2ui-overlay .w2ui-calendar-jump').fadeOut(100);
                                                setTimeout(function () { refreshCalendar(parseInt(selMonth)+1, selYear); }, 100);
                                            }
                                        });
                                    $('#w2ui-overlay .w2ui-calendar-jump >:last-child').prop('scrollTop', 2000);
                                }, 1);
                            }
                        });
                    $('#w2ui-overlay .w2ui-date')
                        .on('mousedown', function () {
                            var day = $(this).attr('date');
                            $(obj.el).val(day).change();
                            $(this).css({ 'background-color': '#B6D5FB', 'border-color': '#aaa' });
                            selDate = new Date($(this).attr('data-date'));
                        })
                        .on('mouseup', function () {
                            // continue with time picker
                            var selHour, selMin;
                            if ($("#w2ui-overlay").length > 0) $('#w2ui-overlay')[0].hide();
                            $(obj.el).w2overlay('<div class="w2ui-reset w2ui-calendar-time"></div>', { css: { "background-color": "#fff" } });
                            var h24 = (obj.options.format == 'h24');
                            $('#w2ui-overlay > div').html(obj.getHourHTML());
                            $('#w2ui-overlay .w2ui-time')
                                .on('mousedown', function (event) {
                                    $(this).css({ 'background-color': '#B6D5FB', 'border-color': '#aaa' });
                                    selHour = $(this).attr('hour');
                                    selDate.setHours(selHour);
                                    var txt = w2utils.formatDateTime(selDate, obj.options.format);
                                    $(obj.el).val(txt).change();
                                    //$(obj.el).val((hour > 12 && !h24 ? hour - 12 : hour) + ':00' + (!h24 ? (hour < 12 ? ' am' : ' pm') : '')).change();
                                });
                            if (obj.options.noMinutes == null || obj.options.noMinutes === false) {
                                $('#w2ui-overlay .w2ui-time')
                                    .on('mouseup', function () {
                                        var hour = $(this).attr('hour');
                                        if ($("#w2ui-overlay").length > 0) $('#w2ui-overlay')[0].hide();
                                        $(obj.el).w2overlay('<div class="w2ui-reset w2ui-calendar-time"></div>', { css: { "background-color": "#fff" } });
                                        $('#w2ui-overlay > div').html(obj.getMinHTML(hour));
                                        $('#w2ui-overlay .w2ui-time')
                                            .on('mousedown', function () {
                                                $(this).css({ 'background-color': '#B6D5FB', 'border-color': '#aaa' });
                                                selMin = $(this).attr('min');
                                                selDate.setHours(selHour, selMin);
                                                var txt = w2utils.formatDateTime(selDate, obj.options.format);
                                                $(obj.el).val(txt).change();
                                                //$(obj.el).val((hour > 12 && !h24 ? hour - 12 : hour) + ':' + (min < 10 ? 0 : '') + min + (!h24 ? (hour < 12 ? ' am' : ' pm') : '')).change();
                                            })
                                            .on('mouseup', function () {
                                                setTimeout(function () { if ($("#w2ui-overlay").length > 0) $('#w2ui-overlay').removeData('keepOpen')[0].hide(); }, 10);
                                            });
                                    });
                            } else {
                                $('#w2ui-overlay .w2ui-time')
                                    .on('mouseup', function () {
                                            setTimeout(function () { if ($("#w2ui-overlay").length > 0) $('#w2ui-overlay').removeData('keepOpen')[0].hide(); }, 10);
                                    });
                            }
                        });
                    $('#w2ui-overlay .previous').on('mousedown', function () {
                        var tmp = obj.options.current.split('/');
                        tmp[0]  = parseInt(tmp[0]) - 1;
                        refreshCalendar(tmp[0], tmp[1]);
                    });
                    $('#w2ui-overlay .next').on('mousedown', function () {
                        var tmp = obj.options.current.split('/');
                        tmp[0]  = parseInt(tmp[0]) + 1;
                        refreshCalendar(tmp[0], tmp[1]);
                    });
                    // "now" button
                    $('#w2ui-overlay .now')
                        .on('mousedown', function () {
                            // this currently ignores blocked days or start / end dates!
                            var tmp = w2utils.formatDateTime(new Date(), obj.options.format);
                            $(obj.el).val(tmp).change();
                            return false;
                        })
                        .on('mouseup', function () {
                            setTimeout(function () {
                                if ($("#w2ui-overlay").length > 0) $('#w2ui-overlay').removeData('keepOpen')[0].hide();
                            }, 10);
                        });
                }) (month, year);
            }
            // list
            if (['list', 'combo', 'enum'].indexOf(this.type) != -1) {
                var el    = this.el;
                var input = this.el;
                if (this.type == 'enum') {
                    el    = $(this.helpers.multi);
                    input = $(el).find('input');
                }
                if (this.type == 'list') {
                    var sel = $(input).data('selected');
                    if ($.isPlainObject(sel) && !$.isEmptyObject(sel) && options.index == -1) {
                        options.items.forEach(function (item, ind) {
                            if (item.id == sel.id) {
                                options.index = ind;
                            }
                        });
                    }
                    input = $(this.helpers.focus).find('input');
                }
                if ($(input).is(':focus')) {
                    if (options.openOnFocus === false && $(input).val() === '' && obj.tmp.force_open !== true) {
                        $().w2overlay();
                        return;
                    }
                    if (obj.tmp.force_hide) {
                        $().w2overlay();
                        setTimeout(function () {
                            delete obj.tmp.force_hide;
                        }, 1);
                        return;
                    }
                    if ($(input).val() !== '') delete obj.tmp.force_open;
                    var msgNoItems = w2utils.lang('No matches');
                    if (options.url != null && $(input).val().length < options.minLength && obj.tmp.emptySet !== true) msgNoItems = options.minLength + ' ' + w2utils.lang('letters or more...');
                    if (options.url != null && $(input).val() === '' && obj.tmp.emptySet !== true) msgNoItems = w2utils.lang('Type to search...');
                    if (options.url == null && options.items.length === 0) msgNoItems = w2utils.lang('Empty list');
                    if (options.msgNoItems != null) msgNoItems = options.msgNoItems;
                    if (msgNoItems == 'function') msgNoItems = msgNoItems(options);
                    $(el).w2menu((!indexOnly ? 'refresh' : 'refresh-index'), $.extend(true, {}, options, {
                        search     : false,
                        render     : options.renderDrop,
                        maxHeight  : options.maxDropHeight,
                        maxWidth   : options.maxDropWidth,
                        msgNoItems : msgNoItems,
                        // selected with mouse
                        onSelect: function (event) {
                            if (obj.type == 'enum') {
                                var selected = $(obj.el).data('selected');
                                if (event.item) {
                                    // trigger event
                                    var edata = obj.trigger({ phase: 'before', type: 'add', target: obj.el, originalEvent: event.originalEvent, item: event.item });
                                    if (edata.isCancelled === true) return;
                                    // default behavior
                                    if (selected.length >= options.max && options.max > 0) selected.pop();
                                    delete event.item.hidden;
                                    selected.push(event.item);
                                    $(obj.el).data('selected', selected).change();
                                    $(obj.helpers.multi).find('input').val('').width(20);
                                    obj.refresh();
                                    if ($("#w2ui-overlay").length > 0) $('#w2ui-overlay')[0].hide();
                                    // event after
                                    obj.trigger($.extend(edata, { phase: 'after' }));
                                }
                            } else {
                                $(obj.el).data('selected', event.item).val(event.item.text).change();
                                if (obj.helpers.focus) obj.helpers.focus.find('input').val('');
                            }
                        }
                    }));
                }
            }
        },

        inRange: function (str, onlyDate) {
            var inRange = false;
            if (this.type == 'date') {
                var dt = w2utils.isDate(str, this.options.format, true);
                if (dt) {
                    // enable range
                    if (this.options.start || this.options.end) {
                        var st = (typeof this.options.start == 'string' ? this.options.start : $(this.options.start).val());
                        var en = (typeof this.options.end == 'string' ? this.options.end : $(this.options.end).val());
                        var start   = w2utils.isDate(st, this.options.format, true);
                        var end     = w2utils.isDate(en, this.options.format, true);
                        var current = new Date(dt);
                        if (!start) start = current;
                        if (!end) end = current;
                        if (current >= start && current <= end) inRange = true;
                    } else {
                        inRange = true;
                    }
                    // block predefined dates
                    if (this.options.blocked && $.inArray(str, this.options.blocked) != -1) inRange = false;

                    /*
                    clockWeekDay - type: array or integers. every element - number of week day.
                    number of weekday (1 - monday, 2 - tuesday, 3 - wensday, 4 - thursday, 5 - friday, 6 - saturday, 0 - sunday)
                    for block in calendar (for example, block all sundays so user can't choose sunday in calendar)
                    */
                    if (this.options.blockWeekDays != null && this.options.blockWeekDays != undefined
                        && this.options.blockWeekDays.length != undefined){
                        var l = this.options.blockWeekDays.length;
                        for (var i=0; i<l; i++){
                            if (dt.getDay() == this.options.blockWeekDays[i]){
                                inRange = false;
                            }
                        }
                    }
                }
            } else if (this.type == 'time') {
                if (this.options.start || this.options.end) {
                    var tm  = this.toMin(str);
                    var tm1 = this.toMin(this.options.start);
                    var tm2 = this.toMin(this.options.end);
                    if (!tm1) tm1 = tm;
                    if (!tm2) tm2 = tm;
                    if (tm >= tm1 && tm <= tm2) inRange = true;
                } else {
                    inRange = true;
                }
            } else if (this.type == 'datetime') {
                var dt = w2utils.isDateTime(str, this.options.format, true);
                if (dt) {
                    // enable range
                    if (this.options.start || this.options.end) {
                        var start, end;
                        if (typeof this.options.start == 'object' && this.options.start instanceof Date) {
                            start = this.options.start;
                        } else {
                            var st = (typeof this.options.start == 'string' ? this.options.start : $(this.options.start).val());
                            if (st.trim() !== '') {
                                start = w2utils.isDateTime(st, this.options.format, true);
                            } else {
                                start = '';
                            }
                        }
                        if (typeof this.options.end == 'object' && this.options.end instanceof Date) {
                            end = this.options.end;
                        } else {
                            var en = (typeof this.options.end == 'string' ? this.options.end : $(this.options.end).val());
                            if (en.trim() !== '') {
                                end = w2utils.isDateTime(en, this.options.format, true);
                            } else {
                                end = '';
                            }
                        }
                        var current = dt; // new Date(dt);
                        if (!start) start = current;
                        if (!end) end = current;
                        if (onlyDate && start instanceof Date) {
                            start.setHours(0);
                            start.setMinutes(0);
                            start.setSeconds(0);
                        }
                        if (current >= start && current <= end) inRange = true;
                    } else {
                        inRange = true;
                    }
                    // block predefined dates
                    if (inRange && this.options.blocked) {
                        for (var i=0; i<this.options.blocked.length; i++) {
                            var blocked = this.options.blocked[i];
                            if(typeof blocked == 'string') {
                                // convert string to Date object
                                blocked = w2utils.isDateTime(blocked, this.options.format, true);
                            }
                            // check for Date object with the same day
                            if(typeof blocked == 'object' && blocked instanceof Date && (blocked.getFullYear() == dt.getFullYear() && blocked.getMonth() == dt.getMonth() && blocked.getDate() == dt.getDate())) {
                                inRange = false;
                                break;
                            }
                        }
                    }
                }
            }
            return inRange;
        },

        /*
        *  INTERNAL FUNCTIONS
        */

        checkType: function (ch, loose) {
            var obj = this;
            switch (obj.type) {
                case 'int':
                    if (loose && ['-', obj.options.groupSymbol].indexOf(ch) != -1) return true;
                    return w2utils.isInt(ch.replace(obj.options.numberRE, ''));
                case 'percent':
                    ch = ch.replace(/%/g, '');
                case 'float':
                    if (loose && ['-', w2utils.settings.decimalSymbol, obj.options.groupSymbol].indexOf(ch) != -1) return true;
                    return w2utils.isFloat(ch.replace(obj.options.numberRE, ''));
                case 'money':
                case 'currency':
                    if (loose && ['-', obj.options.decimalSymbol, obj.options.groupSymbol, obj.options.currencyPrefix, obj.options.currencySuffix].indexOf(ch) != -1) return true;
                    return w2utils.isFloat(ch.replace(obj.options.moneyRE, ''));
                case 'bin':
                    return w2utils.isBin(ch);
                case 'hex':
                case 'color':
                    return w2utils.isHex(ch);
                case 'alphanumeric':
                    return w2utils.isAlphaNumeric(ch);
            }
            return true;
        },

        addPrefix: function () {
            var obj = this;
            setTimeout(function () {
                if (obj.type === 'clear') return;
                var helper;
                var tmp = $(obj.el).data('tmp') || {};
                if (tmp['old-padding-left']) $(obj.el).css('padding-left', tmp['old-padding-left']);
                tmp['old-padding-left'] = $(obj.el).css('padding-left');
                $(obj.el).data('tmp', tmp);
                // remove if already displaed
                if (obj.helpers.prefix) $(obj.helpers.prefix).remove();
                if (obj.options.prefix !== '') {
                    // add fresh
                    $(obj.el).before(
                        '<div class="w2ui-field-helper">'+
                            obj.options.prefix +
                        '</div>'
                    );
                    helper = $(obj.el).prev();
                    helper
                        .css({
                            'color'          : $(obj.el).css('color'),
                            'font-family'    : $(obj.el).css('font-family'),
                            'font-size'      : $(obj.el).css('font-size'),
                            'padding-top'    : $(obj.el).css('padding-top'),
                            'padding-bottom' : $(obj.el).css('padding-bottom'),
                            'padding-left'   : $(obj.el).css('padding-left'),
                            'padding-right'  : 0,
                            'margin-top'     : (parseInt($(obj.el).css('margin-top'), 10) + 2) + 'px',
                            'margin-bottom'  : (parseInt($(obj.el).css('margin-bottom'), 10) + 1) + 'px',
                            'margin-left'    : $(obj.el).css('margin-left'),
                            'margin-right'   : 0
                        })
                        .on('click', function (event) {
                            if (obj.options.icon && typeof obj.onIconClick == 'function') {
                                // event before
                                var edata = obj.trigger({ phase: 'before', type: 'iconClick', target: obj.el, el: $(this).find('span.w2ui-icon')[0] });
                                if (edata.isCancelled === true) return;

                                // intentionally empty

                                // event after
                                obj.trigger($.extend(edata, { phase: 'after' }));
                            } else {
                                if (obj.type == 'list') {
                                    $(obj.helpers.focus).find('input').focus();
                                } else {
                                    $(obj.el).focus();
                                }
                            }
                        });
                    $(obj.el).css('padding-left', (helper.width() + parseInt($(obj.el).css('padding-left'), 10)) + 'px');
                    // remember helper
                    obj.helpers.prefix = helper;
                }
            }, 1);
        },

        addSuffix: function () {
            var obj = this;
            var helper, pr;
            setTimeout(function () {
                if (obj.type === 'clear') return;
                var tmp = $(obj.el).data('tmp') || {};
                if (tmp['old-padding-right']) $(obj.el).css('padding-right', tmp['old-padding-right']);
                tmp['old-padding-right'] = $(obj.el).css('padding-right');
                $(obj.el).data('tmp', tmp);
                pr = parseInt($(obj.el).css('padding-right'), 10);
                if (obj.options.arrows) {
                    // remove if already displayed
                    if (obj.helpers.arrows) $(obj.helpers.arrows).remove();
                    // add fresh
                    $(obj.el).after(
                        '<div class="w2ui-field-helper" style="border: 1px solid transparent">&#160;'+
                        '    <div class="w2ui-field-up" type="up">'+
                        '        <div class="arrow-up" type="up"></div>'+
                        '    </div>'+
                        '    <div class="w2ui-field-down" type="down">'+
                        '        <div class="arrow-down" type="down"></div>'+
                        '    </div>'+
                        '</div>');
                    var height = w2utils.getSize(obj.el, 'height');
                    helper = $(obj.el).next();
                    helper.css({
                            'color'         : $(obj.el).css('color'),
                            'font-family'   : $(obj.el).css('font-family'),
                            'font-size'     : $(obj.el).css('font-size'),
                            'height'        : ($(obj.el).height() + parseInt($(obj.el).css('padding-top'), 10) + parseInt($(obj.el).css('padding-bottom'), 10) ) + 'px',
                            'padding'       : 0,
                            'margin-top'    : (parseInt($(obj.el).css('margin-top'), 10) + 1) + 'px',
                            'margin-bottom' : 0,
                            'border-left'   : '1px solid silver'
                        })
                        .css('margin-left', '-'+ (helper.width() + parseInt($(obj.el).css('margin-right'), 10) + 12) + 'px')
                        .on('mousedown', function (event) {
                            var body = $('body');
                            body.on('mouseup', tmp);
                            body.data('_field_update_timer', setTimeout(update, 700));
                            update(false);
                            // timer function
                            function tmp() {
                                clearTimeout(body.data('_field_update_timer'));
                                body.off('mouseup', tmp);
                            }
                            // update function
                            function update(notimer) {
                                $(obj.el).focus();
                                obj.keyDown($.Event("keydown"), {
                                    keyCode : ($(event.target).attr('type') == 'up' ? 38 : 40)
                                });
                                if (notimer !== false) $('body').data('_field_update_timer', setTimeout(update, 60));
                            }
                        });
                    pr += helper.width() + 12;
                    $(obj.el).css('padding-right', pr + 'px');
                    // remember helper
                    obj.helpers.arrows = helper;
                }
                if (obj.options.suffix !== '') {
                    // remove if already displayed
                    if (obj.helpers.suffix) $(obj.helpers.suffix).remove();
                    // add fresh
                    $(obj.el).after(
                        '<div class="w2ui-field-helper">'+
                            obj.options.suffix +
                        '</div>');
                    helper = $(obj.el).next();
                    helper
                        .css({
                            'color'          : $(obj.el).css('color'),
                            'font-family'    : $(obj.el).css('font-family'),
                            'font-size'      : $(obj.el).css('font-size'),
                            'padding-top'    : $(obj.el).css('padding-top'),
                            'padding-bottom' : $(obj.el).css('padding-bottom'),
                            'padding-left'   : '3px',
                            'padding-right'  : $(obj.el).css('padding-right'),
                            'margin-top'     : (parseInt($(obj.el).css('margin-top'), 10) + 2) + 'px',
                            'margin-bottom'  : (parseInt($(obj.el).css('margin-bottom'), 10) + 1) + 'px'
                        })
                        .on('click', function (event) {
                            if (obj.type == 'list') {
                                $(obj.helpers.focus).find('input').focus();
                            } else {
                                $(obj.el).focus();
                            }
                        });

                    helper.css('margin-left', '-'+ (w2utils.getSize(helper, 'width') + parseInt($(obj.el).css('margin-right'), 10) + 2) + 'px');
                    pr += helper.width() + 3;
                    $(obj.el).css('padding-right', pr + 'px');
                    // remember helper
                    obj.helpers.suffix = helper;
                }
            }, 1);
        },

        addFocus: function () {
            var obj      = this;
            var options  = this.options;
            var width    = 0; // 11 - show search icon, 0 do not show
            var pholder;
            // clean up & init
            $(obj.helpers.focus).remove();
            // remember original tabindex
            var tabIndex = $(obj.el).attr('tabIndex');
            if (tabIndex && tabIndex != -1) obj.el._tabIndex = tabIndex;
            if (obj.el._tabIndex) tabIndex = obj.el._tabIndex;
            if (tabIndex == null) tabIndex = -1;
            // build helper
            var html =
                '<div class="w2ui-field-helper">'+
                '    <div class="w2ui-icon icon-search" style="opacity: 0; display: none"></div>'+
                '    <input type="text" autocomplete="off" tabIndex="'+ tabIndex +'"/>'+
                '</div>';
            $(obj.el).attr('tabindex', -1).before(html);
            var helper = $(obj.el).prev();
            obj.helpers.focus = helper;
            helper.css({
                    width           : $(obj.el).width(),
                    "margin-top"    : $(obj.el).css('margin-top'),
                    "margin-left"   : (parseInt($(obj.el).css('margin-left')) + parseInt($(obj.el).css('padding-left'))) + 'px',
                    "margin-bottom" : $(obj.el).css('margin-bottom'),
                    "margin-right"  : $(obj.el).css('margin-right')
                })
                .find('input')
                .css({
                    cursor   : 'default',
                    width    : '100%',
                    outline  : 'none',
                    opacity  : 1,
                    margin   : 0,
                    border   : '1px solid transparent',
                    padding  : $(obj.el).css('padding-top'),
                    "padding-left"     : 0,
                    "margin-left"      : (width > 0 ? width + 6 : 0),
                    "background-color" : 'transparent'
                });
            // INPUT events
            helper.find('input')
                .on('click', function (event) {
                    if ($('#w2ui-overlay').length === 0) obj.focus(event);
                    event.stopPropagation();
                })
                .on('focus', function (event) {
                    pholder = $(obj.el).attr('placeholder');
                    $(obj.el).css({ 'outline': 'auto 5px #7DB4F3', 'outline-offset': '-2px' });
                    $(this).val('');
                    $(obj.el).triggerHandler('focus');
                    if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true;
                })
                .on('blur', function (event) {
                    $(obj.el).css('outline', 'none');
                    $(this).val('');
                    obj.refresh();
                    $(obj.el).triggerHandler('blur');
                    if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true;
                    if (pholder != null) $(obj.el).attr('placeholder', pholder);
                })
                .on('keydown', function (event) {
                    var el = this;
                    obj.keyDown(event);
                    setTimeout(function () {
                        if (el.value === '') $(obj.el).attr('placeholder', pholder); else $(obj.el).attr('placeholder', '');
                    }, 10);
                })
                .on('keyup', function (event) { obj.keyUp(event); })
                .on('keypress', function (event) { obj.keyPress(event); });
            // MAIN div
            helper.on('click', function (event) { $(this).find('input').focus(); });
            obj.refresh();
        },

        addMulti: function () {
            var obj     = this;
            var options = this.options;
            // clean up & init
            $(obj.helpers.multi).remove();
            // build helper
            var html   = '';
            var margin =
                'margin-top     : 0px; ' +
                'margin-bottom  : 0px; ' +
                'margin-left    : ' + $(obj.el).css('margin-left') + '; ' +
                'margin-right   : ' + $(obj.el).css('margin-right') + '; '+
                'width          : ' + (w2utils.getSize(obj.el, 'width')
                                    - parseInt($(obj.el).css('margin-left'), 10)
                                    - parseInt($(obj.el).css('margin-right'), 10))
                                    + 'px;';
            if (obj.type == 'enum') {
                // remember original tabindex
                var tabIndex = $(obj.el).attr('tabIndex');
                if (tabIndex && tabIndex != -1) obj.el._tabIndex = tabIndex;
                if (obj.el._tabIndex) tabIndex = obj.el._tabIndex;
                if (tabIndex == null) tabIndex = -1;

                html =  '<div class="w2ui-field-helper w2ui-list" style="'+ margin + '; box-sizing: border-box">'+
                        '    <div style="padding: 0px; margin: 0px; display: inline-block" class="w2ui-multi-items">'+
                        '    <ul>'+
                        '        <li style="padding-left: 0px; padding-right: 0px" class="nomouse">'+
                        '            <input type="text" style="width: 20px; margin: -3px 0 0; padding: 2px 0; border-color: white" autocomplete="off"' + ($(obj.el).prop('readonly') ? ' readonly="readonly"': '') + ($(obj.el).prop('disabled') ? ' disabled="disabled"': '') + ' tabindex="'+ tabIndex +'"/>'+
                        '        </li>'+
                        '    </ul>'+
                        '    </div>'+
                        '</div>';
            }
            if (obj.type == 'file') {
                html =  '<div class="w2ui-field-helper w2ui-list" style="'+ margin + '; box-sizing: border-box">'+
                        '   <div style="position: absolute; left: 0px; right: 0px; top: 0px; bottom: 0px;">'+
                        '       <input class="file-input" type="file" style="width: 100%; height: 100%; opacity: 0;" name="attachment" multiple tabindex="-1"' + ($(obj.el).prop('readonly') ? ' readonly="readonly"': '') + ($(obj.el).prop('disabled') ? ' disabled="disabled"': '') + ($(obj.el).attr('accept') ? ' accept="'+ $(obj.el).attr('accept') +'"': '') + '/>'+
                        '   </div>'+
                        '    <div style="position: absolute; padding: 0px; margin: 0px; display: inline-block" class="w2ui-multi-items">'+
                        '        <ul><li style="padding-left: 0px; padding-right: 0px" class="nomouse"></li></ul>'+
                        '    </div>'+
                        '</div>';
            }
            // old bg and border
            var tmp = $(obj.el).data('tmp') || {};
            tmp['old-background-color'] = $(obj.el).css('background-color');
            tmp['old-border-color']     = $(obj.el).css('border-color');
            $(obj.el).data('tmp', tmp);

            $(obj.el)
                .before(html)
                .css({
                    'background-color' : 'transparent',
                    'border-color'     : 'transparent'
                });

            var div    = $(obj.el).prev();
            obj.helpers.multi = div;
            if (obj.type == 'enum') {
                $(obj.el).attr('tabindex', -1);
                // INPUT events
                div.find('input')
                    .on('click', function (event) {
                        if ($('#w2ui-overlay').length === 0) obj.focus(event);
                        $(obj.el).triggerHandler('click');
                    })
                    .on('focus', function (event) {
                        $(div).css({ 'outline': 'auto 5px #7DB4F3', 'outline-offset': '-2px' });
                        $(obj.el).triggerHandler('focus');
                        if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true;
                    })
                    .on('blur', function (event) {
                        $(div).css('outline', 'none');
                        $(obj.el).triggerHandler('blur');
                        if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true;
                    })
                    .on('keyup',    function (event) { obj.keyUp(event); })
                    .on('keydown',  function (event) { obj.keyDown(event); })
                    .on('keypress', function (event) { obj.keyPress(event); });
                // MAIN div
                div.on('click', function (event) { $(this).find('input').focus(); });
            }
            if (obj.type == 'file') {
                $(obj.el).css('outline', 'none');
                div.on('click', function (event) {
                        $(obj.el).focus();
                        if ($(obj.el).prop('readonly') || $(obj.el).prop('disabled')) return;
                        obj.blur(event);
                        obj.resize();
                        setTimeout(function () { div.find('input').click(); }, 10); // needed this when clicked on items div
                    })
                    .on('dragenter', function (event) {
                        if ($(obj.el).prop('readonly') || $(obj.el).prop('disabled')) return;
                        $(div).addClass('w2ui-file-dragover');
                    })
                    .on('dragleave', function (event) {
                        if ($(obj.el).prop('readonly') || $(obj.el).prop('disabled')) return;
                        var tmp = $(event.target).parents('.w2ui-field-helper');
                        if (tmp.length === 0) $(div).removeClass('w2ui-file-dragover');
                    })
                    .on('drop', function (event) {
                        if ($(obj.el).prop('readonly') || $(obj.el).prop('disabled')) return;
                        $(div).removeClass('w2ui-file-dragover');
                        var files = event.originalEvent.dataTransfer.files;
                        for (var i = 0, l = files.length; i < l; i++) obj.addFile.call(obj, files[i]);
                        // cancel to stop browser behaviour
                        event.preventDefault();
                        event.stopPropagation();
                    })
                    .on('dragover', function (event) {
                        // cancel to stop browser behaviour
                        event.preventDefault();
                        event.stopPropagation();
                    });
                div.find('input')
                    .on('click', function (event) {
                        event.stopPropagation();
                    })
                    .on('change', function () {
                        if (typeof this.files !== "undefined") {
                            for (var i = 0, l = this.files.length; i < l; i++) {
                                obj.addFile.call(obj, this.files[i]);
                            }
                        }
                    });
            }
            obj.refresh();
        },

        addFile: function (file) {
            var obj      = this;
            var options  = this.options;
            var selected = $(obj.el).data('selected');
            var newItem  = {
                name     : file.name,
                type     : file.type,
                modified : file.lastModifiedDate,
                size     : file.size,
                content  : null,
                file     : file
            };
            var size = 0;
            var cnt  = 0;
            var err;
            if (selected) {
                for (var s = 0; s < selected.length; s++) {
                   // check for dups
                   if (selected[s].name == file.name && selected[s].size == file.size) return;
                   size += selected[s].size;
                   cnt++;
               }
            }
            // trigger event
            var edata = obj.trigger({ phase: 'before', type: 'add', target: obj.el, file: newItem, total: cnt, totalSize: size });
            if (edata.isCancelled === true) return;
            // check params
            if (options.maxFileSize !== 0 && newItem.size > options.maxFileSize) {
                err = 'Maximum file size is '+ w2utils.formatSize(options.maxFileSize);
                if (options.silent === false) $(obj.el).w2tag(err);
                console.log('ERROR: '+ err);
                return;
            }
            if (options.maxSize !== 0 && size + newItem.size > options.maxSize) {
                err = 'Maximum total size is '+ w2utils.formatSize(options.maxSize);
                if (options.silent === false) $(obj.el).w2tag(err);
                console.log('ERROR: '+ err);
                return;
            }
            if (options.max !== 0 && cnt >= options.max) {
                err = 'Maximum number of files is '+ options.max;
                if (options.silent === false) $(obj.el).w2tag(err);
                console.log('ERROR: '+ err);
                return;
            }
            selected.push(newItem);
            // read file as base64
            if (typeof FileReader !== "undefined" && options.readContent === true) {
                var reader = new FileReader();
                // need a closure
                reader.onload = (function () {
                    return function (event) {
                        var fl  = event.target.result;
                        var ind = fl.indexOf(',');
                        newItem.content = fl.substr(ind+1);
                        obj.refresh();
                        $(obj.el).trigger('change');
                        // event after
                        obj.trigger($.extend(edata, { phase: 'after' }));
                    };
                })();
                reader.readAsDataURL(file);
            } else {
                obj.refresh();
                $(obj.el).trigger('change');
            }
        },

        normMenu: function (menu) {
            if ($.isArray(menu)) {
                for (var m = 0; m < menu.length; m++) {
                    if (typeof menu[m] == 'string') {
                        menu[m] = { id: menu[m], text: menu[m] };
                    } else {
                        if (menu[m].text != null && menu[m].id == null) menu[m].id = menu[m].text;
                        if (menu[m].text == null && menu[m].id != null) menu[m].text = menu[m].id;
                        if (menu[m].caption != null) menu[m].text = menu[m].caption;
                    }
                }
                return menu;
            } else if (typeof menu == 'function') {
                return this.normMenu(menu());
            } else if (typeof menu == 'object') {
                var tmp = [];
                for (var m in menu) tmp.push({ id: m, text: menu[m] });
                return tmp;
            }
        },

        getMonthHTML: function (month, year, selected) {
            var td          = new Date();
            var months      = w2utils.settings.fullmonths;
            var daysCount   = ['31', '28', '31', '30', '31', '30', '31', '31', '30', '31', '30', '31'];
            var today       = td.getFullYear() + '/' + (Number(td.getMonth()) + 1) + '/' + td.getDate();
            var days        = w2utils.settings.fulldays.slice();    // creates copy of the array
            var sdays       = w2utils.settings.shortdays.slice();   // creates copy of the array
            if (w2utils.settings.weekStarts != 'M') {
                days.unshift(days.pop());
                sdays.unshift(sdays.pop());
            }
            var options = this.options;
            if (options == null) options = {};
            // normalize date
            year  = w2utils.isInt(year)  ? parseInt(year)  : td.getFullYear();
            month = w2utils.isInt(month) ? parseInt(month) : td.getMonth() + 1;
            if (month > 12) { month -= 12; year++; }
            if (month < 1 || month === 0)  { month += 12; year--; }
            if (year/4 == Math.floor(year/4)) { daysCount[1] = '29'; } else { daysCount[1] = '28'; }
            options.current = month + '/' + year;

            // start with the required date
            td = new Date(year, month-1, 1);
            var weekDay = td.getDay();
            var dayTitle = '';
            for (var i = 0; i < sdays.length; i++) dayTitle += '<td title="'+ days[i] +'">' + sdays[i] + '</td>';

            var html  =
                '<div class="w2ui-calendar-title title">'+
                '    <div class="w2ui-calendar-previous previous"> <div></div> </div>'+
                '    <div class="w2ui-calendar-next next"> <div></div> </div> '+
                        months[month-1] +', '+ year +
                '</div>'+
                '<table class="w2ui-calendar-days" cellspacing="0"><tbody>'+
                '    <tr class="w2ui-day-title">' + dayTitle + '</tr>'+
                '    <tr>';

            var day = 1;
            if (w2utils.settings.weekStarts != 'M') weekDay++;
            if(this.type === 'datetime') {
                var dt_sel = w2utils.isDateTime(selected, options.format, true);
                selected = w2utils.formatDate(dt_sel, w2utils.settings.dateFormat);
            }
            for (var ci = 1; ci < 43; ci++) {
                if (weekDay === 0 && ci == 1) {
                    for (var ti = 0; ti < 6; ti++) html += '<td class="w2ui-day-empty">&#160;</td>';
                    ci += 6;
                } else {
                    if (ci < weekDay || day > daysCount[month-1]) {
                        html += '<td class="w2ui-day-empty">&#160;</td>';
                        if ((ci) % 7 === 0) html += '</tr><tr>';
                        continue;
                    }
                }
                var dt  = year + '/' + month + '/' + day;
                var DT  = new Date(dt);
                var className = '';
                if (DT.getDay() === 6) className  = ' w2ui-saturday';
                if (DT.getDay() === 0) className  = ' w2ui-sunday';
                if (dt == today) className += ' w2ui-today';

                var dspDay  = day;
                var col     = '';
                var bgcol   = '';
                var tmp_dt, tmp_dt_fmt;
                if(this.type === 'datetime') {
                    // var fm = options.format.split('|')[0].trim();
                    // tmp_dt      = w2utils.formatDate(dt, fm);
                    tmp_dt      = w2utils.formatDateTime(dt, options.format);
                    tmp_dt_fmt  = w2utils.formatDate(dt, w2utils.settings.dateFormat);
                } else {
                    tmp_dt      = w2utils.formatDate(dt, options.format);
                    tmp_dt_fmt  = tmp_dt;
                }
                if (options.colored && options.colored[tmp_dt_fmt] !== undefined) { // if there is predefined colors for dates
                    var tmp = options.colored[tmp_dt_fmt].split(':');
                    bgcol   = 'background-color: ' + tmp[0] + ';';
                    col     = 'color: ' + tmp[1] + ';';
                }
                html += '<td class="'+ (this.inRange(tmp_dt, true) ? 'w2ui-date ' + (tmp_dt_fmt == selected ? 'w2ui-date-selected' : '') : 'w2ui-blocked') + className + '" '+
                        '   style="'+ col + bgcol + '" date="'+ tmp_dt +'" data-date="'+ DT +'">'+
                            dspDay +
                        '</td>';
                if (ci % 7 === 0 || (weekDay === 0 && ci == 1)) html += '</tr><tr>';
                day++;
            }
            html += '</tr></tbody></table>';
            return html;
        },

        getYearHTML: function () {
            var months = w2utils.settings.shortmonths;
            var start_year = w2utils.settings.dateStartYear;
            var end_year = w2utils.settings.dateEndYear;
            var mhtml  = '';
            var yhtml  = '';
            for (var m = 0; m < months.length; m++) {
                mhtml += '<div class="w2ui-jump-month" name="'+ m +'">'+ months[m] + '</div>';
            }
            for (var y = start_year; y <= end_year; y++) {
                yhtml += '<div class="w2ui-jump-year" name="'+ y +'">'+ y + '</div>';
            }
            return '<div>'+ mhtml +'</div><div>'+ yhtml +'</div>';
        },

        getHourHTML: function () {
            var tmp = [];
            var options = this.options;
            if (options == null) options = { format: w2utils.settings.timeFormat };
            var h24 = (options.format.indexOf('h24') > -1);
            for (var a = 0; a < 24; a++) {
                var time = (a >= 12 && !h24 ? a - 12 : a) + ':00' + (!h24 ? (a < 12 ? ' am' : ' pm') : '');
                if (a == 12 && !h24) time = '12:00 pm';
                if (!tmp[Math.floor(a/8)]) tmp[Math.floor(a/8)] = '';
                var tm1 = this.fromMin(this.toMin(time));
                var tm2 = this.fromMin(this.toMin(time) + 59);
                if (this.type === 'datetime') {
                    var dt = w2utils.isDateTime(this.el.value, options.format, true);
                    var fm = options.format.split('|')[0].trim();
                    tm1 = w2utils.formatDate(dt, fm) + ' ' + tm1;
                    tm2 = w2utils.formatDate(dt, fm) + ' ' + tm2;
                }
                tmp[Math.floor(a/8)] += '<div class="'+ (this.inRange(tm1) || this.inRange(tm2) ? 'w2ui-time ' : 'w2ui-blocked') + '" hour="'+ a +'">'+ time +'</div>';
            }
            var html =
                '<div class="w2ui-calendar">'+
                '   <div class="w2ui-calendar-title">'+ w2utils.lang('Select Hour') +'</div>'+
                '   <div class="w2ui-calendar-time"><table><tbody><tr>'+
                '       <td>'+ tmp[0] +'</td>' +
                '       <td>'+ tmp[1] +'</td>' +
                '       <td>'+ tmp[2] +'</td>' +
                '   </tr></tbody></table></div>'+
                '</div>';
            return html;
        },

        getMinHTML: function (hour) {
            if (hour == null) hour = 0;
            var options = this.options;
            if (options == null) options = { format: w2utils.settings.timeFormat };
            var h24 = (options.format.indexOf('h24') > -1);
            var tmp = [];
            for (var a = 0; a < 60; a += 5) {
                var time = (hour > 12 && !h24 ? hour - 12 : hour) + ':' + (a < 10 ? 0 : '') + a + ' ' + (!h24 ? (hour < 12 ? 'am' : 'pm') : '');
                var tm   = time;
                var ind  = a < 20 ? 0 : (a < 40 ? 1 : 2);
                if (!tmp[ind]) tmp[ind] = '';
                if (this.type === 'datetime') {
                    var dt = w2utils.isDateTime(this.el.value, options.format, true);
                    var fm = options.format.split('|')[0].trim();
                    tm = w2utils.formatDate(dt, fm) + ' ' + tm;
                }
                tmp[ind] += '<div class="'+ (this.inRange(tm) ? 'w2ui-time ' : 'w2ui-blocked') + '" min="'+ a +'">'+ time +'</div>';
            }
            var html =
                '<div class="w2ui-calendar">'+
                '   <div class="w2ui-calendar-title">'+ w2utils.lang('Select Minute') +'</div>'+
                '   <div class="w2ui-calendar-time"><table><tbody><tr>'+
                '       <td>'+ tmp[0] +'</td>' +
                '       <td>'+ tmp[1] +'</td>' +
                '       <td>'+ tmp[2] +'</td>' +
                '   </tr></tbody></table></div>'+
                '</div>';
            return html;
        },

        toMin: function (str) {
            if (typeof str != 'string') return null;
            var tmp = str.split(':');
            if (tmp.length === 2) {
                tmp[0] = parseInt(tmp[0]);
                tmp[1] = parseInt(tmp[1]);
                if (str.indexOf('pm') != -1 && tmp[0] != 12) tmp[0] += 12;
            } else {
                return null;
            }
            return tmp[0] * 60 + tmp[1];
        },

        fromMin: function (time) {
            var ret = '';
            if (time >= 24 * 60) time = time % (24 * 60);
            if (time < 0) time = 24 * 60 + time;
            var hour = Math.floor(time/60);
            var min  = ((time % 60) < 10 ? '0' : '') + (time % 60);
            var options = this.options;
            if (options == null) options = { format: w2utils.settings.timeFormat };
            if (options.format.indexOf('h24') != -1) {
                ret = hour + ':' + min;
            } else {
                ret = (hour <= 12 ? hour : hour - 12) + ':' + min + ' ' + (hour >= 12 ? 'pm' : 'am');
            }
            return ret;
        }
    };

    $.extend(w2field.prototype, w2utils.event);
    w2obj.field = w2field;

}) (jQuery);

/************************************************************************
*   Library: Web 2.0 UI for jQuery (using prototypical inheritance)
*   - Following objects defined
*        - w2form      - form widget
*        - $().w2form  - jQuery wrapper
*   - Dependencies: jQuery, w2utils, w2fields, w2tabs, w2toolbar
*
* == NICE TO HAVE ==
*   - include delta on save
*   - form should read <select> <options> into items
*   - two way data bindings
*   - verify validation of fields
*   - added getChanges() - not complete
*   - nested record object
*   - formHTML --> template
*
* == 1.5 changes
*   - $('#form').w2form() - if called w/o argument then it returns form object
*   - added onProgress
*   - added field.html.style (for the whole field)
*   - added enable/disable, show/hide
*   - added field.disabled, field.hidden
*   - when field is blank, set record.field = null
*   - action: { caption: 'Limpiar', style: '', class: '', onClick: function () {} }
*   - added ability to generate radio and select html in generateHTML()
*   - refresh(field) - would refresh only one field
*   - form.message
*   - added field.html.column
*   - added field types html, empty, custom
*   - httpHeaders
*   - method
*
************************************************************************/


(function ($) {
    var w2form = function(options) {
        // public properties
        this.name        = null;
        this.header      = '';
        this.box         = null;     // HTML element that hold this element
        this.url         = '';
        this.routeData   = {};       // data for dynamic routes
        this.formURL     = '';       // url where to get form HTML
        this.formHTML    = '';       // form HTML (might be loaded from the url)
        this.page        = 0;        // current page
        this.recid       = 0;        // can be null or 0
        this.fields      = [];
        this.actions     = {};
        this.record      = {};
        this.original    = {};
        this.postData    = {};
        this.httpHeaders = {};
        this.method      = null;     // only used when not null, otherwise set based on w2utils.settings.dataType
        this.toolbar     = {};       // if not empty, then it is toolbar
        this.tabs        = {};       // if not empty, then it is tabs object
        this.style       = '';
        this.focus       = 0;        // focus first or other element

        // internal
        this.isGenerated = false;
        this.last = {
            xhr: null        // jquery xhr requests
        };

        $.extend(true, this, w2obj.form, options);
    };

    // ====================================================
    // -- Registers as a jQuery plugin

    $.fn.w2form = function(method) {
        if ($.isPlainObject(method)) {
            var obj = this;
            // check name parameter
            if (!w2utils.checkName(method, 'w2form')) return;
            // remember items
            var record   = method.record;
            var original = method.original;
            var fields   = method.fields;
            var toolbar  = method.toolbar;
            var tabs     = method.tabs;
            // extend items
            var object = new w2form(method);
            $.extend(object, { record: {}, original: {}, fields: [], tabs: {}, toolbar: {}, handlers: [] });
            if ($.isArray(tabs)) {
                $.extend(true, object.tabs, { tabs: [] });
                for (var t = 0; t < tabs.length; t++) {
                    var tmp = tabs[t];
                    if (typeof tmp === 'object') {
                        object.tabs.tabs.push(tmp);
                        if(tmp.active === true) {
                            object.tabs.active = tmp.id;
                        }
                    } else {
                        object.tabs.tabs.push({ id: tmp, caption: tmp });
                    }
                }
            } else {
                $.extend(true, object.tabs, tabs);
            }
            $.extend(true, object.toolbar, toolbar);
            // reassign variables
            if (fields) for (var p = 0; p < fields.length; p++) {
                var field = $.extend(true, {}, fields[p]);
                if (field.name == null && field.field != null) field.name = field.field;
                if (field.field == null && field.name != null) field.field = field.name;
                object.fields[p] = field;
            }
            for (var p in record) { // it is an object
                if ($.isPlainObject(record[p])) {
                    object.record[p] = $.extend(true, {}, record[p]);
                } else {
                    object.record[p] = record[p];
                }
            }
            for (var p in original) { // it is an object
                if ($.isPlainObject(original[p])) {
                    object.original[p] = $.extend(true, {}, original[p]);
                } else {
                    object.original[p] = original[p];
                }
            }
            if (obj.length > 0) object.box = obj[0];
            // render if necessary
            if (object.formURL !== '') {
                $.get(object.formURL, function (data) { // should always be $.get as it is template
                    object.formHTML = data;
                    object.isGenerated = true;
                    if ($(object.box).length !== 0 || data.length !== 0) {
                        $(object.box).html(data);
                        object.render(object.box);
                    }
                });
            } else if (object.formHTML !== '') {
                // it is already loaded into formHTML
            } else if ($(this).length !== 0 && $.trim($(this).html()) !== '') {
                object.formHTML = $(this).html();
            }  else { // try to generate it
                object.formHTML = object.generateHTML();
            }
            // register new object
            w2ui[object.name] = object;
            // render if not loaded from url
            if (object.formURL === '') {
                if (String(object.formHTML).indexOf('w2ui-page') == -1) {
                    object.formHTML = '<div class="w2ui-page page-0">'+ object.formHTML +'</div>';
                }
                $(object.box).html(object.formHTML);
                object.isGenerated = true;
                object.render(object.box);
            }
            return object;

        } else {
            var obj = w2ui[$(this).attr('name')];
            if (!obj) return null;
            if (arguments.length > 0) {
                if (obj[method]) obj[method].apply(obj, Array.prototype.slice.call(arguments, 1));
                return this;
            } else {
                return obj;
            }
        }
    };

    // ====================================================
    // -- Implementation of core functionality

    w2form.prototype = {
        // events
        onRequest     : null,
        onLoad        : null,
        onValidate    : null,
        onSubmit      : null,
        onProgress    : null,
        onSave        : null,
        onChange      : null,
        onRender      : null,
        onRefresh     : null,
        onResize      : null,
        onDestroy     : null,
        onAction      : null,
        onToolbar     : null,
        onError       : null,

        msgNotJSON    : 'Returned data is not in valid JSON format.',
        msgAJAXerror  : 'AJAX error. See console for more details.',
        msgRefresh    : 'Refreshing...',
        msgSaving     : 'Saving...',

        get: function (field, returnIndex) {
            if (arguments.length === 0) {
                var all = [];
                for (var f1 = 0; f1 < this.fields.length; f1++) {
                    if (this.fields[f1].name != null) all.push(this.fields[f1].name);
                }
                return all;
            } else {
                for (var f2 = 0; f2 < this.fields.length; f2++) {
                    if (this.fields[f2].name == field) {
                        if (returnIndex === true) return f2; else return this.fields[f2];
                    }
                }
                return null;
            }
        },

        set: function (field, obj) {
            for (var f = 0; f < this.fields.length; f++) {
                if (this.fields[f].name == field) {
                    $.extend(this.fields[f] , obj);
                    this.refresh();
                    return true;
                }
            }
            return false;
        },

        show: function () {
            var affected = 0;
            for (var a = 0; a < arguments.length; a++) {
                var fld = this.get(arguments[a]);
                if (fld && fld.hidden) {
                    fld.hidden = false;
                    affected++;
                }
            }
            if (affected > 0) this.refresh();
            return affected;
        },

        hide: function () {
            var affected = 0;
            for (var a = 0; a < arguments.length; a++) {
                var fld = this.get(arguments[a]);
                if (fld && !fld.hidden) {
                    fld.hidden = true;
                    affected++;
                }
            }
            if (affected > 0) this.refresh();
            return affected;
        },

        enable: function () {
            var affected = 0;
            for (var a = 0; a < arguments.length; a++) {
                var fld = this.get(arguments[a]);
                if (fld && fld.disabled) {
                    fld.disabled = false;
                    affected++;
                }
            }
            if (affected > 0) this.refresh();
            return affected;
        },

        disable: function () {
            var affected = 0;
            for (var a = 0; a < arguments.length; a++) {
                var fld = this.get(arguments[a]);
                if (fld && !fld.disabled) {
                    fld.disabled = true;
                    affected++;
                }
            }
            if (affected > 0) this.refresh();
            return affected;
        },

        reload: function (callBack) {
            var url = (typeof this.url != 'object' ? this.url : this.url.get);
            if (url && this.recid !== 0 && this.recid != null) {
                // this.clear();
                this.request(callBack);
            } else {
                // this.refresh(); // no need to refresh
                if (typeof callBack == 'function') callBack();
            }
        },

        clear: function () {
            this.recid  = 0;
            this.record = {};
            $().w2tag();
            this.refresh();
        },

        error: function (msg) {
            var obj = this;
            // let the management of the error outside of the grid
            var edata = this.trigger({ target: this.name, type: 'error', message: msg , xhr: this.last.xhr });
            if (edata.isCancelled === true) {
                if (typeof callBack == 'function') callBack();
                return;
            }
            // need a time out because message might be already up)
            setTimeout(function () { obj.message(msg); }, 1);
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        message: function(options) {
            if (typeof options == 'string') {
                options = {
                    width   : (options.length < 300 ? 350 : 550),
                    height  : (options.length < 300 ? 170: 250),
                    body    : '<div class="w2ui-centered">' + options + '</div>',
                    buttons : '<button class="w2ui-btn" onclick="w2ui[\''+ this.name +'\'].message()">Ok</button>',
                    onOpen  : function (event) {
                        setTimeout(function () {
                            $(event.box).find('.w2ui-btn').focus();
                        }, 25);
                    }
                };
            }
            w2utils.message.call(this, {
                box   : this.box,
                path  : 'w2ui.' + this.name,
                title : '.w2ui-form-header:visible',
                body  : '.w2ui-form-box'
            }, options);
        },

        validate: function (showErrors) {
            if (showErrors == null) showErrors = true;
            $().w2tag(); // hide all tags before validating
            // validate before saving
            var errors = [];
            for (var f = 0; f < this.fields.length; f++) {
                var field = this.fields[f];
                if (this.record[field.name] == null) this.record[field.name] = '';
                switch (field.type) {
                    case 'int':
                        if (this.record[field.name] && !w2utils.isInt(this.record[field.name])) {
                            errors.push({ field: field, error: w2utils.lang('Not an integer') });
                        }
                        break;
                    case 'float':
                        if (this.record[field.name] && !w2utils.isFloat(this.record[field.name])) {
                            errors.push({ field: field, error: w2utils.lang('Not a float') });
                        }
                        break;
                    case 'money':
                        if (this.record[field.name] && !w2utils.isMoney(this.record[field.name])) {
                            errors.push({ field: field, error: w2utils.lang('Not in money format') });
                        }
                        break;
                    case 'color':
                    case 'hex':
                        if (this.record[field.name] && !w2utils.isHex(this.record[field.name])) {
                            errors.push({ field: field, error: w2utils.lang('Not a hex number') });
                        }
                        break;
                    case 'email':
                        if (this.record[field.name] && !w2utils.isEmail(this.record[field.name])) {
                            errors.push({ field: field, error: w2utils.lang('Not a valid email') });
                        }
                        break;
                    case 'checkbox':
                        // convert true/false
                        if (this.record[field.name] == true) this.record[field.name] = 1; else this.record[field.name] = 0;
                        break;
                    case 'date':
                        // format date before submit
                        if (!field.options.format) field.options.format = w2utils.settings.dateFormat;
                        if (this.record[field.name] && !w2utils.isDate(this.record[field.name], field.options.format)) {
                            errors.push({ field: field, error: w2utils.lang('Not a valid date') + ': ' + field.options.format });
                        } else {
                        }
                        break;
                    case 'list':
                    case 'combo':
                        break;
                    case 'enum':
                        break;
                }
                // === check required - if field is '0' it should be considered not empty
                var val = this.record[field.name];
                if (field.required && (val === '' || ($.isArray(val) && val.length === 0) || ($.isPlainObject(val) && $.isEmptyObject(val)))) {
                    errors.push({ field: field, error: w2utils.lang('Required field') });
                }
                if (field.equalto && this.record[field.name] != this.record[field.equalto]) {
                    errors.push({ field: field, error: w2utils.lang('Field should be equal to ') + field.equalto });
                }
            }
            // event before
            var edata = this.trigger({ phase: 'before', target: this.name, type: 'validate', errors: errors });
            if (edata.isCancelled === true) return;
            // show error
            if (showErrors) {
                for (var e = 0; e < edata.errors.length; e++) {
                    var err = edata.errors[e];
                    if (err.field == null) continue;
                    if (err.field.type == 'radio') { // for radio and checkboxes
                        $($(err.field.el).parents('div')[0]).w2tag(err.error, { "class": 'w2ui-error' });
                    } else if (['enum', 'file'].indexOf(err.field.type) != -1) {
                        (function (err) {
                            setTimeout(function () {
                                var fld = $(err.field.el).data('w2field').helpers.multi;
                                $(err.field.el).w2tag(err.error);
                                $(fld).addClass('w2ui-error');
                            }, 1);
                        })(err);
                    } else {
                        $(err.field.el).w2tag(err.error, { "class": 'w2ui-error' });
                    }
                    this.goto(errors[0].field.page);
                }
            }
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            return errors;
        },

        getChanges: function () {
            var differ = function(record, original, result) {
                for (var i in record) {
                    if (typeof record[i] == "object") {
                        result[i] = differ(record[i], original[i] || {}, {});
                        if (!result[i] || $.isEmptyObject(result[i])) delete result[i];
                    } else if (record[i] != original[i]) {
                        result[i] = record[i];
                    }
                }
                return result;
            };
            return differ(this.record, this.original, {});
        },

        request: function (postData, callBack) { // if (1) param then it is call back if (2) then postData and callBack
            var obj = this;
            // check for multiple params
            if (typeof postData == 'function') {
                callBack = postData;
                postData = null;
            }
            if (postData == null) postData = {};
            if (!this.url || (typeof this.url == 'object' && !this.url.get)) return;
            if (this.recid == null) this.recid = 0;
            // build parameters list
            var params = {};
            // add list params
            params['cmd']   = 'get';
            params['recid'] = this.recid;
            params['name']  = this.name;
            // append other params
            $.extend(params, this.postData);
            $.extend(params, postData);
            // event before
            var edata = this.trigger({ phase: 'before', type: 'request', target: this.name, url: this.url, postData: params, httpHeaders: this.httpHeaders });
            if (edata.isCancelled === true) { if (typeof callBack == 'function') callBack({ status: 'error', message: 'Request aborted.' }); return; }
            // default action
            this.record   = {};
            this.original = {};
            // call server to get data
            this.lock(w2utils.lang(this.msgRefresh));
            var url = edata.url;
            if (typeof edata.url == 'object' && edata.url.get) url = edata.url.get;
            if (this.last.xhr) try { this.last.xhr.abort(); } catch (e) {}
            // process url with routeData
            if (!$.isEmptyObject(obj.routeData)) {
                var info  = w2utils.parseRoute(url);
                if (info.keys.length > 0) {
                    for (var k = 0; k < info.keys.length; k++) {
                        if (obj.routeData[info.keys[k].name] == null) continue;
                        url = url.replace((new RegExp(':'+ info.keys[k].name, 'g')), obj.routeData[info.keys[k].name]);
                    }
                }
            }
            var ajaxOptions = {
                type     : 'POST',
                url      : url,
                data     : edata.postData,
                headers  : edata.httpHeaders,
                dataType : 'text'   // expected from server
            }
            switch (w2utils.settings.dataType) {
                case 'HTTP':
                    ajaxOptions.data = String($.param(ajaxOptions.data, false)).replace(/%5B/g, '[').replace(/%5D/g, ']');
                    break
                case 'HTTPJSON':
                    ajaxOptions.data = { request: JSON.stringify(ajaxOptions.data) };
                    break;
                case 'RESTFULL':
                    ajaxOptions.type = 'GET';
                    ajaxOptions.data = String($.param(ajaxOptions.data, false)).replace(/%5B/g, '[').replace(/%5D/g, ']');
                    break;
                case 'RESTFULLJSON':
                    ajaxOptions.type = 'GET';
                    ajaxOptions.data        = JSON.stringify(ajaxOptions.data);
                    ajaxOptions.contentType = 'application/json';
                    break;
                case 'JSON':
                    ajaxOptions.type        = 'POST';
                    ajaxOptions.data        = JSON.stringify(ajaxOptions.data);
                    ajaxOptions.contentType = 'application/json';
                    break;
            }
            if (this.method) ajaxOptions.type = this.method;
            this.last.xhr = $.ajax(ajaxOptions)
                .done(function (data, status, xhr) {
                    obj.unlock();
                    // event before
                    var edata = obj.trigger({ phase: 'before', target: obj.name, type: 'load', xhr: xhr });
                    if (edata.isCancelled === true) {
                        if (typeof callBack == 'function') callBack({ status: 'error', message: 'Request aborted.' });
                        return;
                    }
                    // parse server response
                    var data;
                    var responseText = obj.last.xhr.responseText;
                    if (status != 'error') {
                        // default action
                        if (responseText != null && responseText !== '') {
                            // check if the onLoad handler has not already parsed the data
                            if (typeof responseText == "object") {
                                data = responseText;
                            } else {
                                // $.parseJSON or $.getJSON did not work because those expect perfect JSON data - where everything is in double quotes
                                //
                                // TODO: avoid (potentially malicious) code injection from the response.
                                try { eval('data = '+ responseText); } catch (e) { }
                            }
                            if (data == null) {
                                data = {
                                    status       : 'error',
                                    message      : w2utils.lang(obj.msgNotJSON),
                                    responseText : responseText
                                };
                            }
                            if (data['status'] == 'error') {
                                obj.error(w2utils.lang(data['message']));
                            } else {
                                obj.record   = $.extend({}, data.record);
                                obj.original = $.extend({}, data.record);
                            }
                        }
                    } else {
                        obj.error('AJAX Error ' + xhr.status + ': '+ xhr.statusText);
                        data = {
                            status       : 'error',
                            message      : w2utils.lang(obj.msgAJAXerror),
                            responseText : responseText
                        };
                    }
                    // event after
                    obj.trigger($.extend(edata, { phase: 'after' }));
                    obj.refresh();
                    // call back
                    if (typeof callBack == 'function') callBack(data);
                })
                .fail(function (xhr, status, error) {
                    // trigger event
                    var errorObj = { status: status, error: error, rawResponseText: xhr.responseText };
                    var edata2 = obj.trigger({ phase: 'before', type: 'error', error: errorObj, xhr: xhr });
                    if (edata2.isCancelled === true) return;
                    // default behavior
                    if (status != 'abort') {
                        var data;
                        try { data = $.parseJSON(xhr.responseText); } catch (e) {}
                        console.log('ERROR: Server communication failed.',
                            '\n   EXPECTED:', { status: 'success', items: [{ id: 1, text: 'item' }] },
                            '\n         OR:', { status: 'error', message: 'error message' },
                            '\n   RECEIVED:', typeof data == 'object' ? data : xhr.responseText);
                    }
                    // event after
                    obj.trigger($.extend(edata2, { phase: 'after' }));
                });
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        submit: function (postData, callBack) {
            return this.save(postData, callBack);
        },

        save: function (postData, callBack) {
            var obj = this;
            $(this.box).find(':focus').change(); // trigger onchange
            // check for multiple params
            if (typeof postData == 'function') {
                callBack = postData;
                postData = null;
            }
            // validation
            var errors = obj.validate(true);
            if (errors.length !== 0) return;
            // submit save
            if (postData == null) postData = {};
            if (!obj.url || (typeof obj.url == 'object' && !obj.url.save)) {
                console.log("ERROR: Form cannot be saved because no url is defined.");
                return;
            }
            obj.lock(w2utils.lang(obj.msgSaving) + ' <span id="'+ obj.name +'_progress"></span>');
            // need timer to allow to lock
            setTimeout(function () {
                // build parameters list
                var params = {};
                // add list params
                params['cmd']   = 'save';
                params['recid'] = obj.recid;
                params['name']  = obj.name;
                // append other params
                $.extend(params, obj.postData);
                $.extend(params, postData);
                // clear up files
                obj.fields.forEach(function (item) {
                    if (item.type == 'file' && Array.isArray(obj.record[item.field])) {
                        obj.record[item.field].forEach(function (fitem) {
                            delete fitem.file;
                        });
                    }
                });
                params.record = $.extend(true, {}, obj.record);
                // event before
                var edata = obj.trigger({ phase: 'before', type: 'submit', target: obj.name, url: obj.url, postData: params, httpHeaders: obj.httpHeaders });
                if (edata.isCancelled === true) return;
                // default action
                var url = edata.url;
                if (typeof edata.url == 'object' && edata.url.save) url = edata.url.save;
                if (obj.last.xhr) try { obj.last.xhr.abort(); } catch (e) {}
                // process url with routeData
                if (!$.isEmptyObject(obj.routeData)) {
                    var info  = w2utils.parseRoute(url);
                    if (info.keys.length > 0) {
                        for (var k = 0; k < info.keys.length; k++) {
                            if (obj.routeData[info.keys[k].name] == null) continue;
                            url = url.replace((new RegExp(':'+ info.keys[k].name, 'g')), obj.routeData[info.keys[k].name]);
                        }
                    }
                }
                var ajaxOptions = {
                    type     : 'POST',
                    url      : url,
                    data     : edata.postData,
                    headers  : edata.httpHeaders,
                    dataType : 'text',   // expected from server
                    xhr : function() {
                        var xhr = new window.XMLHttpRequest();
                        // upload
                        xhr.upload.addEventListener("progress", function(evt) {
                            if (evt.lengthComputable) {
                                var edata3 = obj.trigger({ phase: 'before', type: 'progress', total: evt.total, loaded: evt.loaded, originalEvent: evt });
                                if (edata3.isCancelled === true) return;
                                // default behavior
                                var percent = Math.round(evt.loaded / evt.total * 100);
                                $('#'+ obj.name + '_progress').text(''+ percent + '%');
                                // event after
                                obj.trigger($.extend(edata3, { phase: 'after' }));
                            }
                        }, false);
                        return xhr;
                    }
                };
                switch (w2utils.settings.dataType) {
                    case 'HTTP':
                        ajaxOptions.data = String($.param(ajaxOptions.data, false)).replace(/%5B/g, '[').replace(/%5D/g, ']');
                        break;
                    case 'HTTPJSON':
                        ajaxOptions.data = { request: JSON.stringify(ajaxOptions.data) };
                        break;
                    case 'RESTFULL':
                        if (obj.recid !== 0 && obj.recid != null) ajaxOptions.type = 'PUT';
                        ajaxOptions.data = String($.param(ajaxOptions.data, false)).replace(/%5B/g, '[').replace(/%5D/g, ']');
                        break;
                    case 'RESTFULLJSON':
                        if (obj.recid !== 0 && obj.recid != null) ajaxOptions.type = 'PUT';
                        ajaxOptions.data        = JSON.stringify(ajaxOptions.data);
                        ajaxOptions.contentType = 'application/json';
                        break;
                    case 'JSON':
                        ajaxOptions.type        = 'POST';
                        ajaxOptions.data        = JSON.stringify(ajaxOptions.data);
                        ajaxOptions.contentType = 'application/json';
                        break;
                }
                if (this.method) ajaxOptions.type = this.method;
                obj.last.xhr = $.ajax(ajaxOptions)
                    .done(function (data, status, xhr) {
                        obj.unlock();
                        // event before
                        var edata = obj.trigger({ phase: 'before', target: obj.name, type: 'save', xhr: xhr, status: status });
                        if (edata.isCancelled === true) return;
                        // parse server response
                        var data;
                        var responseText = xhr.responseText;
                        if (status != 'error') {
                            // default action
                            if (responseText != null && responseText !== '') {
                                // check if the onLoad handler has not already parsed the data
                                if (typeof responseText == "object") {
                                    data = responseText;
                                } else {
                                    // $.parseJSON or $.getJSON did not work because those expect perfect JSON data - where everything is in double quotes
                                    //
                                    // TODO: avoid (potentially malicious) code injection from the response.
                                    try { eval('data = '+ responseText); } catch (e) { }
                                }
                                if (data == null) {
                                    data = {
                                        status       : 'error',
                                        message      : w2utils.lang(obj.msgNotJSON),
                                        responseText : responseText
                                    };
                                }
                                if (data['status'] == 'error') {
                                    obj.error(w2utils.lang(data['message']));
                                } else {
                                    obj.original = $.extend({}, obj.record);
                                }
                            }
                        } else {
                            obj.error('AJAX Error ' + xhr.status + ': '+ xhr.statusText);
                            data = {
                                status       : 'error',
                                message      : w2utils.lang(obj.msgAJAXerror),
                                responseText : responseText
                            };
                        }
                        // event after
                        obj.trigger($.extend(edata, { phase: 'after' }));
                        obj.refresh();
                        // call back
                        if (data.status == 'success' && typeof callBack == 'function') callBack(data);
                    })
                    .fail(function (xhr, status, error) {
                        // trigger event
                        var errorObj = { status: status, error: error, rawResponseText: xhr.responseText };
                        var edata2 = obj.trigger({ phase: 'before', type: 'error', error: errorObj, xhr: xhr });
                        if (edata2.isCancelled === true) return;
                        // default behavior
                        console.log('ERROR: server communication failed. The server should return',
                            { status: 'success' }, 'OR', { status: 'error', message: 'error message' },
                            ', instead the AJAX request produced this: ', errorObj);
                        // event after
                        obj.trigger($.extend(edata2, { phase: 'after' }));
                    });
                // event after
                obj.trigger($.extend(edata, { phase: 'after' }));
            }, 50);
        },

        lock: function (msg, showSpinner) {
            var args = Array.prototype.slice.call(arguments, 0);
            args.unshift(this.box);
            setTimeout(function () { w2utils.lock.apply(window, args); }, 10);
        },

        unlock: function (speed) {
            var box = this.box;
            setTimeout(function () { w2utils.unlock(box, speed); }, 25); // needed timer so if server fast, it will not flash
        },

        goto: function (page) {
            if (this.page === page) return; // already on this page
            if (page != null) this.page = page;
            // if it was auto size, resize it
            if ($(this.box).data('auto-size') === true) $(this.box).height(0);
            this.refresh();
        },

        generateHTML: function () {
            var pages = []; // array for each page
            var group = '';
            var page;
            var column;
            var html;
            for (var f = 0; f < this.fields.length; f++) {
                html = '';
                var field = this.fields[f];
                if (field.html == null) field.html = {};
                if (field.options == null) field.options = {};
                field.html = $.extend(true, { caption: '', span: 6, attr: '', text: '', style: '', page: 0, column: 0 }, field.html);
                if (page == null) page = field.html.page;
                if (column == null) column = field.html.column;
                if (field.html.caption === '') field.html.caption = field.name;
                // input control
                var input = '<input name="'+ field.name +'" class="w2ui-input" type="text" '+ field.html.attr +' tabindex="'+ (f+1) +'"/>';
                switch (field.type) {
                    case 'pass':
                    case 'password':
                        input = '<input name="' + field.name + '" class="w2ui-input" type = "password" ' + field.html.attr + ' tabindex="'+ (f+1) +'"/>';
                        break;
                    case 'checkbox':
                        input = '<input name="'+ field.name +'" class="w2ui-input" type="checkbox" '+ field.html.attr +' tabindex="'+ (f+1) +'"/>';
                        break;
                    case 'radio':
                        input = '';
                        // normalized options
                        var items =  field.options.items ? field.options.items : field.html.items;
                        if (!$.isArray(items)) items = [];
                        if (items.length > 0) {
                            items = w2obj.field.prototype.normMenu(items);
                        }
                        // generate
                        for (var i = 0; i < items.length; i++) {
                            input += '<label><input name="' + field.name + '" class="w2ui-input" type = "radio" ' + field.html.attr + ' value="'+ items[i].id + '"/>' +
                                '&#160;' + items[i].text + '</label><br/>';
                        }
                        break;
                    case 'select':
                        input = '<select name="' + field.name + '" class="w2ui-input" ' + field.html.attr + ' tabindex="'+ (f+1) +'">';
                        // normalized options
                        var items =  field.options.items ? field.options.items : field.html.items;
                        if (!$.isArray(items)) items = [];
                        if (items.length > 0) {
                            items = w2obj.field.prototype.normMenu(items);
                        }
                        // generate
                        for (var i = 0; i < items.length; i++) {
                            input += '<option value="'+ items[i].id + '">' + items[i].text + '</option>';
                        }
                        input += '</select>';
                        break;
                    case 'textarea':
                        input = '<textarea name="'+ field.name +'" class="w2ui-input" '+ field.html.attr +' tabindex="'+ (f+1) +'"></textarea>';
                        break;
                    case 'toggle':
                        input = '<input name="'+ field.name +'" type="checkbox" '+ field.html.attr +' class="w2ui-input w2ui-toggle" tabindex="'+ (f+1) +'"/><div><div></div></div>';
                        break;
                    case 'html':
                    case 'custom':
                    case 'empty':
                        input = '';
                        break;

                }
                if (group !== ''){
                    if(page != field.html.page || column != field.html.column || (field.html.group && (group != field.html.group))){
                       pages[page][column]  += '\n   </div>';
                       group = '';
                    }
                }
                if (field.html.group && (group != field.html.group)) {
                    html += '\n   <div class="w2ui-group-title">'+ field.html.group + '</div>\n   <div class="w2ui-group">';
                    group = field.html.group;
                }
                html += '\n      <div class="w2ui-field '+ (field.html.span != null ? 'w2ui-span'+ field.html.span : '') +'" style="'+ field.html.style +'">'+
                        '\n         <label>' + w2utils.lang(field.html.caption) +'</label>'+
                        '\n         <div>'+ input + w2utils.lang(field.html.text) + '</div>'+
                        '\n      </div>';
                if (pages[field.html.page] == null) pages[field.html.page] = [];
                if (pages[field.html.page][field.html.column] == null) pages[field.html.page][field.html.column] = '';
                pages[field.html.page][field.html.column] += html;
                page = field.html.page;
                column = field.html.column;
            }
            if (group !== '') pages[page][column] += '\n   </div>';
            if (this.tabs.tabs) {
                for (var i = 0; i < this.tabs.tabs.length; i++) if (pages[i] == null) pages[i] = [];
            }
            // buttons if any
            var buttons = '';
            if (!$.isEmptyObject(this.actions)) {
                var addClass = '';
                buttons += '\n<div class="w2ui-buttons">';
                for (var a in this.actions) { // it is an object
                    var act  = this.actions[a];
                    var info = { caption: '', style: '', "class": '' };
                    if ($.isPlainObject(act)) {
                        if (act.caption) info.caption = act.caption;
                        if (act.style) info.style = act.style;
                        if (act["class"]) info['class'] = act['class'];
                    } else {
                        info.caption = a;
                        if (['save', 'update', 'create'].indexOf(a.toLowerCase()) != -1) info['class'] = 'w2ui-btn-blue'; else info['class'] = '';
                    }
                    buttons += '\n    <button name="'+ a +'" class="w2ui-btn '+ info['class'] +'" style="'+ info.style +'">'+
                                            w2utils.lang(info.caption) +'</button>';
                }
                buttons += '\n</div>';
            }
            html = '';
            for (var p = 0; p < pages.length; p++){
                html += '<div class="w2ui-page page-'+ p +'" ' + ((p===0)?'':'style="display: none;"') + '><div class="w2ui-column-container" style="display: flex;">';
                for (var c = 0; c < pages[p].length; c++){
                    html += '<div class="w2ui-column col-'+ c +'">' + (pages[p][c] || '') + '\n</div>';
                }
                html += '\n</div></div>';
            }
            html += buttons;
            return html;
        },

        action: function (action, event) {
            var act   = this.actions[action];
            var click = act;
            if ($.isPlainObject(act) && act.onClick) click = act.onClick;
            // event before
            var edata = this.trigger({ phase: 'before', target: action, type: 'action', click: click, originalEvent: event });
            if (edata.isCancelled === true) return;
            // default actions
            if (typeof click == 'function') click.call(this, event);
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
        },

        resize: function () {
            var obj = this;
            // event before
            var edata = this.trigger({ phase: 'before', target: this.name, type: 'resize' });
            if (edata.isCancelled === true) return;
            // default behaviour
            var main    = $(this.box).find('> div.w2ui-form-box');
            var header  = $(this.box).find('> div .w2ui-form-header');
            var toolbar = $(this.box).find('> div .w2ui-form-toolbar');
            var tabs    = $(this.box).find('> div .w2ui-form-tabs');
            var page    = $(this.box).find('> div .w2ui-page');
            var cpage   = $(this.box).find('> div .w2ui-page.page-'+ this.page);
            var dpage   = $(this.box).find('> div .w2ui-page.page-'+ this.page + ' > div');
            var buttons = $(this.box).find('> div .w2ui-buttons');
            // if no height, calculate it
            resizeElements();
            if (parseInt($(this.box).height()) === 0 || $(this.box).data('auto-size') === true) {
                $(this.box).height(
                    (header.length > 0 ? w2utils.getSize(header, 'height') : 0) +
                    ((typeof this.tabs === 'object' && $.isArray(this.tabs.tabs) && this.tabs.tabs.length > 0) ? w2utils.getSize(tabs, 'height') : 0) +
                    ((typeof this.toolbar == 'object' && $.isArray(this.toolbar.items) && this.toolbar.items.length > 0) ? w2utils.getSize(toolbar, 'height') : 0) +
                    (page.length > 0 ? w2utils.getSize(dpage, 'height') + w2utils.getSize(cpage, '+height') + 12 : 0) +  // why 12 ???
                    (buttons.length > 0 ? w2utils.getSize(buttons, 'height') : 0)
                );
                $(this.box).data('auto-size', true);
            }
            resizeElements();
            if (this.toolbar && this.toolbar.resize) this.toolbar.resize();
            if (this.tabs && this.tabs.resize) this.tabs.resize();
            // event after
            obj.trigger($.extend(edata, { phase: 'after' }));

            function resizeElements() {
                // resize elements
                main.width($(obj.box).width()).height($(obj.box).height());
                toolbar.css('top', (obj.header !== '' ? w2utils.getSize(header, 'height') : 0));
                tabs.css('top', (obj.header !== '' ? w2utils.getSize(header, 'height') : 0)
                              + ((typeof obj.toolbar == 'object' && $.isArray(obj.toolbar.items) && obj.toolbar.items.length > 0) ? w2utils.getSize(toolbar, 'height') : 0));
                page.css('top', (obj.header !== '' ? w2utils.getSize(header, 'height') : 0)
                              + ((typeof obj.toolbar == 'object' && $.isArray(obj.toolbar.items) && obj.toolbar.items.length > 0) ? w2utils.getSize(toolbar, 'height') + 5 : 0)
                              + ((typeof obj.tabs === 'object' && $.isArray(obj.tabs.tabs) && obj.tabs.tabs.length > 0) ? w2utils.getSize(tabs, 'height') + 5 : 0));
                page.css('bottom', (buttons.length > 0 ? w2utils.getSize(buttons, 'height') : 0));
            }
        },

        refresh: function (field) {
            var time = (new Date()).getTime();
            var obj = this;
            if (!this.box) return;
            if (!this.isGenerated || $(this.box).html() == null) return;
            // event before
            var edata = this.trigger({ phase: 'before', target: this.name, type: 'refresh', page: this.page, field: field });
            if (edata.isCancelled === true) return;
            if (field != null) {
                var from_field = obj.get(field, true);
                var to_field = from_field + 1;
            } else {
                // update what page field belongs
                $(this.box).find('input, textarea, select').each(function (index, el) {
                    var name  = ($(el).attr('name') != null ? $(el).attr('name') : $(el).attr('id'));
                    var field = obj.get(name);
                    if (field) {
                        // find page
                        var div = $(el).parents('.w2ui-page');
                        if (div.length > 0) {
                            for (var i = 0; i < 100; i++) {
                                if (div.hasClass('page-'+i)) { field.page = i; break; }
                            }
                        }
                    }
                });
                // default action
                $(this.box).find('.w2ui-page').hide();
                $(this.box).find('.w2ui-page.page-' + this.page).show();
                $(this.box).find('.w2ui-form-header').html(this.header);
                // refresh tabs if needed
                if (typeof this.tabs === 'object' && $.isArray(this.tabs.tabs) && this.tabs.tabs.length > 0) {
                    $('#form_'+ this.name +'_tabs').show();
                    this.tabs.active = this.tabs.tabs[this.page].id;
                    this.tabs.refresh();
                } else {
                    $('#form_'+ this.name +'_tabs').hide();
                }
                // refresh tabs if needed
                if (typeof this.toolbar == 'object' && $.isArray(this.toolbar.items) && this.toolbar.items.length > 0) {
                    $('#form_'+ this.name +'_toolbar').show();
                    this.toolbar.refresh();
                } else {
                    $('#form_'+ this.name +'_toolbar').hide();
                }
                var from_field = 0;
                var to_field = this.fields.length;
            }
            // refresh values of fields
            for (var f = from_field; f < to_field; f++) {
                var field = this.fields[f];
                if (field.name == null && field.field != null) field.name = field.field;
                if (field.field == null && field.name != null) field.field = field.name;
                field.$el = $(this.box).find('[name="'+ String(field.name).replace(/\\/g, '\\\\') +'"]');
                field.el  = field.$el[0];
                if (field.el == null) {
                    console.log('ERROR: Cannot associate field "'+ field.name + '" with html control. Make sure html control exists with the same name.');
                    //return;
                }
                if (field.el) field.el.id = field.name;
                var tmp = $(field).data('w2field');
                if (tmp) tmp.clear();
                $(field.$el).off('change').on('change', function () {
                    var value_new      = this.value;
                    var value_previous = obj.record[this.name] != null ? obj.record[this.name] : '';
                    var field          = obj.get(this.name);
                    if (['list', 'enum', 'file'].indexOf(field.type) != -1 && $(this).data('selected')) {
                        var nv = $(this).data('selected');
                        var cv = obj.record[this.name];
                        if ($.isArray(nv)) {
                            value_new = [];
                            for (var i = 0; i < nv.length; i++) value_new[i] = $.extend(true, {}, nv[i]); // clone array
                        }
                        if ($.isPlainObject(nv)) {
                            value_new = $.extend(true, {}, nv); // clone object
                        }
                        if ($.isArray(cv)) {
                            value_previous = [];
                            for (var i = 0; i < cv.length; i++) value_previous[i] = $.extend(true, {}, cv[i]); // clone array
                        }
                        if ($.isPlainObject(cv)) {
                            value_previous = $.extend(true, {}, cv); // clone object
                        }
                    }
                    if (['toggle', 'checkbox'].indexOf(field.type) != -1) {
                        value_new = ($(this).prop('checked') ? ($(this).prop('value') == 'on' ? true : $(this).prop('value')) : false);
                    }
                    // clean extra chars
                    if (['int', 'float', 'percent', 'money', 'currency'].indexOf(field.type) != -1) {
                        value_new = $(this).data('w2field').clean(value_new);
                    }
                    if (value_new === value_previous) return;
                    // event before
                    var edata2 = obj.trigger({ phase: 'before', target: this.name, type: 'change', value_new: value_new, value_previous: value_previous });
                    if (edata2.isCancelled === true) {
                        $(this).val(obj.record[this.name]); // return previous value
                        return;
                    }
                    // default action
                    var val = this.value;
                    if (this.type == 'select')   val = this.value;
                    if (this.type == 'checkbox') val = this.checked ? true : false;
                    if (this.type == 'radio') {
                        field.$el.each(function (index, el) {
                            if (el.checked) val = el.value;
                        });
                    }
                    if (['int', 'float', 'percent', 'money', 'currency', 'list', 'combo', 'enum', 'file', 'toggle'].indexOf(field.type) != -1) {
                        val = value_new;
                    }
                    if (['enum', 'file'].indexOf(field.type) != -1) {
                        if (val.length > 0) {
                            var fld = $(field.el).data('w2field').helpers.multi;
                            $(fld).removeClass('w2ui-error');
                        }
                    }
                    if (val === '' || val == null || ($.isArray(val) && val.length === 0) || ($.isPlainObject(val) && $.isEmptyObject(val))) {
                        val = null;
                    }
                    obj.record[this.name] = val;
                    // event after
                    obj.trigger($.extend(edata2, { phase: 'after' }));
                });
                // required
                if (field.required) {
                    $(field.el).parent().parent().addClass('w2ui-required');
                } else {
                    $(field.el).parent().parent().removeClass('w2ui-required');
                }
                // disabled
                if (field.disabled != null) {
                    if (field.disabled) {
                        $(field.el).prop('readonly', true);
                    } else {
                        $(field.el).prop('readonly', false);
                    }
                }
                // hidden
                if (field.hidden) {
                    $(field.el).parent().parent().hide();
                } else {
                    $(field.el).parent().parent().show();
                }
            }
            // attach actions on buttons
            $(this.box).find('button, input[type=button]').each(function (index, el) {
                $(el).off('click').on('click', function (event) {
                    var action = this.value;
                    if (this.id)   action = this.id;
                    if (this.name) action = this.name;
                    obj.action(action, event);
                });
            });
            // init controls with record
            for (var f = from_field; f < to_field; f++) {
                var field = this.fields[f];
                var value = (this.record[field.name] != null ? this.record[field.name] : '');
                if (!field.el) continue;
                if (!$(field.el).hasClass('w2ui-input')) $(field.el).addClass('w2ui-input');
                field.type = String(field.type).toLowerCase();
                if (!field.options) field.options = {};
                switch (field.type) {
                    case 'text':
                    case 'textarea':
                    case 'email':
                    case 'pass':
                    case 'password':
                        field.el.value = value;
                        break;
                    case 'int':
                    case 'float':
                    case 'money':
                    case 'currency':
                    case 'percent':
                        // issue #761
                        field.el.value = value;
                        $(field.el).w2field($.extend({}, field.options, { type: field.type }));
                        break;
                    case 'hex':
                    case 'alphanumeric':
                    case 'color':
                    case 'date':
                    case 'time':
                        field.el.value = value;
                        $(field.el).w2field($.extend({}, field.options, { type: field.type }));
                        break;
                    case 'toggle':
                        if (w2utils.isFloat(value)) value = parseFloat(value);
                        $(field.el).prop('checked', (value ? true : false));
                        this.record[field.name] = (value ? value : false);
                        break;
                    // enums
                    case 'list':
                    case 'combo':
                        if (field.type == 'list') {
                            var tmp_value = ($.isPlainObject(value) ? value.id : ($.isPlainObject(field.options.selected) ? field.options.selected.id : value));
                            // normalized options
                            if (!field.options.items) field.options.items = [];
                            var items = field.options.items;
                            if ($.isArray(items) && items.length > 0 && !$.isPlainObject(items[0])) {
                                field.options.items = w2obj.field.prototype.normMenu(items);
                            }
                            // find value from items
                            for (var i = 0; i < field.options.items.length; i++) {
                                var item = field.options.items[i];
                                if (item.id == tmp_value) {
                                    value = $.extend(true, {}, item);
                                    obj.record[field.name] = value;
                                    break;
                                }
                            }
                        } else if (field.type == 'combo' && !$.isPlainObject(value)) {
                            field.el.value = value;
                        } else if ($.isPlainObject(value) && value.text != null) {
                            field.el.value = value.text;
                        } else {
                            field.el.value = '';
                        }
                        if (!$.isPlainObject(value)) value = {};
                        $(field.el).w2field($.extend({}, field.options, { type: field.type, selected: value }));
                        break;
                    case 'enum':
                    case 'file':
                        if (!$.isArray(value)) value = [];
                        $(field.el).w2field($.extend({}, field.options, { type: field.type, selected: value }));
                        break;

                    // standard HTML
                    case 'select':
                        // generate options
                        var items = field.options.items;
                        if (items != null && items.length > 0) {
                            items = w2obj.field.prototype.normMenu(items);
                            $(field.el).html('');
                            for (var it = 0; it < items.length; it++) {
                                $(field.el).append('<option value="'+ items[it].id +'">' + items[it].text + '</option');
                            }
                        }
                        $(field.el).val(value);
                        break;
                    case 'radio':
                        $(field.$el).prop('checked', false).each(function (index, el) {
                            if ($(el).val() == value) $(el).prop('checked', true);
                        });
                        break;
                    case 'checkbox':
                        $(field.el).prop('checked', value ? true : false);
                        break;
                    case 'html':
                    case 'custom':
                    case 'empty':
                        break;
                    default:
                        $(field.el).val(value);
                        $(field.el).w2field($.extend({}, field.options, { type: field.type }));
                        break;
                }
            }
            // wrap pages in div
            var tmp = $(this.box).find('.w2ui-page');
            for (var i = 0; i < tmp.length; i++) {
                if ($(tmp[i]).find('> *').length > 1) $(tmp[i]).wrapInner('<div></div>');
            }
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            this.resize();
            return (new Date()).getTime() - time;
        },

        render: function (box) {
            var time = (new Date()).getTime();
            var obj = this;
            if (typeof box == 'object') {
                // remove from previous box
                if ($(this.box).find('#form_'+ this.name +'_tabs').length > 0) {
                    $(this.box).removeAttr('name')
                        .removeClass('w2ui-reset w2ui-form')
                        .html('');
                }
                this.box = box;
            }
            if (!this.isGenerated) return;
            if (!this.box) return;
            // event before
            var edata = this.trigger({ phase: 'before', target: this.name, type: 'render', box: (box != null ? box : this.box) });
            if (edata.isCancelled === true) return;
            // default actions
            if ($.isEmptyObject(this.original) && !$.isEmptyObject(this.record)) {
                this.original = $.extend(true, {}, this.record);
            }
            var html =  '<div class="w2ui-form-box">' +
                        (this.header !== '' ? '<div class="w2ui-form-header">' + this.header + '</div>' : '') +
                        '    <div id="form_'+ this.name +'_toolbar" class="w2ui-form-toolbar" style="display: none"></div>' +
                        '    <div id="form_'+ this.name +'_tabs" class="w2ui-form-tabs" style="display: none"></div>' +
                            this.formHTML +
                        '</div>';
            $(this.box).attr('name', this.name)
                .addClass('w2ui-reset w2ui-form')
                .html(html);
            if ($(this.box).length > 0) $(this.box)[0].style.cssText += this.style;

            // init toolbar regardless it is defined or not
            if (typeof this.toolbar.render !== 'function') {
                this.toolbar = $().w2toolbar($.extend({}, this.toolbar, { name: this.name +'_toolbar', owner: this }));
                this.toolbar.on('click', function (event) {
                    var edata = obj.trigger({ phase: 'before', type: 'toolbar', target: event.target, originalEvent: event });
                    if (edata.isCancelled === true) return;
                    // no default action
                    obj.trigger($.extend(edata, { phase: 'after' }));
                });
            }
            if (typeof this.toolbar == 'object' && typeof this.toolbar.render == 'function') {
                this.toolbar.render($('#form_'+ this.name +'_toolbar')[0]);
            }
            // init tabs regardless it is defined or not
            if (typeof this.tabs.render !== 'function') {
                this.tabs = $().w2tabs($.extend({}, this.tabs, { name: this.name +'_tabs', owner: this, active: this.tabs.active }));
                this.tabs.on('click', function (event) {
                    obj.goto(this.get(event.target, true));
                });
            }
            if (typeof this.tabs == 'object' && typeof this.tabs.render == 'function') {
                this.tabs.render($('#form_'+ this.name +'_tabs')[0]);
                if(this.tabs.active) this.tabs.click(this.tabs.active);
            }
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            // after render actions
            this.resize();
            var url = (typeof this.url != 'object' ? this.url : this.url.get);
            if (url && this.recid !== 0 && this.recid != null) {
                this.request();
            } else {
                this.refresh();
            }
            // attach to resize event
            if ($('.w2ui-layout').length === 0) { // if there is layout, it will send a resize event
                this.tmp_resize = function (event) { w2ui[obj.name].resize(); };
                $(window).off('resize', 'body').on('resize', 'body', this.tmp_resize);
            }
            // focus on load
            function focusEl() {
                var inputs = $(obj.box).find('div:not(.w2ui-field-helper) > input, select, textarea, div > label:nth-child(1) > :radio').not('.file-input');
                if (inputs.length > obj.focus) inputs[obj.focus].focus();
            }
            if (this.focus >= 0) {
                setTimeout(function () {
                    // if not rendered in 10ms, then wait 500ms
                    if ($(obj.box).find('input, select, textarea').length === 0) {
                        setTimeout(focusEl, 500); // need timeout to allow form to render
                    } else {
                        focusEl();
                    }
                }, 10);
            }
            return (new Date()).getTime() - time;
        },

        destroy: function () {
            // event before
            var edata = this.trigger({ phase: 'before', target: this.name, type: 'destroy' });
            if (edata.isCancelled === true) return;
            // clean up
            if (typeof this.toolbar == 'object' && this.toolbar.destroy) this.toolbar.destroy();
            if (typeof this.tabs == 'object' && this.tabs.destroy) this.tabs.destroy();
            if ($(this.box).find('#form_'+ this.name +'_tabs').length > 0) {
                $(this.box)
                    .removeAttr('name')
                    .removeClass('w2ui-reset w2ui-form')
                    .html('');
            }
            delete w2ui[this.name];
            // event after
            this.trigger($.extend(edata, { phase: 'after' }));
            $(window).off('resize', 'body')
        }
    };

    $.extend(w2form.prototype, w2utils.event);
    w2obj.form = w2form;
})(jQuery);

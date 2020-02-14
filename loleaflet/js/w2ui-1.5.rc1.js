/* -*- js-indent-level: 8 -*- */
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
        // console.log('add', edata);
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
                if (!instant) setTimeout(checkIfMoved, 200);
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
                if (tmp[0] === 'zoomin' || tmp[0] === 'zoomout') {
                    return;
                }
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
            var html = '<div class="w2ui-scroll-wrapper" onmousedown="var el=w2ui[\''+ this.name +'\']; if (el) el.resize();" onscroll="var el=w2ui[\'editbar\']; if (el) el.resize();">'+
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
                    '<div class="w2ui-scroll-left" onmousedown="event.preventDefault()" onclick="if($(this).closest(\'#toolbar-up\').length>0 || $(\'#toolbar-down\').width() > 768){var el=w2ui[\''+ this.name +'\']; if (el) el.scroll(\'left\');}"></div>'+
                    '<div class="w2ui-scroll-right" onmousedown="event.preventDefault()" onclick="if($(this).closest(\'#toolbar-up\').length>0 || $(\'#toolbar-down\').width() > 768){var el=w2ui[\''+ this.name +'\']; if (el) el.scroll(\'right\');}"></div>';
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
                // Allow for rounding errors (on mobile, the max scrollLeft we get is 0.5 less than the real max).
                if (scrollBox.scrollLeft() < scrollBox.find(':first').outerWidth() - scrollBox.outerWidth() - 1) {
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
                    /*
                    if (item.type == 'color') {
                        text = '<div style="height: 12px; width: 12px; margin-top: 1px; border: 1px solid #8A8A8A; border-radius: 1px; box-shadow: 0px 0px 1px #fff; '+
                               '        background-color: #'+ (item.color != null ? item.color : 'fff') +'; float: left;"></div>'+
                               (item.text ? '<div style="margin-left: 17px;">' + w2utils.lang(item.text) + '</div>' : '');
                    }
                    */
                    /*if (item.type == 'text-color') {
                        text = '<div style="color: #'+ (item.color != null ? item.color : '444') +';">'+
                                    (item.text ? w2utils.lang(item.text) : '<b>Aa</b>') +
                               '</div>';
                    }*/
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
                                    (((['menu', 'menu-radio', 'menu-check', 'drop'].indexOf(item.type) != -1) && item.arrow !== false) ?
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
            if (window.ThisIsTheiOSApp) return;
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
            if (window.ThisIsTheiOSApp) return;
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

// @ts-strict-ignore -*- Mode: JavaScript; js-indent-level: 8; fill-column: 100 -*-

/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/* global $ _ */

interface BackstageTabConfig {
	id: string;
	label: string;
	type: 'view' | 'action' | 'separator';
	icon?: string;
	visible?: boolean;
	viewType?: 'home' | 'templates' | 'info' | 'export';
	actionType?:
		| 'open'
		| 'save'
		| 'saveas'
		| 'print'
		| 'share'
		| 'repair'
		| 'properties'
		| 'history'
		| 'options'
		| 'about';
}

interface TemplateTypeMap {
	writer: 'writer';
	calc: 'calc';
	impress: 'impress';
}

type TemplateType = TemplateTypeMap[keyof TemplateTypeMap];

interface TemplateData {
	id: string;
	name: string;
	type: TemplateType;
	path?: string;
	preview?: string;
	featured?: boolean;
	searchText: string;
}

interface TemplateManifestEntry {
	id?: string;
	name?: string;
	type?: string;
	category?: string;
	path: string;
	preview?: string | null;
	featured?: boolean;
}

interface TemplateManifest {
	templates?: TemplateManifestEntry[];
}

interface ExportFormatData {
	id: string;
	name: string;
	description: string;
}

interface ExportOptionItem {
	action: string;
	text: string;
	command?: string;
}

// todo: currently export as and downloadAs with pdf as not working, skipping for moment
interface ExportSections {
	exportAs: ExportOptionItem[];
	downloadAs: ExportOptionItem[];
}

const BackstageSVGIcons: Record<string, string> = {
	'lc_home.svg': '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><style>.icon-primary { fill: var(--icon-primary-color, rgb(58, 58, 56)); }.icon-white { fill: rgb(250, 250, 250); }</style><path class="icon-primary" d="M12.002 2.92999C11.7461 2.92999 11.4912 3.02716 11.2949 3.22296L4.15039 10.2952C4.09082 10.3544 4.04102 10.4182 4 10.4866V11.5159V20.0726C4 20.6266 4.44629 21.0726 5 21.0726H10H11.5156H13H14H19C19.5537 21.0726 20 20.6266 20 20.0726V19.0726V17.6585V12.0023V10.5882V10.5862L19.8086 10.3948L12.709 3.22296C12.5132 3.02716 12.2578 2.92999 12.002 2.92999ZM12 3.92999L19 10.93V11.0023V20.0726H14V16.1058C14 15.5518 13.5537 15.1058 13 15.1058H11C10.4463 15.1058 10 15.5518 10 16.1058V20.0726H5L4.99805 12.5569V11.1429V10.9339L5.07031 10.8616L12 3.92999Z"/><path class="icon-white" d="M12.001 3.93103L19.001 10.931V11.0033V20.0736H14.001V16.1068C14.001 15.5528 13.5547 15.1068 13.001 15.1068H11.001C10.4473 15.1068 10.001 15.5528 10.001 16.1068V20.0736H5.00098L4.99902 12.558V11.1439V10.9349L5.07129 10.8627L12.001 3.93103Z"/></svg>',
	'lc_newdoc.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><style>.icon-primary { fill: var(--icon-primary-color, rgb(58, 58, 56)); }.icon-white { fill: rgb(250, 250, 250); }</style><path class="icon-white" d="M5,3.0000436305999756L5,21.000043869018555L19,21.000043869018555L19,6.7294745445251465L15,3.0000436305999756Z"/><path class="icon-primary" d="M5,2.0001046657562256C4.446044921875,2.0001046657562256,4,2.4460275173187256,4,3.0000436305999756L4,21.000043869018555C4,21.554059982299805,4.446044921875,22.00007438659668,5,22.00007438659668L19,22.00007438659668C19.553955078125,22.00007438659668,20,21.554059982299805,20,21.000043869018555L20,10.89069938659668L20,7.2494940757751465L20,7.0414862632751465C20,6.5908637046813965,20.098876953125,6.6149115562438965,19.3955078125,5.9739203453063965L16.087890625,2.7368600368499756C15.37841796875,2.0001046657562256,15.376708984375,2.0001046657562256,14.9931640625,2.0001046657562256L14.66162109375,2.0001046657562256L14,2.0001046657562256ZM5,3.0000436305999756L14,3.0000436305999756L14,7.0000739097595215C14,7.5540289878845215,14.446044921875,8.000043869018555,15,8.000043869018555L19,8.000043869018555L19,21.000043869018555L5,21.000043869018555Z"/><path class="icon-white" d="M15,7.0000739097595215L19,7.0000739097595215L15,3.0000436305999756Z" fill-rule="evenodd"/></svg>',
	'lc_open.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><style>.icon-primary { fill: var(--icon-primary-color, rgb(58, 58, 56)); }.icon-white { fill: rgb(250, 250, 250); }</style><path class="icon-white" d="M7.24658203125,5.00457763671875L10.744384765625,7.627899169921875L18.614013671875,7.627899169921875L18.614013671875,16.95465087890625L2.874267578125,17.2467041015625L2.874267578125,5.00457763671875Z" fill-rule="evenodd"/><path class="icon-primary" d="M2.874267578125,4.130126953125C2.391357421875,4.130126953125,2,4.5216064453125,2,5.00457763671875L2,19.870025634765625L2.874267578125,19.870025634765625L2.874267578125,5.00457763671875L7.24658203125,5.00457763671875L10.744384765625,7.627899169921875L18.614013671875,7.627899169921875L18.614013671875,10.25115966796875L18.614013671875,16.95465087890625L18.614013671875,19.870025634765625L19.48876953125,19.870025634765625L19.48876953125,7.627899169921875C19.48876953125,7.144927978515625,19.09716796875,6.75347900390625,18.614013671875,6.75347900390625L11.1064453125,6.75347900390625L7.86474609375,4.38629150390625C7.70068359375,4.2222900390625,7.478515625,4.130126953125,7.24658203125,4.130126953125Z" fill-rule="evenodd"/><path class="icon-primary" d="M2,19.870025634765625L2.874267578125,19.870025634765625L18.614013671875,19.870025634765625L19.48876953125,19.870025634765625L21.850830078125,10.244354248046875C22.111328125,9.376129150390625,22.1083984375,9.449554443359375,21.199951171875,9.376678466796875L19.48876953125,9.376678466796875L18.614013671875,9.376678466796875L5.516357421875,9.376678466796875C4.623779296875,9.376678466796875,4.6240234375,9.37628173828125,4.39794921875,10.242645263671875L2.874267578125,16.95465087890625Z" fill-rule="evenodd"/><path class="icon-white" d="M5.516357421875,10.25115966796875C5.4052734375,10.25115966796875,5.3759765625,10.2530517578125,5.302978515625,10.25457763671875C5.28564453125,10.316070556640625,5.27392578125,10.34454345703125,5.25,10.435577392578125L5.24658203125,10.45269775390625C5.245361328125,10.458099365234375,5.24462890625,10.457550048828125,5.2431640625,10.462982177734375L3.7265625,17.1475830078125C3.721923828125,17.167144775390625,3.716796875,17.1865234375,3.71142578125,17.205718994140625L3.1748046875,18.99554443359375L18.614013671875,18.99554443359375L18.802001953125,18.99554443359375L20.94921875,10.25115966796875L19.48876953125,10.25115966796875L18.614013671875,10.25115966796875Z" fill-rule="evenodd"/></svg>',
	'lc_shareas.svg': '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><style>.icon-primary { fill: var(--icon-primary-color, rgb(58, 58, 56)); }.icon-white { fill: rgb(250, 250, 250); }.icon-secondary { fill: var(--icon-secondary-color, rgb(30, 139, 205)); }</style><path class="icon-white" d="m5 3v18h14v-14.2705905l-4-3.7294095z"/><path class="icon-primary" d="m5 2c-.554 0-1 .446-1 1v18c0 .554.446 1 1 1h14c.554 0 1-.446 1-1v-10.109375-3.6412209-.2079239c0-.4506799.09887-.4265951-.604637-1.0675892l-3.307389-3.2370335c-.709525-.7368575-.711223-.7368575-1.094804-.7368575h-.331557-.661613zm0 1h9v4c0 .554.446 1 1 1h4v13h-14z"/><path class="icon-white" d="m15 7h4l-4-4z"/><path class="icon-secondary" d="m14 11a1 1 0 0 0 -1 1 1 1 0 0 0 1 1 1 1 0 0 0 1-1 1 1 0 0 0 -1-1zm-2.5 2a.5.5 0 0 0 -.5.5.5.5 0 0 0 .5.5.5.5 0 0 0 .5-.5.5.5 0 0 0 -.5-.5zm-2.5 1a1 1 0 0 0 -1 1 1 1 0 0 0 1 1 1 1 0 0 0 1-1 1 1 0 0 0 -1-1zm2.5 2a.5.5 0 0 0 -.5.5.5.5 0 0 0 .5.5.5.5 0 0 0 .5-.5.5.5 0 0 0 -.5-.5zm2.5 1a1 1 0 0 0 -1 1 1 1 0 0 0 1 1 1 1 0 0 0 1-1 1 1 0 0 0 -1-1z"/></svg>',
	'lc_printpreview.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><style>.icon-primary { fill: var(--icon-primary-color, rgb(58, 58, 56)); }.icon-white { fill: rgb(250, 250, 250); }.icon-secondary { fill: var(--icon-secondary-color, rgb(30, 139, 205)); }</style><path class="icon-white" d="M5,4.000034809112549L5,21.00003433227539L15.5,21.00003433227539C12.474365234375,21.00003433227539,10,18.52573013305664,10,15.500035285949707C10,12.474339485168457,12.474365234375,10.000035285949707,15.5,10.000035285949707C16.82666015625,10.000035285949707,18.04736328125,10.476353645324707,19,11.265660285949707L19,8.000035285949707L15,4.000034809112549ZM18.12890625,20.23831558227539C17.31884765625,20.68814468383789,16.4384765625,20.99875259399414,15.501953125,21.00003433227539L18.890625,21.00003433227539Z"/><path class="icon-primary" d="M5,3.000034809112549C4.446044921875,3.000034809112549,4,3.446018695831299,4,4.000034809112549L4,21.00003433227539C4,21.55405044555664,4.446044921875,22.00003433227539,5,22.00003433227539L19.890625,22.00003433227539L18.890625,21.00003433227539L15.501953125,21.00003433227539L15.5,21.00003433227539L5,21.00003433227539L5,4.000034809112549L14,4.000034809112549L14,8.000035285949707C14,8.554051399230957,14.446044921875,9.000035285949707,15,9.000035285949707L19,9.000035285949707L19,11.265660285949707C19.380859375,11.581212043762207,19.71533203125,11.948094367980957,20,12.353550910949707L20,8.250035285949707L20,8.041050910949707C20,7.590366840362549,20.09814453125,7.615635395050049,19.39453125,6.974644184112549L16.087890625,3.736362934112549C15.37841796875,2.999485492706299,15.377685546875,3.000034809112549,14.994140625,3.000034809112549L14.662109375,3.000034809112549L14,3.000034809112549ZM15,4.000034809112549L19,8.000035285949707L15,8.000035285949707Z"/><path class="icon-secondary" d="M15.5,11.000035285949707C13.0146484375,11.000035285949707,11,13.014744758605957,11,15.500035285949707C11,17.98532485961914,13.0146484375,20.00003433227539,15.5,20.00003433227539C16.52294921875,19.99863052368164,17.51513671875,19.64865493774414,18.3125,19.00784683227539L22.15234375,22.84769058227539C22.27783203125,22.97830581665039,22.4638671875,23.03091812133789,22.63916015625,22.98526382446289C22.814453125,22.93954849243164,22.951171875,22.80270767211914,22.996826171875,22.62753677368164C23.042724609375,22.45230484008789,22.989990234375,22.26608657836914,22.859375,22.14065933227539L19.021484375,18.30276870727539C19.6552734375,17.50607681274414,20.000244140625,16.51803970336914,20,15.500035285949707C20,13.014744758605957,17.9853515625,11.000035285949707,15.5,11.000035285949707ZM15.5,12.000035285949707C17.43310546875,12.000035285949707,19,13.567051887512207,19,15.500035285949707C19,17.43301773071289,17.43310546875,19.00003433227539,15.5,19.00003433227539C13.56689453125,19.00003433227539,12,17.43301773071289,12,15.500035285949707C12,13.567051887512207,13.56689453125,12.000035285949707,15.5,12.000035285949707Z"/><path class="icon-white" d="M19,15.500035285949707C19,17.43301773071289,17.43310546875,19.00003433227539,15.5,19.00003433227539C13.56689453125,19.00003433227539,12,17.43301773071289,12,15.500035285949707C12,13.567051887512207,13.56689453125,12.000035285949707,15.5,12.000035285949707C17.43310546875,12.000035285949707,19,13.567051887512207,19,15.500035285949707Z"/></svg>',
	'lc_save.svg': '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><style>.icon-primary { fill: var(--icon-primary-color, rgb(58, 58, 56)); }.icon-white { fill: rgb(250, 250, 250); }.icon-gray { fill: rgb(121, 119, 116); }</style><path class="icon-primary" d="m3 2a1.0001 1.0001 0 0 0 -1 1v16a1.0001 1.0001 0 0 0 .2929688.707031l2 2a1.0001 1.0001 0 0 0 .7070312.292969h16a1.0001 1.0001 0 0 0 1-1v-18a1.0001 1.0001 0 0 0 -1-1z"/><path class="icon-gray" d="m3 3v16l2 2h1v-7h12v7h3v-18h-2v7h-14v-7z"/><path class="icon-white" d="m6 3v6h12v-6zm1 12v6h2v-5h2v5h6v-6z"/></svg>',
	'lc_saveacopy.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><style>.icon-primary { fill: var(--icon-primary-color, rgb(58, 58, 56)); }.icon-white { fill: rgb(250, 250, 250); }.icon-light-purple { fill: rgb(176, 142, 202); }</style><path class="icon-primary" d="M11,9.999825477600098C10.4482421875,10.000069618225098,9.999755859375,10.447579383850098,9.999755859375,10.999825477600098L9.999755859375,19.999948501586914C9.999755859375,20.265024185180664,10.105712890625,20.519479751586914,10.293212890625,20.707040786743164L11.29345703125,21.707040786743164C11.480712890625,21.894357681274414,11.734375,21.999765396118164,12.000244140625,22.000009536743164L20.99951171875,22.000009536743164C21.55224609375,21.999765396118164,21.999755859375,21.552255630493164,21.999755859375,21.000009536743164L21.999755859375,10.999825477600098C21.999755859375,10.447579383850098,21.55224609375,10.000069618225098,20.99951171875,9.999825477600098ZM13.00048828125,10.999825477600098L19,10.999825477600098L19,13.999886512756348L13.00048828125,13.999886512756348ZM13.00048828125,17.999948501586914L17.999755859375,17.999948501586914L17.999755859375,21.000009536743164L15,21.000009536743164L15,18.999948501586914L13.999755859375,18.999948501586914L13.999755859375,21.000009536743164L13.00048828125,21.000009536743164Z" stroke-width=".265"/><path class="icon-white" d="M5.000244140625,2.9999477863311768L5.000244140625,21.000009536743164L9.00048828125,21.000009536743164L9.00048828125,10.000069618225098C9.00048828125,9.445931434631348,9.446044921875,9.000008583068848,9.999755859375,9.000008583068848L19,9.000008583068848L19,7.000008583068848L15,2.9999477863311768Z" stroke-width=".265"/><path class="icon-primary" d="M5.000244140625,1.9999476671218872C4.44580078125,1.9999476671218872,4,2.4458096027374268,4,2.9999477863311768L4,21.000009536743164C4,21.553842544555664,4.44580078125,22.000009536743164,5.000244140625,22.000009536743164L9.999755859375,22.000009536743164L9.00048828125,21.000009536743164L5.000244140625,21.000009536743164L5.000244140625,2.9999477863311768L13.999755859375,2.9999477863311768L13.999755859375,7.000008583068848C13.999755859375,7.553902626037598,14.4462890625,7.999764442443848,15,7.999764442443848L19,7.999764442443848L19,8.999825477600098L20.000244140625,8.999825477600098L20.000244140625,7.249825477600098L20.000244140625,7.040841102600098C20.000244140625,6.590279579162598,20.09814453125,6.615426063537598,19.39404296875,5.974617958068848L16.087890625,2.7362759113311768C15.37841796875,1.9994593858718872,15.37744140625,1.9999476671218872,14.994384765625,1.9999476671218872C11.662353515625,1.9999476671218872,8.331298828125,1.9999476671218872,5.000244140625,1.9999476671218872ZM15,2.9999477863311768L19,7.000008583068848L15,7.000008583068848Z" stroke-width=".265"/><path class="icon-light-purple" d="M11,11.000069618225098L11,19.999948501586914L12.000244140625,21.000009536743164L12.000244140625,16.999948501586914L19,16.999948501586914L19,21.000009536743164L20.99951171875,21.000009536743164L20.99951171875,11.000069618225098L20.000244140625,11.000069618225098L20.000244140625,14.999886512756348L12.000244140625,14.999886512756348L12.000244140625,11.000069618225098Z" stroke-width=".265" fill-opacity="1"/><path class="icon-white" d="M13.00048828125,11.000069618225098L13.00048828125,13.999886512756348L19,13.999886512756348L19,11.000069618225098ZM13.00048828125,17.999948501586914L13.00048828125,21.000009536743164L13.999755859375,21.000009536743164L13.999755859375,18.999948501586914L15,18.999948501586914L15,21.000009536743164L17.999755859375,21.000009536743164L17.999755859375,17.999948501586914Z" stroke-width=".265"/></svg>',
	'lc_printlayout.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><style>.icon-primary { fill: var(--icon-primary-color, rgb(58, 58, 56)); }.icon-white { fill: rgb(250, 250, 250); }.icon-secondary { fill: var(--icon-secondary-color, rgb(30, 139, 205)); }.icon-gray { fill: rgb(121, 119, 116); }</style><path class="icon-white" d="M5,3.999965190887451L5,20.99996566772461L11,20.99996566772461L11,15.999964714050293C11,15.445948600769043,11.446044921875,14.999964714050293,12,14.999964714050293L13,14.999964714050293L13,11.999964714050293L19,11.999964714050293L19,7.999965190887451L15,3.999965190887451Z"/><path class="icon-primary" d="M5,2.999965190887451C4.446044921875,2.999965190887451,4,3.445949077606201,4,3.999965190887451L4,20.99996566772461C4,21.55398178100586,4.446044921875,21.99996566772461,5,21.99996566772461L11,21.99996566772461L11,20.99996566772461L5,20.99996566772461L5,3.999965190887451L14,3.999965190887451L14,7.999965190887451C14,8.553980827331543,14.446044921875,8.999964714050293,15,8.999964714050293L19,8.999964714050293L19,11.999964714050293L20,11.999964714050293L20,8.040980339050293C20,7.590297222137451,20.09814453125,7.615565776824951,19.39453125,6.974574565887451L16.087890625,3.736293315887451C15.37841796875,2.999415874481201,15.377685546875,2.999965190887451,14.994140625,2.999965190887451C11.662841796875,2.999965190887451,8.331298828125,2.999965190887451,5,2.999965190887451ZM15,3.999965190887451L19,7.999965190887451L15,7.999965190887451Z"/><path class="icon-white" d="M15,13.999964714050293L15,15.999964714050293L20,15.999964714050293L20,13.999964714050293Z"/><path class="icon-primary" d="M14,12.999964714050293L14,15.999964714050293L15,15.999964714050293L15,13.999964714050293L20,13.999964714050293L20,15.999964714050293L21,15.999964714050293L21,12.999964714050293L20,12.999964714050293L15,12.999964714050293ZM13,15.999964714050293C12.446044921875,15.999964714050293,12,16.44594955444336,12,16.99996566772461L12,20.99996566772461C12,21.55398178100586,12.446044921875,21.99996566772461,13,21.99996566772461L14,21.99996566772461L14,23.99996566772461L21,23.99996566772461L21,21.99996566772461L22,21.99996566772461C22.553955078125,21.99996566772461,23,21.55398178100586,23,20.99996566772461L23,16.99996566772461C23,16.44594955444336,22.553955078125,15.999964714050293,22,15.999964714050293L22,20.99996566772461L13,20.99996566772461C13,19.33327865600586,13,17.66665267944336,13,15.999964714050293ZM15,21.99996566772461L20,21.99996566772461L20,22.99996566772461L15,22.99996566772461Z"/><path class="icon-secondary" d="M14,15.999964714050293L21,15.999964714050293L21,17.99996566772461L14,17.99996566772461Z"/><path class="icon-white" d="M15,21.99996566772461L15,22.99996566772461L20,22.99996566772461L20,21.99996566772461Z"/><path class="icon-gray" d="M13,18.99996566772461L22,18.99996566772461L22,20.99996566772461L13,20.99996566772461Z" fill-opacity="0.983"/></svg>',
	'lc_exportto.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><style>.icon-primary { fill: var(--icon-primary-color, rgb(58, 58, 56)); }.icon-white { fill: rgb(250, 250, 250); }.icon-secondary { fill: var(--icon-secondary-color, rgb(30, 139, 205)); }</style><path class="icon-white" d="M5,4.0000433921813965L5,21.000043869018555L17.076171875,21.000043869018555C17.164306640625,20.770978927612305,17.30078125,20.557722091674805,17.478515625,20.398481369018555L17.884765625,19.990278244018555L11.521484375,19.990278244018555C11.101318359375,19.996198654174805,10.65380859375,19.807477951049805,10.3828125,19.505903244018555C10.11181640625,19.204328536987305,10,18.839704513549805,10,18.490278244018555C10,18.140851974487305,10.11181640625,17.776227951049805,10.3828125,17.474653244018555C10.65380859375,17.173078536987305,11.101318359375,16.984357833862305,11.521484375,16.990278244018555L17.873046875,16.990278244018555L17.451171875,16.568403244018555C16.998291015625,16.130109786987305,16.89501953125,15.442975997924805,17.103515625,14.927778244018555C17.3115234375,14.413618087768555,17.861572265625,13.992170333862305,18.490234375,13.990278244018555L18.4921875,13.990278244018555C18.66748046875,13.989850997924805,18.837890625,14.025983810424805,19,14.084028244018555L19,7.7285590171813965L15,4.0000433921813965Z"/><path class="icon-primary" d="M5,3.0000436305999756C4.446044921875,3.0000436305999756,4,3.4460275173187256,4,4.0000433921813965L4,21.000043869018555C4,21.554059982299805,4.446044921875,22.000043869018555,5,22.000043869018555L17.060546875,22.000043869018555C17.0126953125,21.864423751831055,16.976806640625,21.721906661987305,16.970703125,21.564496994018555C16.963623046875,21.378339767456055,17.005126953125,21.184186935424805,17.076171875,21.000043869018555L5,21.000043869018555L5,4.0000433921813965L14,4.0000433921813965L14,8.000043869018555C14,8.554059982299805,14.446044921875,9.000043869018555,15,9.000043869018555L19,9.000043869018555L19,14.084028244018555C19.2119140625,14.159955978393555,19.407958984375,14.277570724487305,19.568359375,14.441450119018555L20,14.873090744018555L20,8.250043869018555L20,8.041059494018555C20,7.5903754234313965,20.09814453125,7.6156439781188965,19.39453125,6.9746527671813965L16.087890625,3.7363717555999756C15.37841796875,2.9994943141937256,15.377685546875,3.0000436305999756,14.994140625,3.0000436305999756L14.662109375,3.0000436305999756L14,3.0000436305999756Z"/><path class="icon-white" d="M15,8.000043869018555L19,8.000043869018555L15,4.0000433921813965Z" fill-rule="evenodd"/><path class="icon-secondary" d="M18.494140625,14.990278244018555C18.29052734375,14.990339279174805,18.107177734375,15.113935470581055,18.03076171875,15.302778244018555C17.954345703125,15.491682052612305,18,15.707990646362305,18.146484375,15.849653244018555L20.291015625,17.990278244018555L11.5078125,17.990278244018555C11.327392578125,17.987714767456055,11.15966796875,18.082441329956055,11.06884765625,18.238203048706055C10.97802734375,18.393964767456055,10.97802734375,18.586591720581055,11.06884765625,18.742353439331055C11.15966796875,18.898115158081055,11.327392578125,18.992841720581055,11.5078125,18.990278244018555L20.294921875,18.990278244018555L18.146484375,21.142621994018555C18.00830078125,21.266279220581055,17.9501953125,21.456220626831055,17.994873046875,21.636091232299805C18.039794921875,21.815961837768555,18.180419921875,21.956281661987305,18.3603515625,22.000593185424805C18.54052734375,22.044965744018555,18.730224609375,21.986127853393555,18.853515625,21.847700119018555L21.810546875,18.886762619018555C21.934814453125,18.791608810424805,22.00732421875,18.643842697143555,22.006591796875,18.487348556518555C22.005615234375,18.330915451049805,21.931884765625,18.183820724487305,21.806640625,18.089887619018555L18.853515625,15.140668869018555C18.759033203125,15.043989181518555,18.62939453125,14.989789962768555,18.494140625,14.990278244018555Z" fill-rule="evenodd"/></svg>',
};

class BackstageView extends window.L.Class {
	private readonly container: HTMLElement;
	private contentArea!: HTMLElement;
	private isVisible: boolean = false;
	private readonly map: any;
	private templates: TemplateManifestEntry[] | null = null;
	private templatesPromise: Promise<void> | null = null;
	private templatesLoadError: boolean = false;
	private activeTemplateType: TemplateType = 'writer';
	private templateSearchQuery: string = '';
	private templateGridContainer: HTMLElement | null = null;
	private templateFeaturedRowContainer: HTMLElement | null = null;
	private templateSearchContainer: HTMLElement | null = null;
	private saveTabElement: HTMLElement | null = null;
	private readonly isStarterMode: boolean;

	private actionHandlers: Record<string, () => void> = {
		open: () => this.executeOpen(),
		save: () => this.executeSave(),
		saveas: () => this.executeSaveAs(),
		print: () => this.executePrint(),
		share: () => this.executeShare(),
		repair: () => this.executeRepair(),
		properties: () => this.executeDocumentProperties(),
		history: () => this.executeRevisionHistory(),
		options: () => this.executeOptions(),
		about: () => this.executeAbout(),
	};

	constructor(map: any) {
		super();
		this.map = map;
		this.isStarterMode = (window as any).starterScreen;
		this.container = this.createContainer();
		document.body.appendChild(this.container);
		this.map?.on(
			'commandstatechanged',
			(e: any) => {
				if (e.commandName === '.uno:ModifiedStatus') {
					this.updateSaveButtonState();
				}
			},
			this,
		);
	}

	private createContainer(): HTMLElement {
		const container = this.createElement(
			'div',
			'backstage-view hidden',
			'backstage-view',
		);

		if (this.isStarterMode) {
			container.classList.add('is-starter-mode');
		}

		const header = this.createHeader();
		container.appendChild(header);

		const mainWrapper = this.createElement('div', 'backstage-main-wrapper');
		const sidebar = this.createSidebar();
		this.contentArea = this.createElement('div', 'backstage-content');

		mainWrapper.appendChild(sidebar);
		mainWrapper.appendChild(this.contentArea);
		container.appendChild(mainWrapper);

		this.renderHomeView();
		return container;
	}

	private createHeader(): HTMLElement {
		const header = this.createElement('div', 'backstage-header');
		const title = this.createElement('span', 'backstage-header-title');
		title.textContent = 'Collabora Office';

		header.appendChild(title);

		// Only show close button if not in starter screen mode
		if (!this.isStarterMode) {
			const closeButton = this.createElement('div', 'backstage-header-close');
			closeButton.setAttribute('aria-label', _('Close backstage'));
			closeButton.title = _('Close backstage');

			const closeBtn = this.createElement(
				'span',
				'backstage-header-close-icon',
			);
			closeBtn.setAttribute('aria-hidden', 'true');
			closeButton.appendChild(closeBtn);

			window.L.DomEvent.on(closeButton, 'click', () => this.hide(), this);

			header.appendChild(closeButton);
		}

		return header;
	}

	private createSidebar(): HTMLElement {
		const sidebar = this.createElement('div', 'backstage-sidebar');

		// Only show back button if not in starter screen mode
		if (!this.isStarterMode) {
			const backButton = this.createSidebarBackBtn();
			sidebar.appendChild(backButton);
		}

		const tabsContainer = this.createElement('div', 'backstage-sidebar-tabs');
		const tabConfigs = this.getTabsConfig();

		tabConfigs.forEach((config) => {
			if (config.visible === false) return;

			const tabElement = this.createTabElement(config);
			tabsContainer.appendChild(tabElement);
		});

		sidebar.appendChild(tabsContainer);
		return sidebar;
	}

	private createSidebarBackBtn(): HTMLElement {
		const backButton = this.createElement('div', 'backstage-sidebar-back');

		backButton.setAttribute('aria-label', _('Back to document'));
		backButton.title = _('Back to document');

		const icon = this.createElement('span', 'backstage-sidebar-back-icon');
		icon.setAttribute('aria-hidden', 'true');
		backButton.appendChild(icon);

		window.L.DomEvent.on(backButton, 'click', () => this.hide(), this);

		return backButton;
	}

	private createTabElement(config: BackstageTabConfig): HTMLElement {
		const element = this.createElement('div', 'backstage-sidebar-item');
		element.id = `backstage-${config.id}`;

		if (config.id === 'save') this.saveTabElement = element;

		if (config.icon) {
			const iconContainer = this.createElement('span', 'backstage-sidebar-icon');
			iconContainer.setAttribute('aria-hidden', 'true');

			const svgContent = BackstageSVGIcons[config.icon];
			if (svgContent) {
				iconContainer.innerHTML = svgContent;
			}
			element.insertBefore(iconContainer, element.firstChild);
		}

		const label = this.createElement('span');
		label.textContent = config.label;
		element.appendChild(label);

		const action =
			config.type === 'view'
				? () => this.handleViewTab(config)
				: () => this.handleActionTab(config);

		window.L.DomEvent.on(element, 'click', action, this);
		return element;
	}

	private getTabsConfig(): BackstageTabConfig[] {
		return [
			{
				id: 'home',
				label: _('Home'),
				type: 'view',
				viewType: 'home',
				icon: 'lc_home.svg',
				visible: true,
			},
			{
				id: 'new',
				label: _('New'),
				type: 'view',
				viewType: 'templates',
				icon: 'lc_newdoc.svg',
				visible: true,
			},
			{
				id: 'open',
				label: _('Open'),
				type: 'action',
				actionType: 'open',
				icon: 'lc_open.svg',
				visible: true,
			},
			{
				id: 'share',
				label: _('Share'),
				type: 'action',
				actionType: 'share',
				icon: 'lc_shareas.svg',
				visible: !this.isStarterMode && this.isFeatureEnabled('share'),
			},
			{
				id: 'info',
				label: _('Info'),
				type: 'view',
				viewType: 'info',
				icon: 'lc_printpreview.svg',
				visible: !this.isStarterMode,
			},
			{
				id: 'save',
				label: _('Save'),
				type: 'action',
				actionType: 'save',
				icon: 'lc_save.svg',
				visible: !this.isStarterMode && this.isFeatureEnabled('save'),
			},
			{
				id: 'saveas',
				label: _('Save As'),
				type: 'action',
				actionType: 'saveas',
				icon: 'lc_saveacopy.svg',
				visible: !this.isStarterMode && this.isFeatureEnabled('saveAs'),
			},
			{
				id: 'print',
				label: _('Print'),
				type: 'action',
				actionType: 'print',
				icon: 'lc_printlayout.svg',
				visible: !this.isStarterMode && this.isFeatureEnabled('print'),
			},
			{
				id: 'export',
				label: _('Export'),
				type: 'view',
				viewType: 'export',
				icon: 'lc_exportto.svg',
				visible: !this.isStarterMode,
			},
			{ type: 'separator', id: 'sidebar-horizontal-break', label: '', visible: !this.isStarterMode },
			{
				id: 'options',
				label: _('Options'),
				type: 'action',
				actionType: 'options',
				visible: false /* it was !this.isStarterMode and we can revert, when the dialog is good enough */,
			},
			{
				id: 'about',
				label: _('About'),
				type: 'action',
				actionType: 'about',
				visible: !this.isStarterMode,
			},
		];
	}

	private handleViewTab(config: BackstageTabConfig): void {
		const viewRenderers: Record<string, () => void> = {
			home: () => this.renderHomeView(),
			templates: () => this.renderNewView(),
			info: () => this.renderInfoView(),
			export: () => this.renderExportView(),
		};

		const viewType = config.viewType;
		if (!viewType) return;

		const renderer = viewRenderers[viewType];
		if (renderer) renderer();
	}

	private handleActionTab(config: BackstageTabConfig): void {
		if (config.actionType === 'save' && !this.isDocumentModified()) return;
		const handler = this.actionHandlers[config.actionType || ''];
		if (handler) handler();
	}

	private isFeatureEnabled(feature: string): boolean {
		const wopi = this.map['wopi'] || {};
		const featureFlags: Record<string, boolean> = {
			share: !!wopi.EnableShare,
			save: !wopi.HideSaveOption,
			saveAs: !wopi.UserCanNotWriteRelative || window.ThisIsTheQtApp,
			print: !wopi.HidePrintOption,
			repair: !wopi.HideRepairOption,
		};
		return featureFlags[feature] !== false;
	}

	private renderHomeView(): void {
		this.setActiveTab('backstage-home');
		this.clearContent();

		this.addSectionHeader(
			_('Home'),
			_('Start a new document from one of the following templates.'),
		);

		if (!this.templates) {
			this.renderTemplatesLoadingState();
			this.loadTemplatesData().then(() => {
				if (this.isVisible) this.renderHomeView();
			});
			return;
		}

		const templateType = this.isStarterMode
			? 'writer'
			: this.detectTemplateTypeFromDoc();

		const allTemplates = this.getTemplatesData();
		const appSpecificTemplates = allTemplates.filter(
			(template) => template.type === templateType
		);

		const blankTemplate = this.getBlankTemplate(templateType);
		const templatesForHome: TemplateData[] = [];

		if (blankTemplate) {
			templatesForHome.push(blankTemplate);
		}

		templatesForHome.push(...appSpecificTemplates);

		const templatesRow = this.createTemplateRow(
			templatesForHome,
			'backstage-home-templates-row',
		);

		const moreTemplatesContainer = this.createElement('div', 'backstage-home-more-templates');
		const divider = this.createElement('div', 'backstage-home-divider');
		const moreTemplatesButton = this.createElement('div', 'backstage-home-more-button');
		moreTemplatesButton.textContent = _('More Templates');
		moreTemplatesButton.setAttribute('role', 'button');
		moreTemplatesButton.setAttribute('tabindex', '0');
		moreTemplatesButton.setAttribute('aria-label', _('More Templates'));

		const handleMoreTemplatesClick = () => {
			const newTabElement = document.getElementById('backstage-new');
			if (newTabElement) {
				newTabElement.click();
			} else {
				this.renderNewView();
			}
		};

		window.L.DomEvent.on(moreTemplatesButton, 'click', handleMoreTemplatesClick, this);

		moreTemplatesContainer.appendChild(divider);
		moreTemplatesContainer.appendChild(moreTemplatesButton);

		if (templatesRow) {
			this.contentArea.appendChild(templatesRow);
		}
		this.contentArea.appendChild(moreTemplatesContainer);

		this.addSectionHeader(
			_('Recent'),
			'',
		);

		this.renderRecentDocuments();
	}

	private async renderRecentDocuments(): Promise<void> {
		try {
			const result = await window.postMobileCall('GETRECENTDOCS');
			if (!result || typeof result !== 'string') {
				this.showEmptyMessage();
				return;
			}

			const docs = JSON.parse(result);
			if (!Array.isArray(docs) || docs.length === 0) {
				this.showEmptyMessage();
				return;
			}

			const table = this.createRecentDocumentsTable(docs);
			this.contentArea.appendChild(table);
		} catch (e) {
			console.error('Failed to get recent documents:', e);
			this.showEmptyMessage();
		}
	}

	private showEmptyMessage(): void {
		const description = this.createElement('p', 'backstage-content-description');
		description.textContent = _('Recently opened documents will appear here');
		this.contentArea.appendChild(description);
	}

	private createRecentDocumentsTable(docs: any[]): HTMLElement {
		const table = this.createElement('table', 'backstage-recent-documents-table');
		const thead = this.createRecentDocumentsTableHeader();
		const tbody = this.createElement('tbody', 'backstage-recent-documents-body');

		docs.forEach((doc) => {
			const rows = this.createRecentDocumentRows(doc);
			rows.forEach((row) => tbody.appendChild(row));
		});

		table.appendChild(thead);
		table.appendChild(tbody);
		return table;
	}

	private createRecentDocumentsTableHeader(): HTMLElement {
		const thead = this.createElement('thead', 'backstage-recent-documents-header');
		const row = this.createElement('tr', 'backstage-recent-documents-header-row');

		const nameHeader = this.createElement('th', 'backstage-recent-documents-header-cell');
		nameHeader.textContent = _('Name');

		const dateHeader = this.createElement('th', 'backstage-recent-documents-header-cell');
		dateHeader.textContent = _('Modified Date');

		row.appendChild(nameHeader);
		row.appendChild(dateHeader);
		thead.appendChild(row);
		return thead;
	}

	private createRecentDocumentRows(doc: any): HTMLElement[] {
		const { fileName, filePath, timestamp, uri } = this.parseDocumentData(doc);
		const docType = doc.doctype || 'writer';
		const formattedTime = this.formatTimestamp(timestamp);

		const row = this.createRecentDocumentRow(fileName, filePath, formattedTime, uri, docType);
		return [row];
	}

	private createRecentDocumentRow(
		fileName: string,
		filePath: string,
		formattedTime: string,
		uri: string,
		docType: string
	): HTMLElement {
		const row = this.createElement('tr', 'backstage-recent-document-row');

		const nameCell = this.createElement('td', 'backstage-recent-document-name-cell');
		const nameText = this.createElement('div', 'backstage-recent-document-name-text');
		nameText.textContent = fileName;

		const pathText = this.createElement('div', 'backstage-recent-document-path-text');
		pathText.textContent = filePath;

		const textWrapper = this.createElement('div', 'backstage-recent-document-text-wrapper');
		textWrapper.appendChild(nameText);
		textWrapper.appendChild(pathText);

		const iconClass = this.getDocumentIconClass(docType);
		const icon = this.createElement('span', `backstage-recent-document-icon ${iconClass}`);

		const contentWrapper = this.createElement('div', 'backstage-recent-document-content-wrapper');
		contentWrapper.appendChild(icon);
		contentWrapper.appendChild(textWrapper);

		nameCell.appendChild(contentWrapper);

		const timeCell = this.createElement('td', 'backstage-recent-document-time-cell');
		timeCell.textContent = formattedTime;

		row.appendChild(nameCell);
		row.appendChild(timeCell);

		window.L.DomEvent.on(row, 'click', () => this.openRecentDocument(uri), this);

		return row;
	}

	private parseDocumentData(doc: any): {
		fileName: string;
		filePath: string;
		timestamp: string | null;
		uri: string;
	} {
		const uri = doc.uri || '';
		const url = new URL(uri);
		let fullPath = url.pathname;

		// On Windows a file: URI looks like this: file:///C:/Users/tml/foo.odt .
		// URL::pathname has a leading slash and is thus not valid as a pathname, we need to
		// strip that slash away.
		if (window.ThisIsTheWindowsApp && fullPath[0] === '/' && fullPath[2] === ':')
			fullPath = fullPath.slice(1);

		// We want to show a more native pathname with backslashes instead of the slashes as
		// used in file URIs.
		if (window.ThisIsTheWindowsApp)
			fullPath = (fullPath as any).replaceAll('/', '\\');
		
		// We want to show non-ASCII characters in the pathname as such, not
		// percent-encoded.
		fullPath = decodeURIComponent(fullPath);

		const lastSlashIndex = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
		
		const fileName = doc.name || (lastSlashIndex >= 0 ? fullPath.slice(lastSlashIndex + 1) : fullPath);
		const filePath = lastSlashIndex >= 0 ? fullPath.slice(0, lastSlashIndex + 1) : '/';

		if (!doc.doctype) {
			const ext = fileName.split('.').pop()?.toLowerCase() || '';
			if (['ods', 'ots', 'xls', 'xlsx', 'csv', 'fods'].includes(ext)) {
				doc.doctype = 'calc';
			} else if (['odp', 'otp', 'ppt', 'pptx', 'fodp'].includes(ext)) {
				doc.doctype = 'impress';
			} else {
				doc.doctype = 'writer';  // Default
			}
		}

		return {
			fileName,
			filePath,
			timestamp: doc.timestamp || "",
			uri,
		};
	}

	private formatTimestamp(timestamp: string): string {
		if (!timestamp) return '';
		
		try {
			const date = new Date(timestamp);
			if (isNaN(date.getTime())) return timestamp;
			
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			const hours = String(date.getHours()).padStart(2, '0');
			const minutes = String(date.getMinutes()).padStart(2, '0');
			const seconds = String(date.getSeconds()).padStart(2, '0');
			
			// TODO: Need Local formatting here?
			return `${year}/${month}/${day} at ${hours}:${minutes}:${seconds}`;
		} catch {
			return timestamp;
		}
	}

	private openRecentDocument(uri: string): void {
		if (!uri) {
			console.warn('openRecentDocument: URI is missing');
			return;
		}
		window.postMobileMessage(`opendoc file=${encodeURIComponent(uri)}`);
	}

	private getDocumentIconClass(docType: string): string {
		switch (docType) {
			case 'calc':
				return 'backstage-doc-icon-calc';
			case 'impress':
				return 'backstage-doc-icon-impress';
			case 'writer':
			default:
				return 'backstage-doc-icon-writer';
		}
	}

	private renderNewView(): void {
		this.setActiveTab('backstage-new');
		this.clearContent();
		this.templateGridContainer = null;
		this.templateFeaturedRowContainer = null;
		this.templateSearchContainer = null;

		this.addSectionHeader(
			_('New')
		);

		if (!this.templates) {
			this.renderTemplatesLoadingState();
			this.loadTemplatesData().then(() => {
				if (this.isVisible) this.renderNewView();
			});
			return;
		}

		const templates = this.getTemplatesData();
		const explorer = this.renderTemplateExplorer(templates);
		this.contentArea.appendChild(explorer);
	}

	private renderInfoView(): void {
		this.setActiveTab('backstage-info');
		this.clearContent();

		this.addSectionHeader(
			_('Document Info'),
			_('View document properties and information'),
		);

		const propertiesColumn = this.createInfoPropertiesColumn();
		this.contentArea.appendChild(propertiesColumn);
	}

	private renderExportView(): void {
		this.setActiveTab('backstage-export');
		this.clearContent();

		// extract list from notebookbar - incase need to add condition better to add there?
		const exportOptions = this.getExportOptionsFromNotebookbar();

		if (exportOptions.downloadAs.length > 0) {
			this.addSectionHeader(
				_('Export Document'),
				_('export your documents in different formats'),
			);

			const downloadAsGrid = this.createExportGridFromOptions(
				exportOptions.downloadAs,
			);
			this.contentArea.appendChild(downloadAsGrid);
		}
	}

	private createExportGridFromOptions(
		options: ExportOptionItem[],
	): HTMLElement {
		const grid = this.createElement('div', 'backstage-formats-grid');

		options.forEach((option) => {
			const card = this.createExportCardFromOption(option);
			grid.appendChild(card);
		});

		return grid;
	}

	private createExportCardFromOption(option: ExportOptionItem): HTMLElement {
		const card = this.createElement('div', 'backstage-format-card');

		const format = option.action.startsWith('downloadas-')
			? option.action.substring('downloadas-'.length)
			: '';
		const extension = format ? `.${format}` : '';

		const icon = this.createElement('div', 'format-icon');
		icon.textContent = extension.toUpperCase().replace('.', '');
		card.appendChild(icon);

		const description = this.createElement('div', 'format-description');
		description.textContent = option.text;
		card.appendChild(description);

		window.L.DomEvent.on(
			card,
			'click',
			() => this.dispatchExportAction(option.action, option.command),
			this,
		);
		return card;
	}

	private createInfoPropertiesColumn(): HTMLElement {
		const column = this.createElement('div', 'backstage-info-properties');

		const header = this.createElement('h3', 'backstage-section-header');
		header.textContent = _('Properties');
		column.appendChild(header);

		const propertiesList = this.createPropertiesList();
		column.appendChild(propertiesList);

		const button = this.createPrimaryButton(_('More Property Info'), () =>
			this.executeDocumentProperties(),
		);
		column.appendChild(button);

		return column;
	}

	private createElement(
		tag: string,
		className?: string,
		id?: string,
	): HTMLElement {
		const element = window.L.DomUtil.create(tag, className || '');
		if (id) element.id = id;
		return element;
	}

	private createPrimaryButton(
		label: string,
		onClick: () => void,
	): HTMLButtonElement {
		const button = this.createElement(
			'button',
			'backstage-property-button',
		) as HTMLButtonElement;
		button.textContent = label;
		window.L.DomEvent.on(button, 'click', onClick, this);
		return button;
	}

	private createPropertiesList(): HTMLElement {
		const list = this.createElement('div', 'backstage-properties-list');

		const properties = this.getDocumentProperties();

		properties.forEach((prop) => {
			if (prop.value) {
				const item = this.createPropertyItem(prop.label, prop.value);
				list.appendChild(item);
			}
		});

		return list;
	}

	private createPropertyItem(label: string, value: string): HTMLElement {
		const item = this.createElement('div', 'backstage-property-item');

		const labelEl = this.createElement('div', 'property-label');
		labelEl.textContent = label;
		item.appendChild(labelEl);

		const valueEl = this.createElement('div', 'property-value');
		valueEl.textContent = value;
		item.appendChild(valueEl);

		return item;
	}

	private getFileName = (wopi: any): string => {
		if (wopi?.BreadcrumbDocName) return wopi.BreadcrumbDocName;
		if (wopi?.BaseFileName) return wopi.BaseFileName;

		const doc = this.map?.options?.doc;
		if (doc) {
			const filename = doc.split('/').pop()?.split('?')[0];
			if (filename) return decodeURIComponent(filename);
		}

		return '';
	};

	private getDocumentProperties(): Array<{ label: string; value: string }> {
		const docType = this.getDocTypeString();
		const docLayer = this.map?._docLayer;
		const wopi = this.map?.['wopi'];

		const typeLabels: Record<string, { type: string; parts: string }> = {
			text: { type: _('Text Document'), parts: _('Pages') },
			spreadsheet: { type: _('Spreadsheet'), parts: _('Sheets') },
			presentation: { type: _('Presentation'), parts: _('Slides') },
			drawing: { type: _('Drawing'), parts: _('Pages') },
		};

		const config = typeLabels[docType] || {
			type: _('Document'),
			parts: _('Parts'),
		};

		const properties = [
			{ label: _('Type'), value: config.type },
			{
				label: config.parts,
				value: docLayer?._parts ? String(docLayer._parts) : '-',
			},
			{
				label: _('Mode'),
				value: this.map?.isEditMode() ? _('Edit') : _('View Only'),
			},
		];

		const filename = this.getFileName(wopi);
		if (filename) {
			properties.splice(1, 0, {
				label: _('File Name'),
				value: filename,
			});
		}

		return properties;
	}

	private addSectionHeader(title: string, description: string = ""): void {
		const titleElement = this.createElement('h2', 'backstage-content-title');
		titleElement.textContent = title;
		this.contentArea.appendChild(titleElement);

		if (description !== "") {
		const descElement = this.createElement(
			'p',
			'backstage-content-description',
		);
		descElement.textContent = description;
		this.contentArea.appendChild(descElement);
	}
	}

	private clearContent(): void {
		while (this.contentArea.firstChild) {
			this.contentArea.removeChild(this.contentArea.firstChild);
		}
	}

	private setActiveTab(tabId: string): void {
		$('.backstage-sidebar-item').removeClass('active');
		$('#' + tabId).addClass('active');
	}

	private getTemplatesData(): TemplateData[] {
		const entries = this.templates || [];
		const templates: TemplateData[] = [];

		entries.forEach((entry) => {
			const absolutePath = entry.path;
			if (!absolutePath) return;

			const type = this.normalizeTemplateType(entry.type, absolutePath);
			if (!type) return;

			const name = entry.name || this.deriveDisplayName(absolutePath);
			const id = entry.id || this.slugify(name + absolutePath);
			const searchComponents = [name, type, absolutePath];

			templates.push({
				id,
				name,
				type,
				path: absolutePath,
				preview: entry.preview || undefined,
				featured: !!entry.featured,
				searchText: searchComponents.join(' ').toLowerCase(),
			});
		});

		// Sort by type first (writer, calc, impress), then alphabetically by name
		const typeOrder: Record<TemplateType, number> = {
			writer: 1,
			calc: 2,
			impress: 3,
		};

		return templates.sort((a, b) => {
			const typeComparison = typeOrder[a.type] - typeOrder[b.type];
			if (typeComparison !== 0) return typeComparison;
			return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
		});
	}

	private async loadTemplatesData(): Promise<void> {
		if (this.templatesPromise) return this.templatesPromise;

		const loader = (async () => {
			try {
				// fetch templates from templates/templates.js build path
				const entries = (window as any).CODA_TEMPLATES || [];
				this.templates = entries;
				this.templatesLoadError = false;

				if (!entries || entries.length === 0) {
					console.warn('Templates manifest loaded but contains no templates!');
				}
			} catch (error) {
				console.error('Unable to load templates manifest', error);
				this.templates = [];
				this.templatesLoadError = true;
			}
		})();

		this.templatesPromise = loader.finally(() => {
			this.templatesPromise = null;
		});

		return this.templatesPromise;
	}

	private renderTemplatesLoadingState(): void {
		const wrapper = this.createElement('div', 'backstage-templates-empty');
		const info = this.createElement('p', 'backstage-content-description');
		info.textContent = _('Loading templates…');
		wrapper.appendChild(info);
		this.contentArea.appendChild(wrapper);
	}

	private renderTemplateExplorer(allTemplates: TemplateData[]): HTMLElement {
		const previousType = this.activeTemplateType;
		const detectedType = this.detectTemplateTypeFromDoc();
		if (detectedType !== previousType) this.templateSearchQuery = '';
		this.activeTemplateType = detectedType;

		const container = this.createElement('div', 'backstage-template-explorer');

		const filteredTemplates = this.getFilteredTemplates(allTemplates);

		const featuredRow = this.renderFeaturedRow();
		if (featuredRow) {
			container.appendChild(featuredRow);
			this.templateFeaturedRowContainer = featuredRow;
		} else {
			this.templateFeaturedRowContainer = null;
		}

		// Only show search bar if there are custom templates to search through
		if (allTemplates.length > 0) {
			const search = this.renderTemplateSearch();
			this.templateSearchContainer = search;
			container.appendChild(search);
		} else {
			this.templateSearchContainer = null;
		}

		const grid = this.renderTemplateGrid(filteredTemplates);
		this.templateGridContainer = grid;
		container.appendChild(grid);

		return container;
	}

	private renderTemplateSearch(): HTMLElement {
		const container = this.createElement('div', 'template-search');
		const input = this.createElement(
			'input',
			'template-search-input',
		) as HTMLInputElement;
		input.type = 'search';
		input.placeholder = _('Search templates');
		input.value = this.templateSearchQuery;

		window.L.DomEvent.on(
			input,
			'input',
			() => {
				this.templateSearchQuery = input.value || '';
				this.updateTemplateGrid();
			},
			this,
		);

		container.appendChild(input);
		return container;
	}

	private getFilteredTemplates(allTemplates: TemplateData[]): TemplateData[] {
		const query = this.templateSearchQuery.trim().toLowerCase();
		return allTemplates.filter((template) => {
			if (!query) return true;
			return template.searchText.includes(query);
		});
	}

	private createTemplateRow(
		templates: TemplateData[],
		className: string = 'template-featured-row',
		cardOptions: { variant?: 'featured'; isBlank?: boolean } = {},
	): HTMLElement | null {
		if (templates.length === 0) return null;

		const row = this.createElement('div', className);
		templates.forEach((template) => {
			row.appendChild(this.createTemplateCard(template, cardOptions));
		});
		return row;
	}

	private renderFeaturedRow(): HTMLElement | null {
		const blankTemplates = [
			this.getBlankTemplate('writer'),
			this.getBlankTemplate('calc'),
			this.getBlankTemplate('impress'),
		].filter((t): t is TemplateData => t !== null);

		const query = this.templateSearchQuery.trim().toLowerCase();
		const filteredBlankTemplates = query
			? blankTemplates.filter((t) => t.searchText.includes(query))
			: blankTemplates;

		return this.createTemplateRow(filteredBlankTemplates, 'template-featured-row', {
			variant: 'featured',
			isBlank: true,
		});
	}

	private renderTemplateGrid(templates: TemplateData[]): HTMLElement {
		const grid = this.createElement('div', 'backstage-templates-grid');

		if (!templates.length) {
			// Only show "no match" message if user is actively searching
			if (this.templateSearchQuery.trim()) {
				const empty = this.createElement('div', 'template-grid-empty');
				empty.textContent = _('No templates match your search.');
				grid.appendChild(empty);
			}
			return grid;
		}

		templates.forEach((template) => {
			grid.appendChild(this.createTemplateCard(template));
		});

		return grid;
	}

	private updateTemplateGrid(): void {
		if (!this.templates || !this.templateGridContainer) return;

		const allTemplates = this.getTemplatesData();
		const filteredTemplates = this.getFilteredTemplates(allTemplates);
		const newGrid = this.renderTemplateGrid(filteredTemplates);
		this.templateGridContainer.replaceWith(newGrid);
		this.templateGridContainer = newGrid;

		const newFeaturedRow = this.renderFeaturedRow();
		if (this.templateFeaturedRowContainer) {
			if (newFeaturedRow) {
				this.templateFeaturedRowContainer.replaceWith(newFeaturedRow);
				this.templateFeaturedRowContainer = newFeaturedRow;
			} else {
				this.templateFeaturedRowContainer.remove();
				this.templateFeaturedRowContainer = null;
			}
		} else if (newFeaturedRow && this.templateSearchContainer) {
			// Only try to insert if search container exists
			if (this.templateSearchContainer.parentElement) {
				this.templateSearchContainer.parentElement.insertBefore(
					newFeaturedRow,
					this.templateSearchContainer,
				);
				this.templateFeaturedRowContainer = newFeaturedRow;
			}
		} else if (newFeaturedRow && this.templateGridContainer.parentElement) {
			// If no search container, insert before grid
			this.templateGridContainer.parentElement.insertBefore(
				newFeaturedRow,
				this.templateGridContainer,
			);
			this.templateFeaturedRowContainer = newFeaturedRow;
		}
	}

	private getTemplateTypeLabel(type: TemplateType): string {
		switch (type) {
			case 'writer':
				return 'Writer';
			case 'calc':
				return 'Calc';
			case 'impress':
				return 'Impress';
			default:
				return type;
		}
	}

	private createTemplateCard(
		template: TemplateData,
		options: { variant?: 'featured'; isBlank?: boolean } = {},
	): HTMLElement {
		const card = this.createElement('div', 'backstage-template-card');
		if (options.variant === 'featured') card.classList.add('is-featured');
		if (options.isBlank) card.classList.add('is-blank');

		const previewWrapper = this.createElement('div', 'template-thumbnail');
		const preview = this.createElement('img') as HTMLImageElement;
		preview.alt = template.name;
		if (template.preview) preview.src = template.preview;
		else preview.src = this.getDefaultPreview(template.type);
		previewWrapper.appendChild(preview);
		card.appendChild(previewWrapper);

		const name = this.createElement('div', 'template-name');
		name.textContent = template.name;
		card.appendChild(name);

		window.L.DomEvent.on(
			card,
			'click',
			() => this.triggerNewDocument(template),
			this,
		);
		return card;
	}

	private getDefaultPreview(type: TemplateType): string {
		const previews: Record<TemplateType, string> = {
			writer: 'images/filetype/writer.svg',
			calc: 'images/filetype/calc.svg',
			impress: 'images/filetype/impress.svg',
		};
		return previews[type] || 'images/filetype/document.svg';
	}

	private getBlankTemplate(type: TemplateType): TemplateData | null {
		let name: string;
		let previewPath: string | undefined;
		switch (type) {
			case 'calc':
				name = _('Blank Spreadsheet');
				previewPath = 'images/templates/preview/blank_spreadsheet.png';
				break;
			case 'impress':
				name = _('Blank Presentation');
				previewPath = 'images/templates/preview/blank_presentation.png';
				break;
			case 'writer':
			default:
				name = _('Blank Document');
				previewPath = 'images/templates/preview/blank_writer.png';
				break;
		}

		return {
			id: `blank-${type}`,
			name,
			type,
			preview: previewPath,
			searchText: `${name.toLowerCase()} ${type} blank`,
		};
	}

	private detectTypeFromPath(templatePath: string): TemplateType | null {
		const extension = templatePath.split('.').pop()?.toLowerCase() || '';
		const map: Record<string, TemplateType> = {
			ott: 'writer',
			oth: 'writer',
			otm: 'writer',
			ots: 'calc',
			otp: 'impress',
		};
		return map[extension] || null;
	}

	private normalizeTemplateType(
		entryType: string | undefined,
		templatePath: string,
	): TemplateType | null {
		const normalized = (entryType || '').toLowerCase();
		if (
			normalized === 'writer' ||
			normalized === 'calc' ||
			normalized === 'impress'
		)
			return normalized as TemplateType;
		return this.detectTypeFromPath(templatePath);
	}

	private slugify(value: string): string {
		return value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.replace(/-{2,}/g, '-');
	}

	private deriveDisplayName(templatePath: string): string {
		const baseName = templatePath.split(/[\\/]/).pop() || templatePath;
		const nameWithoutExtension = baseName.replace(/\.[^.]+$/, '');
		return nameWithoutExtension
			.replace(/[_-]+/g, ' ')
			.replace(/\s+/g, ' ')
			.replace(/\b\w/g, (char) => char.toUpperCase());
	}

	private getDocTypeString(): string {
		const docLayer = this.map && this.map._docLayer;
		const docType = docLayer && docLayer._docType;
		return docType || 'text';
	}

	private getExportOptionsFromNotebookbar(): ExportSections {
		const docType = this.getDocTypeString();
		const builder = new (window.L.Control.NotebookbarBuilder as any)();

		let downloadAsOpts: ExportOptionItem[] = builder._getDownloadAsSubmenuOpts
			? builder._getDownloadAsSubmenuOpts(docType) || []
			: [];

		downloadAsOpts = downloadAsOpts.filter(
			(option) =>
				option.action !== 'exportpdf' && option.command !== 'exportpdf',
		);

		return {
			exportAs: [],
			downloadAs: downloadAsOpts,
		};
	}

	private executeOpen(): void {
		if (this.isStarterMode) {
			window.postMobileMessage('uno .uno:Open');
		} else {
			this.sendUnoCommand('.uno:Open');
		}
	}

	private executeOptions(): void {
		this.map.settings.showSettingsDialog();
	}

	private executeAbout(): void {
		this.map.showLOAboutDialog();
	}

	private executeSave(): void {
		if (this.map && this.map.save) {
			this.map.save(false, false);
		}
		this.hide();
	}

	private executeSaveAs(): void {
		this.sendUnoCommand('.uno:SaveAs');
		this.hide();
	}

	private executePrint(): void {
		if (window.ThisIsAMobileApp) {
			window.postMobileMessage('PRINT');
		} else if (this.map && this.map.print) {
			this.map.print();
		}
		this.hide();
	}

	private executeShare(): void {
		this.fireMapEvent('postMessage', { msgId: 'UI_Share' });
		this.hide();
	}

	private executeRevisionHistory(): void {
		this.fireMapEvent('postMessage', { msgId: 'rev-history' });
		this.hide();
	}

	private executeRepair(): void {
		this.sendUnoCommand('.uno:Repair');
		this.hide();
	}

	private executeDocumentProperties(): void {
		this.sendUnoCommand('.uno:SetDocumentProperties');
		this.hide();
	}

	private triggerNewDocument(template: TemplateData): void {
		const docType = template.type || 'writer';
		const params: string[] = ['type=' + docType];
		if (template.path) {
			params.push('template=' + encodeURIComponent(template.path));
		}

		// URI-encode the basename parameter because the syntax for these keyword=value
		// style of messages doesn't allow spaces inside a value, and a translation of
		// "Untitled" might contains a space.

		// Eventually, instead of just "Untitled", we might want to use something that
		// depends on what type of document the template is. Like "Business letter" or
		// "CV". Such basenames should be in the templates.js file. If a template doesn't
		// have one, "Untitled" would then be the default.
		params.push('basename=' + encodeURIComponent(_('Untitled')));

		window.postMobileMessage('newdoc ' + params.join(' '));

		if (!this.isStarterMode) {
			this.hide();
		}
	}

	private dispatchExportAction(action: string, command?: string): void {
		const actionToDispatch = command || action;

		if (window.app && window.app.dispatcher) {
			window.app.dispatcher.dispatch(actionToDispatch);
		} else {
			console.warn('app.dispatcher not available, using fallback');
			this.handleExportFallback(actionToDispatch);
		}
		this.hide();
	}

	private getBaseFileName(): string {
		const fileName = this.map?.['wopi']?.BaseFileName || 'document';
		const lastDot = fileName.lastIndexOf('.');
		return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
	}

	private handleExportFallback(action: string): void {
		if (action === 'exportdirectpdf') {
			if (this.map && this.map.downloadAs) {
				this.map.downloadAs(this.getBaseFileName() + '.pdf', 'pdf');
			}
			return;
		}

		if (action.startsWith('downloadas-')) {
			const format = action.substring('downloadas-'.length);
			if (this.map && this.map.downloadAs) {
				this.map.downloadAs(this.getBaseFileName() + '.' + format, format);
			}
			return;
		}

		console.error('something want wrong with this action: ', action);
	}

	private sendUnoCommand(command: string): void {
		if (this.map && this.map.sendUnoCommand) {
			this.map.sendUnoCommand(command);
		}
	}

	private fireMapEvent(eventName: string, data?: any): void {
		if (this.map && this.map.fire) {
			this.map.fire(eventName, data);
		}
	}

	public show(): void {
		if (this.isVisible) {
			return;
		}

		this.isVisible = true;
		$(this.container).removeClass('hidden');
		this.hideDocumentContainer();
		this.renderHomeView();
		this.updateSaveButtonState();
		this.container.focus();
		this.fireMapEvent('backstageshow');
	}

	public hide(): void {
		if (!this.isVisible) {
			return;
		}

		this.isVisible = false;
		$(this.container).addClass('hidden');
		this.showDocumentContainer();
		this.focusMap();
		this.fireMapEvent('backstagehide');
	}

	public toggle(): void {
		if (this.isVisible) {
			this.hide();
		} else {
			this.show();
		}
	}

	private hideDocumentContainer(): void {
		$('#document-container').addClass('hidden');
		$('.notebookbar-scroll-wrapper').addClass('hidden');
	}

	private showDocumentContainer(): void {
		$('#document-container').removeClass('hidden');
		$('.notebookbar-scroll-wrapper').removeClass('hidden');
	}

	private focusMap(): void {
		if (this.map && this.map.focus) {
			this.map.focus();
		}
	}

	private detectTemplateTypeFromDoc(): TemplateType {
		const docLayer = this.map && this.map._docLayer;
		const docType = docLayer && docLayer._docType;
		switch (docType) {
			case 'spreadsheet':
				return 'calc';
			case 'presentation':
			case 'drawing':
				return 'impress';
			default:
				return 'writer';
		}
	}

	private isDocumentModified(): boolean {
		return (
			this.map?.stateChangeHandler?.getItemValue('.uno:ModifiedStatus') ===
			'true'
		);
	}

	private updateSaveButtonState(): void {
		if (!this.saveTabElement) return;
		this.saveTabElement.classList.toggle(
			'disabled',
			!this.isDocumentModified(),
		);
	}
}

window.L.Control.BackstageView = BackstageView;

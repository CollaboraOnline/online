type DefCallBack = () => void;
interface WSDServerInfo {
	Id: string;
	Version: string;
	Hash: string;
	Protocol: string;
	Options: string;
	Timezone: string;
}

type MessageInterface =
	| string
	| ArrayBuffer
	| Blob
	| Uint8Array
	| Int8Array
	| DataView;

interface DelayedMessageInterface {
	msg: string;
}

interface CompleteTraceEvent {
	id: number;
	tid: number;
	active: boolean;
	args: any;
	begin: DOMHighResTimeStamp;
	finish(): void;
	abort(): void;
}

interface CoolHTMLImageElement extends HTMLImageElement {
	completeTraceEvent?: CompleteTraceEvent;

	rawData?: Uint8Array;
	isKeyframe?: boolean;
}

interface SlurpMessageEvent extends MessageEvent {
	data: MessageInterface;
	imgBytes?: Uint8Array;
	imgIndex?: number;
	textMsg: string;
	isComplete(): boolean;
	image?: CoolHTMLImageElement;
	imageIsComplete?: boolean;
	callback?: DefCallBack;
	reason?: string;
}

interface Command {
	filename?: string;
	url?: string;
	type?: string;
	mode?: number;
	id?: string;
	errorCmd?: string;
	errorCode?: string;
	errorKind?: string;
	jail?: string;
	dir?: string;
	downloadid?: string;
	name?: string;
	port?: string;
	font?: string;
	char?: string;
	viewid?: string;
	nviewid?: string;
	params?: string[];
	rendercount?: number;
	wireId?: string;
	title?: string;
	dialogwidth?: string;
	dialogheight?: string;
	rectangle?: string;
	hiddenparts?: number[];
	rtlParts?: number[];
	protectedParts?: number[];
	hash?: string;
	nopng?: boolean;
	username?: string;
	pageRectangleList?: number[][];
	lastcolumn?: number;
	lastrow?: number;
	readonly?: number;

	x?: number;
	y?: number;
	tileWidth?: number;
	tileHeight?: number;
	width?: number;
	height?: number;
	zoom?: number;
	part?: number;
	parts?: number;
	selectedPart?: number;
}

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

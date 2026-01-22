/* -*- js-indent-level: 8 -*- */
interface CompleteTraceEvent {
	id: number;
	tid: number;
	active: boolean;
	args: any;
	begin: DOMHighResTimeStamp;
	finish(): void;
	abort(): void;
}

/* vim:set shiftwidth=8 softtabstop=8 noexpandtab: */

interface CompleteTraceEvent {
	id: number;
	tid: number;
	active: boolean;
	args: any;
	begin: DOMHighResTimeStamp;
	finish(): void;
	abort(): void;
}


import assert from 'assert';

export function assertFloat(actual: number, expected: number, eps: number, msg: string) {
	assert.ok(Math.abs(actual - expected) < eps,
		msg + ` | actual : ${actual}, expected: ${expected}, eps: ${eps}`);
}

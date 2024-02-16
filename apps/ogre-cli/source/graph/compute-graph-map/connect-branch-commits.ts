import flow from 'lodash/flow.js';
import chunk from 'lodash/fp/chunk.js';
import flatten from 'lodash/fp/flatten.js';
import inRange from 'lodash/inRange.js';

import {GraphLine, GraphSymbol} from './index.js';

export default connectBranchCommits;

function connectBranchCommits(branchColor: string, line: GraphLine): GraphLine {
	const branchPaths = flow<
		GraphLine,
		number[],
		number[][],
		number[],
		number[][],
		number[][]
	>(
		cells =>
			// @ts-ignore
			cells.reduce((point, {value}, index) => {
				if (value === GraphSymbol.Commit) point.push(index);
				return point;
			}, [] as number[]),
		points =>
			points.map((point, index) => {
				// Duplicate inner points so we can build path chunks.
				// e.g [1, 2] => [[1, 2]] and [1, 2, 2, 3] => [[1, 2], [2, 3]]
				const isAtTheEdge = index === 0 || index === points.length - 1;
				return isAtTheEdge ? [point] : [point, point];
			}),
		flatten,
		chunk(2),
		chunks => chunks.filter(path => path.length === 2),
		// @ts-ignore
	)(line);

	return line.map((cell, index) =>
		branchPaths.some(isInBranchPath(index))
			? {value: GraphSymbol.Branch, color: branchColor}
			: cell,
	);
}

function isInBranchPath(index: number): (path: number[]) => boolean {
	return ([start, end]) => (!!start ? inRange(index, start + 1, end) : false);
}

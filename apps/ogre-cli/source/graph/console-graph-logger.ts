/* tslint:disable:no-console */
import chalk from 'chalk';
import convert from 'color-convert';
import {KEYWORD} from 'color-convert/conversions.js';
import startsWith from 'lodash/startsWith.js';

import {
	GraphCommit,
	GraphSymbol,
	ILogGraph,
} from './compute-graph-map/index.js';

const consoleGraphLogger: ILogGraph = graph => {
	const lines = graph.map(line =>
		line
			.map(({value, color}) => {
				const [r, g, b] = !startsWith(color, '#')
					? convert.keyword.rgb(color as KEYWORD) ||
					  convert.keyword.rgb('white')
					: [0, 0, 0];
				const colored = startsWith(color, '#')
					? chalk.hex(color)
					: chalk.rgb(r, g, b);

				switch (value) {
					case GraphSymbol.Empty:
						return ' ';

					case GraphSymbol.Branch:
						return colored('|');

					case GraphSymbol.BranchOpen:
						return colored('\\');

					case GraphSymbol.BranchMerge:
						return colored('/');

					case GraphSymbol.Commit:
						return colored('*');

					default:
						const commit = value as GraphCommit;
						let text = ` ${colored(commit.hash)} `;

						if (commit.refs.length > 0) {
							const parsedRefs = commit.refs.map(ref => {
								return ref === 'HEAD' ? chalk.bold(ref) : ref;
							});
							text += chalk.red(`(${parsedRefs.join(', ')})`);
							text += ' ';
						}

						text += `${colored(commit.message)}`;

						return text;
				}
			})
			.join(''),
	);

	console.log(lines.join('\n'));
};

export default consoleGraphLogger;

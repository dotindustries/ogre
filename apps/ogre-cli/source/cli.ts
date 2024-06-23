#!/usr/bin/env node
import meow from 'meow';

import {formatGit2Json, Repository} from '@dotinc/ogre';
import {GitgraphUserApi} from '@gitgraph/core';

import {Gitgraph, render} from './graph/index.js';

const cli = meow(
	`
	Usage
	  $ ogre-cli

	Options
		--name  Your name

	Examples
	  $ ogre-cli --name=Jane
	  Hello, Jane
`,
	{
		importMeta: import.meta,
		flags: {
			name: {
				type: 'string',
			},
		},
	},
);

interface someClass {
	name: string;
	description: string;
}

const run = async ({name = 'author'}: {name?: string}) => {
	const graph = new Gitgraph();

	let author = `${name} <${name}@email.info>`;
	const r = new Repository<someClass>({description: '', name}, {});
	r.data.name = 'new name';
	r.data.description = 'first description';
	await r.commit('initial commit', author);

	await r.checkout('desc-up', true);
	r.data.description = 'some longer different description';
	await r.commit('change desc', author);

	r.data.description = 'correct mistake made in prev description';
	await r.commit('fix desc', author);

	r.createBranch('another_branch');

	r.data.description = 'yet another correction';
	await r.commit('typo fix', author);

	await r.checkout('main');
	await r.merge('desc-up');

	const history = r.getHistory();

	// workaround to give an empty update method, otherwise we have window not defined issues
	const graphuserapi = new GitgraphUserApi(graph, () => {});
	graphuserapi.import(formatGit2Json(history));

	render(graph);
	console.log('finished rendering');
};

run({name: cli.flags.name});

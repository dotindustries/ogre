import test from 'ava';

import {
	BranchUserApi,
	GitgraphCore,
	GitgraphUserApi,
	templateExtend,
	TemplateName,
} from '@gitgraph/core';

import computeGraphMap, {
	GraphCommit,
	GraphMap,
} from '../source/graph/compute-graph-map/index.js';

let core: GitgraphCore;
let gitgraph: GitgraphUserApi<SVGElement>;
let master: BranchUserApi<SVGElement>;

test('compute cells values', t => {
	function expectGraphMapValues(graphMap: GraphMap) {
		return {
			toEqual(expected: any): void {
				const graphMapValues = graphMap.map(line =>
					line.map(({value}) => value),
				);
				t.is(graphMapValues, expected);
			},
		};
	}

	test.beforeEach(() => {
		core = new GitgraphCore();
		gitgraph = core.getUserApi();
		master = gitgraph.branch('master');
	});

	test('for a single commit on a single branch', () => {
		master.commit({
			hash: '9a58c0b5939a20a929bf3ade9b2974e91106a83f',
			subject: 'Hello',
		});

		const graphMap = computeGraphMap(core);

		const graphCommit: GraphCommit = {
			hash: '9a58c0b',
			message: 'Hello',
			refs: ['master', 'HEAD'],
		};
		expectGraphMapValues(graphMap).toEqual([['*', graphCommit]]);
	});

	test('for multiple commits on a single branch', () => {
		master.commit({
			hash: '9a58c0b5939a20a929bf3ade9b2974e91106a83f',
			subject: 'Hello',
		});
		master.commit({
			hash: '8b4581ad6fc5ceca3726e585c2a46a76a4cd3a23',
			subject: 'World!',
		});

		const graphMap = computeGraphMap(core);

		const graphCommit1: GraphCommit = {
			hash: '9a58c0b',
			message: 'Hello',
			refs: [],
		};
		const graphCommit2: GraphCommit = {
			hash: '8b4581a',
			message: 'World!',
			refs: ['master', 'HEAD'],
		};
		expectGraphMapValues(graphMap).toEqual([
			['*', graphCommit1],
			['*', graphCommit2],
		]);
	});

	test('for multiple commits on 2 branches (fast-forward)', () => {
		master.commit('one');
		const develop = gitgraph.branch('develop');
		develop.commit('two');

		const graphMap = computeGraphMap(core);

		const masterGraphCommit = expect.objectContaining({
			message: 'one',
			refs: ['master'],
		});
		const developGraphCommit = expect.objectContaining({
			message: 'two',
			refs: ['develop', 'HEAD'],
		});
		expectGraphMapValues(graphMap).toEqual([
			['*', ' ', ' ', masterGraphCommit],
			[' ', '\\', ' ', ' '],
			[' ', ' ', '*', developGraphCommit],
		]);
	});

	test('for multiple commits on 2 branches (no fast-forward)', () => {
		master.commit('one');
		const develop = gitgraph.branch('develop');
		develop.commit('two');
		master.commit('three');
		develop.commit('four');

		const graphMap = computeGraphMap(core);

		const graphCommit1 = expect.objectContaining({
			message: 'one',
			refs: [],
		});
		const graphCommit2 = expect.objectContaining({
			message: 'two',
			refs: [],
		});
		const graphCommit3 = expect.objectContaining({
			message: 'three',
			refs: ['master'],
		});
		const graphCommit4 = expect.objectContaining({
			message: 'four',
			refs: ['develop', 'HEAD'],
		});
		expectGraphMapValues(graphMap).toEqual([
			['*', ' ', ' ', graphCommit1],
			['|', '\\', ' ', ' '],
			['|', ' ', '*', graphCommit2],
			['*', ' ', '|', graphCommit3],
			[' ', ' ', '*', graphCommit4],
		]);
	});

	test('for 2 branches with merge', () => {
		master.commit('one');
		const develop = gitgraph.branch('develop');
		develop.commit('two');
		master.merge(develop);

		const graphMap = computeGraphMap(core);

		const masterGraphCommit = expect.objectContaining({
			message: 'one',
			refs: [],
		});
		const developGraphCommit = expect.objectContaining({
			message: 'two',
			refs: ['develop'],
		});
		const mergeCommit = expect.objectContaining({
			refs: ['master', 'HEAD'],
		});
		expectGraphMapValues(graphMap).toEqual([
			['*', ' ', ' ', masterGraphCommit],
			['|', '\\', ' ', ' '],
			['|', ' ', '*', developGraphCommit],
			['|', '/', ' ', ' '],
			['*', ' ', ' ', mergeCommit],
		]);
	});

	test('for 2 branches merge (last branch into master)', () => {
		master.commit('one');
		const develop = gitgraph.branch('develop');
		develop.commit('two');
		const feat = gitgraph.branch('feat');
		feat.commit('three');
		master.merge(feat);

		const graphMap = computeGraphMap(core);

		const masterGraphCommit = expect.objectContaining({
			message: 'one',
			refs: [],
		});
		const developGraphCommit = expect.objectContaining({
			message: 'two',
			refs: ['develop'],
		});
		const featGraphCommit = expect.objectContaining({
			message: 'three',
			refs: ['feat'],
		});
		const mergeCommit = expect.objectContaining({
			refs: ['master', 'HEAD'],
		});
		expectGraphMapValues(graphMap).toEqual([
			['*', ' ', ' ', ' ', ' ', masterGraphCommit],
			['|', '\\', ' ', ' ', ' ', ' '],
			['|', ' ', '*', ' ', ' ', developGraphCommit],
			['|', ' ', ' ', '\\', ' ', ' '],
			['|', ' ', ' ', ' ', '*', featGraphCommit],
			['|', ' ', ' ', '/', ' ', ' '],
			['|', ' ', '/', ' ', ' ', ' '],
			['|', '/', ' ', ' ', ' ', ' '],
			['*', ' ', ' ', ' ', ' ', mergeCommit],
		]);
	});

	test('for 3 branches (consecutive)', () => {
		master.commit('one');

		const feat1 = gitgraph.branch('feat1');
		feat1.commit('two');

		const feat2 = gitgraph.branch('feat2');
		feat2.commit('three');

		const graphMap = computeGraphMap(core);

		const masterCommit = expect.objectContaining({
			message: 'one',
			refs: ['master'],
		});
		const feat1Commit = expect.objectContaining({
			message: 'two',
			refs: ['feat1'],
		});
		const feat2Commit = expect.objectContaining({
			message: 'three',
			refs: ['feat2', 'HEAD'],
		});
		expectGraphMapValues(graphMap).toEqual([
			['*', ' ', ' ', ' ', ' ', masterCommit],
			[' ', '\\', ' ', ' ', ' ', ' '],
			[' ', ' ', '*', ' ', ' ', feat1Commit],
			[' ', ' ', ' ', '\\', ' ', ' '],
			[' ', ' ', ' ', ' ', '*', feat2Commit],
		]);
	});

	it('for 3 branches (from master)', () => {
		master.commit('one');

		const feat1 = gitgraph.branch('feat1');
		feat1.commit('two');

		// Reset HEAD to master
		master.commit('three');

		const feat2 = gitgraph.branch('feat2');
		feat2.commit('four');

		const graphMap = computeGraphMap(core);

		const masterCommit1 = expect.objectContaining({
			message: 'one',
			refs: [],
		});
		const feat1Commit = expect.objectContaining({
			message: 'two',
			refs: ['feat1'],
		});
		const masterCommit2 = expect.objectContaining({
			message: 'three',
			refs: ['master'],
		});
		const feat2Commit = expect.objectContaining({
			message: 'four',
			refs: ['feat2', 'HEAD'],
		});
		expectGraphMapValues(graphMap).toEqual([
			['*', ' ', ' ', ' ', ' ', masterCommit1],
			['|', '\\', ' ', ' ', ' ', ' '],
			['|', ' ', '*', ' ', ' ', feat1Commit],
			['*', ' ', ' ', ' ', ' ', masterCommit2],
			[' ', '\\', ' ', ' ', ' ', ' '],
			[' ', ' ', '\\', ' ', ' ', ' '],
			[' ', ' ', ' ', '\\', ' ', ' '],
			[' ', ' ', ' ', ' ', '*', feat2Commit],
		]);
	});
});

test('compute cells colors', t => {
	function expectGraphMapColors(graphMap: GraphMap) {
		return {
			toEqual(expected: any): void {
				const graphMapColors = graphMap.map(line =>
					line.map(({color}) => color),
				);
				t.is(graphMapColors, expected);
			},
		};
	}

	test.beforeEach(() => {
		const template = templateExtend(TemplateName.Metro, {
			colors: ['red', 'green', 'blue'],
		});
		core = new GitgraphCore({template});
		gitgraph = core.getUserApi();
		master = gitgraph.branch('master');
	});

	test('for commits on a single branch', () => {
		master.commit().commit();

		const graphMap = computeGraphMap(core);

		expectGraphMapColors(graphMap).toEqual([
			['red', 'red'],
			['red', 'red'],
		]);
	});

	test('for commits on 2 branches', () => {
		master.commit().commit();
		const develop = gitgraph.branch('develop');
		develop.commit();
		master.commit();
		develop.commit();

		const graphMap = computeGraphMap(core);

		expectGraphMapColors(graphMap).toEqual([
			['red', '', '', 'red'],
			['red', '', '', 'red'],
			['red', 'green', '', ''],
			['red', '', 'green', 'green'],
			['red', '', 'green', 'red'],
			['', '', 'green', 'green'],
		]);
	});

	test('for 2 branches with merge', () => {
		master.commit('one');
		const develop = gitgraph.branch('develop');
		develop.commit('two');
		master.merge(develop);

		const graphMap = computeGraphMap(core);

		expectGraphMapColors(graphMap).toEqual([
			['red', '', '', 'red'],
			['red', 'green', '', ''],
			['red', '', 'green', 'green'],
			['red', 'green', '', ''],
			['red', '', '', 'red'],
		]);
	});
});

/* eslint-disable max-lines-per-function */

const {unlink, writeFile} = require('fs');
const {expect} = require('chai');

const mapFolder = require('../index');
const getExpectedResultFor = require('./expected-results/get-expected-result');
const getTestFolderPath = require('./expected-results/get-test-folder-path');

const NOT_FOUND = -1;

describe('map-folder', () => {
	const gitkeepPath = getTestFolderPath('/notes/empty/.gitkeep');

	before((done) => {
		unlink(gitkeepPath, (err) => {
			if (err && !err.message.includes('ENOENT: no such file or directory')) throw err;
			done();
		});
	});

	after((done) => {
		writeFile(gitkeepPath, '', (err) => {
			if (err) throw err;
			done();
		});
	});

	it('exports entery type constants', () => {
		expect(mapFolder.FOLDER).to.equal(0);
		expect(mapFolder.FILE).to.equal(1);
	});

	describe('async', () => {
		it('can map a single file', () => {
			return mapFolder(getTestFolderPath('article.doc'))
				.then(res => expect(res).to.deep.equal(getExpectedResultFor('file')))
				.catch(() => expect(false).to.be.true);
		});

		it('map files in folder', async () => {
			let res;

			try {
				res = await mapFolder(getTestFolderPath('diary'));
			}
			catch (ex) {
				return expect(false).to.be.true;
			}

			return expect(res).to.deep.equal(getExpectedResultFor('folderWithFiles'));
		});

		it('maps a given folder recursively', async () => {
			let res;

			try {
				res = await mapFolder(getTestFolderPath('/'));
			}
			catch (ex) {
				return expect(false).to.be.true;
			}

			return expect(res).to.deep.equal(getExpectedResultFor('fullStructure'));
		});

		describe('ignore', () => {
			it('ignores a given item', async () => {
				let res;

				try {
					res = await mapFolder(getTestFolderPath('/'), 'wish-list.txt');
				}
				catch (ex) {
					return expect(false).to.be.true;
				}

				return expect(res).to.deep.equal(getExpectedResultFor('ignoreItem'));
			});

			it('ignores given list of items', async () => {
				let res;

				try {
					res = await mapFolder(getTestFolderPath('/'), ['personal', 'day-2.txt']);
				}
				catch (ex) {
					return expect(false).to.be.true;
				}

				return expect(res).to.deep.equal(getExpectedResultFor('ignoreList'));
			});

			describe('ignore function', () => {
				it('works as a predicate function', async () => {
					let res;

					try {
						const filter = ({name}) => !name.includes('h');

						res = await mapFolder(getTestFolderPath('/'), filter);
					}
					catch (ex) {
						return expect(false).to.be.true;
					}

					return expect(res).to.deep.equal(getExpectedResultFor('filter'));
				});

				it('accepts `pathObj` argument', async () => {
					const expected = [
						'dummy-folder',
						'article.doc',
						'notes',
						'wish-list.txt',
						'empty',
						'personal',
						'contacts.csv',
						'goals.txt',
						'diary',
						'day-1.txt',
						'day-2.txt',
						'code',
						'app.js',
						'app.min.js',
						'index.html',
						'style.css',
						'images',
						'logo.png',
						'photo.jpg',
					];

					let i = 0;

					const ignoreFn = ({name, path, type}) => {
						expect(expected.indexOf(name)).to.be.above(NOT_FOUND);
						expect(path).to.be.a('string');
						expect(type).to.be.oneOf([0, 1]);
						i++;

						return true;
					};

					await mapFolder(getTestFolderPath('/'), ignoreFn);

					return expect(i).to.equal(expected.length);
				});
			});
		});

		it('throws when given path does not exist', () => (
			mapFolder('./test/not/exist')
				.then(() => expect(true).to.be.false)
				.catch(err => expect(err.message).to.include('ENOENT: no such file or directory'))
		));
	});
});

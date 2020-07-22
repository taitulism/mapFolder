/* eslint-disable eqeqeq */
const {statSync, readdirSync} = require('fs');
const {resolve, parse, join} = require('path');

const {FILE, FOLDER} = require('./constants');
const getStat = require('./promised/get-stat');
const readDir = require('./promised/read-dir');
const getConfig = require('./get-configs');

async function mapEntry (rawEntryPath, opts) {
	const cfg = getConfig(opts);
	const entryPath = resolve(rawEntryPath);
	const entryType = await getEntryType(entryPath);
	const entryMap = createEntryMap(entryPath, entryType);

	if (!shouldBeMapped(entryMap, cfg)) return null;
	if (entryType === FILE) return entryMap;
	if (entryType === FOLDER) {
		const entries = await readDir(entryPath);
		const entryName = entryMap.name.toLowerCase();
		const subOpts = getSubFolderOpts(entryName, cfg);
		const entriesObj = await mapEntries(entryPath, entries, subOpts || opts);

		if (cfg.skipEmpty && !Object.keys(entriesObj).length) return null;
		if (entriesObj) entryMap.entries = entriesObj;

		return entryMap;
	}
}

function mapEntrySync (rawEntryPath, opts) {
	const cfg = getConfig(opts);
	const entryPath = resolve(rawEntryPath);
	const entryType = getEntryTypeSync(entryPath);
	const entryMap = createEntryMap(entryPath, entryType);

	if (!shouldBeMapped(entryMap, cfg)) return null;
	if (entryType === FILE) return entryMap;
	if (entryType === FOLDER) {
		const entries = readdirSync(entryPath);
		const entryName = entryMap.name.toLowerCase();
		const subOpts = getSubFolderOpts(entryName, cfg);
		const entriesObj = mapEntriesSync(entryPath, entries, subOpts || opts);

		if (cfg.skipEmpty && !Object.keys(entriesObj).length) return null;
		if (entriesObj) entryMap.entries = entriesObj;

		return entryMap;
	}
}

function mapEntries (parentPath, entries, opts) {
	if (!entries.length) return {};
	const entriesObj = {};

	const promises = entries.map((entryName) => {
		const entryPath = join(parentPath, entryName);

		return mapEntry(entryPath, opts).then((entryMap) => {
			if (entryMap) entriesObj[entryName] = entryMap;
		});
	});

	return Promise.all(promises).then(() => entriesObj);
}

function mapEntriesSync (parentPath, entries, opts) {
	if (!entries.length) return {};
	const entriesObj = {};

	entries.forEach((entryName) => {
		const entryPath = join(parentPath, entryName);
		const entryMap = mapEntrySync(entryPath, opts);

		if (entryMap) entriesObj[entryName] = entryMap;
	});

	return entriesObj;
}

async function getEntryType (entryPath) {
	const statObj = await getStat(entryPath);
	const isFolder = statObj.isDirectory();

	return isFolder ? FOLDER : FILE;
}

function getEntryTypeSync (entryPath) {
	const statObj = statSync(entryPath);
	const isFolder = statObj.isDirectory();

	return isFolder ? FOLDER : FILE;
}

function getSubFolderOpts (entryName, cfg) {
	if (cfg.includeNames && cfg.includeNames.includes(entryName)) {
		if (cfg.includeFolders && cfg.includeFolders.has(entryName)) {
			return cfg.includeFolders.get(entryName);
		}
		return {};
	}

	return null;
}

function createEntryMap (entryPath, entryType) {
	const pathObj = parse(entryPath);

	const {base, name, ext} = pathObj;
	const entryMap = {
		path: entryPath,
		type: entryType,
	};

	if (entryType === FILE) {
		entryMap.name = base;

		// .dotfile
		if (name.startsWith('.') && !ext) {
			entryMap.base = '';
			entryMap.ext = name.substr(1);
		}
		else {
			entryMap.base = name;
			entryMap.ext = ext.substr(1);
		}
	}
	else if (entryType === FOLDER) {
		entryMap.name = base;
	}

	return entryMap;
}

function shouldBeMapped (entryMap, cfg) {
	const {
		filter,
		excludeNames,
		excludeExtensions,
		includeNames,
		includeExtensions,
	} = cfg;

	const defaultRetVal = !(includeNames || includeExtensions);
	const entryName = entryMap.name.toLowerCase();

	if (includeNames && includeNames.includes(entryName)) return true;
	if (excludeNames && excludeNames.includes(entryName)) return false;

	if (entryMap.type === FOLDER) return (filter) ? filter(entryMap) : true;

	const fileExt = entryMap.ext.toLowerCase();

	if (includeExtensions && includeExtensions.includes(fileExt)) return true;
	if (excludeExtensions && excludeExtensions.includes(fileExt)) return false;

	if (filter) return filter(entryMap);

	return defaultRetVal;
}

module.exports.async = mapEntry;
module.exports.sync = mapEntrySync;

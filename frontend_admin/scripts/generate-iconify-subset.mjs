import { spawn } from 'node:child_process';
import { existsSync, watch } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getIcons } from '@iconify/utils';

const require = createRequire(import.meta.url);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(projectRoot, 'src');
const outputPath = join(sourceRoot, 'generated', 'iconify-icons.json');
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const ignoredDirectories = new Set(['.umi', '.umi-production', 'generated']);

const iconSets = {
  solar: () => require('@iconify-json/solar/icons.json'),
  tabler: () => require('@iconify-json/tabler/icons.json'),
};

const iconReferencePattern = new RegExp(
  `\\b(${Object.keys(iconSets).join('|')}):([a-z0-9]+(?:-[a-z0-9]+)*)\\b`,
  'g',
);

function shouldScanFile(filePath) {
  const fileName = filePath.split(sep).at(-1) ?? '';
  return (
    sourceExtensions.has(extname(filePath)) &&
    !fileName.endsWith('.d.ts') &&
    !fileName.includes('.test.') &&
    !fileName.includes('.spec.')
  );
}

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name) && entry.name !== '__tests__') {
        files.push(...(await listSourceFiles(entryPath)));
      }
    } else if (entry.isFile() && shouldScanFile(entryPath)) {
      files.push(entryPath);
    }
  }

  return files;
}

export function extractIconReferences(source) {
  const references = new Map(
    Object.keys(iconSets).map((prefix) => [prefix, new Set()]),
  );

  for (const match of source.matchAll(iconReferencePattern)) {
    references.get(match[1])?.add(match[2]);
  }

  return references;
}

async function collectIconReferences() {
  const references = new Map(
    Object.keys(iconSets).map((prefix) => [prefix, new Set()]),
  );
  const files = await listSourceFiles(sourceRoot);

  for (const filePath of files) {
    const source = await readFile(filePath, 'utf8');
    const fileReferences = extractIconReferences(source);
    for (const [prefix, names] of fileReferences) {
      const target = references.get(prefix);
      for (const name of names) {
        target?.add(name);
      }
    }
  }

  return references;
}

export function buildIconSubsets(references) {
  const subsets = [];

  for (const [prefix, namesSet] of references) {
    const names = [...namesSet].sort();
    if (names.length === 0) {
      continue;
    }

    const iconSet = iconSets[prefix]();
    const missing = names.filter(
      (name) => !iconSet.icons[name] && !iconSet.aliases?.[name],
    );
    if (missing.length > 0) {
      throw new Error(
        `图标集 ${prefix} 中不存在以下图标：${missing.join(', ')}`,
      );
    }

    const subset = getIcons(iconSet, names);
    if (!subset) {
      throw new Error(`无法生成图标集 ${prefix} 的离线子集`);
    }
    subsets.push(subset);
  }

  return subsets;
}

export async function generateIconSubsets() {
  const references = await collectIconReferences();
  const subsets = buildIconSubsets(references);
  const output = `${JSON.stringify(subsets, null, 2)}\n`;
  const iconCount = [...references.values()].reduce(
    (total, names) => total + names.size,
    0,
  );

  let currentOutput = '';
  try {
    currentOutput = await readFile(outputPath, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }

  if (currentOutput !== output) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output, 'utf8');
    console.info(`已生成 ${iconCount} 个 Iconify 离线图标`);
  } else {
    console.info(`Iconify 离线图标无变化，共 ${iconCount} 个`);
  }
}

function isRelevantWatchPath(fileName) {
  if (!fileName) {
    return true;
  }
  const normalized = String(fileName).split(sep).join('/');
  const pathSegments = normalized.split('/');
  return (
    !pathSegments.some(
      (segment) =>
        ignoredDirectories.has(segment) || segment === '__tests__',
    ) &&
    shouldScanFile(normalized)
  );
}

async function watchIconSubsets(childCommand) {
  let generationTimer;
  let generationRunning = false;
  let generationPending = false;

  const runGeneration = async () => {
    if (generationRunning) {
      generationPending = true;
      return;
    }

    generationRunning = true;
    try {
      await generateIconSubsets();
    } catch (error) {
      console.error(error);
    } finally {
      generationRunning = false;
      if (generationPending) {
        generationPending = false;
        void runGeneration();
      }
    }
  };

  const watcher = watch(
    sourceRoot,
    { recursive: true },
    (_eventType, fileName) => {
      if (!isRelevantWatchPath(fileName)) {
        return;
      }
      clearTimeout(generationTimer);
      generationTimer = setTimeout(() => void runGeneration(), 80);
    },
  );

  console.info('正在监听 Iconify 图标引用变化');

  if (childCommand.length === 0) {
    return;
  }

  const childEnv = { ...process.env };
  let commandIndex = 0;
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(childCommand[commandIndex] ?? '')) {
    const assignment = childCommand[commandIndex];
    const equalsIndex = assignment.indexOf('=');
    childEnv[assignment.slice(0, equalsIndex)] = assignment.slice(equalsIndex + 1);
    commandIndex += 1;
  }

  const command = childCommand[commandIndex];
  if (!command) {
    watcher.close();
    throw new Error('监听模式缺少需要启动的子命令');
  }

  const localExecutable = join(
    projectRoot,
    'node_modules',
    '.bin',
    command,
  );
  const executable = existsSync(localExecutable)
    ? localExecutable
    : command;
  const child = spawn(executable, childCommand.slice(commandIndex + 1), {
    cwd: projectRoot,
    env: childEnv,
    stdio: 'inherit',
  });

  const stopChild = (signal) => {
    watcher.close();
    if (!child.killed) {
      child.kill(signal);
    }
  };
  process.once('SIGINT', () => stopChild('SIGINT'));
  process.once('SIGTERM', () => stopChild('SIGTERM'));

  await new Promise((resolveExit, rejectExit) => {
    child.once('error', (error) => {
      watcher.close();
      rejectExit(error);
    });
    child.once('exit', (code, signal) => {
      watcher.close();
      process.exitCode = code ?? (signal ? 1 : 0);
      resolveExit();
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const separatorIndex = args.indexOf('--');
  const watchMode = args.includes('--watch');
  const childCommand = separatorIndex === -1 ? [] : args.slice(separatorIndex + 1);

  await generateIconSubsets();
  if (watchMode) {
    await watchIconSubsets(childCommand);
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

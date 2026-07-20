import fs from 'fs';
import path from 'path';
import { Project, type SourceFile } from 'ts-morph';
import fg from 'fast-glob';
import type {
  DefinitionEntry,
  DependencyEntry,
  AstChunk,
  ManifestFile,
  AnalysisResult,
  DefinitionKind,
} from '../types.js';
import { hashFile } from '../utils/hash.js';
import { estimateTokens } from '../utils/tokens.js';

const SOURCE_GLOB = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.mjs'];
const IGNORE_GLOB = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.git/**',
  '**/*.d.ts',
  '**/*.test.ts',
  '**/*.spec.ts',
];

let chunkCounter = 0;
function nextChunkId(): string {
  return `chunk_${String(++chunkCounter).padStart(5, '0')}`;
}

export class Analyzer {
  private readonly sourceRoot: string;
  private readonly maxChunkTokens: number;

  constructor(sourceRoot: string, maxChunkTokens: number) {
    this.sourceRoot = path.resolve(sourceRoot);
    this.maxChunkTokens = maxChunkTokens;
    chunkCounter = 0;
  }

  async analyze(targetFiles?: string[]): Promise<AnalysisResult> {
    const filePaths = targetFiles ?? (await this.discoverFiles());
    const project = this.buildProject(filePaths);
    const sourceFiles = project.getSourceFiles();

    const definitions: DefinitionEntry[] = [];
    const dependencies: DependencyEntry[] = [];
    const chunks: AstChunk[] = [];
    const files: ManifestFile[] = [];

    for (const sf of sourceFiles) {
      const absPath = sf.getFilePath();
      const relPath = path.relative(this.sourceRoot, absPath);

      // skip files outside source root
      if (relPath.startsWith('..')) continue;

      const stat = fs.statSync(absPath);
      files.push({
        path: relPath,
        hash: hashFile(absPath),
        size: stat.size,
        lastModified: stat.mtime.toISOString(),
      });

      definitions.push(...this.extractDefinitions(sf, relPath));
      dependencies.push(...this.extractDependencies(sf, relPath));
      chunks.push(...this.extractChunks(sf, relPath));
    }

    // Sort deterministically
    files.sort((a, b) => a.path.localeCompare(b.path));
    definitions.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name));
    dependencies.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
    chunks.sort((a, b) => a.file.localeCompare(b.file) || a.startLine - b.startLine);

    return { definitions, dependencies, chunks, files };
  }

  private async discoverFiles(): Promise<string[]> {
    const found = await fg(SOURCE_GLOB, {
      cwd: this.sourceRoot,
      ignore: IGNORE_GLOB,
      absolute: true,
      onlyFiles: true,
    });
    return found.sort();
  }

  private buildProject(filePaths: string[]): Project {
    const tsconfigPath = path.join(this.sourceRoot, 'tsconfig.json');
    const project = fs.existsSync(tsconfigPath)
      ? new Project({ tsConfigFilePath: tsconfigPath, skipAddingFilesFromTsConfig: true })
      : new Project({ compilerOptions: { allowJs: true } });

    for (const fp of filePaths) {
      project.addSourceFileAtPath(fp);
    }
    return project;
  }

  private extractDefinitions(sf: SourceFile, relPath: string): DefinitionEntry[] {
    const entries: DefinitionEntry[] = [];

    const pushEntry = (
      kind: DefinitionKind,
      name: string,
      exported: boolean,
      startLine: number,
      endLine: number,
    ): void => {
      const lines = sf.getFullText().split('\n');
      const text = lines.slice(startLine - 1, endLine).join('\n');
      entries.push({ file: relPath, kind, name, exported, startLine, endLine, text });
    };

    for (const decl of sf.getClasses()) {
      pushEntry('class', decl.getName() ?? '<anonymous>', decl.isExported(), decl.getStartLineNumber(), decl.getEndLineNumber());
    }
    for (const decl of sf.getInterfaces()) {
      pushEntry('interface', decl.getName(), decl.isExported(), decl.getStartLineNumber(), decl.getEndLineNumber());
    }
    for (const decl of sf.getTypeAliases()) {
      pushEntry('type', decl.getName(), decl.isExported(), decl.getStartLineNumber(), decl.getEndLineNumber());
    }
    for (const decl of sf.getFunctions()) {
      pushEntry('function', decl.getName() ?? '<anonymous>', decl.isExported(), decl.getStartLineNumber(), decl.getEndLineNumber());
    }
    for (const decl of sf.getEnums()) {
      pushEntry('enum', decl.getName(), decl.isExported(), decl.getStartLineNumber(), decl.getEndLineNumber());
    }
    for (const decl of sf.getVariableStatements()) {
      const exported = decl.isExported();
      for (const v of decl.getDeclarations()) {
        pushEntry('variable', v.getName(), exported, decl.getStartLineNumber(), decl.getEndLineNumber());
      }
    }

    return entries;
  }

  private extractDependencies(sf: SourceFile, relPath: string): DependencyEntry[] {
    const entries: DependencyEntry[] = [];

    for (const imp of sf.getImportDeclarations()) {
      const moduleSpec = imp.getModuleSpecifierValue();
      if (!moduleSpec.startsWith('.')) continue; // skip external

      const namedImports = imp.getNamedImports().map((n) => n.getName());
      const defaultImport = imp.getDefaultImport()?.getText();
      const symbols = defaultImport ? [defaultImport, ...namedImports] : namedImports;

      entries.push({ from: relPath, to: moduleSpec, kind: 'import', symbols });
    }

    return entries;
  }

  private extractChunks(sf: SourceFile, relPath: string): AstChunk[] {
    const chunks: AstChunk[] = [];
    const lines = sf.getFullText().split('\n');

    // Try to chunk by top-level declarations first
    const declarations = [
      ...sf.getClasses().map((d) => ({ kind: 'class', name: d.getName() ?? null, start: d.getStartLineNumber(), end: d.getEndLineNumber() })),
      ...sf.getFunctions().map((d) => ({ kind: 'function', name: d.getName() ?? null, start: d.getStartLineNumber(), end: d.getEndLineNumber() })),
      ...sf.getInterfaces().map((d) => ({ kind: 'interface', name: d.getName(), start: d.getStartLineNumber(), end: d.getEndLineNumber() })),
    ].sort((a, b) => a.start - b.start);

    if (declarations.length === 0) {
      // chunk the whole file
      chunks.push(...this.chunkLines(lines, relPath, 'file', null, 1));
    } else {
      for (const decl of declarations) {
        const declLines = lines.slice(decl.start - 1, decl.end);
        chunks.push(...this.chunkLines(declLines, relPath, decl.kind, decl.name, decl.start));
      }
    }

    return chunks;
  }

  private chunkLines(
    lines: string[],
    file: string,
    kind: string,
    name: string | null,
    startOffset: number,
  ): AstChunk[] {
    const maxChars = this.maxChunkTokens * 4;
    const chunks: AstChunk[] = [];

    let bufferLines: string[] = [];
    let bufferStart = startOffset;

    const flush = (): void => {
      if (bufferLines.length === 0) return;
      const content = bufferLines.join('\n');
      chunks.push({
        id: nextChunkId(),
        file,
        startLine: bufferStart,
        endLine: bufferStart + bufferLines.length - 1,
        estimatedTokens: estimateTokens(content),
        content,
        kind,
        name,
      });
      bufferLines = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const nextLen = (bufferLines.join('\n') + '\n' + line).length;

      if (bufferLines.length > 0 && nextLen > maxChars) {
        flush();
        bufferStart = startOffset + i;
      }

      if (bufferLines.length === 0) bufferStart = startOffset + i;
      bufferLines.push(line);
    }
    flush();

    return chunks;
  }
}

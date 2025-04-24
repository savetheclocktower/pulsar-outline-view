import type { TextEditor, Point, Range as AtomRange } from 'atom';
type MaybePromise<T> = T | Promise<T>;
export type SymbolPosition = {
    position: Point;
};
export type SymbolRange = {
    range: AtomRange;
};
export type SymbolDirectoryAndFile = {
    file: string;
    directory: string;
};
export type SymbolPath = {
    path: string;
};
export type FileSymbol = (SymbolPosition | SymbolRange) & {
    name: string;
    shortName?: string;
    tag?: string;
    context?: string;
    icon?: string;
    signature?: string;
    source?: string;
};
type ProjectSymbol = FileSymbol & (SymbolDirectoryAndFile | SymbolPath);
export type SymbolMeta = {
    type: 'file' | 'project' | 'project-find';
    editor: TextEditor;
    query?: string;
    signal: AbortSignal;
    timeoutMs?: number;
};
type FileSymbolMeta = SymbolMeta & {
    type: 'file';
};
type ProjectSymbolMeta = SymbolMeta & {
    type: 'project' | 'project-find';
};
export type PreliminarySymbolMeta = Omit<SymbolMeta, 'signal'>;
export interface SymbolProvider {
    name: string;
    packageName: string;
    destroy?(): void;
    onShouldClearCache?(callback: () => TextEditor): void;
    isExclusive?: boolean;
    canProvideSymbols(meta: PreliminarySymbolMeta): MaybePromise<boolean | number>;
    getSymbols(meta: FileSymbolMeta): MaybePromise<FileSymbol[] | null>;
    getSymbols(meta: ProjectSymbolMeta): MaybePromise<ProjectSymbol[] | null>;
}
export {};

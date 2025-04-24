
import type { TextEditor, Point, Range as AtomRange } from 'atom';

type MaybePromise<T> = T | Promise<T>;

export type SymbolPosition = {
  // An instance of `Point` describing the symbol's location. The `column`
  // value of the point may be ignored, depending on the user's settings. At
  // least one of `position` and `range` must exist.
  position: Point;
};

export type SymbolRange = {
  // An exact range describing the bounds of a given token. If present, might
  // be used to highlight the token when selected by the user, though that
  // depends on the user's settings. At least one of `position` and `range`
  // must exist.
  range: AtomRange
};

export type SymbolDirectoryAndFile = {
  // The name of the file that contains the symbol. Will be shown in the UI.
  file: string,
  // The path of to the directory of the file that contains the symbol. Should
  // not contain the file name.
  directory: string
};

export type SymbolPath = {
  // The full path to the file that contains the symbol.
  path: string
};

export type FileSymbol = (SymbolPosition | SymbolRange) & {
  // The name of the symbol. This value will be shown in the UI and will be
  // filtered against if the user types in the text box. Required.
  name: string,

  // A short name for a symbol. A consumer can choose to display this value in
  // the UI instead of `name`. This should describe the bare identifier without
  // any other decoration. If this would be identical to `name`, you may omit
  // it.
  shortName?: string,

  // A word representing the symbol in some way. Typically this would describe
  // the symbol — function, constant, et cetera — but can be used however the
  // provider sees fit. If present, will be included in the symbol list as a
  // badge.
  tag?: string

  // A _short_ string of explanatory text. Optional. Can be used for text that
  // is contexually significant to the symbol; for instance, a method or field
  // might describe the class that owns it. Symbol consumers will expect this
  // field to be short, and will not devote much space to it in the interface,
  // so this field _should not_ contain unbounded text.
  //
  // If this text refers to the name of another symbol, it should match either
  // `name` or `shortName` of the other symbol. This gives consumers a way to
  // infer hierarchical relationships.
  context?: string,

  // A string that represents an icon. This will typically take the form of a
  // class name that starts with `icon-`, but not always, so be sure to specify
  // the `icon-` part.
  //
  // If the consumer chooses to use the icon when rendering its UI, this string
  // will be used as a class name. All of the icons provided by Atom's built-in
  // Octicons will be available; other icons may be available depending on the
  // user's installed packages and themes.
  icon?: string,

  // POSSIBLE ENHANCEMENTS (UNIMPLEMENTED!):
  //
  // I don't necessarily find these useful myself, or at least not useful
  // enough to warrant their inclusion in a space-constrained list of symbols,
  // but some people might want these to be present.

  // A description of the symbol in code or pseudocode. For functions, this
  // could be a function signature, along with parameter names and (if known)
  // types.
  //
  // This field would receive its own line in a symbol list.
  signature?: string

  // The literal line of code containing the symbol. A symbol consumer could
  // try to retrieve this information itself, but some symbol providers would
  // be able to supply it much more simply.
  //
  // This field would receive its own line in a symbol list.
  source?: string
};

type ProjectSymbol = FileSymbol & (SymbolDirectoryAndFile | SymbolPath);

export type SymbolMeta = {
  // The type of action being performed:
  //
  // * `file`: A symbol search within the current file.
  // * `project`: A project-wide symbol search.
  // * `project-find`: A project-wide attempt to resolve a reference based on
  //    (a) the position of the cursor, (b) the value of the editor's current
  //    text selection, or (c) whatever word was clicked on in the IDE.
  type: 'file' | 'project' | 'project-find',

  // The current text editor.
  editor: TextEditor,

  // The relevant search term, if any.
  //
  // When `type` is `project`, this will represent the text that the
  // user has typed into a search field in order to filter the list of symbols.
  //
  // When `type` is `project-find`, this will represent the text that the IDE
  // wants to resolve.
  query?: string,

  // An `AbortSignal` that represents whether the user has cancelled the task.
  // This will happen if the user cancels out of the symbol UI while waiting
  // for symbols, or if they type a new character in the query field before the
  // results have returned for the previous typed character.
  //
  // If the provider goes async at any point, it should check the signal after
  // resuming. If the signal has aborted, the provider should immediately
  // return/resolve with `null` and avoid doing unnecessary further work.
  signal: AbortSignal,

  // The amount of time, in milliseconds, the provider has before it must
  // return results. This value is configurable by the user. If the provider
  // doesn't return anything after this amount of time, it will be ignored.
  //
  // This value is given to providers so that they can act wisely when faced
  // with a choice between “search for more symbols” and “return what we have.”
  //
  // The `timeoutMs` property is only present when the appropriate symbol list
  // UI is not present. Its purpose is to show the UI within a reasonable
  // amount of time. If the UI is already present — for instance, when
  // winnowing results in a project-wide symbol search — `timeoutMs` will be
  // omitted, and the provider can take as much time as it deems appropriate.
  timeoutMs?: number
};

type FileSymbolMeta = SymbolMeta & { type: 'file' };
type ProjectSymbolMeta = SymbolMeta & { type: 'project' | 'project-find' };

// Symbol metadata that will be passed to the `canProvideSymbols` method.
export type PreliminarySymbolMeta = Omit<SymbolMeta, 'signal'>;

export interface SymbolProvider {
  name: string,
  packageName: string,
  destroy?(): void,

  // An optional method. If it exists, the main package will register a
  // callback so that it can clear the cache of this provider's symbols.
  //
  // The main package will automatically clear its cache for these reasons:
  //
  // * when the main package's config changes (entire cache);
  // * when any provider is activated or deactivated (single provider's cache);
  // * when the buffer is modified in any of several ways, including grammar
  //   change, save, or buffer change (entire cache).
  //
  // If your provider may have its cache invalidated for reasons not in this
  // list, you should implement `onShouldClearCache` and invoke any callback
  // that registers for it. The `EventEmitter` pattern found throughout Pulsar
  // is probably how you want to pull this off.
  onShouldClearCache?(callback: () => TextEditor): void,

  // Whether this provider aims to be the main symbol provider for a given
  // file. The “exclusive” provider competes with the other workhorse providers
  // of symbols like `ctags` and Tree-sitter to offer typical symbols like
  // classes, method names, and the like. A maximum of one exclusive provider
  // will be chosen for any task, depending on which one scores highest.
  //
  // “Supplemental” providers are those that contribute more specialized kinds
  // of symbols. These providers generally do not compete with exclusive
  // providers, or with each other, and can add symbols to any exclusive
  // provider’s results.
  isExclusive?: boolean,

  // Indicates whether the provider can provide symbols for a given task. Can
  // return either a boolean or a number; boolean `true` is equivalent to a
  // score of `1`, and boolean `false` is equivalent to a score of `0`.
  //
  // This method receives the same metadata bundle that will be present in the
  // subsequent call to `getSymbols`. The provider can inspect this metadata
  // and decide whether it can fulfill the given symbols request.
  //
  // Examples:
  //
  // * A provider that can analyze the current file, but not the entire
  //   project, should return `false` for any requests where `type` does not
  //   equal `file`.
  // * A provider that works by analyzing code on disk, rather than looking at
  //   the current unsaved contents of buffers, could return a slightly lower
  //   score if asked to complete symbols for a file that has been modified.
  //   This would indicate that it’d be slightly worse than usual candidate.
  //
  // Since language server providers will have to ask their servers about
  // capabilities, this method can go async, though it’s strongly suggested to
  // keep it synchronous if possible.
  //
  // In general, providers are encouraged not to return any scores higher than
  // `1`, and to allow the user to break ties among providers by choosing their
  // preferred providers in the package settings.
  canProvideSymbols(meta: PreliminarySymbolMeta): MaybePromise<boolean | number>,

  // Returns a list of symbols.
  //
  // If there are no results, you should return an empty array. If the request
  // is invalid or cannot be completed — for instance, if the user cancels the
  // task — you should return `null`.
  //
  // This method can go async if needed.
  getSymbols(meta: FileSymbolMeta): MaybePromise<FileSymbol[] | null>,
  getSymbols(meta: ProjectSymbolMeta): MaybePromise<ProjectSymbol[] | null>
}

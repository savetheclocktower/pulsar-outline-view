"use babel";

import { TextEditor } from 'atom';

import { waitFor, wait } from './async-spec-helpers';
import OutlinePackage from "../dist/main";
import outlineMock from "./outline-mock.json";

function createMockProvider() {
  return {
    grammarScopes: ['text.plain.null-grammar'],
    getOutline: () => outlineMock,
  };
}

function viewHasSymbols(viewEl) {
  return !viewEl.querySelector('ul')?.classList.contains('background-message');
}

describe("Outline view", () => {
  let workspaceElement;

  beforeEach(async () => {
    workspaceElement = atom.views.getView(atom.workspace);

    atom.packages.triggerDeferredActivationHooks();
    atom.packages.triggerActivationHook("core:loaded-shell-environment");
    await atom.packages.activatePackage("pulsar-outline-view");

    expect(atom.packages.isPackageLoaded("pulsar-outline-view")).toBeTruthy();
    spyOn(OutlinePackage.broker, "chooseProviderForEditor").and.returnValue(createMockProvider());
  });

  describe("getOutline", () => {
    let editor;
    let outlineView;

    beforeEach(async () => {
      atom.config.set("outline.sortEntries", false);
      editor = atom.workspace.open();
      outlineView = OutlinePackage.getOutlineView(editor);
      await outlineView.show();
      await waitFor(() => viewHasSymbols(outlineView.element));
    });

    it("renders outline into HTML", () => {
      const rootRecords = outlineView.element.querySelectorAll("li.outline-view-option");
      expect(outlineView.element.children.length > 0).toEqual(true);
      expect(rootRecords.length).toEqual(3);
    });

    it("nests lists for records with children", () => {
      const recordWithoutChildren = outlineView.element.querySelector("ul.outline-list > li:nth-child(1) > ul");
      const recordWithChildren = outlineView.element.querySelector("ul.outline-list > li:nth-child(2) > ul");

      expect(recordWithoutChildren).toEqual(null);
      expect(Boolean(recordWithChildren)).toEqual(true);
    });

    it("generates icon and label for an entry", () => {
      const recordContentHolder = outlineView.element.querySelector("ul.outline-list > li .name-inner");

      expect(recordContentHolder.textContent).toEqual("primaryFunction");
      expect(recordContentHolder.parentNode.classList.contains('icon-gear')).toBe(true);
    });

    it("provides fallback for entries without icons", () => {
      const recordContentHolder = outlineView.element.querySelector("ul.outline-list > li:nth-child(3) .name-inner");
      expect(recordContentHolder?.parentNode.className.includes('icon-')).toBe(false);
    });
  });
});

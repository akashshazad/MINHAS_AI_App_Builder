
import { describe, expect, it } from "vitest";
import { threeWayMerge } from "./merge";

describe("three-way merge", () => {
  it("accepts independent changes", () => {
    const base=[{path:"a.ts",content:"one\ntwo"}];
    const ours=[{path:"a.ts",content:"ONE\ntwo"}];
    const theirs=[{path:"a.ts",content:"one\nTWO"}];
    const result=threeWayMerge(base,ours,theirs);
    expect(result.clean).toBe(true); expect(result.files[0].content).toBe("ONE\nTWO");
  });
  it("reports concurrent changes instead of overwriting", () => {
    const base=[{path:"a.ts",content:"one"}];
    const ours=[{path:"a.ts",content:"ours"}];
    const theirs=[{path:"a.ts",content:"theirs"}];
    const result=threeWayMerge(base,ours,theirs);
    expect(result.clean).toBe(false); expect(result.conflicts[0].path).toBe("a.ts");
  });
  it("handles added and deleted files", () => {
    const result=threeWayMerge([{path:"old.ts",content:"x"}],[],[{path:"new.ts",content:"y"}]);
    expect(result.clean).toBe(true); expect(result.files).toEqual([{path:"new.ts",content:"y"}]);
  });
});

describe("three-way merge insert/delete semantics", () => {
  it("merges an insertion on one side with an edit on another", () => {
    const base=[{path:"a.ts",content:"one\ntwo\nthree"}];
    const ours=[{path:"a.ts",content:"one\nINSERTED\ntwo\nthree"}];
    const theirs=[{path:"a.ts",content:"one\nTWO\nthree"}];
    const result=threeWayMerge(base,ours,theirs);
    expect(result.clean).toBe(true);
    expect(result.files[0].content).toBe("one\nINSERTED\nTWO\nthree");
  });
  it("blocks overlapping replacement edits", () => {
    const base=[{path:"a.ts",content:"one\ntwo\nthree"}];
    const ours=[{path:"a.ts",content:"one\nOURS\nthree"}];
    const theirs=[{path:"a.ts",content:"one\nTHEIRS\nthree"}];
    expect(threeWayMerge(base,ours,theirs).clean).toBe(false);
  });
});



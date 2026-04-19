export function contentEquals<T>(
    a: T[], b: T[],
    equals: (a: T, b: T) => boolean = (a, b) => a === b) {
    if (a.length !== b.length) {
      return false;
    }
    const copy = [...a];
    for (let e of b) {
      const idx = copy.findIndex(c => equals(c, e));
      if (idx === -1) {
        return false;
      }
      copy.splice(idx, 1);
    }
    return true;
  }

export const toPlain = <T extends { _id: { toString(): string } }>(document: T | null) => {
  if (!document) {
    return null;
  }

  const plain = JSON.parse(JSON.stringify(document));
  plain.id = document._id.toString();
  delete plain._id;
  delete plain.__v;
  return plain;
};

export const toPlainList = <T extends { _id: { toString(): string } }>(documents: T[]) =>
  documents.map((document) => toPlain(document));

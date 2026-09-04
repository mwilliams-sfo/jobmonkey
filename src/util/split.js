
const reSingleQuoted = /^'([^']*)'?/;
const reDoubleQuoted = /^"([^"]*)"?/;
const reAtom = /^(\S*)/;

export const splitTerms = str => {
  const terms = [];
  while (str = str.trimStart()) {
    const re =
      str.startsWith('\'') ? reSingleQuoted :
      str.startsWith('"') ? reDoubleQuoted :
      reAtom;
    const match = re.exec(str);
    terms.push(match[1]);
    str = str.substr(match[0].length);
  }
  return terms;
};

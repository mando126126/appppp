// Laufzeit-Kontext: wer bin ich, wohin navigieren. Getrennt von app.js,
// damit die Ansichten keine zirkulären Importe brauchen.

export const session = {
  config: null,          // { url, key, room, me, nameA, nameB }
  get me() { return this.config?.me || 'a'; },
  get partner() { return this.me === 'a' ? 'b' : 'a'; },
  navigate: () => {},    // wird von app.js gesetzt
  refresh: () => {},
};

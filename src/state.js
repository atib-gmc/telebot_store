// state.js → Tempat simpan data yang dipakai bersama antar file

// userData: Map yang nyimpen info setiap user yang pernah chat
// Dipakai di handler.js untuk tracking dan di commands.js untuk /stats
export const userData = new Map();

// setorSessions: Map yang nyimpen user yang sedang dalam mode /setor
// Format session: { step: 'account' } atau { step: 'price', accountId, level, isNew }
// Dipakai di commands.js dan handler.js untuk mengontrol alur setor
export const setorSessions = new Map();

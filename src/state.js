// state.js → Tempat simpan data yang dipakai bersama antar file

// userData: Map yang nyimpen info setiap user yang pernah chat
// Dipakai di handler.js untuk tracking dan di commands.js untuk /stats
export const userData = new Map();

export const setorSessions = new Map();

export const wdSessions = new Map();

export const adminSessions = new Map();

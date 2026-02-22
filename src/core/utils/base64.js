function b64Decode(str) {
    try {
        str = str.trim().replace(/\s/g, '');
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        const pad = str.length % 4;
        if (pad) str += '='.repeat(4 - pad);
        return decodeURIComponent(escape(atob(str)));
    } catch (e) {
        return null;
    }
}

function b64Encode(str) {
    try {
        return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
        return btoa(str);
    }
}

module.exports = {
    b64Decode,
    b64Encode
};

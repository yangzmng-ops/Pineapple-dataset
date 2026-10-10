/* Pure policy and state machine: also loaded as Core.gs in Apps Script. */
var PineappleCore = (function () {
  'use strict';
  function email(s) { return String(s || '').trim().toLowerCase(); }
  function decide(a, blocked) {
    if (blocked) return 'MANUAL_BLOCKED';
    if (!a.verified || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email(a.email))) return 'INCOMPLETE';
    if (['name','institution','identity','purpose'].some(k => !String(a[k] || '').trim())) return 'INCOMPLETE';
    if (a.consent !== 'I agree') return 'NO_CONSENT';
    if (![a.academic,a.commercial,a.redistribution].every(v => ['Yes','No','Unsure'].includes(v))) return 'INCOMPLETE';
    // Conservative keyword triage only, not a semantic or identity verifier.
    if (/commercial|for[- ]profit|resell|redistribut|sell(?:ing)?|商用|商业|销售|售卖|再分发|转售|分享数据/i.test(a.purpose)) return 'MANUAL';
    return a.academic === 'Yes' && a.commercial === 'No' && a.redistribution === 'No' ? 'ELIGIBLE' : 'MANUAL';
  }
  function advance(r, ctx, io) {
    if (ctx.blocked) { r.review = 'MANUAL_BLOCKED'; return r; }
    if (r.review !== 'ELIGIBLE' || !ctx.live || !ctx.policyReady || r.mode !== 'LIVE' || r.created < ctx.liveSince) return r;
    if (r.permission === 'EXISTING' || r.notification === 'SENT' || r.notification === 'UNCERTAIN' || r.permission === 'NEEDS_OPERATOR') return r;
    // Verify actual access before every retry. Never lower existing editor/owner privileges.
    var actual = io.access(r.email);
    if (actual !== 'NONE') {
      if (r.permission !== 'ATTEMPTING' && r.permission !== 'GRANTED') { r.permission = 'EXISTING'; io.save(r); return r; }
      r.permission = 'GRANTED'; io.save(r);
    } else if (r.permission === 'GRANTED') {
      r.permission = 'REVOKED'; r.review = 'MANUAL_BLOCKED'; io.block(r.email); io.save(r); return r;
    } else if (r.permission === 'ATTEMPTING') {
      // Unknown result could have been granted and later revoked: never restore blindly.
      r.permission = 'NEEDS_OPERATOR'; r.review = 'MANUAL_UNCERTAIN'; io.save(r); return r;
    } else {
      r.permission = 'ATTEMPTING'; io.save(r); // durable intent before remote mutation
      io.grant(r.email); r.permission = 'GRANTED'; io.save(r);
    }
    if (!ctx.notify || io.quota() < 1) { r.notification = 'PENDING_QUOTA'; io.save(r); return r; }
    if (r.notification === 'SENDING') { r.notification = 'UNCERTAIN'; io.save(r); return r; }
    r.notification = 'SENDING'; io.save(r); // no blind email retry after ambiguous send
    try { io.send(r.email); r.notification = 'SENT'; io.save(r); }
    catch (err) { r.notification = 'UNCERTAIN'; io.save(r); throw err; }
    return r;
  }
  return {email:email, decide:decide, advance:advance};
})();
if (typeof module !== 'undefined') module.exports = PineappleCore;

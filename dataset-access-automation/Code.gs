/* Pineapple dataset access. No action occurs until owner runs setup explicitly. */
const TARGET_FILE_ID = '1gy-sYSPqZZ_yMpRZ_ciyWj58GbsVeiwe';
const FIELDS = {name:'Full name', institution:'Institution', identity:'Role / identity', purpose:'Research project and purpose', academic:'Academic research?', commercial:'Commercial use?', redistribution:'Redistribute original data or copies?', consent:'Dataset terms'};
function props_() { return PropertiesService.getScriptProperties(); }
function cfg_() { return JSON.parse(props_().getProperty('CONFIG') || '{}'); }
function locked_(fn) { const l=LockService.getScriptLock(); l.waitLock(20000); try {return fn();} finally {l.releaseLock();} }
function api_(url,method,payload) {
  const options={method:method || 'get',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true};
  if(payload) {options.contentType='application/json'; options.payload=JSON.stringify(payload);}
  const res=UrlFetchApp.fetch(url,options), status=res.getResponseCode();
  if(status<200 || status>=300) { let reason=''; try {reason=JSON.parse(res.getContentText()).error.errors[0].reason || '';} catch(_) {} throw new Error('HTTP '+status+' '+reason.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80)); }
  return JSON.parse(res.getContentText() || '{}');
}
function formApi_(id) { return 'https://forms.googleapis.com/v1/forms/'+encodeURIComponent(id); }
function setup() {
  return locked_(() => {
    if(props_().getProperty('CONFIG')) throw new Error('Already initialized. Inspect existing CONFIG; do not duplicate installation.');
    // Persist IDs as created, so a partial failure never silently creates replacements.
    const c={mode:'DRY_RUN',policyReady:false,notify:false,termsVersion:'',termsUrl:'',ownerEmail:'',liveSince:0};
    props_().setProperty('CONFIG',JSON.stringify(c));
    const ss=SpreadsheetApp.create('Pineapple dataset access (private)'); c.sheetId=ss.getId(); props_().setProperty('CONFIG',JSON.stringify(c));
    ss.getSheets()[0].setName('Requests').appendRow(['Response ID','Record JSON']);
    ss.insertSheet('Blocks').appendRow(['Email','Status: REJECTED or REVOKED','Reason']);
    const f=FormApp.create('Pineapple dataset access request'); c.formId=f.getId(); props_().setProperty('CONFIG',JSON.stringify(c));
    f.setAcceptingResponses(false); f.setPublishingSummary(false); if(f.supportsAdvancedResponderPermissions()) f.setPublished(false); f.setAllowResponseEdits(false); f.setCollectEmail(true);
    f.setDescription('Not yet open. Dataset terms and privacy information are pending owner review.');
    c.items={};
    Object.keys(FIELDS).forEach(k => {
      let item;
      if(['academic','commercial','redistribution'].includes(k)) item=f.addMultipleChoiceItem().setChoiceValues(['Yes','No','Unsure']);
      else if(k==='consent') item=f.addMultipleChoiceItem().setChoiceValues(['I agree','I do not agree']).setHelpText('TERMS PENDING — do not publish.');
      else item=f.addParagraphTextItem();
      item.setTitle(FIELDS[k]).setRequired(true); c.items[k]=String(item.getId());
    });
    props_().setProperty('CONFIG',JSON.stringify(c));
    api_(formApi_(c.formId)+':batchUpdate','post',{requests:[{updateSettings:{settings:{emailCollectionType:'VERIFIED'},updateMask:'emailCollectionType'}}]});
    Logger.log('Form editor: '+f.getEditUrl()); Logger.log('Private log: '+ss.getUrl());
    return {form:f.getEditUrl(),log:ss.getUrl(),mode:c.mode};
  });
}
function sheet_(name) { return SpreadsheetApp.openById(cfg_().sheetId).getSheetByName(name); }
function records_() { const v=sheet_('Requests').getDataRange().getValues(); return v.slice(1).map((x,i)=>({row:i+2,record:JSON.parse(x[1])})); }
function save_(r) {
  const s=sheet_('Requests'), rows=s.getDataRange().getValues(), i=rows.findIndex((x,n)=>n>0 && String(x[0])===r.id);
  const val=[r.id,JSON.stringify(r)]; if(i<0) s.appendRow(val); else s.getRange(i+1,1,1,2).setValues([val]);
  SpreadsheetApp.flush();
}
function blocked_(email) {return sheet_('Blocks').getDataRange().getValues().slice(1).some(x => PineappleCore.email(x[0])===email && ['REJECTED','REVOKED'].includes(String(x[1]).trim()));}
function block_(email) {if(!blocked_(email)) sheet_('Blocks').appendRow([email,'REVOKED','Previously granted permission was removed']);}
function schema_(c) {
  const f=FormApp.openById(c.formId), info=api_(formApi_(c.formId));
  if(!info.settings || info.settings.emailCollectionType!=='VERIFIED') throw new Error('Verified Google-account email collection required; fail closed.');
  if(f.isPublishingSummary() || f.getEditors().length) throw new Error('Form response summary/edit sharing must be private to owner.');
  privateLog_(c);
  if(f.canEditResponse()) throw new Error('Response edits must be disabled.');
  const expected=Object.values(c.items).sort(), actual=f.getItems().map(i=>String(i.getId())).sort();
  if(JSON.stringify(expected)!==JSON.stringify(actual)) throw new Error('Form schema changed; operator review required.');
  f.getItems().forEach(item => {
    const k=Object.keys(c.items).find(key=>c.items[key]===String(item.getId()));
    if(item.getTitle()!==FIELDS[k]) throw new Error('Question title changed; review required.');
    const choice=['academic','commercial','redistribution','consent'].includes(k);
    if(String(item.getType())!==(choice?'MULTIPLE_CHOICE':'PARAGRAPH_TEXT')) throw new Error('Question type changed.');
    const typed=choice?item.asMultipleChoiceItem():item.asParagraphTextItem();
    if(!typed.isRequired()) throw new Error('Required field changed.');
    if(choice) {
      const expectedChoices=k==='consent'?['I agree','I do not agree']:['Yes','No','Unsure'];
      if(JSON.stringify(typed.getChoices().map(x=>x.getValue()))!==JSON.stringify(expectedChoices) || typed.hasOtherOption()) throw new Error('Question choices changed.');
    }
  });
  if(c.policyReady) {
    const item=f.getItems().find(i=>String(i.getId())===c.items.consent);
    if(item.getHelpText()!==termsText_(c)) throw new Error('Displayed terms differ from approved configuration.');
  }
  return f;
}
function privateLog_(c) {
  let token='';
  do {
    const result=api_('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(c.sheetId)+'/permissions?fields=nextPageToken,permissions(type,role)&pageSize=100'+(token?'&pageToken='+encodeURIComponent(token):''));
    if((result.permissions||[]).some(p=>p.type!=='user' || p.role!=='owner')) throw new Error('Response log must be owner-only.');
    token=result.nextPageToken || '';
  } while(token);
}
function termsText_(c) {return 'Version: '+c.termsVersion+'\n'+c.termsUrl;}
function policyCheck_(c) {
  if(!c.policyReady || !c.termsVersion || !/^https:\/\//.test(c.termsUrl) || !c.ownerEmail) throw new Error('Owner-approved terms/version/email required.');
  const owner=PineappleCore.email(Session.getEffectiveUser().getEmail());
  if(owner!==PineappleCore.email(c.ownerEmail)) throw new Error('Run as the configured owner.');
  const file=DriveApp.getFileById(TARGET_FILE_ID);
  if(!file.getOwner() || PineappleCore.email(file.getOwner().getEmail())!==owner) throw new Error('Target must be owned by configured account; shared-drive deployment needs separate review.');
  if(!/\.zip$/i.test(file.getName())) throw new Error('Target is not a ZIP filename.');
  if(file.getSharingAccess()!==DriveApp.Access.PRIVATE) throw new Error('Target must remain Restricted.');
  let token='';
  do {
    const result=api_('https://www.googleapis.com/drive/v3/files/'+TARGET_FILE_ID+'/permissions?fields=nextPageToken,permissions(type,role)&pageSize=100'+(token?'&pageToken='+encodeURIComponent(token):''));
    if((result.permissions||[]).some(p=>p.type!=='user')) throw new Error('Non-individual target permissions require manual review.');
    token=result.nextPageToken || '';
  } while(token);
  schema_(c);
}
// Run only after reviewing/configuring actual policy; this does not invent licence text.
function configureApprovedTerms() {
  return locked_(() => {
    const c=cfg_();
    // Set these Script Properties only after the owner approves the final text.
    c.termsVersion=props_().getProperty('APPROVED_TERMS_VERSION') || '';
    c.termsUrl=props_().getProperty('APPROVED_TERMS_URL') || '';
    c.ownerEmail=props_().getProperty('APPROVED_OWNER_EMAIL') || '';
    const privacy=props_().getProperty('APPROVED_PRIVACY_NOTICE') || '';
    if(!c.termsVersion || !/^https:\/\//.test(c.termsUrl) || !c.ownerEmail || !privacy) throw new Error('Approved terms, owner email and privacy notice missing.');
    c.mode='DRY_RUN'; c.policyReady=true; c.notify=false; c.liveSince=0;
    const f=FormApp.openById(c.formId); f.setAcceptingResponses(false);
    f.getItems().find(i=>String(i.getId())===c.items.consent).asMultipleChoiceItem().setHelpText(termsText_(c));
    f.setDescription(privacy+'\nAcademic, non-commercial use without redistribution can qualify for automatic access. Other requests require review.');
    props_().setProperty('CONFIG',JSON.stringify(c)); policyCheck_(c);
  });
}
function installDryRunTriggers() {
  return locked_(() => {
    const c=cfg_(); schema_(c);
    if(c.mode!=='DRY_RUN') throw new Error('Switch to dry-run first.');
    const handlers=ScriptApp.getProjectTriggers().map(t=>t.getHandlerFunction());
    if(!handlers.includes('onApplicationSubmit')) ScriptApp.newTrigger('onApplicationSubmit').forForm(c.formId).onFormSubmit().create();
    if(!handlers.includes('retryPending')) ScriptApp.newTrigger('retryPending').timeBased().everyHours(1).create();
  });
}
function enableLive() {
  return locked_(() => {
    const c=cfg_(); policyCheck_(c);
    if(props_().getProperty('ENABLE_CONFIRMATION')!=='ENABLE '+TARGET_FILE_ID) throw new Error('Explicit owner enable confirmation missing.');
    const handlers=ScriptApp.getProjectTriggers().map(t=>t.getHandlerFunction());
    if(!handlers.includes('onApplicationSubmit') || !handlers.includes('retryPending')) throw new Error('Install triggers first.');
    c.mode='LIVE'; c.notify=true; c.liveSince=Date.now(); props_().setProperty('CONFIG',JSON.stringify(c)); props_().deleteProperty('ENABLE_CONFIRMATION');
    // Publishing/respondent access stays an explicit owner UI step.
  });
}
function pauseLive() {return locked_(()=>{const c=cfg_();c.mode='DRY_RUN';c.notify=false;props_().setProperty('CONFIG',JSON.stringify(c));});}
function onApplicationSubmit(e) {
  return locked_(() => {
    const c=cfg_(); if(!e || !e.response || !e.source || e.source.getId()!==c.formId) throw new Error('Expected installed Forms submit event.');
    schema_(c); const response=e.response, id=response.getId();
    if(records_().some(x=>x.record.id===id)) return; // same event never replayed
    const answers={}; response.getItemResponses().forEach(x=>{answers[String(x.getItem().getId())]=x.getResponse();});
    const a={email:PineappleCore.email(response.getRespondentEmail()),verified:true}; Object.keys(c.items).forEach(k=>a[k]=answers[c.items[k]]);
    const r={id:id,email:a.email,created:response.getTimestamp().getTime(),received:Date.now(),mode:c.mode,termsVersion:c.termsVersion,review:PineappleCore.decide(a,blocked_(a.email)),permission:'NONE',notification:'NONE',attempts:0,nextAttempt:0,answers:a};
    // An existing successful request is not permission to re-grant after revocation.
    const prior=records_().map(x=>x.record).find(p=>p.email===r.email && ['GRANTED','EXISTING','REVOKED'].includes(p.permission));
    if(prior) {r.review='DUPLICATE_REVIEW';r.duplicateOf=prior.id;}
    save_(r); if(c.mode==='LIVE') process_(r,c);
  });
}
function process_(r,c) {
  if(r.nextAttempt>Date.now()) return;
  if(r.attempts>=5) {r.review='MANUAL_RETRY_LIMIT';save_(r);throw new Error('Retry limit reached for '+r.id+'; operator review required.');}
  if(r.permission==='NONE') {
    const prior=records_().map(x=>x.record).find(p=>p.id!==r.id && p.email===r.email && p.permission!=='NONE');
    if(prior) {r.review='DUPLICATE_REVIEW';r.duplicateOf=prior.id;save_(r);return;}
  }
  policyCheck_(c); r.attempts++; save_(r);
  try {
    PineappleCore.advance(r,{blocked:blocked_(r.email),live:c.mode==='LIVE',policyReady:c.policyReady && r.termsVersion===c.termsVersion,liveSince:c.liveSince,notify:c.notify},{
      access:email=>{const p=DriveApp.getFileById(TARGET_FILE_ID).getAccess(email);return p===DriveApp.Permission.NONE?'NONE':String(p);},
      // API provides explicit notification=false; custom email has its own durable state.
      grant:email=>api_('https://www.googleapis.com/drive/v3/files/'+TARGET_FILE_ID+'/permissions?sendNotificationEmail=false','post',{type:'user',role:'reader',emailAddress:email}),
      save:save_,block:block_,quota:()=>MailApp.getRemainingDailyQuota(),
      send:email=>MailApp.sendEmail({to:email,subject:'Pineapple dataset access',body:'Your access to the Pineapple dataset is ready. Sign in with this Google account to download:\nhttps://drive.google.com/file/d/'+TARGET_FILE_ID+'/view\nTerms version: '+c.termsVersion+'\n'+c.termsUrl})
    });
    r.lastError=''; if(r.notification==='PENDING_QUOTA') r.attempts=Math.max(0,r.attempts-1); save_(r);
  } catch(err) {
    const msg=String(err); r.lastError=msg.slice(0,500);
    if(/HTTP (429|500|502|503|504)|rate.?limit|too many times/i.test(msg)) r.nextAttempt=Date.now()+Math.min(24,Math.pow(2,r.attempts))*3600000;
    else r.permission=r.permission==='GRANTED'?'GRANTED':'NEEDS_OPERATOR';
    save_(r); throw err; // retain native trigger failure email and Executions record
  }
}
function retryPending() {
  return locked_(() => {
    const c=cfg_(); if(c.mode!=='LIVE') return; const start=Date.now(); policyCheck_(c); const errors=[];
    for(const x of records_()) {
      if(Date.now()-start>240000) break;
      const r=x.record;
      if(r.mode!=='LIVE' || r.review!=='ELIGIBLE' || r.created<c.liveSince || ['SENT','UNCERTAIN'].includes(r.notification) || ['EXISTING','NEEDS_OPERATOR'].includes(r.permission)) continue;
      try{process_(r,c);}catch(err){errors.push(r.id+': '+String(err));}
    }
    if(errors.length) throw new Error(errors.join('\n').slice(0,1500));
  });
}
